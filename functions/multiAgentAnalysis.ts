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

        // Agent 1: OpenAI - Pattern Recognition & Historical Analysis
        const openaiAnalysis = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a climate pattern recognition expert. Analyze historical trends and identify patterns in environmental data. Focus on statistical correlations and anomaly detection."
                },
                {
                    role: "user",
                    content: `Context: ${JSON.stringify(context)}\n\nQuery: ${query}\n\nProvide pattern analysis and historical trends.`
                }
            ],
            temperature: 0.3,
        });

        // Agent 2: Watson - Risk Assessment & Predictions
        const watsonResponse = await fetch(`${Deno.env.get("WATSON_URL")}/v2/assistants/sessions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get("WATSON_API_KEY")}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                assistant_id: Deno.env.get("WATSON_ASSISTANT_ID"),
            }),
        });

        let watsonAnalysis = "Watson analysis unavailable";
        
        if (watsonResponse.ok) {
            const session = await watsonResponse.json();
            const messageResponse = await fetch(`${Deno.env.get("WATSON_URL")}/v2/assistants/${Deno.env.get("WATSON_ASSISTANT_ID")}/sessions/${session.session_id}/message`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get("WATSON_API_KEY")}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: {
                        text: `Analyze climate risks and provide predictions: ${query}\nData: ${JSON.stringify(context)}`
                    }
                }),
            });

            if (messageResponse.ok) {
                const watsonData = await messageResponse.json();
                watsonAnalysis = watsonData.output?.generic?.[0]?.text || "No Watson response";
            }
        }

        // Agent 3: OpenAI - Synthesis & Recommendations
        const synthesisResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a climate risk synthesis expert. Combine insights from multiple AI agents and provide actionable recommendations."
                },
                {
                    role: "user",
                    content: `Agent 1 (Pattern Analysis): ${openaiAnalysis.choices[0].message.content}\n\nAgent 2 (Risk Assessment): ${watsonAnalysis}\n\nSynthesize these insights and provide clear recommendations for: ${query}`
                }
            ],
            temperature: 0.5,
        });

        return Response.json({
            success: true,
            agents: {
                pattern_analysis: openaiAnalysis.choices[0].message.content,
                risk_assessment: watsonAnalysis,
                synthesis: synthesisResponse.choices[0].message.content
            },
            final_answer: synthesisResponse.choices[0].message.content
        });

    } catch (error) {
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});