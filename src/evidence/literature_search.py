"""Multi-source scholarly literature search: PubMed, OpenAlex, Crossref, Europe PMC."""
import logging
import os
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional

import requests

from . import config

logger = logging.getLogger(__name__)

SEARCH_QUERY_TEMPLATES = {
    "heatwave": "heatwave OR heat wave OR excess heat factor",
    "drought": "drought OR SPI OR standardized precipitation",
    "flood": "flood OR flooding OR inundation",
    "wildfire": "wildfire OR bushfire OR forest fire OR smoke exposure",
    "air_quality": "air pollution OR PM2.5 OR particulate matter OR ozone exposure",
    "high_wind": "high wind OR windstorm OR cyclone OR hurricane",
}

OUTCOME_TERMS = {
    "mortality": "mortality OR death OR excess deaths",
    "hospitalizations": "hospitalization OR hospital admission OR emergency department",
    "displacement": "displacement OR evacuation OR migration",
    "infrastructure_stress": "infrastructure damage OR power outage OR service disruption",
    "vegetation_stress": "vegetation stress OR NDVI OR crop yield OR agricultural loss",
    "fire_activity": "fire activity OR burned area OR fire spread",
    "aid_requests": "humanitarian aid OR disaster relief OR emergency response",
}


def build_search_query(hazard_type: str, outcome_type: str, additional_terms: str = "") -> str:
    hazard_q = SEARCH_QUERY_TEMPLATES.get(hazard_type, hazard_type)
    outcome_q = OUTCOME_TERMS.get(outcome_type, outcome_type)
    parts = [f"({hazard_q})", f"({outcome_q})"]
    if additional_terms:
        parts.append(f"({additional_terms})")
    return " AND ".join(parts)


# ---- PubMed E-utilities ----

def search_pubmed(query: str, max_results: int = 15) -> List[Dict]:
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": max_results,
        "retmode": "json",
        "sort": "relevance",
    }
    if config.NCBI_API_KEY:
        params["api_key"] = config.NCBI_API_KEY

    try:
        resp = requests.get(f"{base}/esearch.fcgi", params=params, timeout=15)
        resp.raise_for_status()
        pmids = resp.json().get("esearchresult", {}).get("idlist", [])
        if not pmids:
            return []
    except Exception as e:
        logger.warning(f"PubMed search failed: {e}")
        return []

    # Fetch summaries
    try:
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "retmode": "xml",
            "rettype": "abstract",
        }
        if config.NCBI_API_KEY:
            fetch_params["api_key"] = config.NCBI_API_KEY
        resp = requests.get(f"{base}/efetch.fcgi", params=fetch_params, timeout=20)
        resp.raise_for_status()
        return _parse_pubmed_xml(resp.text)
    except Exception as e:
        logger.warning(f"PubMed fetch failed: {e}")
        return []


def _parse_pubmed_xml(xml_text: str) -> List[Dict]:
    candidates = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    for article in root.findall(".//PubmedArticle"):
        med = article.find(".//MedlineCitation")
        if med is None:
            continue
        pmid_el = med.find("PMID")
        pmid = pmid_el.text if pmid_el is not None else ""
        art = med.find("Article")
        if art is None:
            continue
        title_el = art.find("ArticleTitle")
        title = title_el.text if title_el is not None else ""
        abstract_parts = []
        for abs_el in art.findall(".//AbstractText"):
            if abs_el.text:
                abstract_parts.append(abs_el.text)
        abstract = " ".join(abstract_parts)
        journal_el = art.find(".//Journal/Title")
        journal = journal_el.text if journal_el is not None else ""
        year_el = art.find(".//PubDate/Year")
        year = int(year_el.text) if year_el is not None and year_el.text else None
        # DOI
        doi = ""
        for eid in article.findall(".//ArticleIdList/ArticleId"):
            if eid.get("IdType") == "doi":
                doi = eid.text or ""
        # Authors
        authors = []
        for auth in art.findall(".//AuthorList/Author"):
            last = auth.find("LastName")
            first = auth.find("ForeName")
            if last is not None:
                name = last.text or ""
                if first is not None:
                    name = f"{first.text} {name}"
                authors.append(name)

        candidates.append({
            "source_api": "pubmed",
            "external_id": f"PMID:{pmid}",
            "title": title,
            "doi": doi,
            "year": year,
            "journal": journal,
            "abstract": abstract[:2000],
            "authors": authors[:10],
            "relevance_score": 0.0,
        })
    return candidates


# ---- OpenAlex ----

def search_openalex(query: str, max_results: int = 15) -> List[Dict]:
    url = "https://api.openalex.org/works"
    params = {
        "search": query,
        "per_page": max_results,
        "sort": "relevance_score:desc",
    }
    headers = {}
    if config.OPENALEX_API_KEY:
        headers["Authorization"] = f"Bearer {config.OPENALEX_API_KEY}"

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
        results = resp.json().get("results", [])
    except Exception as e:
        logger.warning(f"OpenAlex search failed: {e}")
        return []

    candidates = []
    for r in results:
        abstract = _reconstruct_openalex_abstract(r.get("abstract_inverted_index"))
        candidates.append({
            "source_api": "openalex",
            "external_id": r.get("id", ""),
            "title": r.get("title", ""),
            "doi": (r.get("doi") or "").replace("https://doi.org/", ""),
            "year": r.get("publication_year"),
            "journal": (r.get("primary_location") or {}).get("source", {}).get("display_name", "") if r.get("primary_location") else "",
            "abstract": abstract[:2000],
            "authors": [
                a.get("author", {}).get("display_name", "")
                for a in (r.get("authorships") or [])[:10]
            ],
            "relevance_score": r.get("relevance_score", 0),
        })
    return candidates


def _reconstruct_openalex_abstract(inverted_index: Optional[Dict]) -> str:
    if not inverted_index:
        return ""
    pos_word = []
    for word, positions in inverted_index.items():
        for pos in positions:
            pos_word.append((pos, word))
    pos_word.sort()
    return " ".join(w for _, w in pos_word)


# ---- Crossref ----

def search_crossref(query: str, max_results: int = 15) -> List[Dict]:
    url = "https://api.crossref.org/works"
    params = {
        "query": query,
        "rows": max_results,
        "sort": "relevance",
        "order": "desc",
        "mailto": config.CROSSREF_MAILTO,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        items = resp.json().get("message", {}).get("items", [])
    except Exception as e:
        logger.warning(f"Crossref search failed: {e}")
        return []

    candidates = []
    for item in items:
        year = None
        for date_field in ["published-print", "published-online", "created"]:
            dp = item.get(date_field, {}).get("date-parts", [[None]])
            if dp and dp[0] and dp[0][0]:
                year = dp[0][0]
                break
        candidates.append({
            "source_api": "crossref",
            "external_id": item.get("DOI", ""),
            "title": (item.get("title") or [""])[0],
            "doi": item.get("DOI", ""),
            "year": year,
            "journal": (item.get("container-title") or [""])[0],
            "abstract": (item.get("abstract") or "")[:2000],
            "authors": [
                f"{a.get('given', '')} {a.get('family', '')}".strip()
                for a in (item.get("author") or [])[:10]
            ],
            "relevance_score": item.get("score", 0),
        })
    return candidates


# ---- Multi-source search ----

def search_all(
    hazard_type: str,
    outcome_type: str,
    additional_terms: str = "",
    sources: Optional[List[str]] = None,
    max_results: int = 20,
) -> Dict:
    """Search across scholarly APIs, deduplicate, and return ranked candidates."""
    query = build_search_query(hazard_type, outcome_type, additional_terms)
    sources = sources or ["pubmed", "openalex"]

    all_candidates: List[Dict] = []
    for source in sources:
        try:
            if source == "pubmed":
                all_candidates.extend(search_pubmed(query, max_results))
            elif source == "openalex":
                all_candidates.extend(search_openalex(query, max_results))
            elif source == "crossref":
                all_candidates.extend(search_crossref(query, max_results))
        except Exception as e:
            logger.warning(f"Search source {source} failed: {e}")

    # Deduplicate by DOI
    seen_dois = set()
    deduped = []
    for c in all_candidates:
        doi = (c.get("doi") or "").lower().strip()
        if doi and doi in seen_dois:
            continue
        if doi:
            seen_dois.add(doi)
        deduped.append(c)

    return {
        "query": query,
        "total_found": len(all_candidates),
        "deduplicated_count": len(deduped),
        "candidates": deduped[:max_results],
    }
