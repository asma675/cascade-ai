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

async function fetchNASAPowerData(city) {
  const { latitude, longitude } = city;
  
  const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
  const endDate = new Date();
  
  // Fetch 30-year baseline for EHF calculation
  const baselineStartDate = new Date();
  baselineStartDate.setFullYear(baselineStartDate.getFullYear() - 30);
  
  const baselineUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX&community=RE&longitude=${longitude}&latitude=${latitude}&start=${formatDate(baselineStartDate)}&end=${formatDate(endDate)}&format=JSON`;
  
  const baselineResponse = await fetch(baselineUrl);
  const baselineData = await baselineResponse.json();
  
  // Fetch recent 30 days for current metrics
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const dailyUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,PRECTOTCORR,WS2M,PS,RH2M&community=RE&longitude=${longitude}&latitude=${latitude}&start=${formatDate(startDate)}&end=${formatDate(endDate)}&format=JSON`;
  
  const response = await fetch(dailyUrl);
  const data = await response.json();
  
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
  
  // Process baseline data for EHF
  const baselineParams = baselineData.properties.parameter;
  const baselineMaxTemps = Object.values(baselineParams.T2M_MAX || {}).filter(v => v !== -999);
  
  // Calculate T95 (95th percentile of 30-year max temperatures)
  const sortedBaseline = [...baselineMaxTemps].sort((a, b) => a - b);
  const t95Index = Math.floor(sortedBaseline.length * 0.95);
  const T95 = sortedBaseline[t95Index];
  
  // Get recent max temperatures for T3 and T30 calculations
  const recentMaxTemps = dates
    .map(date => params.T2M_MAX[date])
    .filter(v => v !== -999);
  
  return {
    temperature_30d,
    precipitation_30d,
    wind_30d,
    pressure_30d,
    humidity_30d: dates
      .map(date => ({
        date: date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8),
        value: params.RH2M[date]
      }))
      .filter(d => d.value !== -999),
    current: {
      temperature: temperature_30d[temperature_30d.length - 1]?.value,
      precipitation: precipitation_30d[precipitation_30d.length - 1]?.value,
      wind: wind_30d[wind_30d.length - 1]?.value
    },
    baseline: {
      T95,
      recentMaxTemps
    }
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

function mergeDataSources(nasaData, weatherApiData) {
  if (!weatherApiData) {
    return nasaData;
  }
  
  return {
    ...nasaData,
    current: {
      ...nasaData.current,
      ...weatherApiData.current,
      air_quality: weatherApiData.air_quality
    }
  };
}

function detectHazards(nasaData, city) {
  const hazards = [];
  
  // Heatwave detection using proper EHF calculation
  if (nasaData.baseline && nasaData.baseline.recentMaxTemps.length >= 30) {
    const { T95, recentMaxTemps } = nasaData.baseline;
    
    // T3: Average of last 3 days max temperature
    const T3 = recentMaxTemps.slice(-3).reduce((a, b) => a + b, 0) / 3;
    
    // T30: Average of last 30 days max temperature
    const T30 = recentMaxTemps.reduce((a, b) => a + b, 0) / recentMaxTemps.length;
    
    // EHI_sig: Significance component
    const EHI_sig = T3 - T95;
    
    // EHI_accl: Acclimatization component
    const EHI_accl = T3 - T30;
    
    // EHF: Excess Heat Factor
    const EHF = EHI_sig * Math.max(1, EHI_accl);
    
    // Detect heatwave if EHF is positive
    if (EHF > 0) {
      let severity = 'low';
      let score = Math.min(EHF / 10, 10);
      
      if (EHF > 40) severity = 'extreme';
      else if (EHF > 20) severity = 'severe';
      else if (EHF > 5) severity = 'moderate';
      
      hazards.push({
        type: 'heatwave',
        severity,
        score,
        index: 'EHF',
        value: EHF.toFixed(2),
        details: {
          T95: T95.toFixed(1),
          T3: T3.toFixed(1),
          T30: T30.toFixed(1),
          EHI_sig: EHI_sig.toFixed(2),
          EHI_accl: EHI_accl.toFixed(2)
        }
      });
    }
  }
  
  // Drought detection using Standardized Precipitation Index (SPI)
  const precipitations = nasaData.precipitation_30d.map(d => d.value);
  
  if (precipitations.length >= 30) {
    // Calculate mean and standard deviation of precipitation
    const mean = precipitations.reduce((a, b) => a + b, 0) / precipitations.length;
    const variance = precipitations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / precipitations.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate recent precipitation (last 30 days total)
    const recentPrecip = precipitations.reduce((a, b) => a + b, 0);
    
    // SPI = (observed - mean) / stdDev
    const SPI = stdDev > 0 ? (recentPrecip - (mean * precipitations.length)) / (stdDev * Math.sqrt(precipitations.length)) : 0;
    
    // Detect drought if SPI < -1.0 (moderate or worse)
    if (SPI < -1.0) {
      let severity = 'moderate';
      let score = Math.abs(SPI) * 2;
      
      if (SPI < -2.0) severity = 'extreme';
      else if (SPI < -1.5) severity = 'severe';
      
      hazards.push({
        type: 'drought',
        severity,
        score: Math.min(score, 10),
        index: 'SPI',
        value: SPI.toFixed(2),
        details: {
          mean_precip: mean.toFixed(2),
          recent_total: recentPrecip.toFixed(2),
          std_dev: stdDev.toFixed(2)
        }
      });
    }
  }
  
  // High wind detection
  const winds = nasaData.wind_30d.map(d => d.value);
  const maxWind = Math.max(...winds);
  
  if (maxWind > 15) {
    hazards.push({
      type: 'high_wind',
      severity: maxWind > 25 ? 'severe' : 'moderate',
      score: Math.min(maxWind / 3, 10),
      index: 'WS2M',
      value: maxWind.toFixed(1)
    });
  }
  
  // Air quality detection using WeatherAPI data
  if (nasaData.current?.air_quality) {
    const aqi = nasaData.current.air_quality;
    const epaIndex = aqi.us_epa_index;
    
    if (epaIndex >= 3) {
      let severity = 'moderate';
      let score = epaIndex * 1.5;
      
      if (epaIndex >= 5) severity = 'extreme';
      else if (epaIndex >= 4) severity = 'severe';
      
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
    }
  } else if (city.population > 5000000) {
    // Fallback estimation for large cities
    hazards.push({
      type: 'air_quality',
      severity: 'moderate',
      score: 5.5,
      index: 'AQI',
      value: '120'
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