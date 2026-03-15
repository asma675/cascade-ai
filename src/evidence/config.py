"""Configuration for the Evidence Service. All secrets from env vars only."""
import os
import logging

logger = logging.getLogger(__name__)

# --------------- Required for Deno -> Python communication ---------------
EVIDENCE_PORT = int(os.environ.get("EVIDENCE_PORT", "5001"))
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:5173")

# --------------- IBM watsonx via OpenAI-compatible gateway ---------------
IBM_CLOUD_APIKEY = os.environ.get("IBM_CLOUD_APIKEY", "")
WATSONX_GATEWAY_URL = os.environ.get("WATSONX_GATEWAY_URL", "")
WATSONX_MODEL_NAME = os.environ.get("WATSONX_MODEL_NAME", "ibm/granite-3-8b-instruct")

# --------------- OpenAI fallback ---------------
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# --------------- Scholarly API keys ---------------
NCBI_API_KEY = os.environ.get("NCBI_API_KEY", "")
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY", "")
CROSSREF_MAILTO = os.environ.get("CROSSREF_MAILTO", "cascade-ai@example.com")
EUROPE_PMC_EMAIL = os.environ.get("EUROPE_PMC_EMAIL", "")

# --------------- Data paths ---------------
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
EVIDENCE_FILE = os.path.join(DATA_DIR, "evidence.json")
CANDIDATES_FILE = os.path.join(DATA_DIR, "candidates.json")
QUERY_LOG_FILE = os.path.join(DATA_DIR, "query_log.json")
SEED_FILE = os.path.join(DATA_DIR, "seed_evidence.json")


def validate_config():
    """Log which credentials are available (never log actual values)."""
    has_watsonx = bool(IBM_CLOUD_APIKEY and WATSONX_GATEWAY_URL)
    has_openai = bool(OPENAI_API_KEY)
    has_ncbi = bool(NCBI_API_KEY)
    has_openalex = bool(OPENALEX_API_KEY)

    logger.info("Evidence Service Configuration:")
    logger.info(f"  watsonx gateway : {'configured' if has_watsonx else 'NOT SET'}")
    logger.info(f"  watsonx model   : {WATSONX_MODEL_NAME}")
    logger.info(f"  OpenAI fallback : {'configured' if has_openai else 'NOT SET'}")
    logger.info(f"  NCBI/PubMed     : {'configured' if has_ncbi else 'NOT SET (optional)'}")
    logger.info(f"  OpenAlex        : {'configured' if has_openalex else 'NOT SET (optional)'}")
    logger.info(f"  Crossref mailto : {CROSSREF_MAILTO}")
    logger.info(f"  Data directory  : {DATA_DIR}")

    if not has_watsonx and not has_openai:
        logger.warning("No LLM credentials configured. Extraction will be unavailable.")

    return {
        "has_watsonx": has_watsonx,
        "has_openai": has_openai,
        "has_ncbi": has_ncbi,
        "has_openalex": has_openalex,
    }
