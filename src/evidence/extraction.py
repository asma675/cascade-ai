"""Railtracks-style extraction flow: extract structured evidence from paper abstracts.

Uses watsonx (or OpenAI fallback) to parse abstracts into structured PeerReviewedEvidence.
This is the AI-assisted layer -- the LLM extracts, but never invents the final numeric estimates.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from . import store
from .watsonx_provider import get_llm_provider

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are an epidemiology research assistant. Extract structured climate-health evidence from this scientific paper.

Title: {title}
DOI: {doi}
Journal: {journal}
Year: {year}
Abstract: {abstract}

Extract the following fields as a JSON object. Use null for any field you cannot determine from the abstract.

{{
  "hazard_type": "one of: heatwave, drought, flood, wildfire, air_quality, high_wind",
  "outcome_type": "one of: mortality, hospitalizations, displacement, infrastructure_stress, vegetation_stress, fire_activity, aid_requests",
  "effect_metric": "one of: relative_risk, odds_ratio, percent_increase, absolute_increase, threshold_response, severity_band",
  "effect_value": <numeric value or null>,
  "effect_unit": "description of what the value means, e.g. 'per 1C increase above threshold'",
  "population_studied": "description of study population",
  "region": "geographic region of study",
  "climate_zone": "one of: tropical, subtropical, temperate, continental, polar, arid, or null",
  "sample_size": <integer or null>,
  "confidence_interval": [<lower>, <upper>] or null,
  "study_quality_score": <0.0-1.0 based on methodology, sample size, statistical rigor>,
  "applicable_severity_range": ["low", "moderate", "severe", "extreme"] - which severity levels this applies to,
  "baseline_rate_per_100k": <if reported, the baseline incidence rate per 100,000, else null>
}}

Return ONLY valid JSON, no explanation."""


def extract_evidence_from_candidate(candidate: Dict) -> Optional[Dict]:
    """Use LLM to extract structured evidence from a literature candidate.

    Args:
        candidate: A LiteratureCandidate dict with title, abstract, doi, etc.

    Returns:
        A PeerReviewedEvidence dict if extraction succeeds, else None.
    """
    title = candidate.get("title", "")
    abstract = candidate.get("abstract", "")
    doi = candidate.get("doi", "")
    journal = candidate.get("journal", "")
    year = candidate.get("year", "")

    if not abstract or len(abstract) < 50:
        logger.warning(f"Candidate {candidate.get('id')} has insufficient abstract text")
        return None

    prompt = EXTRACTION_PROMPT.format(
        title=title, doi=doi, journal=journal, year=year, abstract=abstract
    )

    try:
        provider = get_llm_provider()
        response = provider.chat(
            messages=[
                {"role": "system", "content": "You extract structured data from scientific abstracts. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=1500,
        )

        # Parse JSON from response (handle markdown code blocks)
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            response = "\n".join(lines[1:-1]) if len(lines) > 2 else response
        extracted = json.loads(response)

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM extraction output: {e}")
        return None
    except RuntimeError as e:
        logger.error(f"LLM provider error during extraction: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected extraction error: {e}")
        return None

    # Build PeerReviewedEvidence entry
    evidence = {
        "id": str(uuid.uuid4()),
        "doi": doi,
        "title": title,
        "authors": candidate.get("authors", []),
        "journal": journal,
        "year": year,
        "abstract": abstract[:2000],
        "hazard_type": extracted.get("hazard_type"),
        "outcome_type": extracted.get("outcome_type"),
        "effect_metric": extracted.get("effect_metric"),
        "effect_value": extracted.get("effect_value"),
        "effect_unit": extracted.get("effect_unit"),
        "population_studied": extracted.get("population_studied"),
        "region": extracted.get("region"),
        "climate_zone": extracted.get("climate_zone"),
        "sample_size": extracted.get("sample_size"),
        "confidence_interval": extracted.get("confidence_interval"),
        "study_quality_score": extracted.get("study_quality_score", 0.5),
        "applicable_severity_range": extracted.get("applicable_severity_range", []),
        "baseline_rate_per_100k": extracted.get("baseline_rate_per_100k"),
        "extraction_method": "watsonx_extraction" if "Watsonx" in type(provider).__name__ else "openai_extraction",
        "extraction_date": datetime.now(timezone.utc).isoformat(),
        "verified": False,
        "peer_reviewed": True,
        "source_api": candidate.get("source_api", "unknown"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    return evidence


def extract_and_store(candidate_id: str) -> Dict:
    """Extract evidence from a stored candidate and save to evidence store.

    Returns dict with status and evidence_id.
    """
    candidate = store.get_record(store.config.CANDIDATES_FILE, candidate_id)
    if not candidate:
        return {"status": "error", "error": "Candidate not found"}

    evidence = extract_evidence_from_candidate(candidate)
    if not evidence:
        store.update_candidate(candidate_id, {"status": "error"})
        return {"status": "error", "error": "Extraction failed"}

    # Save evidence
    saved = store.create_evidence(evidence)

    # Update candidate status
    store.update_candidate(candidate_id, {
        "status": "extracted",
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "evidence_id": saved["id"],
    })

    return {"status": "success", "evidence_id": saved["id"], "evidence": saved}
