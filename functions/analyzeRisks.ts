import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { city } = await req.json();

    // Fetch NASA POWER data (EHF, SPI-12 use selection_radius_km / selection_center from city)
    const nasaData = await fetchNASAPowerData(city);

    // Fetch satellite indices (NDVI, NBR, dNBR, MNDWI, etc.) with same radius/center
    const satelliteIndices = await fetchSatelliteIndices(city);
    if (satelliteIndices && nasaData.indices) {
      nasaData.indices = {
        ...nasaData.indices,
        ndvi: satelliteIndices.ndvi,
        nbr: satelliteIndices.nbr,
        dnbr: satelliteIndices.dnbr,
        mndwi: satelliteIndices.mndwi,
        dmndwi: satelliteIndices.dmndwi,
        bsi: satelliteIndices.bsi,
        dbsi: satelliteIndices.dbsi,
        dndvi: satelliteIndices.dndvi,
        nbr_label: satelliteIndices.nbr_label,
        mndwi_label: satelliteIndices.mndwi_label,
        land_class: satelliteIndices.land_class,
        hazard_state: satelliteIndices.hazard_state,
      };
    }

    // Fetch WeatherAPI data for real-time validation
    const weatherApiData = await fetchWeatherAPIData(city);
    
    // Merge data sources
    const mergedData = mergeDataSources(nasaData, weatherApiData);
    
    // Detect hazards (includes heatwave, drought, and satellite wildfire/flood when hazard_state present)
    const hazards = detectHazards(mergedData, city);

    // Generate cascading risk chains: use RAG server when configured, else fallback to LLM
    const RAG_CHAINS_URL = Deno.env.get("RAG_CHAINS_URL")?.replace(/\/$/, "");
    let cascadingChains: unknown[];
    if (RAG_CHAINS_URL) {
      try {
        const ragRes = await fetch(`${RAG_CHAINS_URL}/chains`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "Generate cascading impact chains for the detected hazards and location indices. Output format: json.",
            city: { name: city.name, country: city.country, latitude: city.latitude, longitude: city.longitude, population: city.population, climate_zone: city.climate_zone, elevation: city.elevation },
            assessment: { environmental_data: mergedData, hazards_detected: hazards },
            format: "json",
          }),
        });
        if (ragRes.ok) {
          const ragData = (await ragRes.json()) as { chains?: unknown[] };
          if (Array.isArray(ragData.chains) && ragData.chains.length > 0) {
            cascadingChains = ragData.chains;
          } else {
            cascadingChains = await generateCascadingChains(base44, city, hazards, nasaData);
          }
        } else {
          cascadingChains = await generateCascadingChains(base44, city, hazards, nasaData);
        }
      } catch {
        cascadingChains = await generateCascadingChains(base44, city, hazards, nasaData);
      }
    } else {
      cascadingChains = await generateCascadingChains(base44, city, hazards, nasaData);
    }
    
    // Predict impacts
    const predictedImpacts = predictImpacts(hazards, city);
    
    // Create assessment
    const assessment = {
      city_id: city.id,
      city_name: city.name,
      assessment_date: new Date().toISOString(),
      hazards_detected: hazards,
      cascading_chains: cascadingChains,
      environmental_data: mergedData,
      predicted_impacts: predictedImpacts
    };

    // Save to database
    await base44.asServiceRole.entities.RiskAssessment.create(assessment);

    return Response.json(assessment);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatDateDaily(d: Date) {
  return d.toISOString().split('T')[0].replace(/-/g, '');
}
function formatDateMonthly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

/** EHF: sample N points within this radius (km) of city center, then average EHF. Set EHF_SELECTION_RADIUS_KM, EHF_NUM_POINTS in env to override. */
const EHF_SELECTION_RADIUS_KM = Number(Deno.env.get("EHF_SELECTION_RADIUS_KM")) || 10;
const EHF_NUM_POINTS = Math.min(20, Math.max(1, Number(Deno.env.get("EHF_NUM_POINTS")) || 10));

/** Sample n points within radiusKm of (centerLat, centerLon). Point 0 = center; 1..n-1 on a circle. */
function samplePointsInRadius(centerLat: number, centerLon: number, radiusKm: number, n: number): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = [{ lat: centerLat, lon: centerLon }];
  if (n <= 1) return points;
  const radiusDeg = radiusKm / 111; // ~111 km per degree
  for (let i = 1; i < n; i++) {
    const angle = (2 * Math.PI * (i - 1)) / (n - 1);
    const lat = centerLat + radiusDeg * Math.cos(angle);
    const lon = centerLon + (radiusDeg * Math.sin(angle)) / Math.max(0.01, Math.cos((centerLat * Math.PI) / 180));
    points.push({ lat, lon });
  }
  return points;
}

/**
 * Standard EHF: T_i = (Tmax_i + Tmin_i)/2.
 * T95 = 95th percentile of baseline daily mean T.
 * T3 = mean of last 3 days; T30 = mean of 30 days before that (days i-3 to i-32).
 * EHI_sig = T3 - T95; EHI_accl = T3 - T30; EHF = EHI_sig * max(1, EHI_accl).
 */
function computeEHFFromDailyMeans(
  baselineDailyMeans: number[],
  recentDailyMeans: number[] // length >= 33: last 3 = T3, preceding 30 = T30
): { ehf: number; T95: number; T3: number; T30: number; EHI_sig: number; EHI_accl: number } | null {
  if (baselineDailyMeans.length === 0 || recentDailyMeans.length < 33) return null;
  const sortedBaseline = [...baselineDailyMeans].sort((a, b) => a - b);
  const t95Index = Math.min(Math.floor(sortedBaseline.length * 0.95), sortedBaseline.length - 1);
  const T95 = sortedBaseline[t95Index];
  const T3 = recentDailyMeans.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const T30 = recentDailyMeans.slice(-33, -3).reduce((a, b) => a + b, 0) / 30;
  const EHI_sig = T3 - T95;
  const EHI_accl = T3 - T30;
  const ehf = EHI_sig * Math.max(1, EHI_accl);
  return { ehf, T95, T3, T30, EHI_sig, EHI_accl };
}

/** Compute SPI-12 from monthly PRECTOTCORR (month key = YYYYMM). Returns spi12 and details or null. */
function computeSPI12FromMonthly(monthlyParams: Record<string, number>): { spi12: number; spi12Details: { current_12mo_mm: number; mean_12mo_mm: number; std_12mo_mm: number; n_years: number } } | null {
  if (!monthlyParams || typeof monthlyParams !== 'object') return null;
  const monthKeys = Object.keys(monthlyParams)
    .filter((k) => /^\d{6}$/.test(k))
    .sort();
  const monthlyTotalsMm: Record<string, number> = {};
  for (const key of monthKeys) {
    const val = monthlyParams[key];
    if (val == null || val === -999) continue;
    const y = parseInt(key.substring(0, 4), 10);
    const m = parseInt(key.substring(4, 6), 10);
    monthlyTotalsMm[key] = val * daysInMonth(y, m);
  }
  if (monthKeys.length < 12) return null;
  const lastKey = monthKeys[monthKeys.length - 1];
  const endYear = parseInt(lastKey.substring(0, 4), 10);
  const endMonth = parseInt(lastKey.substring(4, 6), 10);
  const historical12mo: number[] = [];
  for (let year = 1981; year <= endYear; year++) {
    let sum = 0;
    let hasAll = true;
    for (let i = 0; i < 12; i++) {
      let m = endMonth - 11 + i;
      let y = year;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const k = `${y}${String(m).padStart(2, '0')}`;
      if (monthlyTotalsMm[k] == null) {
        hasAll = false;
        break;
      }
      sum += monthlyTotalsMm[k];
    }
    if (hasAll) historical12mo.push(sum);
  }
  const current12mo = historical12mo.length > 0 ? historical12mo[historical12mo.length - 1] : 0;
  if (historical12mo.length < 2) return null;
  const mean = historical12mo.reduce((a, b) => a + b, 0) / historical12mo.length;
  const variance = historical12mo.reduce((s, v) => s + (v - mean) ** 2, 0) / historical12mo.length;
  const std = Math.sqrt(variance);
  if (std <= 0) return null;
  const spi12 = (current12mo - mean) / std;
  return {
    spi12,
    spi12Details: {
      current_12mo_mm: current12mo,
      mean_12mo_mm: mean,
      std_12mo_mm: std,
      n_years: historical12mo.length
    }
  };
}

async function fetchNASAPowerDataAtPoint(
  latitude: number,
  longitude: number,
  endDate: Date,
  options: { includeMonthly?: boolean }
): Promise<{
  baselineData: unknown;
  dailyData: unknown;
  monthlyData?: unknown;
  recentDailyMeans: number[];
  baselineDailyMeans: number[];
  dates: string[];
  params: Record<string, Record<string, number>>;
}> {
  const baselineStartDate = new Date();
  baselineStartDate.setFullYear(baselineStartDate.getFullYear() - 30);
  const baselineUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN&community=RE&longitude=${longitude}&latitude=${latitude}&start=${formatDateDaily(baselineStartDate)}&end=${formatDateDaily(endDate)}&format=JSON`;
  const baselineResponse = await fetch(baselineUrl);
  const baselineData = await baselineResponse.json();
  if (!baselineData?.properties?.parameter) throw new Error(`NASA POWER baseline failed: ${(baselineData as { message?: string }).message || 'no parameter'}`);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 33);
  const dailyUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M,PS,RH2M&community=RE&longitude=${longitude}&latitude=${latitude}&start=${formatDateDaily(startDate)}&end=${formatDateDaily(endDate)}&format=JSON`;
  const response = await fetch(dailyUrl);
  const data = await response.json();
  if (!data?.properties?.parameter) throw new Error(`NASA POWER daily failed: ${(data as { message?: string }).message || 'no parameter'}`);

  const params = data.properties.parameter as Record<string, Record<string, number>>;
  const dates = Object.keys(params.T2M || {}).sort();
  const baselineParams = baselineData.properties.parameter as Record<string, Record<string, number>>;
  const baselineDates = Object.keys(baselineParams.T2M_MAX || {}).sort();
  const baselineDailyMeans = baselineDates
    .map((date: string) => {
      const tmax = baselineParams.T2M_MAX?.[date];
      const tmin = baselineParams.T2M_MIN?.[date];
      if (tmax == null || tmin == null || tmax === -999 || tmin === -999) return null;
      return (tmax + tmin) / 2;
    })
    .filter((v: number | null): v is number => v != null);
  const recentDailyMeans = dates
    .map((date: string) => {
      const tmax = params.T2M_MAX?.[date];
      const tmin = params.T2M_MIN?.[date];
      if (tmax == null || tmin == null || tmax === -999 || tmin === -999) return null;
      return (tmax + tmin) / 2;
    })
    .filter((v: number | null): v is number => v != null);

  let monthlyData: unknown;
  if (options.includeMonthly) {
    const endYear = Math.min(endDate.getFullYear(), 2025);
    const monthlyUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR&community=AG&longitude=${longitude}&latitude=${latitude}&start=1981&end=${endYear}&format=JSON`;
    const monthlyResponse = await fetch(monthlyUrl);
    monthlyData = await monthlyResponse.json();
  }

  return { baselineData, dailyData: data, monthlyData, recentDailyMeans, baselineDailyMeans, dates, params };
}

/** Fetches NASA POWER data: all indices (EHF, SPI) and 30d series are computed from N points sampled within the selection radius (default 10 points). Radius/center from request when provided (city view 50m–5km scale). */
async function fetchNASAPowerData(city: {
  latitude: number;
  longitude: number;
  selection_radius_km?: number;
  selection_center_lat?: number;
  selection_center_lon?: number;
}) {
  const endDate = new Date();
  const centerLat = city.selection_center_lat ?? city.latitude;
  const centerLon = city.selection_center_lon ?? city.longitude;
  const radiusKm = city.selection_radius_km ?? EHF_SELECTION_RADIUS_KM;
  const points = samplePointsInRadius(centerLat, centerLon, radiusKm, EHF_NUM_POINTS);

  const ehfValues: number[] = [];
  const spi12Values: number[] = [];
  let ehfDetailsFirst: { T95: number; T3: number; T30: number; EHI_sig: number; EHI_accl: number } | null = null;
  let firstPointResult: Awaited<ReturnType<typeof fetchNASAPowerDataAtPoint>> | null = null;
  let spi12DetailsFirst: { current_12mo_mm: number; mean_12mo_mm: number; std_12mo_mm: number; n_years: number } | null = null;
  /** Per-point params and recentDailyMeans for 10-point averaging of 30d series and baseline. */
  const allPointResults: Array<{ params: Record<string, Record<string, number>>; recentDailyMeans: number[] }> = [];

  for (let i = 0; i < points.length; i++) {
    const { lat, lon } = points[i];
    const result = await fetchNASAPowerDataAtPoint(lat, lon, endDate, { includeMonthly: true });
    if (i === 0) firstPointResult = result;
    allPointResults.push({ params: result.params as Record<string, Record<string, number>>, recentDailyMeans: result.recentDailyMeans });
    const ehfResult = computeEHFFromDailyMeans(result.baselineDailyMeans, result.recentDailyMeans);
    if (ehfResult) {
      ehfValues.push(ehfResult.ehf);
      if (i === 0) ehfDetailsFirst = { T95: ehfResult.T95, T3: ehfResult.T3, T30: ehfResult.T30, EHI_sig: ehfResult.EHI_sig, EHI_accl: ehfResult.EHI_accl };
    }
    const monthlyParams = result.monthlyData && (result.monthlyData as { properties?: { parameter?: { PRECTOTCORR?: Record<string, number> } } }).properties?.parameter?.PRECTOTCORR;
    const spiResult = monthlyParams ? computeSPI12FromMonthly(monthlyParams) : null;
    if (spiResult) {
      spi12Values.push(spiResult.spi12);
      if (i === 0) spi12DetailsFirst = spiResult.spi12Details;
    }
  }

  if (!firstPointResult) throw new Error('NASA POWER: no valid data at city center');
  const { dates } = firstPointResult;
  const nPoints = allPointResults.length;

  const meanEHF = ehfValues.length > 0 ? ehfValues.reduce((a, b) => a + b, 0) / ehfValues.length : null;
  const meanSPI12 = spi12Values.length > 0 ? spi12Values.reduce((a, b) => a + b, 0) / spi12Values.length : null;
  const T95 = ehfDetailsFirst?.T95 ?? 0;
  const T3 = ehfDetailsFirst?.T3 ?? 0;
  const T30 = ehfDetailsFirst?.T30 ?? 0;
  const EHI_sig = ehfDetailsFirst ? ehfDetailsFirst.T3 - ehfDetailsFirst.T95 : 0;
  const EHI_accl = ehfDetailsFirst ? ehfDetailsFirst.T3 - ehfDetailsFirst.T30 : 0;

  const dates30 = dates.slice(-30);
  const toIso = (d: string) => d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
  const avg = (key: string, date: string) => {
    let sum = 0;
    let count = 0;
    for (const r of allPointResults) {
      const v = r.params[key]?.[date];
      if (v != null && v !== -999) {
        sum += v;
        count++;
      }
    }
    return count > 0 ? sum / count : -999;
  };

  const temperature_30d = dates30
    .map(date => ({ date: toIso(date), value: avg('T2M', date) }))
    .filter(d => d.value !== -999);
  const precipitation_30d = dates30
    .map(date => ({ date: toIso(date), value: avg('PRECTOTCORR', date) }))
    .filter(d => d.value !== -999);
  const wind_30d = dates30
    .map(date => ({ date: toIso(date), value: avg('WS2M', date) }))
    .filter(d => d.value !== -999);
  const pressure_30d = dates30
    .map(date => ({ date: toIso(date), value: avg('PS', date) }))
    .filter(d => d.value !== -999);
  const humidity_30d = dates30
    .map((date: string) => ({ date: toIso(date), value: avg('RH2M', date) }))
    .filter((d: { value: number }) => d.value !== -999);

  /** Baseline recentDailyMeans: per-day mean across the N points (same 33-day window). */
  const recentDailyMeansAveraged: number[] = [];
  const len33 = Math.min(33, ...allPointResults.map(r => r.recentDailyMeans.length));
  for (let j = 0; j < len33; j++) {
    let s = 0;
    let c = 0;
    for (const r of allPointResults) {
      if (r.recentDailyMeans[j] != null) {
        s += r.recentDailyMeans[j];
        c++;
      }
    }
    recentDailyMeansAveraged.push(c > 0 ? s / c : 0);
  }

  return {
    temperature_30d,
    precipitation_30d,
    wind_30d,
    pressure_30d,
    humidity_30d,
    current: {
      temperature: temperature_30d[temperature_30d.length - 1]?.value,
      precipitation: precipitation_30d[precipitation_30d.length - 1]?.value,
      wind: wind_30d[wind_30d.length - 1]?.value
    },
    baseline: {
      T95,
      recentDailyMeans: recentDailyMeansAveraged.length > 0 ? recentDailyMeansAveraged : firstPointResult.recentDailyMeans
    },
    indices: {
      spi: meanSPI12,
      spi_details: spi12DetailsFirst,
      current_month_precip_mm: spi12DetailsFirst?.current_12mo_mm ?? null,
      spi_n_points: spi12Values.length,
      ehf: meanEHF,
      ehf_details: ehfDetailsFirst ? { T95, T3, T30, EHI_sig, EHI_accl } : null,
      ehf_n_points: points.length,
      ehf_selection_radius_km: radiusKm,
      /** All indices and 30d series are computed from this many points sampled within the selection radius. */
      n_points: nPoints
    }
  };
}

/** Satellite indices (NDVI, NBR, MNDWI, etc.) from the GEE server using the same radius/center as EHF/SPI. */
async function fetchSatelliteIndices(city: {
  latitude: number;
  longitude: number;
  selection_radius_km?: number;
  selection_center_lat?: number;
  selection_center_lon?: number;
}): Promise<Record<string, unknown> | null> {
  const baseUrl = Deno.env.get("SATELLITE_INDICES_URL")?.replace(/\/$/, "");
  if (!baseUrl) return null;

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const centerLat = city.selection_center_lat ?? city.latitude;
  const centerLon = city.selection_center_lon ?? city.longitude;
  const radiusKm = city.selection_radius_km ?? 0.5;

  try {
    const res = await fetch(`${baseUrl}/indices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        center_lat: centerLat,
        center_lon: centerLon,
        radius_km: radiusKm,
        n_points: 10,
        start: startStr,
        end: endStr,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchWeatherAPIData(city) {
  const apiKey = Deno.env.get("WEATHERAPI_KEY");
  if (!apiKey) {
    return null;
  }
  
  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city.latitude},${city.longitude}&aqi=yes`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    current: {
      temperature: data.current.temp_c,
      feels_like: data.current.feelslike_c,
      wind_speed: data.current.wind_kph / 3.6, // Convert to m/s
      wind_direction: data.current.wind_dir,
      humidity: data.current.humidity,
      pressure: data.current.pressure_mb,
      precipitation: data.current.precip_mm,
      uv_index: data.current.uv,
      visibility: data.current.vis_km,
      cloud_cover: data.current.cloud
    },
    air_quality: data.current.air_quality ? {
      pm2_5: data.current.air_quality.pm2_5,
      pm10: data.current.air_quality.pm10,
      us_epa_index: data.current.air_quality['us-epa-index'],
      o3: data.current.air_quality.o3,
      no2: data.current.air_quality.no2,
      co: data.current.air_quality.co
    } : null
  };
}

function mergeDataSources(nasaData: Record<string, unknown>, weatherApiData: Record<string, unknown> | null) {
  if (!weatherApiData) {
    return nasaData;
  }
  return {
    ...nasaData,
    current: {
      ...(nasaData.current as object),
      ...(weatherApiData.current as object),
      air_quality: (weatherApiData as { air_quality?: unknown }).air_quality
    }
  };
}

function detectHazards(nasaData, city) {
  const hazards = [];
  
  // Heatwave detection using EHF
  const indices = (nasaData as { indices?: { ehf?: number | null; ehf_details?: { T95: number; T3: number; T30: number; EHI_sig: number; EHI_accl: number } | null } }).indices;
  const EHF = indices?.ehf ?? null;
  const ehfDetails = indices?.ehf_details;

  if (EHF != null) {
    let severity = 'low';
    let score = Math.min(Math.max(EHF, 0) / 10, 10);
    if (EHF > 40) severity = 'extreme';
    else if (EHF > 20) severity = 'severe';
    else if (EHF > 5) severity = 'moderate';
    hazards.push({
      type: 'heatwave',
      severity,
      score,
      index: 'EHF',
      value: EHF.toFixed(2),
      details: ehfDetails
        ? {
            T95: ehfDetails.T95.toFixed(1),
            T3: ehfDetails.T3.toFixed(1),
            T30: ehfDetails.T30.toFixed(1),
            EHI_sig: ehfDetails.EHI_sig.toFixed(2),
            EHI_accl: ehfDetails.EHI_accl.toFixed(2)
          }
        : undefined
    });
  }

  // Drought detection using SPI-12 (12-month standardized precipitation index)
  const SPI12 = indices?.spi ?? null;
  if (SPI12 != null && SPI12 < -1.0) {
    let severity = 'moderate';
    let score = Math.abs(SPI12) * 2;
    if (SPI12 < -2.0) severity = 'extreme';
    else if (SPI12 < -1.5) severity = 'severe';
    const spiDetails = (nasaData as { indices?: { spi_details?: { mean_12mo_mm?: number; std_12mo_mm?: number; current_12mo_mm?: number }; current_month_precip_mm?: number | null } }).indices;
    const d = spiDetails?.spi_details;
    hazards.push({
      type: 'drought',
      severity,
      score: Math.min(score, 10),
      index: 'SPI-12',
      value: SPI12.toFixed(2),
      details: d
        ? {
            mean_12mo_mm: d.mean_12mo_mm?.toFixed(2),
            current_12mo_mm: d.current_12mo_mm?.toFixed(2),
            std_12mo_mm: d.std_12mo_mm?.toFixed(2),
            n_years: d.n_years
          }
        : undefined
    });
  }

  // Wildfire / flood from satellite indices (hazard_state)
  const hazardState = (nasaData as { indices?: { hazard_state?: { wildfire?: { risk?: boolean; severity?: string }; flood?: { risk?: boolean; severity?: string } } } }).indices?.hazard_state;
  if (hazardState?.wildfire?.risk) {
    hazards.push({
      type: 'wildfire',
      severity: hazardState.wildfire.severity || 'moderate',
      score: 6,
      index: 'dNBR',
      value: (indices?.dnbr != null ? Number(indices.dnbr).toFixed(2) : '—'),
      details: { label: (indices as { nbr_label?: string })?.nbr_label }
    });
  }
  if (hazardState?.flood?.risk) {
    hazards.push({
      type: 'flood',
      severity: hazardState.flood.severity || 'moderate',
      score: 5,
      index: 'MNDWI',
      value: (indices?.mndwi != null ? Number(indices.mndwi).toFixed(2) : '—'),
      details: { label: (indices as { mndwi_label?: string })?.mndwi_label }
    });
  }
  
  // High wind detection
  const winds = nasaData.wind_30d.map(d => d.value).filter(v => v > 0);
  const maxWind = winds.length > 0 ? Math.max(...winds) : 0;
  
  hazards.push({
    type: 'high_wind',
    severity: maxWind > 25 ? 'severe' : maxWind > 15 ? 'moderate' : 'low',
    score: Math.min(maxWind / 3, 10),
    index: 'WS2M',
    value: maxWind.toFixed(1)
  });
  
  // Air quality detection using WeatherAPI data
  if (nasaData.current?.air_quality) {
    const aqi = nasaData.current.air_quality;
    const epaIndex = aqi.us_epa_index || 1;
    
    let severity = 'low';
    let score = epaIndex * 1.5;
    if (epaIndex >= 5) severity = 'extreme';
    else if (epaIndex >= 4) severity = 'severe';
    else if (epaIndex >= 3) severity = 'moderate';
    
    hazards.push({
      type: 'air_quality',
      severity,
      score: Math.min(score, 10),
      index: 'US EPA AQI',
      value: epaIndex,
      details: {
        pm2_5: aqi.pm2_5?.toFixed(1),
        pm10: aqi.pm10?.toFixed(1),
        o3: aqi.o3?.toFixed(1)
      }
    });
  } else {
    // Fallback with average data
    hazards.push({
      type: 'air_quality',
      severity: 'low',
      score: 2,
      index: 'US EPA AQI',
      value: 50
    });
  }
  
  return hazards;
}

async function generateCascadingChains(base44, city, hazards, nasaData) {
  const chains = [];
  
  // If no hazards detected, create baseline risk analysis
  const hazardsToAnalyze = hazards.length > 0 ? hazards.slice(0, 3) : [
    {
      type: 'baseline_climate',
      severity: 'low',
      score: 3,
      index: 'General',
      value: 'N/A'
    }
  ];
  
  for (const hazard of hazardsToAnalyze) {
    const prompt = `You are a climate risk analyst. Given a ${hazard.type} event with ${hazard.severity} severity (score: ${hazard.score}/10) in ${city.name} (population: ${city.population}, elevation: ${city.elevation}m), generate a cascading risk chain.

Current conditions:
- Temperature: ${nasaData.current.temperature}°C
- Wind: ${nasaData.current.wind} m/s
- Precipitation: ${nasaData.current.precipitation} mm

Generate a JSON object with this structure:
{
  "chain_id": "unique_id",
  "probability": 0.0-1.0,
  "severity": 0.0-1.0,
  "confidence": 0.0-1.0,
  "nodes": [
    {
      "layer": "hazard|environmental|infrastructure|human|economic",
      "description": "brief description",
      "impact": 0.0-1.0,
      "data": "supporting data point"
    }
  ]
}

Create a realistic 5-node cascading chain showing how this hazard cascades through systems.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          chain_id: { type: "string" },
          probability: { type: "number" },
          severity: { type: "number" },
          confidence: { type: "number" },
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                layer: { type: "string" },
                description: { type: "string" },
                impact: { type: "number" },
                data: { type: "string" }
              }
            }
          }
        }
      }
    });
    
    chains.push(response);
  }
  
  return chains;
}

function predictImpacts(hazards, city) {
  const impacts = {
    hospitalizations: 0,
    mortality: 0,
    infrastructure_stress: 0,
    economic_loss: 0
  };
  
  for (const hazard of hazards) {
    const baseMultiplier = city.population / 1000000;
    
    if (hazard.type === 'heatwave') {
      impacts.hospitalizations += Math.round(hazard.score * 50 * baseMultiplier);
      impacts.mortality += Math.round(hazard.score * 5 * baseMultiplier);
    }
    
    if (hazard.type === 'drought') {
      impacts.infrastructure_stress += hazard.score * 10;
      impacts.economic_loss += Math.round(hazard.score * 1000000 * baseMultiplier);
    }
    
    if (hazard.type === 'air_quality') {
      impacts.hospitalizations += Math.round(hazard.score * 30 * baseMultiplier);
    }
  }
  
  return impacts;
}