"""
Evidence Service API
────────────────────
Flask server for peer-reviewed evidence management, literature search,
and LLM-based evidence extraction (watsonx / OpenAI fallback).

Endpoints
  GET  /health              → service health + config status
  GET  /evidence            → list evidence (optional filters: hazard_type, outcome_type)
  GET  /evidence/<id>       → get single evidence entry
  POST /evidence            → create evidence entry
  PUT  /evidence/<id>       → update evidence entry
  DEL  /evidence/<id>       → delete evidence entry
  POST /evidence/match      → match evidence by hazard/outcome/severity
  POST /evidence/seed       → load seed evidence data
  POST /literature/search   → search scholarly APIs (PubMed, OpenAlex, Crossref)
  POST /literature/extract  → extract structured evidence from a candidate via LLM
"""
import logging
import os
from datetime import datetime, timezone

from flask import Flask, Response, jsonify, request
from flask_cors import CORS

from . import config
from . import store
from .matching import match_evidence
from .literature_search import search_all
from .extraction import extract_and_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# CORS — allow Vite dev server and any configured origin
CORS(app, origins=[config.CORS_ORIGIN, "http://localhost:5173", "http://localhost:3000"])


# ── Health ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Health check with configuration status."""
    cfg = config.validate_config()
    return jsonify({
        "status": "ok",
        "service": "evidence",
        "evidence_count": store.count_evidence(),
        "config": cfg,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ── Evidence CRUD ─────────────────────────────────────────────────────────────

@app.route("/evidence", methods=["GET"])
def list_evidence():
    """List evidence entries with optional filters."""
    filters = {}
    for key in ["hazard_type", "outcome_type", "climate_zone", "verified"]:
        val = request.args.get(key)
        if val is not None:
            if key == "verified":
                filters[key] = val.lower() in ("true", "1", "yes")
            else:
                filters[key] = val
    entries = store.list_evidence(filters if filters else None)
    return jsonify({"count": len(entries), "evidence": entries})


@app.route("/evidence/<evidence_id>", methods=["GET"])
def get_evidence(evidence_id):
    """Get a single evidence entry by ID."""
    entry = store.get_evidence(evidence_id)
    if not entry:
        return jsonify({"error": "Evidence not found"}), 404
    return jsonify(entry)


@app.route("/evidence", methods=["POST"])
def create_evidence():
    """Create a new evidence entry."""
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400
    required = ["hazard_type", "outcome_type"]
    missing = [f for f in required if not body.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    entry = store.create_evidence(body)
    return jsonify(entry), 201


@app.route("/evidence/<evidence_id>", methods=["PUT"])
def update_evidence(evidence_id):
    """Update an existing evidence entry."""
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400
    updated = store.update_evidence(evidence_id, body)
    if not updated:
        return jsonify({"error": "Evidence not found"}), 404
    return jsonify(updated)


@app.route("/evidence/<evidence_id>", methods=["DELETE"])
def delete_evidence(evidence_id):
    """Delete an evidence entry."""
    deleted = store.delete_evidence(evidence_id)
    if not deleted:
        return jsonify({"error": "Evidence not found"}), 404
    return jsonify({"status": "deleted", "id": evidence_id})


# ── Evidence Matching ─────────────────────────────────────────────────────────

@app.route("/evidence/match", methods=["POST"])
def match_evidence_route():
    """Find and rank evidence matching a hazard/outcome request.

    POST body: {hazard_type, outcome_type, severity?, climate_zone?, population_group?}
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400
    if not body.get("hazard_type"):
        return jsonify({"error": "hazard_type required"}), 400

    limit = int(body.get("limit", 10))
    matches = match_evidence(body, limit=limit)
    return jsonify({
        "request": body,
        "count": len(matches),
        "evidence": matches,
    })


# ── Seed Data ─────────────────────────────────────────────────────────────────

@app.route("/evidence/seed", methods=["POST"])
def seed_evidence():
    """Load seed evidence from seed_evidence.json."""
    try:
        count = store.load_seed_data()
        total = store.count_evidence()
        return jsonify({
            "status": "success",
            "loaded": count,
            "total_evidence": total,
        })
    except Exception as e:
        logger.error(f"Seed loading failed: {e}")
        return jsonify({"error": str(e)}), 500


# ── Literature Search ─────────────────────────────────────────────────────────

@app.route("/literature/search", methods=["POST"])
def literature_search():
    """Search scholarly APIs for relevant literature.

    POST body: {hazard_type, outcome_type, additional_terms?, sources?, max_results?}
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400
    if not body.get("hazard_type") or not body.get("outcome_type"):
        return jsonify({"error": "hazard_type and outcome_type required"}), 400

    hazard_type = body["hazard_type"]
    outcome_type = body["outcome_type"]
    additional_terms = body.get("additional_terms", "")
    sources = body.get("sources", ["pubmed", "openalex"])
    max_results = int(body.get("max_results", 20))

    try:
        results = search_all(
            hazard_type=hazard_type,
            outcome_type=outcome_type,
            additional_terms=additional_terms,
            sources=sources,
            max_results=max_results,
        )

        # Store candidates for later extraction
        stored_candidates = []
        for candidate in results.get("candidates", []):
            candidate["status"] = "found"
            candidate["search_hazard"] = hazard_type
            candidate["search_outcome"] = outcome_type
            saved = store.create_candidate(candidate)
            stored_candidates.append(saved)

        # Log the query
        store.create_query_log({
            "hazard_type": hazard_type,
            "outcome_type": outcome_type,
            "additional_terms": additional_terms,
            "sources": sources,
            "query": results.get("query", ""),
            "total_found": results.get("total_found", 0),
            "deduplicated_count": results.get("deduplicated_count", 0),
            "candidates_stored": len(stored_candidates),
        })

        return jsonify({
            "query": results.get("query", ""),
            "total_found": results.get("total_found", 0),
            "deduplicated_count": results.get("deduplicated_count", 0),
            "candidates": stored_candidates,
        })
    except Exception as e:
        logger.error(f"Literature search failed: {e}")
        return jsonify({"error": str(e)}), 500


# ── Literature Extraction ─────────────────────────────────────────────────────

@app.route("/literature/extract", methods=["POST"])
def literature_extract():
    """Extract structured evidence from a candidate using LLM.

    POST body: {candidate_id}
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400
    candidate_id = body.get("candidate_id")
    if not candidate_id:
        return jsonify({"error": "candidate_id required"}), 400

    try:
        result = extract_and_store(candidate_id)
        if result.get("status") == "error":
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        return jsonify({"error": str(e)}), 500


# ── Candidates list (for admin UI) ───────────────────────────────────────────

@app.route("/candidates", methods=["GET"])
def list_candidates():
    """List literature candidates with optional status filter."""
    status = request.args.get("status")
    filters = {"status": status} if status else None
    entries = store.list_candidates(filters)
    return jsonify({"count": len(entries), "candidates": entries})


# ── Query logs (for admin UI) ────────────────────────────────────────────────

@app.route("/query-logs", methods=["GET"])
def list_query_logs():
    """List search query history."""
    logs = store.list_query_logs()
    return jsonify({"count": len(logs), "logs": logs})


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("Starting Evidence Service...")
    config.validate_config()

    # Auto-load seed data on first start if evidence store is empty
    if store.count_evidence() == 0:
        logger.info("Evidence store empty — loading seed data...")
        count = store.load_seed_data()
        logger.info(f"Loaded {count} seed evidence entries")

    app.run(host="0.0.0.0", port=config.EVIDENCE_PORT, debug=False)
