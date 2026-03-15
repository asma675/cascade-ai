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
    
    // Generate cascading risk chains using AI
    const cascadingChains = await generateCascadingChains(base44, city, hazards, nasaData);
    
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