# Satellite Hazard Indices Server

Flask API that computes **wildfire** (NBR, dNBR) and **flood** (MNDWI, dMNDWI) indices using **Google Earth Engine** (Sentinel-2). Returns spectral indices plus a `hazard_state` with thresholds so the main app can progress hazard chains (e.g. wildfire risk, flood risk).

## Indices computed

| Hazard   | Indices        | Source   | Threshold / use |
|----------|----------------|----------|------------------|
| Wildfire | NBR, dNBR      | GEE S2   | dNBR > 0.1 → burn signal; `hazard_state.wildfire.risk` |
| Flood    | MNDWI, dMNDWI  | GEE S2   | MNDWI ≥ 0.3 → water/flooded; `hazard_state.flood.risk` |
| Drought  | SPI-12         | Main backend (NASA POWER) | — |
| Heatwave | EHF            | Main backend (NASA POWER) | — |

## Setup

1. **Google Earth Engine**
   - Create a [GEE account](https://signup.earthengine.google.com/) and enable the API.
   - Create a **service account** in Google Cloud, grant it Earth Engine access, and download a JSON key.

2. **Environment**
   ```bash
   cd src/satellite
   python -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   export GEE_SERVICE_ACCOUNT_KEY="$(cat /path/to/your-service-account.json)"
   ```

3. **Run**
   ```bash
   python server.py
   ```
   Server listens on `http://0.0.0.0:5000`.

## Endpoints

- **GET /health** — `{"status": "ok", "gee_initialized": true|false}`
- **POST /indices** — body (JSON):
  - **Single point:** `lat`, `lon`, `start`, `end` (YYYY-MM-DD); optional `buffer_m`, `years_back`, `baseline_start`, `baseline_end`.
  - **Area mode:** `center_lat`, `center_lon`, `radius_km`, `n_points`, and `start`/`end` (or `post_start`/`post_end`). Samples N points in the radius, aggregates indices (mean for NBR/NDVI/BSI/deltas, max for MNDWI/dMNDWI), returns one result with `hazard_state`.

Response includes `nbr`, `dnbr`, `mndwi`, `dmndwi`, labels, and **`hazard_state`**:
- `hazard_state.wildfire.risk`, `.severity`, `.dnbr_threshold_exceeded`
- `hazard_state.flood.risk`, `.severity`, `.mndwi_threshold_exceeded`

Use these flags in the main backend to drive hazard detection and chain progression (e.g. when `wildfire.risk` or `flood.risk` is true, advance to exposure/vulnerability and outcome prediction).

## Backend integration

The main backend (`functions/analyzeRisks`) calls this server when **`SATELLITE_INDICES_URL`** is set (e.g. `http://localhost:5000` or your deployed URL). It uses the **same radius and center** as EHF/SPI (from the city view selection). Set `SATELLITE_INDICES_URL` in your Base44 function environment so that "Update analysis for this area" recalculates both weather-based indices (EHF, SPI-12) and satellite indices (NDVI, NBR, MNDWI, etc.) for the selected radius.
