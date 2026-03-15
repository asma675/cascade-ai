"""Evidence matching and relevance scoring."""
from typing import Any, Dict, List, Optional
from . import store


def compute_relevance(entry: Dict, request: Dict) -> float:
    """Score an evidence entry against a match request (0-1)."""
    score = 0.0
    total_weight = 0.0

    # Exact hazard type match (weight 3)
    if entry.get("hazard_type") == request.get("hazard_type"):
        score += 3.0
    total_weight += 3.0

    # Exact outcome type match (weight 3)
    if entry.get("outcome_type") == request.get("outcome_type"):
        score += 3.0
    total_weight += 3.0

    # Climate zone similarity (weight 1)
    req_cz = (request.get("climate_zone") or "").lower()
    ent_cz = (entry.get("climate_zone") or "").lower()
    if req_cz and ent_cz:
        if req_cz == ent_cz:
            score += 1.0
        elif req_cz[:3] == ent_cz[:3]:
            score += 0.5
    total_weight += 1.0

    # Study quality (weight 1.5)
    quality = entry.get("study_quality_score", 0.5)
    score += quality * 1.5
    total_weight += 1.5

    # Recency bonus (weight 1)
    year = entry.get("year") or 2000
    if year >= 2020:
        score += 1.0
    elif year >= 2015:
        score += 0.7
    elif year >= 2010:
        score += 0.4
    else:
        score += 0.1
    total_weight += 1.0

    # Peer reviewed bonus (weight 0.5)
    if entry.get("peer_reviewed", True):
        score += 0.5
    total_weight += 0.5

    # Verified/approved bonus (weight 0.5)
    if entry.get("verified", False):
        score += 0.5
    total_weight += 0.5

    return round(score / total_weight, 4) if total_weight > 0 else 0.0


def match_evidence(request: Dict, limit: int = 10) -> List[Dict]:
    """Retrieve and rank evidence entries matching a hazard/outcome request.

    Args:
        request: {hazard_type, outcome_type, severity?, climate_zone?, population_group?}
        limit: max results

    Returns:
        List of evidence dicts with added `relevance_score` field, sorted descending.
    """
    # Filter to entries that at least match hazard_type OR outcome_type
    all_evidence = store.list_evidence()
    candidates = []
    for entry in all_evidence:
        if (entry.get("hazard_type") == request.get("hazard_type") or
                entry.get("outcome_type") == request.get("outcome_type")):
            entry_copy = dict(entry)
            entry_copy["relevance_score"] = compute_relevance(entry, request)
            candidates.append(entry_copy)

    # Sort by relevance
    candidates.sort(key=lambda x: x["relevance_score"], reverse=True)
    return candidates[:limit]
