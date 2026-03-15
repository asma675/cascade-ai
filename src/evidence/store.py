"""Thread-safe JSON file store for evidence, candidates, and query logs."""
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import config

_lock = threading.Lock()


def _read(path: str) -> List[Dict]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _write(path: str, data: List[Dict]):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


# ---- Generic CRUD helpers ----

def list_records(path: str, filters: Optional[Dict] = None) -> List[Dict]:
    with _lock:
        records = _read(path)
    if not filters:
        return records
    result = []
    for r in records:
        match = True
        for k, v in filters.items():
            if v is not None and r.get(k) != v:
                match = False
                break
        if match:
            result.append(r)
    return result


def get_record(path: str, record_id: str) -> Optional[Dict]:
    for r in list_records(path):
        if r.get("id") == record_id:
            return r
    return None


def create_record(path: str, data: Dict) -> Dict:
    with _lock:
        records = _read(path)
        data["id"] = data.get("id") or str(uuid.uuid4())
        data["created_at"] = data.get("created_at") or datetime.now(timezone.utc).isoformat()
        records.append(data)
        _write(path, records)
    return data


def update_record(path: str, record_id: str, updates: Dict) -> Optional[Dict]:
    with _lock:
        records = _read(path)
        for i, r in enumerate(records):
            if r.get("id") == record_id:
                r.update(updates)
                r["updated_at"] = datetime.now(timezone.utc).isoformat()
                records[i] = r
                _write(path, records)
                return r
    return None


def delete_record(path: str, record_id: str) -> bool:
    with _lock:
        records = _read(path)
        new_records = [r for r in records if r.get("id") != record_id]
        if len(new_records) == len(records):
            return False
        _write(path, new_records)
    return True


# ---- Evidence-specific helpers ----

def list_evidence(filters: Optional[Dict] = None) -> List[Dict]:
    return list_records(config.EVIDENCE_FILE, filters)

def get_evidence(eid: str) -> Optional[Dict]:
    return get_record(config.EVIDENCE_FILE, eid)

def create_evidence(data: Dict) -> Dict:
    return create_record(config.EVIDENCE_FILE, data)

def update_evidence(eid: str, updates: Dict) -> Optional[Dict]:
    return update_record(config.EVIDENCE_FILE, eid, updates)

def delete_evidence(eid: str) -> bool:
    return delete_record(config.EVIDENCE_FILE, eid)

def count_evidence() -> int:
    return len(list_evidence())


# ---- Candidate helpers ----

def list_candidates(filters: Optional[Dict] = None) -> List[Dict]:
    return list_records(config.CANDIDATES_FILE, filters)

def create_candidate(data: Dict) -> Dict:
    return create_record(config.CANDIDATES_FILE, data)

def update_candidate(cid: str, updates: Dict) -> Optional[Dict]:
    return update_record(config.CANDIDATES_FILE, cid, updates)


# ---- Query log helpers ----

def list_query_logs() -> List[Dict]:
    return list_records(config.QUERY_LOG_FILE)

def create_query_log(data: Dict) -> Dict:
    return create_record(config.QUERY_LOG_FILE, data)


# ---- Seed ----

def load_seed_data() -> int:
    """Load seed evidence from seed_evidence.json, skip duplicates by DOI."""
    if not os.path.exists(config.SEED_FILE):
        return 0
    with open(config.SEED_FILE, "r", encoding="utf-8") as f:
        seed = json.load(f)
    existing_dois = {(e.get("doi") or "").lower() for e in list_evidence()}
    count = 0
    for entry in seed:
        doi = (entry.get("doi") or "").lower()
        if doi and doi in existing_dois:
            continue
        entry["id"] = entry.get("id") or str(uuid.uuid4())
        entry["created_at"] = entry.get("created_at") or datetime.now(timezone.utc).isoformat()
        entry["verified"] = entry.get("verified", True)
        entry["source_api"] = entry.get("source_api", "seed")
        create_evidence(entry)
        existing_dois.add(doi)
        count += 1
    return count
