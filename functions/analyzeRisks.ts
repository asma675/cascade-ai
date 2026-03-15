import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { city } = await req.json();

    // Fetch NASA POWER data
    const nasaData = await fetchNASAPowerData(city);
    
    // Fetch WeatherAPI data for real-time validation
    const weatherApiData = await fetchWeatherAPIData(city);
    
    // Merge data sources
    const mergedData = mergeDataSources(nasaData, weatherApiData);
    
    // Detect hazards
    const hazards = detectHazards(mergedData, city);

    // Part 4: Exposure & Vulnerability conditioning
    const satelliteData = await fetchSatelliteDataIfAvailable(city);
    const exposureProfile = buildExposureProfile(city, mergedData, satelliteData);
    const vulnerabilityProfile = buildVulnerabilityProfile(city);

    // Generate cascading risk chains using AI
    const cascadingChains = await generateCascadingChains(base44, city, hazards, nasaData);

    // Part 5: Evidence-based outcome predictions (replaces naive predictImpacts)
    const outcomePredictions = await predictOutcomesEvidenceBased(hazards, city, exposureProfile, vulnerabilityProfile);

    // Legacy impacts (kept for backward compat)
    const predictedImpacts = predictImpacts(hazards, city);

    // Create assessment
    const assessment = {
      city_id: city.id,
      city_name: city.name,
      assessment_date: new Date().toISOString(),
      hazards_detected: hazards,
      cascading_chains: cascadingChains,
      environmental_data: mergedData,
      predicted_impacts: predictedImpacts,
      exposure_profile: exposureProfile,
      vulnerability_profile: vulnerabilityProfile,
      outcome_predictions: outcomePredictions,
      satellite_data: satelliteData,
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

async function fetchNASAPowerData(city: { latitude: number; longitude: number }) {
  const { latitude, longitude } = city;
  const endDate = new Date();

  // Fetch 30-year baseline for EHF (T95) using daily mean T = (Tmax+Tmin)/2
  const baselineStartDate = new Date();
  baselineStartDate.setFullYear(baselineStartDate.getFullYear() - 30);
  const baselineUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN&community=RE&longitude=${longitude}&latitude=${latitude}&start=${formatDateDaily(baselineStartDate)}&end=${formatDateDaily(endDate)}&format=JSON`;
  const baselineResponse = await fetch(baselineUrl);
  const baselineData = await baselineResponse.json();

  // Fetch recent 30 days for charts and EHF T3/T30 (canonical EHF uses daily mean T = (Tmax+Tmin)/2)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const dailyUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M,PS,RH2M&community=RE&longitude=${longitude}&latitude=${latitude}&start=${formatDateDaily(startDate)}&end=${formatDateDaily(endDate)}&format=JSON`;
  const response = await fetch(dailyUrl);
  const data = await response.json();

  // Fetch monthly precipitation for SPI; API expects year-only start/end and rejects future years (e.g. 2026)
  const endYear = Math.min(endDate.getFullYear(), 2025);
  const monthlyUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR&community=AG&longitude=${longitude}&latitude=${latitude}&start=1981&end=${endYear}&format=JSON`;
  const monthlyResponse = await fetch(monthlyUrl);
  const monthlyData = await monthlyResponse.json();
  
  // Process data into time series
  const params = data.properties.parameter;
  const dates = Object.keys(params.T2M || {});
  
  const temperature_30d = dates
    .map(date => ({
      date: date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8),
      value: params.T2M[date]
    }))
    .filter(d => d.value !== -999);
  
  const precipitation_30d = dates
    .map(date => ({
      date: date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8),
      value: params.PRECTOTCORR[date]
    }))
    .filter(d => d.value !== -999);
  
  const wind_30d = dates
    .map(date => ({
      date: date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8),
      value: params.WS2M[date]
    }))
    .filter(d => d.value !== -999);
  
  const pressure_30d = dates
    .map(date => ({
      date: date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8),
      value: params.PS[date]
    }))
    .filter(d => d.value !== -999);
  
  // Process baseline for EHF: daily mean T = (Tmax + Tmin)/2, then T95 = 95th percentile of those
  const baselineParams = baselineData.properties?.parameter ?? {};
  const baselineDates = Object.keys(baselineParams.T2M_MAX || {});
  const baselineDailyMeans = baselineDates
    .map((date: string) => {
      const tmax = baselineParams.T2M_MAX?.[date];
      const tmin = baselineParams.T2M_MIN?.[date];
      if (tmax == null || tmin == null || tmax === -999 || tmin === -999) return null;
      return (tmax + tmin) / 2;
    })
    .filter((v: number | null): v is number => v != null);
  const sortedBaseline = [...baselineDailyMeans].sort((a, b) => a - b);
  const t95Index = Math.min(Math.floor(sortedBaseline.length * 0.95), sortedBaseline.length - 1);
  const T95 = sortedBaseline[t95Index];

  // Recent daily mean temperatures for canonical EHF (T3, T30)
  const recentDailyMeans = dates
    .map((date: string) => {
      const tmax = params.T2M_MAX?.[date];
      const tmin = params.T2M_MIN?.[date];
      if (tmax == null || tmin == null || tmax === -999 || tmin === -999) return null;
      return (tmax + tmin) / 2;
    })
    .filter((v: number | null): v is number => v != null);

  // SPI-12: 12-month rolling precipitation total, historical same-ending-month totals, z-score
  let spi12: number | null = null;
  let spi12Details: { current_12mo_mm: number; mean_12mo_mm: number; std_12mo_mm: number; n_years: number } | null = null;
  const monthlyParams = monthlyData?.properties?.parameter?.PRECTOTCORR;
  if (monthlyParams && typeof monthlyParams === 'object') {
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
    if (monthKeys.length >= 12) {
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
      if (historical12mo.length >= 2) {
        const mean = historical12mo.reduce((a, b) => a + b, 0) / historical12mo.length;
        const variance = historical12mo.reduce((s, v) => s + (v - mean) ** 2, 0) / historical12mo.length;
        const std = Math.sqrt(variance);
        if (std > 0) {
          spi12 = (current12mo - mean) / std;
          spi12Details = {
            current_12mo_mm: current12mo,
            mean_12mo_mm: mean,
            std_12mo_mm: std,
            n_years: historical12mo.length
          };
        }
      }
    }
  }

  return {
    temperature_30d,
    precipitation_30d,
    wind_30d,
    pressure_30d,
    humidity_30d: dates
      .map((date: string) => ({
        date: date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8),
        value: params.RH2M[date]
      }))
      .filter((d: { value: number }) => d.value !== -999),
    current: {
      temperature: temperature_30d[temperature_30d.length - 1]?.value,
      precipitation: precipitation_30d[precipitation_30d.length - 1]?.value,
      wind: wind_30d[wind_30d.length - 1]?.value
    },
    baseline: {
      T95,
      recentDailyMeans
    },
    indices: (() => {
      let ehf: number | null = null;
      let ehfDetails: { T95: number; T3: number; T30: number; EHI_sig: number; EHI_accl: number } | null = null;
      if (recentDailyMeans.length >= 21) {
        const T3 = recentDailyMeans.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, recentDailyMeans.length);
        const T30 = recentDailyMeans.reduce((a, b) => a + b, 0) / recentDailyMeans.length;
        const EHI_sig = T3 - T95;
        const EHI_accl = T3 - T30;
        ehf = Math.max(0, EHI_sig * Math.max(1, EHI_accl));
        ehfDetails = { T95, T3, T30, EHI_sig, EHI_accl };
      }
      return {
        spi: spi12,
        spi_details: spi12Details,
        current_month_precip_mm: spi12Details?.current_12mo_mm ?? null,
        ehf,
        ehf_details: ehfDetails
      };
    })()
  };
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

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: Exposure & Vulnerability Conditioning Engine
// ═══════════════════════════════════════════════════════════════════════════════

// HDI lookup table (30+ countries) for vulnerability proxy estimation
const HDI_LOOKUP: Record<string, { hdi: number; elderly_frac: number; child_frac: number; income_cat: string }> = {
  'JP': { hdi: 0.925, elderly_frac: 0.29, child_frac: 0.12, income_cat: 'high' },
  'US': { hdi: 0.921, elderly_frac: 0.17, child_frac: 0.22, income_cat: 'high' },
  'CA': { hdi: 0.929, elderly_frac: 0.18, child_frac: 0.16, income_cat: 'high' },
  'DE': { hdi: 0.942, elderly_frac: 0.22, child_frac: 0.14, income_cat: 'high' },
  'GB': { hdi: 0.929, elderly_frac: 0.19, child_frac: 0.18, income_cat: 'high' },
  'FR': { hdi: 0.903, elderly_frac: 0.21, child_frac: 0.18, income_cat: 'high' },
  'AU': { hdi: 0.951, elderly_frac: 0.16, child_frac: 0.19, income_cat: 'high' },
  'KR': { hdi: 0.929, elderly_frac: 0.17, child_frac: 0.12, income_cat: 'high' },
  'IT': { hdi: 0.895, elderly_frac: 0.24, child_frac: 0.13, income_cat: 'high' },
  'ES': { hdi: 0.905, elderly_frac: 0.20, child_frac: 0.15, income_cat: 'high' },
  'NL': { hdi: 0.941, elderly_frac: 0.20, child_frac: 0.16, income_cat: 'high' },
  'SE': { hdi: 0.947, elderly_frac: 0.20, child_frac: 0.18, income_cat: 'high' },
  'NO': { hdi: 0.961, elderly_frac: 0.18, child_frac: 0.17, income_cat: 'high' },
  'CH': { hdi: 0.962, elderly_frac: 0.19, child_frac: 0.15, income_cat: 'high' },
  'SG': { hdi: 0.939, elderly_frac: 0.14, child_frac: 0.12, income_cat: 'high' },
  'CN': { hdi: 0.768, elderly_frac: 0.13, child_frac: 0.17, income_cat: 'upper_middle' },
  'BR': { hdi: 0.754, elderly_frac: 0.10, child_frac: 0.21, income_cat: 'upper_middle' },
  'MX': { hdi: 0.758, elderly_frac: 0.08, child_frac: 0.26, income_cat: 'upper_middle' },
  'TH': { hdi: 0.800, elderly_frac: 0.13, child_frac: 0.17, income_cat: 'upper_middle' },
  'TR': { hdi: 0.838, elderly_frac: 0.09, child_frac: 0.24, income_cat: 'upper_middle' },
  'ZA': { hdi: 0.713, elderly_frac: 0.06, child_frac: 0.29, income_cat: 'upper_middle' },
  'IN': { hdi: 0.644, elderly_frac: 0.07, child_frac: 0.26, income_cat: 'lower_middle' },
  'PH': { hdi: 0.699, elderly_frac: 0.06, child_frac: 0.30, income_cat: 'lower_middle' },
  'EG': { hdi: 0.731, elderly_frac: 0.06, child_frac: 0.34, income_cat: 'lower_middle' },
  'NG': { hdi: 0.535, elderly_frac: 0.03, child_frac: 0.43, income_cat: 'lower_middle' },
  'BD': { hdi: 0.661, elderly_frac: 0.06, child_frac: 0.27, income_cat: 'lower_middle' },
  'PK': { hdi: 0.544, elderly_frac: 0.05, child_frac: 0.35, income_cat: 'lower_middle' },
  'KE': { hdi: 0.575, elderly_frac: 0.03, child_frac: 0.39, income_cat: 'lower_middle' },
  'ET': { hdi: 0.498, elderly_frac: 0.04, child_frac: 0.40, income_cat: 'low' },
  'AF': { hdi: 0.462, elderly_frac: 0.03, child_frac: 0.46, income_cat: 'low' },
  'HT': { hdi: 0.535, elderly_frac: 0.05, child_frac: 0.33, income_cat: 'low' },
  'AE': { hdi: 0.911, elderly_frac: 0.02, child_frac: 0.13, income_cat: 'high' },
  'SA': { hdi: 0.875, elderly_frac: 0.04, child_frac: 0.25, income_cat: 'high' },
  'RU': { hdi: 0.822, elderly_frac: 0.16, child_frac: 0.18, income_cat: 'upper_middle' },
  'AR': { hdi: 0.842, elderly_frac: 0.12, child_frac: 0.24, income_cat: 'upper_middle' },
  'CL': { hdi: 0.855, elderly_frac: 0.12, child_frac: 0.20, income_cat: 'high' },
  'CO': { hdi: 0.752, elderly_frac: 0.09, child_frac: 0.23, income_cat: 'upper_middle' },
  'ID': { hdi: 0.713, elderly_frac: 0.06, child_frac: 0.26, income_cat: 'upper_middle' },
  'VN': { hdi: 0.726, elderly_frac: 0.08, child_frac: 0.23, income_cat: 'lower_middle' },
  'MY': { hdi: 0.803, elderly_frac: 0.07, child_frac: 0.23, income_cat: 'upper_middle' },
};

// Default for unknown countries
const HDI_DEFAULT = { hdi: 0.72, elderly_frac: 0.08, child_frac: 0.25, income_cat: 'lower_middle' };

function classifyClimateZone(lat: number): string {
  const absLat = Math.abs(lat);
  if (absLat <= 10) return 'tropical';
  if (absLat <= 25) return 'subtropical';
  if (absLat <= 45) return 'temperate';
  if (absLat <= 65) return 'continental';
  return 'polar';
}

function classifyDensity(pop: number): string {
  if (pop > 10_000_000) return 'mega_city';
  if (pop > 3_000_000) return 'very_high';
  if (pop > 1_000_000) return 'high';
  if (pop > 300_000) return 'medium';
  return 'low';
}

async function fetchSatelliteDataIfAvailable(city: { latitude: number; longitude: number }) {
  const satelliteUrl = Deno.env.get("SATELLITE_SERVICE_URL") || "http://localhost:5000";
  try {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const startStr = start.toISOString().split('T')[0];

    const resp = await fetch(`${satelliteUrl}/indices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: city.latitude,
        lon: city.longitude,
        start: startStr,
        end: end,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function buildExposureProfile(
  city: { id?: string; name?: string; latitude: number; longitude: number; population?: number; elevation?: number; country_code?: string },
  mergedData: Record<string, unknown>,
  satelliteData: Record<string, unknown> | null,
) {
  const population = city.population || 500_000;
  const elevation = city.elevation || 50;
  const lat = city.latitude;

  // Population density estimate (using city area heuristic: ~100-2000 km² for cities)
  const estimatedAreaKm2 = population > 5_000_000 ? 1500 : population > 1_000_000 ? 800 : 300;
  const populationDensityPerKm2 = Math.round(population / estimatedAreaKm2);
  const densityCategory = classifyDensity(population);

  // Coastal proximity proxy from elevation
  const coastalProximityKm = elevation < 10 ? 5 : elevation < 50 ? 20 : elevation < 200 ? 80 : 200;

  // River proximity proxy from recent precipitation patterns
  const precipData = mergedData.precipitation_30d as Array<{ value: number }> | undefined;
  const avgPrecip = precipData && precipData.length > 0
    ? precipData.reduce((s, d) => s + d.value, 0) / precipData.length
    : 2;
  const riverProximityCategory = avgPrecip > 5 ? 'near' : avgPrecip > 2 ? 'moderate' : 'far';

  // Infrastructure density score (population-based proxy, 0-1)
  const infrastructureDensityScore = Math.min(1, population / 10_000_000);

  // Urban fraction from satellite NDVI or population proxy
  let urbanFraction = 0.7; // default for cities
  let ndviCurrent: number | null = null;
  let landClass = 'urban';
  if (satelliteData) {
    ndviCurrent = (satelliteData as { ndvi?: number }).ndvi ?? null;
    landClass = (satelliteData as { land_class?: string }).land_class ?? 'urban';
    if (ndviCurrent != null) {
      urbanFraction = Math.max(0, Math.min(1, 1 - ndviCurrent));
    }
  } else {
    urbanFraction = population > 3_000_000 ? 0.85 : population > 500_000 ? 0.7 : 0.5;
  }

  const climateZone = classifyClimateZone(lat);

  const proxyFlags: string[] = [];
  proxyFlags.push('population_density_estimated_from_heuristic_area');
  proxyFlags.push('coastal_proximity_from_elevation');
  proxyFlags.push('river_proximity_from_precipitation');
  if (!satelliteData) proxyFlags.push('urban_fraction_estimated_from_population');

  return {
    city_id: city.id || city.name || 'unknown',
    population,
    population_density_per_km2: populationDensityPerKm2,
    density_category: densityCategory,
    urban_fraction: parseFloat(urbanFraction.toFixed(2)),
    elevation_m: elevation,
    coastal_proximity_km: coastalProximityKm,
    river_proximity_category: riverProximityCategory,
    infrastructure_density_score: parseFloat(infrastructureDensityScore.toFixed(3)),
    ndvi_current: ndviCurrent,
    land_class: landClass,
    climate_zone: climateZone,
    data_sources: satelliteData ? ['nasa_power', 'weatherapi', 'sentinel2'] : ['nasa_power', 'weatherapi'],
    proxy_flags: proxyFlags,
  };
}

function buildVulnerabilityProfile(
  city: { id?: string; name?: string; country_code?: string; population?: number },
) {
  const countryCode = (city.country_code || 'XX').toUpperCase();
  const lookup = HDI_LOOKUP[countryCode] || HDI_DEFAULT;

  const elderlyFraction = lookup.elderly_frac;
  const childFraction = lookup.child_frac;
  const dependencyRatio = parseFloat((elderlyFraction + childFraction).toFixed(3));
  const hdiProxy = lookup.hdi;
  const incomeCategory = lookup.income_cat;

  // Poverty rate proxy from HDI
  const povertyRateProxy = parseFloat(Math.max(0, (1 - hdiProxy) * 0.6).toFixed(3));

  // Access scores (0-1, higher = better access)
  const coolingAccessScore = hdiProxy > 0.8 ? 0.8 : hdiProxy > 0.6 ? 0.5 : 0.2;
  const healthcareAccessScore = hdiProxy > 0.85 ? 0.9 : hdiProxy > 0.7 ? 0.6 : hdiProxy > 0.5 ? 0.35 : 0.15;
  const earlyWarningScore = hdiProxy > 0.8 ? 0.85 : hdiProxy > 0.6 ? 0.55 : 0.25;

  // Social Vulnerability Index (SVI): higher = more vulnerable
  const svi = parseFloat(
    (1 - (
      (1 - dependencyRatio) * 0.3 +
      hdiProxy * 0.3 +
      coolingAccessScore * 0.15 +
      healthcareAccessScore * 0.15 +
      earlyWarningScore * 0.1
    )).toFixed(3)
  );

  // Adaptive Capacity Index (ACI): higher = more capacity to adapt
  const aci = parseFloat(
    (
      hdiProxy * 0.35 +
      healthcareAccessScore * 0.25 +
      earlyWarningScore * 0.2 +
      coolingAccessScore * 0.1 +
      (1 - povertyRateProxy) * 0.1
    ).toFixed(3)
  );

  const proxyFlags = [
    'demographics_from_country_hdi_table',
    'access_scores_from_hdi_proxy',
    'svi_aci_composite_indices',
  ];
  if (!HDI_LOOKUP[countryCode]) {
    proxyFlags.push('country_not_in_lookup_using_global_defaults');
  }

  return {
    city_id: city.id || city.name || 'unknown',
    elderly_fraction: elderlyFraction,
    child_fraction: childFraction,
    dependency_ratio: dependencyRatio,
    hdi_proxy: hdiProxy,
    income_category: incomeCategory,
    poverty_rate_proxy: povertyRateProxy,
    cooling_access_score: coolingAccessScore,
    healthcare_access_score: healthcareAccessScore,
    early_warning_score: earlyWarningScore,
    social_vulnerability_index: svi,
    adaptive_capacity_index: aci,
    data_sources: ['undp_hdi_2023', 'country_proxy'],
    proxy_flags: proxyFlags,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: Evidence-Based Quantitative Outcome Prediction
// ═══════════════════════════════════════════════════════════════════════════════

const OUTCOME_TYPES_BY_HAZARD: Record<string, string[]> = {
  heatwave: ['mortality', 'hospitalizations', 'infrastructure_stress', 'aid_requests'],
  drought: ['vegetation_stress', 'mortality', 'fire_activity', 'infrastructure_stress'],
  flood: ['displacement', 'hospitalizations', 'infrastructure_stress', 'mortality'],
  wildfire: ['hospitalizations', 'mortality', 'displacement', 'fire_activity'],
  air_quality: ['mortality', 'hospitalizations'],
  high_wind: ['infrastructure_stress', 'displacement'],
};

const OUTCOME_UNITS: Record<string, string> = {
  mortality: 'excess deaths per 100k',
  hospitalizations: 'excess admissions per 100k',
  displacement: 'persons displaced per 100k exposed',
  infrastructure_stress: 'percent increase in service disruption',
  vegetation_stress: 'percent NDVI decrease',
  fire_activity: 'percent increase in burned area',
  aid_requests: 'aid requests per 100k',
};

async function fetchMatchingEvidence(hazardType: string, outcomeType: string, climateZone: string) {
  const evidenceUrl = Deno.env.get("EVIDENCE_SERVICE_URL") || "http://localhost:5001";
  try {
    const resp = await fetch(`${evidenceUrl}/evidence/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hazard_type: hazardType,
        outcome_type: outcomeType,
        climate_zone: climateZone,
        limit: 5,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.evidence || [];
  } catch {
    return [];
  }
}

function computeVulnerabilityModifier(vulnerability: Record<string, unknown>, outcomeType: string): number {
  const svi = (vulnerability.social_vulnerability_index as number) || 0.5;
  const aci = (vulnerability.adaptive_capacity_index as number) || 0.5;
  const elderlyFrac = (vulnerability.elderly_fraction as number) || 0.1;
  const coolingAccess = (vulnerability.cooling_access_score as number) || 0.5;
  const healthcareAccess = (vulnerability.healthcare_access_score as number) || 0.5;

  let modifier = 1.0;

  // SVI amplifies risk, ACI dampens it
  modifier *= (0.5 + svi); // 0.5 to 1.5x
  modifier *= (1.5 - aci * 0.5); // 0.75 to 1.5x

  // Outcome-specific modifiers
  if (outcomeType === 'mortality' || outcomeType === 'hospitalizations') {
    modifier *= (1 + elderlyFrac); // elderly fraction amplifies health outcomes
    modifier *= (1.3 - healthcareAccess * 0.3); // poor healthcare amplifies
  }
  if (outcomeType === 'mortality' && coolingAccess < 0.5) {
    modifier *= 1.2; // low cooling access amplifies heat mortality
  }
  if (outcomeType === 'displacement') {
    modifier *= (1.5 - aci * 0.5); // low adaptive capacity = more displacement
  }

  return parseFloat(Math.max(0.3, Math.min(3.0, modifier)).toFixed(3));
}

function computeExposureModifier(exposure: Record<string, unknown>, hazardType: string): number {
  const density = (exposure.population_density_per_km2 as number) || 3000;
  const coastalKm = (exposure.coastal_proximity_km as number) || 100;
  const urbanFraction = (exposure.urban_fraction as number) || 0.7;
  const infraScore = (exposure.infrastructure_density_score as number) || 0.5;

  let modifier = 1.0;

  // Density: denser areas have more exposed population
  if (density > 10000) modifier *= 1.3;
  else if (density > 5000) modifier *= 1.15;
  else if (density < 1000) modifier *= 0.7;

  // Hazard-specific exposure adjustments
  if (hazardType === 'flood' && coastalKm < 20) modifier *= 1.4;
  if (hazardType === 'heatwave' && urbanFraction > 0.8) modifier *= 1.2; // UHI effect
  if (hazardType === 'high_wind' && coastalKm < 30) modifier *= 1.3;

  return parseFloat(Math.max(0.3, Math.min(3.0, modifier)).toFixed(3));
}

function computeEvidenceBasedPrediction(
  hazard: { type: string; severity: string; score: number },
  outcomeType: string,
  evidence: Array<Record<string, unknown>>,
  population: number,
  exposureModifier: number,
  vulnerabilityModifier: number,
) {
  if (evidence.length === 0) return null;

  const topEvidence = evidence[0];
  const effectValue = (topEvidence.effect_value as number) || 1.0;
  const effectMetric = (topEvidence.effect_metric as string) || 'relative_risk';
  const baselineRate = (topEvidence.baseline_rate_per_100k as number) || null;
  const ci = (topEvidence.confidence_interval as [number, number]) || null;
  const qualityScore = (topEvidence.study_quality_score as number) || 0.5;

  // Hazard intensity factor from score (0-10)
  const intensityFactor = hazard.score / 5; // normalized so score=5 gives factor=1

  let predicted = 0;
  let lower = 0;
  let upper = 0;
  let unit = OUTCOME_UNITS[outcomeType] || 'units per 100k';

  if (effectMetric === 'relative_risk' || effectMetric === 'odds_ratio') {
    // RR/OR: excess = baseline * (RR^intensity - 1) * modifiers
    const baseline = baselineRate || getDefaultBaseline(outcomeType);
    const scaledRR = Math.pow(effectValue, intensityFactor);
    const excess = baseline * (scaledRR - 1) * exposureModifier * vulnerabilityModifier;
    predicted = Math.max(0, excess);

    if (ci) {
      const lowerRR = Math.pow(ci[0], intensityFactor);
      const upperRR = Math.pow(ci[1], intensityFactor);
      lower = Math.max(0, baseline * (lowerRR - 1) * exposureModifier * vulnerabilityModifier);
      upper = Math.max(0, baseline * (upperRR - 1) * exposureModifier * vulnerabilityModifier);
    } else {
      lower = predicted * 0.5;
      upper = predicted * 2.0;
    }
  } else if (effectMetric === 'percent_increase') {
    // Direct percentage increase scaled by intensity
    predicted = effectValue * intensityFactor * exposureModifier * vulnerabilityModifier;
    lower = predicted * 0.5;
    upper = predicted * 2.0;
    unit = 'percent increase';
  } else if (effectMetric === 'absolute_increase') {
    predicted = effectValue * intensityFactor * exposureModifier * vulnerabilityModifier;
    lower = predicted * 0.5;
    upper = predicted * 2.0;
  } else {
    // Fallback: treat as multiplier
    const baseline = getDefaultBaseline(outcomeType);
    predicted = baseline * effectValue * intensityFactor * exposureModifier * vulnerabilityModifier;
    lower = predicted * 0.5;
    upper = predicted * 2.0;
  }

  // Scale from per-100k to absolute numbers
  const popFactor = population / 100_000;
  const absolutePredicted = Math.round(predicted * popFactor);
  const absoluteLower = Math.round(lower * popFactor);
  const absoluteUpper = Math.round(upper * popFactor);

  // Confidence based on evidence quality, count, and CI availability
  const evidenceCountBonus = Math.min(evidence.length * 0.1, 0.3);
  const ciBonus = ci ? 0.1 : 0;
  const confidence = parseFloat(Math.min(1, qualityScore * 0.5 + evidenceCountBonus + ciBonus + 0.1).toFixed(2));

  return {
    outcome_type: outcomeType,
    hazard_type: hazard.type,
    predicted_value: absolutePredicted,
    predicted_per_100k: parseFloat(predicted.toFixed(2)),
    predicted_unit: unit,
    lower_bound: absoluteLower,
    upper_bound: absoluteUpper,
    confidence_level: confidence,
    evidence_count: evidence.length,
    evidence_ids: evidence.map(e => (e as { id?: string }).id).filter(Boolean),
    primary_evidence_doi: (topEvidence.doi as string) || null,
    vulnerability_modifier: vulnerabilityModifier,
    exposure_modifier: exposureModifier,
    method: 'evidence_based',
    method_detail: `${effectMetric} from ${topEvidence.title || 'peer-reviewed study'} (${topEvidence.year || 'N/A'})`,
  };
}

function getDefaultBaseline(outcomeType: string): number {
  const baselines: Record<string, number> = {
    mortality: 800,          // ~800/100k all-cause annual
    hospitalizations: 3000,  // ~3000/100k annual
    displacement: 50,        // ~50/100k annual avg
    infrastructure_stress: 5, // 5% baseline disruption
    vegetation_stress: 5,    // 5% baseline NDVI loss
    fire_activity: 2,        // 2% baseline
    aid_requests: 100,       // 100/100k baseline
  };
  return baselines[outcomeType] || 100;
}

function computeFallbackPrediction(
  hazard: { type: string; severity: string; score: number },
  outcomeType: string,
  population: number,
  exposureModifier: number,
  vulnerabilityModifier: number,
) {
  const popFactor = population / 100_000;
  const baseline = getDefaultBaseline(outcomeType);

  // Simple heuristic: baseline * (score/10) * modifiers
  const heuristicRate = baseline * (hazard.score / 10) * 0.1 * exposureModifier * vulnerabilityModifier;
  const predicted = Math.round(heuristicRate * popFactor);

  return {
    outcome_type: outcomeType,
    hazard_type: hazard.type,
    predicted_value: Math.max(0, predicted),
    predicted_per_100k: parseFloat(heuristicRate.toFixed(2)),
    predicted_unit: OUTCOME_UNITS[outcomeType] || 'units per 100k',
    lower_bound: Math.round(predicted * 0.3),
    upper_bound: Math.round(predicted * 3.0),
    confidence_level: 0.2,
    evidence_count: 0,
    evidence_ids: [],
    primary_evidence_doi: null,
    vulnerability_modifier: vulnerabilityModifier,
    exposure_modifier: exposureModifier,
    method: 'heuristic',
    method_detail: `Heuristic estimate: baseline × (hazard_score/10) × 0.1 × modifiers. Low confidence.`,
  };
}

async function predictOutcomesEvidenceBased(
  hazards: Array<{ type: string; severity: string; score: number }>,
  city: { population?: number },
  exposureProfile: Record<string, unknown>,
  vulnerabilityProfile: Record<string, unknown>,
) {
  const population = city.population || 500_000;
  const climateZone = (exposureProfile.climate_zone as string) || 'temperate';
  const predictions: Array<Record<string, unknown>> = [];
  let totalConfidence = 0;
  let fallbackUsed = false;

  for (const hazard of hazards) {
    const outcomeTypes = OUTCOME_TYPES_BY_HAZARD[hazard.type] || ['mortality', 'hospitalizations'];

    for (const outcomeType of outcomeTypes) {
      const exposureModifier = computeExposureModifier(exposureProfile, hazard.type);
      const vulnerabilityModifier = computeVulnerabilityModifier(vulnerabilityProfile, outcomeType);

      // Try evidence-based prediction
      const evidence = await fetchMatchingEvidence(hazard.type, outcomeType, climateZone);

      let prediction: Record<string, unknown> | null = null;

      if (evidence.length > 0) {
        prediction = computeEvidenceBasedPrediction(
          hazard, outcomeType, evidence, population, exposureModifier, vulnerabilityModifier,
        );
      }

      if (!prediction) {
        // Fallback to heuristic
        prediction = computeFallbackPrediction(
          hazard, outcomeType, population, exposureModifier, vulnerabilityModifier,
        );
        fallbackUsed = true;
      }

      predictions.push(prediction);
      totalConfidence += (prediction.confidence_level as number) || 0;
    }
  }

  const overallConfidence = predictions.length > 0
    ? parseFloat((totalConfidence / predictions.length).toFixed(2))
    : 0;

  return {
    city_id: exposureProfile.city_id || 'unknown',
    predictions,
    overall_confidence: overallConfidence,
    fallback_used: fallbackUsed,
    prediction_count: predictions.length,
  };
}