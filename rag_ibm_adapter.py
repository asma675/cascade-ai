"""
IBM Cloud RAG adapter: exposes POST /search for the main app.
Talks to a watsonx.ai AI service deployment (messages-style API), not watsonx.data retrieval.

Contract:
  POST /search  body: { "query": "string", "top_k": 5 }
  response:     { "chunks": [ { "content": "...", "metadata": { "source": "..." }, "similarity": 0.9 } ] }

Set in .env:
  IBM_RETRIEVAL_URL         Full AI service deployment URL (messages API).
  IBM_RETRIEVAL_SEARCH_URL  Optional: watsonx.data retrieval base URL for real PDF chunks and sources.
  IBM_APIKEY                IBM Cloud API key (exchanged for IAM token).
  WATSONX_PROJECT_ID        Required for watsonx ML deployments (/deployments/ URLs).

For real PDF sources in the UI, set IBM_RETRIEVAL_SEARCH_URL so the adapter calls the retrieval API.
Then in the MAIN APP .env set: IBM_RETRIEVAL_URL=http://localhost:5051 (this adapter).
"""
import os
import json
import urllib.request
import urllib.error
from urllib.parse import urlencode

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        r = make_response("", 204)
        r.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
        r.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type"
        r.headers["Access-Control-Max-Age"] = "86400"
        return r

@app.after_request
def _cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

IBM_RETRIEVAL_URL = os.getenv("IBM_RETRIEVAL_URL", "").strip()
IBM_APIKEY = os.getenv("IBM_APIKEY", "").strip()
IBM_RETRIEVAL_SEARCH_URL = os.getenv("IBM_RETRIEVAL_SEARCH_URL", "").strip().rstrip("/")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID", "").strip()
PORT = int(os.getenv("PORT", "5051"))

# Detect watsonx ML deployment: URL contains /deployments/
# (previous code also required 'ai_service' in the URL, which broke ca-tor.ml.cloud.ibm.com URLs)
_IS_ML_DEPLOYMENT = "/deployments/" in IBM_RETRIEVAL_URL


def get_iam_token(api_key: str) -> str:
    """
    Exchange IBM Cloud API key for a short-lived IAM access token.
    IBM APIs require Bearer <token>, NOT the raw API key.
    """
    if not api_key:
        return ""
    body = urlencode({
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": api_key,
    }).encode()
    req = urllib.request.Request(
        "https://iam.cloud.ibm.com/identity/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        token = data.get("access_token", "")
        if not token:
            print(f"[adapter] IAM response had no access_token. Keys: {list(data.keys())}", flush=True)
        return token
    except urllib.error.HTTPError as e:
        try:
            err = e.read().decode()[:300]
        except Exception:
            err = ""
        print(f"[adapter] IAM token failed {e.code}: {err}", flush=True)
        return ""
    except Exception as e:
        print(f"[adapter] IAM token error: {e}", flush=True)
        return ""


def _build_ml_url(base_url: str) -> str:
    """
    Append required query params to a watsonx ML deployment URL.
    watsonx ML requires ?version=YYYY-MM-DD; project_id is also required
    when the deployment is scoped to a project.
    """
    params = {"version": "2024-01-29"}
    if WATSONX_PROJECT_ID:
        params["project_id"] = WATSONX_PROJECT_ID
    sep = "&" if "?" in base_url else "?"
    return base_url + sep + urlencode(params)


def _extract_text_from_response(data: dict) -> str:
    """Parse watsonx.ai AI service response into a single text string."""
    if not data or not isinstance(data, dict):
        return ""

    text = (
        data.get("generated_text")
        or data.get("output")
        or data.get("answer")
        or data.get("result")
    )
    if isinstance(text, str) and text.strip():
        return text.strip()
    if isinstance(text, dict):
        t = text.get("text") or text.get("generated_text") or text.get("content")
        if isinstance(t, str) and t.strip():
            return t.strip()

    preds = data.get("predictions") or data.get("results") or data.get("outputs")
    if isinstance(preds, list) and len(preds) > 0:
        p = preds[0]
        if isinstance(p, dict):
            t = p.get("content") or p.get("generated_text") or (p.get("output") or {}).get("text")
            if isinstance(t, str) and t.strip():
                return t.strip()
        elif isinstance(p, str) and p.strip():
            return p.strip()
    elif isinstance(preds, dict):
        t = preds.get("content") or preds.get("generated_text")
        if isinstance(t, str) and t.strip():
            return t.strip()

    inner = data.get("result") or data.get("output")
    if isinstance(inner, dict):
        return _extract_text_from_response(inner)
    if isinstance(inner, str) and inner.strip():
        return inner.strip()

    # OpenAI-style choices: choices[0].message.content
    choices = data.get("choices")
    if isinstance(choices, list) and len(choices) > 0:
        c0 = choices[0]
        if isinstance(c0, dict):
            msg = c0.get("message") or c0
            if isinstance(msg, dict):
                t = msg.get("content") or msg.get("text")
                if isinstance(t, str) and t.strip():
                    return t.strip()
            t = c0.get("content") or c0.get("text")
            if isinstance(t, str) and t.strip():
                return t.strip()

    return ""


def _normalize_one_chunk(item, default_source: str = "ibm_document") -> dict | None:
    """Turn one retrieval/citation item into { content, metadata: { source }, similarity }."""
    if item is None:
        return None
    if isinstance(item, str) and item.strip():
        return {"content": item.strip(), "metadata": {"source": default_source}, "similarity": 0.8}
    if not isinstance(item, dict):
        return None
    content = (
        item.get("content") or item.get("text") or item.get("passage") or item.get("snippet")
        or item.get("document") or item.get("body") or ""
    )
    if isinstance(content, dict):
        content = content.get("text") or content.get("content") or ""
    if not (isinstance(content, str) and content.strip()):
        return None
    meta = item.get("metadata") or {}
    source = (
        meta.get("source") or meta.get("filename") or meta.get("file_name") or meta.get("document_id")
        or item.get("source") or item.get("filename") or item.get("title") or item.get("document_id")
        or default_source
    )
    if isinstance(source, dict):
        source = source.get("name") or source.get("filename") or default_source
    sim = float(item.get("similarity") or item.get("score") or item.get("relevance") or 0.8)
    return {
        "content": content.strip(),
        "metadata": {"source": str(source)},
        "similarity": min(1.0, max(0.0, sim)),
    }


def _extract_retrieval_chunks(data: dict) -> list[dict]:
    """Extract retrieval results / citations / source documents from an IBM RAG response."""
    if not data or not isinstance(data, dict):
        return []
    chunks = []
    seen = set()

    def add_candidates(arr, default_source="ibm_document"):
        if not isinstance(arr, list):
            return
        for i, it in enumerate(arr):
            c = _normalize_one_chunk(it, default_source=default_source)
            if c and c["content"] and c["content"] not in seen:
                seen.add(c["content"])
                chunks.append(c)

    for key in ("retrieval_results", "citations", "source_documents", "references", "documents", "passages", "results"):
        add_candidates(data.get(key))

    # OpenAI-style choices: choices[0].message may have citations / retrieval_results
    choices = data.get("choices")
    if isinstance(choices, list):
        for c in choices:
            if not isinstance(c, dict):
                continue
            msg = c.get("message") or c
            if isinstance(msg, dict):
                for key in ("retrieval_results", "citations", "source_documents", "references", "documents", "passages"):
                    add_candidates(msg.get(key))

    for outer in ("predictions", "results", "output", "outputs"):
        outer_val = data.get(outer)
        if isinstance(outer_val, list) and len(outer_val) > 0 and isinstance(outer_val[0], dict):
            for p in outer_val:
                for key in ("retrieval_results", "citations", "source_documents", "references", "documents", "passages"):
                    add_candidates(p.get(key))
        elif isinstance(outer_val, dict):
            for key in ("retrieval_results", "citations", "source_documents", "references", "documents", "passages"):
                add_candidates(outer_val.get(key))

    return chunks[:20]


def search_watsonx_data_retrieval(query: str, top_k: int) -> list[dict]:
    """Call watsonx.data retrieval API for real PDF chunks. Used when IBM_RETRIEVAL_SEARCH_URL is set."""
    if not IBM_RETRIEVAL_SEARCH_URL or not IBM_APIKEY:
        return []
    token = get_iam_token(IBM_APIKEY)
    if not token:
        print("[adapter] No IAM token for retrieval search.", flush=True)
        return []
    url = f"{IBM_RETRIEVAL_SEARCH_URL}/api/v2/retrieval/search"
    payload = {"query": query, "max_results": top_k}
    if WATSONX_PROJECT_ID:
        payload["project_id"] = WATSONX_PROJECT_ID
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err = e.read().decode()[:500]
        except Exception:
            err = ""
        print(f"[adapter] watsonx.data retrieval failed {e.code}: {err}", flush=True)
        return []
    except Exception as e:
        print(f"[adapter] watsonx.data retrieval error: {e}", flush=True)
        return []

    raw = data.get("results") or data.get("passages") or data.get("documents") or data.get("chunks") or []
    out = []
    for c in raw[:top_k]:
        norm = _normalize_one_chunk(c) if isinstance(c, dict) else _normalize_one_chunk({"content": str(c)})
        if norm:
            out.append(norm)
    return out


def search_ibm_rag(query: str, top_k: int) -> list[dict]:
    """
    Prefer real PDF chunks and sources:
    - If IBM_RETRIEVAL_SEARCH_URL is set, call watsonx.data retrieval and return those chunks.
    - Else call IBM_RETRIEVAL_URL (AI service / ML deployment), parse retrieval/citations from
      the response; if any, return them. If none, return the generated answer as one chunk.
    """
    # 1) Optional: use watsonx.data retrieval for real PDF chunks and filenames
    if IBM_RETRIEVAL_SEARCH_URL and IBM_APIKEY:
        chunks = search_watsonx_data_retrieval(query, top_k)
        if chunks:
            return chunks

    # 2) AI service / ML deployment
    if not IBM_RETRIEVAL_URL or not IBM_APIKEY:
        return []

    # Always exchange the API key for an IAM token — never send the raw key as Bearer
    token = get_iam_token(IBM_APIKEY)
    if not token:
        print("[adapter] No IAM token obtained — check IBM_APIKEY.", flush=True)
        return []

    if _IS_ML_DEPLOYMENT:
        # watsonx ML requires version + project_id as query params
        url = _build_ml_url(IBM_RETRIEVAL_URL)
        body = {
            "messages": [{"role": "user", "content": query}],
            "query": query,
            "top_k": top_k,
        }
    else:
        url = IBM_RETRIEVAL_URL
        body = {
            "messages": [{"role": "user", "content": query}]
        }

    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode()[:500]
        except Exception:
            pass
        print(f"[adapter] IBM RAG failed {e.code}: {err_body}", flush=True)
        return []
    except Exception as e:
        print(f"[adapter] IBM RAG error: {e}", flush=True)
        return []

    print(f"[adapter] IBM raw response keys: {list(data.keys())}", flush=True)

    # Prefer retrieval/citations so we show real PDF sources
    retrieval_chunks = _extract_retrieval_chunks(data)
    if retrieval_chunks:
        return retrieval_chunks[:top_k]

    # Fallback: use generated answer as single chunk
    text = _extract_text_from_response(data)
    if not text:
        print("[adapter] No text in IBM response; raw keys: " + str(list(data.keys())[:10]), flush=True)
        return []

    print(
        "[adapter] IBM response has no retrieval/citations; using generated answer as single chunk. "
        "For real PDF sources set IBM_RETRIEVAL_SEARCH_URL or use a RAG deployment that returns citations. "
        "Response keys: " + str(list(data.keys())),
        flush=True,
    )
    return [
        {
            "content": text,
            "metadata": {"source": "ibm_rag_deployment"},
            "similarity": 1.0,
        }
    ]


@app.route("/search", methods=["POST", "OPTIONS"])
def search():
    if request.method == "OPTIONS":
        return "", 204
    try:
        body = request.get_json(silent=True) or {}
        query = (body.get("query") or "").strip()
        top_k = min(int(body.get("top_k", 5)), 10)
        if not query:
            return jsonify({"chunks": [], "error": "Missing query"}), 400

        chunks = search_ibm_rag(query, top_k)
        ibm_configured = (IBM_RETRIEVAL_URL or IBM_RETRIEVAL_SEARCH_URL) and IBM_APIKEY
        if not chunks and ibm_configured:
            print(f"[adapter] IBM failed or returned no chunks for query={query[:50]}...", flush=True)
            return jsonify({"chunks": [], "error": "IBM RAG failed or returned no results"}), 502
        return jsonify({"chunks": chunks or []})
    except Exception as e:
        print(f"[adapter] search error: {e}", flush=True)
        return jsonify({"chunks": [], "error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "ibm_configured": bool((IBM_RETRIEVAL_URL or IBM_RETRIEVAL_SEARCH_URL) and IBM_APIKEY),
        "retrieval_search_url_set": bool(IBM_RETRIEVAL_SEARCH_URL),
        "is_ml_deployment": _IS_ML_DEPLOYMENT,
        "project_id_set": bool(WATSONX_PROJECT_ID),
    })


@app.route("/chains", methods=["POST", "OPTIONS"])
def chains_placeholder():
    """For /chains use main.py (e.g. port 5050) and set VITE_RAG_CHAINS_URL to that URL."""
    if request.method == "OPTIONS":
        return "", 204
    return jsonify({
        "error": "This is the IBM RAG adapter (POST /search). For cascading chains run main.py and set VITE_RAG_CHAINS_URL to that server (e.g. http://localhost:5050).",
        "chains": [],
        "sources": [],
    }), 400


if __name__ == "__main__":
    print(f"IBM RAG adapter listening on port {PORT}", flush=True)
    configured = (IBM_RETRIEVAL_URL or IBM_RETRIEVAL_SEARCH_URL) and IBM_APIKEY
    if not configured:
        print("WARNING: Set IBM_RETRIEVAL_URL (and optionally IBM_RETRIEVAL_SEARCH_URL) and IBM_APIKEY in .env.", flush=True)
    else:
        if _IS_ML_DEPLOYMENT:
            pid = f"&project_id={WATSONX_PROJECT_ID}" if WATSONX_PROJECT_ID else " (WARNING: no WATSONX_PROJECT_ID set)"
            print(f"Detected watsonx ML deployment. Will append ?version=2024-01-29{pid}.", flush=True)
        if IBM_RETRIEVAL_SEARCH_URL:
            print("Using watsonx.data retrieval for PDF chunks and sources.", flush=True)
        else:
            print("Using AI service; response citations will be parsed if present.", flush=True)
    app.run(host="0.0.0.0", port=PORT)