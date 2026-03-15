import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { city, assessment, message, conversationHistory } = await req.json();

    // Prepare context for the AI
    const contextData = {
      city: {
        name: city.name,
        country: city.country,
        population: city.population,
        latitude: city.latitude,
        longitude: city.longitude,
        climate_zone: city.climate_zone,
        elevation: city.elevation
      },
      assessment: assessment ? {
        assessment_date: assessment.assessment_date,
        hazards: assessment.hazards_detected?.map(h => ({
          type: h.type,
          severity: h.severity,
          description: h.description,
          score: h.score
        })),
        cascading_risks: assessment.cascading_chains?.length || 0,
        environmental_data: assessment.environmental_data
      } : null
    };

    // Build conversation messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are an expert climate risk analyst AI assistant. You have access to real environmental data from NASA POWER API and WeatherAPI for ${city.name}, ${city.country}.

City Information:
- Location: ${city.latitude}, ${city.longitude}
- Population: ${city.population?.toLocaleString() || 'N/A'}
- Climate Zone: ${city.climate_zone || 'N/A'}
- Elevation: ${city.elevation || 'N/A'}m

${assessment ? `Current Risk Assessment:
- Assessment Date: ${new Date(assessment.assessment_date).toLocaleDateString()}
- Detected Hazards: ${assessment.hazards_detected?.map(h => `${h.type} (severity: ${h.severity})`).join(', ') || 'None'}
- Cascading Risk Chains: ${assessment.cascading_chains?.length || 0}
- Environmental Data Available: Temperature, Precipitation, Wind Speed, Air Quality, Pressure

Key Metrics:
${JSON.stringify(assessment.environmental_data, null, 2)}
` : 'No risk assessment has been run yet for this city.'}

Your role:
1. Answer questions about climate risks, environmental conditions, and hazards for this specific city
2. Explain the data in clear, accessible language
3. Provide context about what the numbers mean for residents
4. Suggest mitigation strategies when relevant
5. Use the actual data provided above in your responses
6. Be concise but informative

Always base your answers on the real data provided. If asked about something not in the data, acknowledge that and explain what data would be needed.`
      }
    ];

    // Add conversation history (last 10 messages to keep context manageable)
    const recentHistory = conversationHistory.slice(-10);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Use multi-agent system for enhanced climate analysis
    const multiAgentResponse = await base44.functions.invoke('multiAgentAnalysis', {
      query: message,
      context: {
        city: cityName,
        environmental_data: environmentalData,
        risk_assessment: riskAssessment,
        conversation_history: recentHistory
      }
    });

    const aiResponse = multiAgentResponse.data?.final_answer || 
                      multiAgentResponse.data?.agents?.synthesis ||
                      'Unable to generate response';

    return Response.json({ 
      response: aiResponse,
      insights: {
        pattern_analysis: multiAgentResponse.data?.agents?.pattern_analysis,
        risk_assessment: multiAgentResponse.data?.agents?.risk_assessment
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ 
      error: error.message || 'Failed to process chat request' 
    }, { status: 500 });
  }
});