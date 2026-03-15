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
from flask import Flask, request, jsonify
from openai import OpenAI
from supabase import create_client

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
PORT = int(os.getenv("PORT", "5050"))

if not all([OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    sys.exit("Error: Set OPENAI_API_KEY, SUPABASE_URL, and SUPABASE_KEY in .env")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)

# CORS
@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "rag": True})

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
SYSTEM_PROMPT_JSON = """You are a climate risk analyst. Using ONLY the provided context (location indices and research excerpts), generate cascading impact chains for the SPECIFIC CITY named in the Location section. Be creative; each step must flow logically to the next. Weave DIRECT QUOTES into the description—quotes must be verbatim from the context, no additions.

Output ONLY valid JSON, no markdown or extra text. Use this exact structure:
{
  "chains": [
    {
      "chain_id": "short_unique_id",
      "probability": 0.0 to 1.0,
      "severity": 0.0 to 1.0,
      "confidence": 0.0 to 1.0,
      "nodes": [
        {
          "layer": "one of: hazard, environmental, infrastructure, human, economic",
          "description": "One to three sentences that connect this step to the previous one and to the city. Integrate a direct quote from the cited source inside the sentence (e.g. 'The study found that heat stress is increasingly affecting populations; as noted, \\'vulnerable groups such as the elderly\\' are at higher risk.'). The quoted part must be copied character-for-character from the context—do not paraphrase or add words. For location-only steps, use the actual index values from the Location section.",
          "citation": "Exact source: e.g. 'Source: 2022 - Heat stress in Africa under high intensity climate change.pdf' or 'Location data'"
        }
      ]
    }
  ]
}

Rules:
- layer: use any of hazard, environmental, infrastructure, human, economic. Order nodes so the chain flows logically; vary the sequence across chains.
- description: Write 1–3 sentences. The sentence MUST contain a verbatim quote from the context—copy a phrase or sentence exactly as it appears in the [Source: ...] excerpts. Integrate it naturally (e.g. 'In [City], EHF of X indicates excess heat; the report states that \\'exact text from context\\'.'). Do NOT invent, paraphrase, or add to quotes; only use text that appears in the provided context.
- citation: exact document filename from the context or "Location data".
- Reference the city by name in at least the first node of each chain.
- Generate 1–3 chains, 4–6 nodes each. Use at most 5 different sources. probability/severity/confidence must reflect the evidence."""


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


def retrieve_chunks(query: str, top_k: int = 5) -> list[dict]:
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

    # Optional location block
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

    # Include city name in retrieval so studies relevant to the location are favoured
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
        {"index": i, "source": c.get("metadata", {}).get("source", "unknown"), "similarity": round(c.get("similarity", 0), 2), "snippet": (c.get("content") or "")[:200].replace("\n", " ").strip()}
        for i, c in enumerate(chunks, 1)
    ]

    # Parse JSON (allow wrapped in ```json ... ```)
    try:
        if "```" in raw:
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        chains = data.get("chains")
        if isinstance(chains, list) and len(chains) > 0:
            return chains, sources
    except (json.JSONDecodeError, TypeError):
        pass
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
