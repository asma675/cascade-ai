"""
Climate Hazard Indices API
──────────────────────────
Endpoints
  POST /indices   → spectral indices, deltas, and hazard labels for a point
  GET  /health    → {"status": "ok"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Masking pipeline  (every image before compositing)
  1. Cloud / cirrus  — QA60 bits 10 & 11
  2. Snow / ice      — NDSI = (B3 − B11) / (B3 + B11) ≥ 0.4
     QA60 does NOT mask snow.  Without snow masking, shoulder-season or
     high-latitude baselines contain partially snow-covered pixels whose
     suppressed SWIR reflectance artificially inflates NBR_pre, producing
     spurious negative dNBR (apparent greening) where no change occurred.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Baseline strategy
  Multi-year seasonal median (default: 5 years, same calendar DOY window).
  All N yearly collections are merged and a single median is taken across the
  full stack.  This is equivalent to a phenological climatology: same sun
  angle, same growing-season state, inter-annual noise suppressed, robust to
  single bad years (drought, off-year fire, anomalous cloud cover).

  Callers may supply explicit baseline_start / baseline_end to override.

  Response metadata uses unambiguous field names:
    • Multi-year mode  → baseline_start / baseline_end describe the full span,
                         baseline_years = N, baseline_type = "multi-year …"
    • Explicit mode    → baseline_start / baseline_end describe the supplied
                         window, baseline_years = null,
                         baseline_type = "explicit window"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Delta sign conventions  (all: positive = disturbance / loss)
  dNBR   = NBR_pre  − NBR_post    positive → vegetation / moisture loss (burn)
  dNDVI  = NDVI_pre − NDVI_post   positive → green biomass loss
  dBSI   = BSI_post − BSI_pre     positive → more bare / burned soil exposed
  dMNDWI = MNDWI_post − MNDWI_pre positive → surface became wetter post-event

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /indices  request body (JSON)
  Required
    lat         float   WGS-84 latitude
    lon         float   WGS-84 longitude
    start       str     post-event window start  (YYYY-MM-DD)
    end         str     post-event window end    (YYYY-MM-DD, inclusive)

  Optional
    buffer_m        int   analysis radius in metres          (default 250)
    years_back      int   historical years for baseline       (default 5)
    baseline_start  str   explicit baseline start; if supplied, baseline_end
    baseline_end    str   is also required and multi-year mode is skipped
"""

from __future__ import annotations

import json
import os
from datetime import datetime

from dateutil.relativedelta import relativedelta
from flask import Flask, jsonify, request, Response

import ee

app = Flask(__name__)

# Allow frontend origin (Vite default); set to "*" to allow any origin
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:5173")


def _cors_response():
    """Response with CORS headers for preflight (OPTIONS) or manual use."""
    r = Response(status=204)
    r.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    r.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    r.headers["Access-Control-Max-Age"] = "86400"
    return r


@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        return _cors_response()


@app.after_request
def _cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


# ── GEE initialisation ────────────────────────────────────────────────────────
_key_data    = json.loads(os.environ["GEE_SERVICE_ACCOUNT_KEY"])
_credentials = ee.ServiceAccountCredentials(
    email    = _key_data["client_email"],
    key_data = json.dumps(_key_data),
)
ee.Initialize(credentials=_credentials, project="ggr437-1007998482")


# ── constants ─────────────────────────────────────────────────────────────────
COLLECTION    = "COPERNICUS/S2_SR_HARMONIZED"
SCALE_M       = 20     # 20 m: coarsest common native res. for B3/B4/B8/B11
DEFAULT_BUF   = 250    # metres
DEFAULT_YEARS = 5      # historical years for the multi-year seasonal baseline
NDSI_SNOW_THR = 0.4    # NDSI ≥ this value → pixel treated as snow / ice


# ── masking ───────────────────────────────────────────────────────────────────
def _mask_image(image: ee.Image) -> ee.Image:
    """
    Mask clouds, cirrus, and snow/ice; scale DN → reflectance [0, 1].

    Cloud/cirrus: QA60 bits 10 (opaque cloud) and 11 (cirrus).
    Snow/ice:     NDSI is computed on raw (unscaled) DN so that the
                  normalised difference uses consistent units before the
                  divide(10000) call.
    """
    qa         = image.select("QA60")
    cloud_mask = (
        qa.bitwiseAnd(1 << 10).eq(0)
        .And(qa.bitwiseAnd(1 << 11).eq(0))
    )
    ndsi      = image.normalizedDifference(["B3", "B11"])  # raw DN, pre-scale
    snow_mask = ndsi.lt(NDSI_SNOW_THR)

    return image.updateMask(cloud_mask.And(snow_mask)).divide(10000)


# ── composite builders ────────────────────────────────────────────────────────
def _composite(point: ee.Geometry, start: str, end: str) -> ee.Image:
    """Cloud / snow-free median composite for a single date window."""
    return (
        ee.ImageCollection(COLLECTION)
        .filterBounds(point)
        .filterDate(start, end)
        .map(_mask_image)
        .median()
    )


def _seasonal_baseline(
    point:      ee.Geometry,
    start:      str,
    end:        str,
    years_back: int = DEFAULT_YEARS,
) -> ee.Image:
    """
    Multi-year seasonal median composite (phenological climatology).

    For each of the N prior years the identical calendar DOY window is
    collected, masked, and merged.  One median is then taken across the
    entire stack — equivalent to a pixel-wise N-year seasonal average with
    outlier rejection via the median operator.
    """
    start_dt = datetime.strptime(start, "%Y-%m-%d")
    end_dt   = datetime.strptime(end,   "%Y-%m-%d")

    merged: ee.ImageCollection | None = None
    for y in range(1, years_back + 1):
        s   = (start_dt - relativedelta(years=y)).strftime("%Y-%m-%d")
        e   = (end_dt   - relativedelta(years=y)).strftime("%Y-%m-%d")
        col = (
            ee.ImageCollection(COLLECTION)
            .filterBounds(point)
            .filterDate(s, e)
            .map(_mask_image)
        )
        merged = col if merged is None else merged.merge(col)

    return merged.median()


# ── spectral index computation ────────────────────────────────────────────────
def _spectral_indices(image: ee.Image) -> ee.Image:
    """
    Compute four spectral indices from a scaled reflectance composite.

    NBR   = (B8 − B11) / (B8 + B11)
            Near-infrared burn ratio; sensitive to canopy structure and fuel
            moisture.  High values = healthy vegetation; low/negative = burned,
            bare, or urban.  Range [−1, 1].

    NDVI  = (B8 − B4) / (B8 + B4)
            Normalised Difference Vegetation Index; green biomass proxy.
            Range [−1, 1].

    MNDWI = (B3 − B11) / (B3 + B11)
            Modified Normalised Difference Water Index; positive over open
            water and flooded surfaces, strongly negative over dry soil /
            urban.  Range [−1, 1].

    BSI   = ((B11 + B4) − (B8 + B2)) / ((B11 + B4) + (B8 + B2))
            Bare Soil Index; positive over exposed mineral soil or char,
            negative over vegetated or impervious surfaces.  Range [−1, 1].

    Returns a 4-band ee.Image with one named band per index.
    """
    nbr   = image.normalizedDifference(["B8",  "B11"]).rename("NBR")
    ndvi  = image.normalizedDifference(["B8",  "B4" ]).rename("NDVI")
    mndwi = image.normalizedDifference(["B3",  "B11"]).rename("MNDWI")
    bsi   = image.expression(
        "((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))",
        {
            "SWIR": image.select("B11"),
            "RED":  image.select("B4"),
            "NIR":  image.select("B8"),
            "BLUE": image.select("B2"),
        },
    ).rename("BSI")

    return nbr.addBands(ndvi).addBands(mndwi).addBands(bsi)


# ── classification helpers ────────────────────────────────────────────────────
def _land_class(
    ndvi:  float | None,
    mndwi: float | None,
    bsi:   float | None,
) -> str:
    """
    Post-event land-cover class from three complementary indices.

    Priority order prevents misclassification at soft thresholds:
      Water > Dense vegetation > Sparse vegetation > Bare soil > Urban > Mixed
    """
    if ndvi is None or mndwi is None or bsi is None:
        return "NO DATA"
    if mndwi >= 0.3:  return "WATER"
    if ndvi  >= 0.5:  return "DENSE VEGETATION"
    if ndvi  >= 0.2:  return "SPARSE VEGETATION"
    if bsi   >  0.0:  return "BARE SOIL"
    if mndwi < -0.1:  return "URBAN / IMPERVIOUS"
    return "MIXED / WET SURFACE"


def _nbr_label(
    nbr:        float | None,
    dnbr:       float | None,
    dndvi:      float | None,
    dbsi:       float | None,
    land_class: str,
) -> str:
    """
    Burn-severity label using dNBR as the primary signal and dNDVI / dBSI
    as corroborating indices.

    A pixel is only flagged BURNED when all three conditions hold:
      1. Post-event land class is BARE SOIL
         (the surface has been stripped of canopy)
      2. dNBR > 0.1  — meaningful pre→post NBR drop
      3. dNDVI > 0.05 OR dBSI > 0.05  — at least one corroborating signal
         (real fire leaves multiple spectral fingerprints; requiring
          corroboration suppresses false positives from tillage, construction,
          dry spells, or residual snow artefacts)

    Severity thresholds follow Key & Benson (2006) / USGS BARC dNBR scale.
    """
    if nbr is None:
        return "NO DATA"
    if land_class == "WATER":
        return "WATER"

    if nbr >= 0.5:   return "HEALTHY VEGETATION"
    if nbr >= 0.3:   return "MODERATE VEGETATION"
    if nbr >= 0.1:   return "SPARSE VEGETATION"
    if nbr >= -0.1:  return "BARE / TRANSITIONAL"

    # NBR < −0.1: bare or severely altered — evaluate burn signal
    corroborated = (
        (dndvi is not None and dndvi > 0.05)
        or (dbsi  is not None and dbsi  > 0.05)
    )
    is_burned = (
        land_class == "BARE SOIL"
        and dnbr is not None
        and dnbr > 0.1
        and corroborated
    )

    if is_burned:
        if   dnbr > 0.66:  return "BURNED / HIGH SEVERITY"
        elif dnbr > 0.44:  return "BURNED / MODERATE-HIGH SEVERITY"
        elif dnbr > 0.27:  return "BURNED / MODERATE-LOW SEVERITY"
        else:              return "BURNED / LOW SEVERITY"

    if land_class == "BARE SOIL":
        return "BARE SOIL / NOT BURNED"

    return "URBAN / IMPERVIOUS SURFACE"


def _mndwi_label(mndwi: float | None) -> str:
    """Flood / inundation risk label from MNDWI."""
    if mndwi is None:   return "NO DATA"
    if mndwi >= 0.3:    return "WATER / FLOODED"
    if mndwi >= 0.0:    return "HIGH FLOOD RISK"
    if mndwi >= -0.2:   return "MODERATE FLOOD RISK"
    return "LOW FLOOD RISK"


def _change_label(
    delta:        float | None,
    threshold_lo: float = 0.05,
    threshold_hi: float = 0.20,
) -> str:
    """
    Directional magnitude label for continuous delta indices (dNDVI, dBSI).

    For dNDVI  — LOSS means vegetation decreased post-event.
    For dBSI   — LOSS means bare soil increased post-event (sign convention:
                 dBSI = BSI_post − BSI_pre; positive = more bare soil, so
                 the label says LOSS when dBSI > threshold).

    The direction is embedded in the label so consumers never need to check
    the sign of the raw value to understand the ecological direction.
    """
    if delta is None:
        return "NO DATA"
    abs_d = abs(delta)
    if abs_d < threshold_lo:
        return "NO SIGNIFICANT CHANGE"
    direction = "LOSS" if delta > 0 else "GAIN"
    magnitude = "MODERATE" if abs_d < threshold_hi else "SIGNIFICANT"
    return f"{magnitude} {direction}"


# ── main function ─────────────────────────────────────────────────────────────
def get_indices(
    lat:            float,
    lon:            float,
    start:          str,
    end:            str,
    buffer_m:       int      = DEFAULT_BUF,
    years_back:     int      = DEFAULT_YEARS,
    baseline_start: str|None = None,
    baseline_end:   str|None = None,
) -> dict:
    """
    Compute all spectral indices and change deltas for a buffered point.

    Parameters
    ----------
    lat, lon        : WGS-84 decimal degrees
    start, end      : post-event analysis window (YYYY-MM-DD)
    buffer_m        : circular analysis radius in metres (default 250)
    years_back      : depth of the multi-year seasonal baseline (default 5)
    baseline_start,
    baseline_end    : explicit baseline window; if supplied, multi-year mode
                      is skipped and exactly this window is composited
    """
    point = ee.Geometry.Point([lon, lat]).buffer(buffer_m)

    # ── Post-event composite ─────────────────────────────────────────────────
    image_post = _composite(point, start, end)

    # ── Baseline composite ───────────────────────────────────────────────────
    use_multiyear = baseline_start is None or baseline_end is None

    if use_multiyear:
        image_pre = _seasonal_baseline(point, start, end, years_back)
        # Compute the actual date span covered by the baseline for reporting.
        # baseline_start = earliest date in the stack (N years back, same DOY)
        # baseline_end   = latest date in the stack (1 year back, same DOY)
        start_dt       = datetime.strptime(start, "%Y-%m-%d")
        end_dt         = datetime.strptime(end,   "%Y-%m-%d")
        baseline_start = (start_dt - relativedelta(years=years_back)).strftime("%Y-%m-%d")
        baseline_end   = (end_dt   - relativedelta(years=1)         ).strftime("%Y-%m-%d")
    else:
        image_pre = _composite(point, baseline_start, baseline_end)

    # ── Spectral indices — fully symmetric pre & post ─────────────────────────
    post_idx = _spectral_indices(image_post)
    pre_idx  = _spectral_indices(image_pre)

    pre_renamed = (
        pre_idx
        .select(["NBR",     "NDVI",     "BSI",     "MNDWI"])
        .rename( ["NBR_pre", "NDVI_pre", "BSI_pre", "MNDWI_pre"])
    )

    # Single reduceRegion call — one GEE server round-trip
    values = (
        post_idx.addBands(pre_renamed)
        .reduceRegion(
            reducer  = ee.Reducer.mean(),
            geometry = point,
            scale    = SCALE_M,
        )
        .getInfo()
    )

    # ── Extract scalars ───────────────────────────────────────────────────────
    nbr       = values.get("NBR")
    ndvi      = values.get("NDVI")
    mndwi     = values.get("MNDWI")
    bsi       = values.get("BSI")
    nbr_pre   = values.get("NBR_pre")
    ndvi_pre  = values.get("NDVI_pre")
    bsi_pre   = values.get("BSI_pre")
    mndwi_pre = values.get("MNDWI_pre")

    # ── Delta indices ─────────────────────────────────────────────────────────
    def _delta(a: float | None, b: float | None) -> float | None:
        return (a - b) if (a is not None and b is not None) else None

    dnbr   = _delta(nbr_pre,  nbr)       # positive → burn signal
    dndvi  = _delta(ndvi_pre, ndvi)      # positive → biomass loss
    dbsi   = _delta(bsi,      bsi_pre)   # positive → more bare soil exposed
    dmndwi = _delta(mndwi,    mndwi_pre) # positive → wetter post-event

    # ── Classifications ───────────────────────────────────────────────────────
    lc        = _land_class(ndvi, mndwi, bsi)
    nbr_lbl   = _nbr_label(nbr, dnbr, dndvi, dbsi, lc)
    mndwi_lbl = _mndwi_label(mndwi)
    dndvi_lbl = _change_label(dndvi)
    dbsi_lbl  = _change_label(dbsi)

    return {
        # ── request metadata ───────────────────────────────────────────────
        "lat":             lat,
        "lon":             lon,
        "buffer_m":        buffer_m,

        # post-event window
        "post_start":      start,
        "post_end":        end,

        # baseline window — unambiguous naming for both modes
        # multi-year: span from (start − N years) to (end − 1 year)
        # explicit:   the supplied baseline_start / baseline_end
        "baseline_start":  baseline_start,
        "baseline_end":    baseline_end,
        "baseline_years":  years_back if use_multiyear else None,
        "baseline_type":   (
            f"multi-year seasonal median ({years_back} years)"
            if use_multiyear else "explicit window"
        ),

        # ── post-event spectral indices ────────────────────────────────────
        "nbr":    nbr,
        "ndvi":   ndvi,
        "mndwi":  mndwi,
        "bsi":    bsi,

        # ── baseline spectral indices (symmetric with post) ────────────────
        "nbr_pre":    nbr_pre,
        "ndvi_pre":   ndvi_pre,
        "bsi_pre":    bsi_pre,
        "mndwi_pre":  mndwi_pre,

        # ── delta indices ──────────────────────────────────────────────────
        "dnbr":   dnbr,    # > 0.1 → significant burn
        "dndvi":  dndvi,   # > 0   → biomass loss
        "dbsi":   dbsi,    # > 0   → more bare soil exposed
        "dmndwi": dmndwi,  # > 0   → wetter post-event

        # ── hazard classifications ─────────────────────────────────────────
        "land_class":  lc,
        "nbr_label":   nbr_lbl,
        "mndwi_label": mndwi_lbl,
        "dndvi_label": dndvi_lbl,
        "dbsi_label":  dbsi_lbl,
    }


# ── routes ────────────────────────────────────────────────────────────────────
@app.route("/indices", methods=["POST"])
def indices():
    body    = request.get_json(silent=True) or {}
    missing = [f for f in ("lat", "lon", "start", "end") if f not in body]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        lat            = float(body["lat"])
        lon            = float(body["lon"])
        start          = str(body["start"])
        end            = str(body["end"])
        buffer_m       = int(body.get("buffer_m",   DEFAULT_BUF))
        years_back     = int(body.get("years_back", DEFAULT_YEARS))
        baseline_start = str(body["baseline_start"]) if "baseline_start" in body else None
        baseline_end   = str(body["baseline_end"])   if "baseline_end"   in body else None
    except (ValueError, TypeError) as exc:
        return jsonify({"error": f"Invalid parameter: {exc}"}), 400

    # Both baseline dates must be supplied together or not at all
    if (baseline_start is None) != (baseline_end is None):
        return jsonify({
            "error": "Provide both baseline_start and baseline_end, or neither."
        }), 400

    try:
        result = get_indices(
            lat, lon, start, end,
            buffer_m, years_back,
            baseline_start, baseline_end,
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify(result)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ── entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
