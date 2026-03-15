import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import OpenAI from 'npm:openai';

const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { query, context } = await req.json();

        // Prepare comprehensive data context for AI agents
        const dataContext = {
            city: context.city || {},
            hazards: context.hazard ? [context.hazard] : (context.hazards || []),
            environmental: {
                nasa_power_data: context.current_conditions || {},
                temperature_trends: context.environmental_data?.temperature_trend || [],
                precipitation_trends: context.environmental_data?.precipitation_trend || [],
                wind_data: context.environmental_data?.wind_30d || [],
                pressure_data: context.environmental_data?.pressure_30d || [],
                climate_indices: {
                    ehf: context.environmental_data?.indices?.ehf,
                    spi: context.environmental_data?.indices?.spi,
                    details: context.environmental_data?.indices
                }
            },
            vulnerability_factors: context.city?.vulnerability_factors || {},
            population: context.city?.population || 0,
            climate_zone: context.city?.climate_zone || 'unknown'
        };

        // Agent 1: OpenAI GPT-4o - Pattern Recognition & Historical Analysis
        const openaiAnalysis = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert climate pattern analyst with access to NASA satellite data, historical climate records, and real-time environmental metrics. Analyze patterns, correlations, and anomalies in the data to identify climate trends and their implications.

Focus on:
- Statistical analysis of temperature, precipitation, wind patterns
- Climate index interpretation (EHF for heatwaves, SPI-12 for drought)
- Historical trend deviations and anomalies
- Spatial and temporal correlation patterns
- Early warning indicators from the data`
                },
                {
                    role: "user",
                    content: `Analyze climate patterns for this scenario:

Query: ${query}

Data Available:
- City: ${dataContext.city.name}, Population: ${dataContext.population.toLocaleString()}, Climate Zone: ${dataContext.climate_zone}
- Current Hazards: ${JSON.stringify(dataContext.hazards)}
- NASA POWER Data: ${JSON.stringify(dataContext.environmental.nasa_power_data)}
- Climate Indices: EHF=${dataContext.environmental.climate_indices.ehf?.toFixed(2) || 'N/A'}, SPI-12=${dataContext.environmental.climate_indices.spi?.toFixed(2) || 'N/A'}
- Temperature Trend (7-day): ${JSON.stringify(dataContext.environmental.temperature_trends)}
- Precipitation Trend (7-day): ${JSON.stringify(dataContext.environmental.precipitation_trends)}
- Vulnerability Factors: ${JSON.stringify(dataContext.vulnerability_factors)}

Provide a detailed pattern analysis identifying key climate trends, anomalies, and their significance.`
                }
            ],
            temperature: 0.3,
        });

        // Agent 2: Watson - Risk Assessment & Cascading Impact Predictions
        let watsonAnalysis = null;
        
        try {
            const watsonPrompt = `You are a disaster risk assessment expert specializing in cascading climate impacts. Using real environmental data and vulnerability assessments, predict how climate hazards cascade through interconnected systems.

Scenario: ${query}

City Profile:
- Location: ${dataContext.city.name} (${dataContext.city.country})
- Population: ${dataContext.population.toLocaleString()}
- Climate Zone: ${dataContext.climate_zone}
- Elevation: ${dataContext.city.elevation}m

Current Environmental Conditions:
- Hazards Detected: ${dataContext.hazards.map(h => `${h.type} (severity: ${h.severity}, score: ${h.score}/10)`).join(', ')}
- Temperature: ${dataContext.environmental.nasa_power_data.temperature || 'N/A'}°C
- Precipitation: ${dataContext.environmental.nasa_power_data.precipitation || 'N/A'}mm
- Wind Speed: ${dataContext.environmental.nasa_power_data.wind || 'N/A'}m/s
- Climate Indices: EHF=${dataContext.environmental.climate_indices.ehf?.toFixed(2) || 'N/A'} (heatwave), SPI-12=${dataContext.environmental.climate_indices.spi?.toFixed(2) || 'N/A'} (drought)

Vulnerability Context:
${JSON.stringify(dataContext.vulnerability_factors, null, 2)}

Based on this data, assess:
1. Primary cascading pathways from detected hazards
2. Secondary and tertiary impact chains across infrastructure, environmental, human, and economic systems
3. Probability and severity of each cascade stage
4. Critical thresholds and tipping points
5. Most vulnerable sectors and populations

Provide a comprehensive cascading risk assessment with realistic impact predictions.`;

            const watsonResponse = await fetch(`${Deno.env.get("WATSON_URL")}/message`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get("WATSON_API_KEY")}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text: watsonPrompt },
                    context: {
                        metadata: {
                            deployment: 'production'
                        }
                    }
                }),
            });

            if (watsonResponse.ok) {
                const watsonData = await watsonResponse.json();
                watsonAnalysis = watsonData.output?.generic?.[0]?.text || watsonData.output?.text?.[0] || null;
            }
        } catch (error) {
            console.error('Watson API error:', error);
        }

        // Fallback to OpenAI if Watson unavailable
        if (!watsonAnalysis) {
            const watsonFallback = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a disaster risk assessment expert specializing in cascading climate impacts. Predict realistic cascading pathways through environmental, infrastructure, human, and economic systems."
                    },
                    {
                        role: "user",
                        content: `Scenario: ${query}

Data: ${JSON.stringify(dataContext, null, 2)}

Provide a comprehensive cascading risk assessment with realistic probability and severity estimates for each cascade stage.`
                    }
                ],
                temperature: 0.4,
            });
            watsonAnalysis = watsonFallback.choices[0].message.content;
        }

        // Agent 3: OpenAI GPT-4o - Synthesis & Actionable Recommendations
        const synthesisResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a senior climate risk advisor synthesizing insights from multiple expert AI systems. Combine pattern analysis and risk assessment to provide clear, actionable recommendations.

Your synthesis should:
- Integrate findings from both analytical perspectives
- Highlight critical cascading pathways with highest confidence
- Identify data-driven tipping points and thresholds
- Provide specific, prioritized recommendations
- Quantify uncertainty where data is limited`
                },
                {
                    role: "user",
                    content: `Synthesize these expert analyses for: ${query}

PATTERN ANALYSIS (OpenAI Climate Expert):
${openaiAnalysis.choices[0].message.content}

CASCADING RISK ASSESSMENT (Watson/Risk Expert):
${watsonAnalysis}

REAL DATA FOUNDATION:
- City: ${dataContext.city.name}, Pop: ${dataContext.population.toLocaleString()}
- Hazards: ${dataContext.hazards.map(h => h.type).join(', ')}
- Climate Indices: EHF=${dataContext.environmental.climate_indices.ehf?.toFixed(2) || 'N/A'}, SPI=${dataContext.environmental.climate_indices.spi?.toFixed(2) || 'N/A'}

Provide a unified assessment with:
1. Most probable cascading event chain (with confidence levels)
2. Critical impact predictions based on real data
3. Key vulnerability points
4. Prioritized recommendations`
                }
            ],
            temperature: 0.5,
        });

        return Response.json({
            success: true,
            data_sources_used: {
                nasa_power: true,
                climate_indices: !!dataContext.environmental.climate_indices.ehf || !!dataContext.environmental.climate_indices.spi,
                vulnerability_data: Object.keys(dataContext.vulnerability_factors).length > 0,
                population_data: dataContext.population > 0
            },
            agents: {
                pattern_analysis: openaiAnalysis.choices[0].message.content,
                risk_assessment: watsonAnalysis,
                synthesis: synthesisResponse.choices[0].message.content
            },
            final_answer: synthesisResponse.choices[0].message.content,
            confidence_level: watsonAnalysis ? 'high' : 'medium'
        });

    } catch (error) {
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});