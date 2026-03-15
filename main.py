"""
Flask server for RAG-based cascading impact chains.
POST /chains — get chains (optional: include city + assessment for location-aware chains).
GET /health — liveness.
Run CLI: python main.py --cli
"""
import json
import os
import re
import sys

from dotenv import load_dotenv
from flask import Flask, request, jsonify, make_response
from openai import OpenAI
from supabase import create_client

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# Optional: IBM Cloud RAG — retrieval endpoint that accepts POST { "query", "top_k" } and returns { "chunks": [ { "content", "metadata": { "source" }, "similarity" } ] }
IBM_RETRIEVAL_URL = os.getenv("IBM_RETRIEVAL_URL", "").strip().rstrip("/")
IBM_RETRIEVAL_APIKEY = os.getenv("IBM_RETRIEVAL_APIKEY", "").strip()
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID", "").strip()
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
PORT = int(os.getenv("PORT", "5050"))

if not OPENAI_API_KEY:
    sys.exit("Error: Set OPENAI_API_KEY in .env")

# RAG backend: either Supabase (vector DB) or IBM (retrieval endpoint)
use_ibm_retrieval = bool(IBM_RETRIEVAL_URL)
if not use_ibm_retrieval and not all([SUPABASE_URL, SUPABASE_KEY]):
    sys.exit("Error: Set either SUPABASE_URL and SUPABASE_KEY, or IBM_RETRIEVAL_URL in .env")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)

# CORS — allow frontend at 5173 to call /chains and /health
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
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "rag": True, "rag_backend": "ibm" if use_ibm_retrieval else "supabase"})

# Queries that should get a short reply without RAG
NON_QUESTION_PATTERNS = (
    "hello", "hi", "hey", "howdy", "hi there", "hello there",
    "thanks", "thank you", "bye", "goodbye", "good bye",
    "ok", "okay", "yes", "no", "cool", "nice", "great",
    "who are you", "who are you?",
)
MIN_SIMILARITY_FOR_RAG = 0.22

SYSTEM_PROMPT = """You are a climate research assistant. Answer the user's question using ONLY the provided context.

Structure every response as **cascading impact chains**: cause → effect → next effect. Each step must be supported by evidence from the context.

Required structure:

1. **Cascading impact chains**
   - Present 1–3 short chains in the form: [Cause] → [Effect] → [Further effect].
   - Each step must be a **unique conclusion** drawn from the context, not a generic statement.
   - After each chain, cite the source: e.g. (Source: filename) or (Location data).
   - Example format:
     - *Chain 1:* [specific finding from context] → [specific consequence] → [downstream impact]. (Source: …)
     - *Chain 2:* …

2. **Prevention & mitigation** (only if the context supports it)
   - List 2–4 concrete measures mentioned or clearly implied in the context. Cite sources.
   - If the context does not mention prevention, say: "No prevention measures were found in the provided sources."

3. **References**
   - List every [Source: filename] or Location data you used.

Rules:
- Do not repeat the question or add filler.
- Every claim must be grounded in the provided context; no generic or unsupported conclusions.
- Do not invent any numbers, percentages, or statistics—only use values from the context.
- If the context does not answer the question, say so clearly and do not invent chains.
- Keep chains concise and evidence-based."""

# System prompt for structured JSON output (for City flowchart)
SYSTEM_PROMPT_JSON = """You are a climate risk analyst. The user message contains ALL the data you need: a Location block with real climate indices (EHF, SPI, NDVI, etc.) and detected hazards, plus research excerpts. Your ONLY job is to produce valid JSON. You have everything required — do not refuse, do not say you lack data or tools.

CRITICAL: Never output phrases like "I don't have the necessary tools", "I cannot", "I'm unable", or any refusal. If you find yourself about to refuse, stop and instead generate chains using whatever location indices and research excerpts are present in the user message.

Output ONLY valid JSON, no markdown fences, no preamble, no explanation. Use this exact structure:
{
  "chains": [
    {
      "chain_id": "short_unique_id",
      "probability": 0.0,
      "severity": 0.0,
      "confidence": 0.0,
      "nodes": [
        {
          "layer": "hazard | environmental | infrastructure | human | economic",
          "description": "1–3 sentences connecting this step to the previous and to the city. Integrate a verbatim quote from the cited source (copy the exact words). For location-only steps, use the actual index values from the Location block (e.g. 'EHF of 4.2 indicates...').",
          "citation": "Source: exact-filename.pdf  OR  Location data"
        }
      ]
    }
  ]
}

Rules:
- You MUST always produce at least one chain. Never return empty chains [].
- Use the Location block indices (EHF, SPI, NDVI, hazards) as your primary evidence. Cite them as "Location data".
- Use research excerpts as supporting evidence. Cite them by exact filename.
- layer: any of hazard, environmental, infrastructure, human, economic — in whatever causal order fits.
- Each chain: 3–6 nodes. Generate 1–4 chains total.
- Reference the city by name in at least one node per chain.
- probability / severity / confidence: derive from the evidence (e.g. high EHF → high probability of heat hazard).
- Verbatim quotes: copy a short phrase exactly as it appears in the [Source: ...] excerpts. Do not invent or paraphrase quoted text.
- If research context is sparse, build the chain primarily from the Location indices and hazards — that is real data."""


def is_greeting_or_off_topic(query: str) -> bool:
    q = query.lower().strip()
    if len(q) > 60:
        return False
    if q in ("?", "??", "???") or (len(q) <= 2 and q.isalpha()):
        return True
    for p in NON_QUESTION_PATTERNS:
        if q == p or q.startswith(p + " ") or q.rstrip("!?.,") == p:
            return True
    words = q.split()
    if len(words) <= 2 and not any(
        w in q for w in ("what", "why", "how", "when", "where", "climate", "impact", "heat", "flood", "drought", "risk", "uhi", "stress")
    ):
        return True
    return False


def get_query_embedding(query: str) -> list[float]:
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
    )
    return response.data[0].embedding


def _ibm_iam_token(api_key: str) -> str:
    """
    Exchange IBM Cloud API key for a short-lived IAM access token.
    IBM APIs require Bearer <token>, NOT Bearer <api_key> directly.
    """
    import urllib.request
    import urllib.error
    from urllib.parse import urlencode

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
            print(f"[RAG] IBM IAM response had no access_token. Keys: {list(data.keys())}", flush=True)
        return token
    except urllib.error.HTTPError as e:
        try:
            err = e.read().decode()[:300]
        except Exception:
            err = ""
        print(f"[RAG] IBM IAM token failed {e.code}: {err}", flush=True)
        return ""
    except Exception as e:
        print(f"[RAG] IBM IAM token error: {e}", flush=True)
        return ""


def retrieve_chunks_ibm(query: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve chunks from IBM watsonx ML deployment.

    Key fixes:
    - is_ml_deployment only checks for /deployments/ (not 'ai_service' — that broke ca-tor URLs)
    - watsonx ML requires ?version=YYYY-MM-DD and ?project_id as query params
    - IAM token exchange is mandatory; raw API key is NEVER sent as Bearer
    - Logs raw response keys so you can see exactly what shape IBM returns
    """
    import urllib.request
    import urllib.error
    from urllib.parse import urlencode

    if not IBM_RETRIEVAL_URL or not IBM_RETRIEVAL_APIKEY:
        print("[RAG] IBM_RETRIEVAL_URL or IBM_RETRIEVAL_APIKEY not configured.", flush=True)
        return []

    # Exchange API key for IAM access token.
    # Sending the raw key as Bearer returns 401 — IBM requires the exchanged token.
    token = _ibm_iam_token(IBM_RETRIEVAL_APIKEY)
    if not token:
        print("[RAG] IBM IAM token exchange failed — check IBM_RETRIEVAL_APIKEY.", flush=True)
        return []

    # Detect watsonx ML deployment by /deployments/ in the URL.
    # Original code also required 'ai_service', which excluded ca-tor.ml.cloud.ibm.com URLs.
    is_ml_deployment = "/deployments/" in IBM_RETRIEVAL_URL

    if is_ml_deployment:
        # watsonx ML requires version + project_id as query params — requests fail without them
        params = {"version": "2024-01-29"}
        if WATSONX_PROJECT_ID:
            params["project_id"] = WATSONX_PROJECT_ID
        sep = "&" if "?" in IBM_RETRIEVAL_URL else "?"
        url = IBM_RETRIEVAL_URL + sep + urlencode(params)
        # ML deployments use a messages-style (chat) body
        payload = {
            "messages": [{"role": "user", "content": query}],
            "query": query,
            "top_k": top_k,
        }
    else:
        # Plain RAG adapter (e.g. localhost:5051/search)
        url = f"{IBM_RETRIEVAL_URL}/search"
        payload = {"query": query, "top_k": top_k}

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()[:500]
        except Exception:
            err_body = ""
        print(f"[RAG] IBM retrieval failed {e.code}: {err_body}", flush=True)
        return []
    except Exception as e:
        print(f"[RAG] IBM retrieval error: {e}", flush=True)
        return []

    print(f"[RAG] IBM raw response keys: {list(data.keys())}", flush=True)

    # Normalize: try standard chunk/result arrays first
    chunks = (
        data.get("chunks")
        or data.get("results")
        or data.get("passages")
        or data.get("retrieval_results")
        or []
    )

    # OpenAI-style: choices[0].message.content  <- IBM watsonx returns this shape
    if not chunks:
        choices = data.get("choices")
        if isinstance(choices, list) and len(choices) > 0:
            c0 = choices[0]
            if isinstance(c0, dict):
                msg = c0.get("message") or {}
                content = (
                    (msg.get("content") if isinstance(msg, dict) else None)
                    or c0.get("content")
                    or c0.get("text")
                )
                if isinstance(content, str) and content.strip():
                    print(f"[RAG] IBM choices[0].message.content extracted ({len(content)} chars)", flush=True)
                    chunks.append({"content": content.strip(), "metadata": {"source": "ibm_rag_deployment"}, "similarity": 0.8})

    # watsonx ML AI service wraps generated output in predictions[]
    if not chunks:
        preds = data.get("predictions") or data.get("output") or []
        if isinstance(preds, list):
            for p in preds:
                if isinstance(p, dict):
                    content = (
                        p.get("content")
                        or p.get("generated_text")
                        or (p.get("output") or {}).get("text")
                        or str(p)
                    )
                    if content:
                        chunks.append({"content": content, "metadata": {"source": "ibm"}, "similarity": 0.8})
                elif isinstance(p, str) and p.strip():
                    chunks.append({"content": p, "metadata": {"source": "ibm"}, "similarity": 0.8})
        elif isinstance(preds, dict) and preds.get("content"):
            chunks.append({"content": preds["content"], "metadata": {"source": "ibm"}, "similarity": 0.8})

    if not chunks:
        print(f"[RAG] IBM response contained no usable chunks. Full keys: {list(data.keys())}", flush=True)
        try:
            print(f"[RAG] IBM raw response (truncated): {__import__("json").dumps(data)[:500]}", flush=True)
        except Exception:
            pass

    out = []
    for c in chunks:
        if isinstance(c, str):
            out.append({"content": c, "metadata": {"source": "unknown"}, "similarity": 0.0})
        else:
            out.append({
                "content": c.get("content") or c.get("text") or c.get("passage") or c.get("document") or "",
                "metadata": c.get("metadata") or {"source": c.get("source") or "unknown"},
                "similarity": float(c.get("similarity") or c.get("score") or 0),
            })
    return out[:top_k]


def retrieve_chunks(query: str, top_k: int = 5) -> list[dict]:
    if use_ibm_retrieval:
        return retrieve_chunks_ibm(query, top_k)
    embedding = get_query_embedding(query)
    result = supabase.rpc(
        "match_documents",
        {"query_embedding": embedding, "match_count": top_k},
    ).execute()
    return result.data


def build_location_block(city: dict, assessment: dict | None) -> str:
    """Build location + indices block from city and assessment (only real values)."""
    lines = []
    lines.append(f"# Location: {city.get('name', '')}, {city.get('country', '')}")
    if city.get("latitude") is not None and city.get("longitude") is not None:
        lines.append(f"- Coordinates: {city['latitude']}, {city['longitude']}")
    if city.get("population") is not None:
        lines.append(f"- Population: {city['population']:,}")
    if city.get("climate_zone"):
        lines.append(f"- Climate zone: {city['climate_zone']}")
    if city.get("elevation") is not None:
        lines.append(f"- Elevation: {city['elevation']} m")

    if not assessment or not assessment.get("environmental_data"):
        lines.append("- Risk assessment: Not run yet. No indices available.")
        return "\n".join(lines)

    ed = assessment.get("environmental_data") or {}
    indices = ed.get("indices") or {}
    hazards = assessment.get("hazards_detected") or []

    if assessment.get("assessment_date"):
        lines.append(f"- Assessment date: {assessment['assessment_date'][:10]}")
    if indices.get("ehf_selection_radius_km") is not None:
        lines.append(f"- Selection radius (analysis): {indices['ehf_selection_radius_km']} km")
    if indices.get("n_points") is not None:
        lines.append(f"- Sampled points: {indices['n_points']}")

    lines.append("\n## Indices (from NASA POWER / satellite; use only these values)")
    if indices.get("ehf") is not None:
        lines.append(f"- EHF (Excess Heat Factor): {indices['ehf']}")
    if indices.get("ehf_details") is not None:
        lines.append("  - EHF details: T95, T3, T30, EHI_sig, EHI_accl (from data)")
    if indices.get("spi") is not None:
        lines.append(f"- SPI-12: {indices['spi']}")
    if indices.get("current_month_precip_mm") is not None:
        lines.append(f"- Current 12-month precip (mm): {indices['current_month_precip_mm']}")
    if indices.get("ndvi") is not None:
        lines.append(f"- NDVI: {indices['ndvi']}")
    if indices.get("nbr") is not None:
        lines.append(f"- NBR: {indices['nbr']}")
    if indices.get("dnbr") is not None:
        lines.append(f"- dNBR: {indices['dnbr']}")
    if indices.get("mndwi") is not None:
        lines.append(f"- MNDWI: {indices['mndwi']}")
    if indices.get("bsi") is not None:
        lines.append(f"- BSI: {indices['bsi']}")
    if indices.get("nbr_label") is not None:
        lines.append(f"- NBR label: {indices['nbr_label']}")
    if indices.get("mndwi_label") is not None:
        lines.append(f"- MNDWI label: {indices['mndwi_label']}")
    if indices.get("land_class") is not None:
        lines.append(f"- Land class: {indices['land_class']}")

    if ed.get("temperature_30d") and len(ed.get("temperature_30d") or []) > 0:
        lines.append("- 30-day temperature series: available")
    if ed.get("precipitation_30d") and len(ed.get("precipitation_30d") or []) > 0:
        lines.append("- 30-day precipitation series: available")

    if hazards:
        lines.append("\n## Detected hazards (from indices above)")
        for h in hazards:
            part = f"{h.get('type', '')} ({h.get('severity', 'N/A')})"
            if h.get("index"):
                part += f", index: {h['index']}"
            if h.get("value") is not None:
                part += f", value: {h['value']}"
            lines.append(f"- {part}")

    return "\n".join(lines)


def ask(query: str, city: dict | None = None, assessment: dict | None = None) -> tuple[str, list[dict]]:
    """
    RAG pipeline: optional location block + retrieve context, then generate chains.
    Returns (answer_text, sources_list).
    """
    if is_greeting_or_off_topic(query):
        msg = (
            "Hello! I'm the Cascading Impact RAG assistant. "
            "Ask me a climate-related question (e.g. heat stress, urban heat islands, floods, drought, mitigation) "
            "and I'll answer using impact chains from the research in the database."
        )
        return msg, []

    location_block = ""
    if city:
        location_block = "\n\n## Location and indices (use only these values)\n" + build_location_block(city, assessment)

    chunks = retrieve_chunks(query)
    if not chunks:
        return "No relevant documents found.", []

    best_similarity = max(c.get("similarity", 0) for c in chunks)
    if best_similarity < MIN_SIMILARITY_FOR_RAG:
        return (
            "No relevant documents found for that question. "
            "Try asking about climate impacts, heat stress, urban heat islands, floods, drought, or mitigation measures.",
            [],
        )

    context = "\n\n---\n\n".join(
        f"[Source: {c.get('metadata', {}).get('source', 'unknown')}]\n{c['content']}"
        for c in chunks
    )

    user_content = f"Context:\n{context}\n\nQuestion: {query}"
    if location_block:
        user_content = f"{location_block}\n\n---\n\n{user_content}"

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        max_tokens=1200,
    )

    answer = response.choices[0].message.content

    sources = []
    for i, c in enumerate(chunks, 1):
        name = c.get("metadata", {}).get("source", "unknown")
        sim = c.get("similarity", 0)
        snippet = (c.get("content", "") or "")[:200].replace("\n", " ").strip()
        sources.append({"index": i, "source": name, "similarity": round(sim, 2), "snippet": snippet})

    return answer, sources


def ask_json(
    query: str,
    city: dict | None = None,
    assessment: dict | None = None,
) -> tuple[list[dict], list[dict]]:
    """
    RAG pipeline for structured chain JSON. Returns (chains, sources).
    Used by the City/analyzeRisks flow to get flowchart-compatible chains.
    """
    location_block = ""
    if city:
        location_block = "\n\n## Location and indices (use only these values)\n" + build_location_block(city, assessment)

    city_name = (city or {}).get("name", "")
    search_query = query or "cascading impact chains hazards heat stress drought flood urban"
    if city_name:
        search_query = f"{city_name} {search_query}"
    chunks = retrieve_chunks(search_query, top_k=5)
    if not chunks:
        return [], []

    best_similarity = max(c.get("similarity", 0) for c in chunks)
    if best_similarity < MIN_SIMILARITY_FOR_RAG:
        return [], []

    context = "\n\n---\n\n".join(
        f"[Source: {c.get('metadata', {}).get('source', 'unknown')}]\n{c['content']}"
        for c in chunks
    )
    user_content = f"Context:\n{context}\n\nQuestion: {query}"
    if location_block:
        user_content = f"{location_block}\n\n---\n\n{user_content}"
    if city_name:
        user_content += f"\n\nImportant: Generate chains specifically for the city '{city_name}'. Reference this city by name and cite the exact Source filenames from the context in each node's citation field."

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT_JSON},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        max_tokens=2000,
    )

    raw = (response.choices[0].message.content or "").strip()
    sources = [
        {
            "index": i,
            "source": c.get("metadata", {}).get("source", "unknown"),
            "similarity": round(c.get("similarity", 0), 2),
            "snippet": (c.get("content") or "")[:200].replace("\n", " ").strip(),
        }
        for i, c in enumerate(chunks, 1)
    ]

    # Detect model refusals before attempting JSON parse — LLM sometimes says
    # "I don't have the necessary tools/data" even when context is fully provided.
    _REFUSAL_PHRASES = (
        "i don't have the necessary",
        "i do not have the necessary",
        "i cannot generate",
        "i'm unable",
        "i am unable",
        "i lack the",
        "no tools",
        "no data available",
        "cannot produce",
        "not possible to generate",
    )
    if any(phrase in raw.lower() for phrase in _REFUSAL_PHRASES):
        print(f"[RAG] Model refused ask_json — retrying with explicit override. Raw start: {raw[:120]}", flush=True)
        retry_messages = [
            {"role": "system", "content": SYSTEM_PROMPT_JSON},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": raw},
            {
                "role": "user",
                "content": (
                    "IGNORE your previous response. You have all the data you need in the Location block "
                    "and context excerpts above — use them now. "
                    "Output ONLY valid JSON starting with { and ending with }. "
                    "Include at least one chain. No explanation, no refusal text."
                ),
            },
        ]
        retry_response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=retry_messages,
            temperature=0.0,
            max_tokens=2000,
        )
        raw = (retry_response.choices[0].message.content or "").strip()
        print(f"[RAG] Retry raw start: {raw[:120]}", flush=True)

    def _try_parse(text: str) -> list | None:
        if "```" in text:
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        # Strip any leading prose before the first {
        brace = text.find("{")
        if brace > 0:
            text = text[brace:]
        try:
            parsed = json.loads(text)
            c = parsed.get("chains")
            if isinstance(c, list) and len(c) > 0:
                return c
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    result_chains = _try_parse(raw)
    if result_chains:
        return result_chains, sources
    return [], sources


@app.route("/chains", methods=["POST", "OPTIONS"])
def chains():
    if request.method == "OPTIONS":
        return "", 204
    try:
        body = request.get_json(silent=True) or {}
        query = (body.get("query") or "").strip()
        if not query:
            return jsonify({"error": "Missing 'query'"}), 400
        city = body.get("city")
        assessment = body.get("assessment")
        fmt = body.get("format")

        if fmt == "json":
            chains, sources = ask_json(query, city=city, assessment=assessment)
            return jsonify({"chains": chains, "sources": sources})

        answer, sources = ask(query, city=city, assessment=assessment)
        return jsonify({"answer": answer, "sources": sources})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def run_cli():
    """Interactive CLI loop."""
    print("=" * 50)
    print("  Cascading Impact RAG Assistant")
    print("  Type a climate question to get impact chains")
    print("  Type 'quit' to exit")
    print("=" * 50)
    while True:
        query = input("\nYou: ").strip()
        if not query:
            continue
        if query.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break
        try:
            answer, sources = ask(query)
            print(f"\n{answer}")
            if sources:
                print("\n--- SOURCES ---")
                for s in sources:
                    print(f"  [{s['index']}] {s['source']}  (similarity: {s['similarity']})\n      \"{s['snippet']}...\"")
        except Exception as e:
            print(f"\nError: {e}")


if __name__ == "__main__":
    if "--cli" in sys.argv:
        run_cli()
    else:
        app.run(host="0.0.0.0", port=PORT, debug=os.getenv("FLASK_DEBUG", "0") == "1")