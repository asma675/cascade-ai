import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from pypdf import PdfReader
from supabase import create_client

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not all([OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    sys.exit("Error: Set OPENAI_API_KEY, SUPABASE_URL, and SUPABASE_KEY in .env")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CHUNK_SIZE = 1000  # characters per chunk
CHUNK_OVERLAP = 200
BATCH_SIZE = 50  # rows per Supabase insert to avoid timeouts
DATA_DIR = Path("data")


def sanitize_text(text: str) -> str:
    """Remove null bytes and other problematic characters for PostgreSQL."""
    return text.replace("\x00", "")


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract all text from a PDF file."""
    reader = PdfReader(str(pdf_path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return sanitize_text(text)


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return [c.strip() for c in chunks if c.strip()]


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Get embeddings using text-embedding-3-small (cheapest model)."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [item.embedding for item in response.data]


def get_ingested_sources() -> set[str]:
    """Fetch filenames already ingested into Supabase to skip duplicates."""
    result = supabase.table("documents").select("metadata->source").execute()
    return {row["source"] for row in result.data if row.get("source")}


def ingest_pdfs():
    """Load PDFs from /data, chunk, embed, and upload to Supabase."""
    if not DATA_DIR.exists():
        sys.exit(f"Error: '{DATA_DIR}' folder not found. Create it and add your PDFs.")

    pdf_files = list(DATA_DIR.glob("*.pdf"))
    if not pdf_files:
        sys.exit(f"Error: No PDF files found in '{DATA_DIR}'.")

    # Skip already-ingested PDFs
    existing = get_ingested_sources()
    new_files = [f for f in pdf_files if f.name not in existing]

    if existing:
        print(f"Already ingested: {len(existing)} PDF(s) — skipping those.")

    if not new_files:
        print("No new PDFs to ingest. All files already in database.")
        return

    print(f"Found {len(new_files)} new PDF(s) to ingest")

    all_rows = []

    for pdf_path in new_files:
        print(f"  Processing: {pdf_path.name}")
        text = extract_text_from_pdf(pdf_path)
        if not text.strip():
            print(f"    Skipped (no text extracted)")
            continue

        chunks = chunk_text(text)
        print(f"    {len(chunks)} chunks")

        # Embed in batches of 100 (OpenAI limit is 2048 per request)
        for i in range(0, len(chunks), 100):
            batch_chunks = chunks[i : i + 100]
            embeddings = get_embeddings(batch_chunks)

            for chunk, embedding in zip(batch_chunks, embeddings):
                all_rows.append({
                    "content": chunk,
                    "metadata": {"source": pdf_path.name},
                    "embedding": embedding,
                })

    if not all_rows:
        sys.exit("No content extracted from any PDF.")

    print(f"\nUploading {len(all_rows)} chunks to Supabase in batches of {BATCH_SIZE}...")

    for i in range(0, len(all_rows), BATCH_SIZE):
        batch = all_rows[i : i + BATCH_SIZE]
        supabase.table("documents").insert(batch).execute()
        print(f"  Uploaded batch {i // BATCH_SIZE + 1}/{(len(all_rows) - 1) // BATCH_SIZE + 1}")

    print(f"\nDone! {len(all_rows)} chunks ingested successfully.")


if __name__ == "__main__":
    ingest_pdfs()
