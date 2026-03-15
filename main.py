import os
import sys

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not all([OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    sys.exit("Error: Set OPENAI_API_KEY, SUPABASE_URL, and SUPABASE_KEY in .env")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SYSTEM_PROMPT = """You are a climate research assistant. Answer the user's question using ONLY the provided context.

Structure every response with these sections:

1. **Findings**: A clear, detailed answer to the question using bullet points where helpful (300-400 words is fine).

2. **Prevention & Mitigation Measures**: Based on the context, list practical steps to prevent or reduce the impact. Include early warning systems, infrastructure improvements, policy recommendations, community preparedness, or any adaptation strategies mentioned. If the context doesn't explicitly mention prevention measures, infer reasonable ones from the hazards described.

3. **References**: List the [Source: filename] tags from the context chunks you used.

Rules:
- Do not repeat the question or add filler.
- If the context doesn't contain the answer, say so.
- Always ground claims in the provided context."""


def get_query_embedding(query: str) -> list[float]:
    """Embed the user query with text-embedding-3-small."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
    )
    return response.data[0].embedding


def retrieve_chunks(query: str, top_k: int = 5) -> list[dict]:
    """Retrieve top-k similar chunks from Supabase via the match_documents RPC."""
    embedding = get_query_embedding(query)
    result = supabase.rpc(
        "match_documents",
        {"query_embedding": embedding, "match_count": top_k},
    ).execute()
    return result.data


def ask(query: str) -> str:
    """RAG pipeline: retrieve context, then generate answer with gpt-4o-mini."""
    chunks = retrieve_chunks(query)

    if not chunks:
        return "No relevant documents found."

    context = "\n\n---\n\n".join(
        f"[Source: {c.get('metadata', {}).get('source', 'unknown')}]\n{c['content']}"
        for c in chunks
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {query}",
            },
        ],
        temperature=0.2,
        max_tokens=1200,
    )

    answer = response.choices[0].message.content

    # Append detailed source references with snippets
    source_lines = []
    for i, c in enumerate(chunks, 1):
        name = c.get("metadata", {}).get("source", "unknown")
        sim = c.get("similarity", 0)
        snippet = c.get("content", "")[:200].replace("\n", " ").strip()
        source_lines.append(
            f"  [{i}] {name}  (similarity: {sim:.2f})\n"
            f"      \"{snippet}...\""
        )

    source_block = "\n\n--- SOURCES ---\n" + "\n\n".join(source_lines)
    return answer + source_block


def main():
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
            answer = ask(query)
            print(f"\n{answer}")
        except Exception as e:
            print(f"\nError: {e}")


if __name__ == "__main__":
    main()
