# Migrating RAG from Supabase to IBM Cloud

This project can use **IBM Cloud** (e.g. watsonx.data / watsonx.ai) for RAG instead of Supabase. You said you already have a DB with PDFs set up on IBM; below is what you need and how to wire it in.

**Important:** In the **main app**, set `IBM_RETRIEVAL_URL` to the **adapter** (e.g. `http://localhost:5051`). The adapter then calls your **watsonx.ai AI service deployment** (full URL in the adapter’s `.env`). The adapter sends `{ "messages": [{ "role": "user", "content": query }] }` and parses the generated answer into the app’s chunk contract.

---

## What you need from IBM

1. **Where your PDFs live**
   - **watsonx.data** – Document library / Unstructured Retrieval index (you upload PDFs in the UI or via API).
   - **watsonx.ai** – Project with a “data index” or vectorized documents for grounding.
   - **Elasticsearch / Milvus** on IBM Cloud – Your own vector store that you’ve already loaded with PDF chunks.

2. **Credentials and endpoint**
   - **API key** (IBM Cloud IAM).
   - **Full deployment URL** for your watsonx.ai RAG / AI service, e.g.  
     `https://ca-tor.ml.cloud.ibm.com/ml/v4/deployments/<deployment-id>/ai_service?version=2021-05-01`  
     (from the deployment’s “Test” or “API” tab). The adapter calls this URL directly; no path is appended.

3. **Contract the app expects**
   The app calls a **single retrieval endpoint** that:
   - Accepts: `POST` with JSON `{ "query": "your question", "top_k": 5 }`
   - Returns: `{ "chunks": [ { "content": "text...", "metadata": { "source": "filename.pdf" }, "similarity": 0.9 } ] }`

   So you can use IBM in two ways:
   - **A)** Point the app at an **adapter** that talks to IBM and implements this contract (recommended).
   - **B)** If your IBM API already returns something like this, point the app at it and adjust the normalizer in `main.py` if needed.

---

## Option A: Use the provided adapter (recommended)

1. **Run the IBM adapter** (it exposes `POST /search` and calls your watsonx.ai deployment):

   ```bash
   # .env for the adapter (create or add):
   IBM_RETRIEVAL_URL=https://ca-tor.ml.cloud.ibm.com/ml/v4/deployments/YOUR_DEPLOYMENT_ID/ai_service?version=2021-05-01
   IBM_APIKEY=your_ibm_cloud_api_key
   # Optional: for real PDF chunks and source filenames in the UI, set your watsonx.data retrieval base URL:
   # IBM_RETRIEVAL_SEARCH_URL=https://your-instance.watsonx.data.cloud.ibm.com
   PORT=5051

   python rag_ibm_adapter.py
   ```

2. **Point the main app at the adapter** (in the main app `.env`):

   ```env
   # Disable Supabase for RAG (optional; if you only use IBM, leave Supabase unset)
   # SUPABASE_URL=
   # SUPABASE_KEY=

   # Use IBM via the adapter
   IBM_RETRIEVAL_URL=http://localhost:5051
   IBM_RETRIEVAL_APIKEY=optional_if_adapter_has_no_auth
   ```

3. **Start the main app** (Flask RAG server):

   ```bash
   python main.py
   ```

   It will call `http://localhost:5051/search` for retrieval and use your IBM-backed PDFs.

**Real PDF sources in the UI:**  
The app shows “Sources (N)” when it gets chunks with real filenames. The AI service often returns only a generated answer, so you may see one generic source (“ibm_rag_deployment”). To get **real PDF chunks and filenames**:

- **Option 1 (recommended):** Set **`IBM_RETRIEVAL_SEARCH_URL`** in the **adapter’s** `.env` to your **watsonx.data retrieval base URL** (e.g. `https://your-instance.watsonx.data.cloud.ibm.com`). The adapter will call `/api/v2/retrieval/search` there and return the retrieved passages as chunks; the main app will then show those as sources.
- **Option 2:** If your RAG deployment’s response includes retrieval/citations (e.g. `retrieval_results`, `citations`, `source_documents`), the adapter will parse them and return them as chunks. If you see “Response keys: …” in the adapter logs, your deployment doesn’t return those keys; you can add parsing in `_extract_retrieval_chunks()` for your response shape.

**Adapter customization:**  
The adapter sends `{ "messages": [{ "role": "user", "content": query }] }` and parses the response for `generated_text`, `output`, `answer`, `result`, or nested `predictions`/`results`. If your deployment returns a different JSON shape, edit `_extract_text_from_response()` in `rag_ibm_adapter.py` to match it.

---

## Option B: Your IBM endpoint already matches the contract

If you have a service that already exposes:

- `POST /search` with `{ "query", "top_k" }`  
- and returns `{ "chunks": [ { "content", "metadata": { "source" }, "similarity" } ] }`  

then in the main app `.env` set:

```env
IBM_RETRIEVAL_URL=https://your-ibm-retrieval-service
IBM_RETRIEVAL_APIKEY=your_token_if_required
```

Leave `SUPABASE_URL` / `SUPABASE_KEY` unset (or remove them). The app will use IBM only.

---

## Ingest (PDFs already in IBM)

- If your PDFs are **already** in IBM (your “db with pdfs”), you **do not** need to run `ingest.py` for IBM. Ingest is only for pushing from local `data/*.pdf` into Supabase (or, if you add it, into IBM).
- If later you want to re-ingest local PDFs into IBM, you’d add an IBM-specific path in `ingest.py` (e.g. call IBM’s document upload/indexing API) or use IBM’s UI/CLI to upload PDFs.

---

## Summary

| Goal                         | Action |
|-----------------------------|--------|
| Use IBM for RAG             | Set `IBM_RETRIEVAL_URL` (and optionally `IBM_RETRIEVAL_APIKEY`) in main app `.env`. |
| Use Supabase for RAG        | Set `SUPABASE_URL` and `SUPABASE_KEY`; leave `IBM_RETRIEVAL_URL` unset. |
| Expose IBM as one endpoint  | Run `rag_ibm_adapter.py`; set `IBM_RETRIEVAL_URL` to that server (e.g. `http://localhost:5051`). |
| Match your IBM API          | Edit `rag_ibm_adapter.py` (or the normalizer in `main.py`) to match your API’s request/response. |

After switching, open the City page and run the flow: retrieval will come from IBM (or from the adapter that calls IBM) instead of Supabase.
