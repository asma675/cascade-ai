import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { city } = await req.json();

    // Fetch NASA POWER data
    const nasaData = await fetchNASAPowerData(city);
    
    // Detect hazards
    const hazards = detectHazards(nasaData, city);
    
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
      environmental_data: nasaData,
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
  
  // NASA POWER API - Daily data for past 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
  
  const dailyUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR,WS2M,PS,RH2M&community=RE&longitude=${longitude}&latitude=${latitude}&start=${formatDate(startDate)}&end=${formatDate(endDate)}&format=JSON`;
  
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
    }
  };
}

function detectHazards(nasaData, city) {
  const hazards = [];
  
  // Heatwave detection (Excess Heat Factor)
  const temps = nasaData.temperature_30d.map(d => d.value);
  const recentTemps = temps.slice(-7);
  const avgTemp = recentTemps.reduce((a, b) => a + b, 0) / recentTemps.length;
  
  if (avgTemp > 35) {
    const ehf = (avgTemp - 30) * 2;
    let severity = 'low';
    if (ehf > 80) severity = 'extreme';
    else if (ehf > 20) severity = 'severe';
    else if (ehf > 5) severity = 'moderate';
    
    hazards.push({
      type: 'heatwave',
      severity,
      score: Math.min(ehf / 10, 10),
      index: 'EHF',
      value: ehf.toFixed(1)
    });
  }
  
  // Drought detection (SPI approximation)
  const precipitations = nasaData.precipitation_30d.map(d => d.value);
  const avgPrecip = precipitations.reduce((a, b) => a + b, 0) / precipitations.length;
  const monthlyPrecip = precipitations.slice(-30).reduce((a, b) => a + b, 0);
  
  if (monthlyPrecip < avgPrecip * 0.5) {
    const spi = -1.5;
    hazards.push({
      type: 'drought',
      severity: 'moderate',
      score: 6.5,
      index: 'SPI',
      value: spi.toFixed(2)
    });
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
  
  // Air quality estimation (based on location and conditions)
  if (city.population > 5000000) {
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
  
  for (const hazard of hazards.slice(0, 3)) {
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