import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
const SUPABASE_KEY = Deno.env.get('SUPABASE_KEY');
const RAG_CHAINS_URL = Deno.env.get('RAG_CHAINS_URL')?.replace(/\/$/, '');
const RAG_TOP_K = 5;
const MIN_SIMILARITY_FOR_RAG = 0.22;

/** Get embedding for a string using OpenAI text-embedding-3-small */
async function getQueryEmbedding(query: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  });
  if (!res.ok) throw new Error('OpenAI embeddings failed');
  const data = await res.json();
  return data.data[0].embedding;
}

/** Retrieve top-k chunks from Supabase match_documents RPC */
async function retrieveRagChunks(queryEmbedding: number[], matchCount: number): Promise<{ content: string; metadata?: { source?: string }; similarity?: number }[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      query_embedding: queryEmbedding,
      match_count: matchCount,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Build a location block from city + assessment: only real indices and hazards (no fake data) */
function buildLocationBlock(city: { name: string; country?: string; latitude?: number; longitude?: number; population?: number; climate_zone?: string; elevation?: number }, assessment: { assessment_date?: string; hazards_detected?: { type: string; severity?: string; index?: string; value?: string }[]; environmental_data?: Record<string, unknown> } | null): string {
  const lines: string[] = [];
  lines.push(`# Location: ${city.name}${city.country ? `, ${city.country}` : ''}`);
  if (city.latitude != null && city.longitude != null) lines.push(`- Coordinates: ${city.latitude}, ${city.longitude}`);
  if (city.population != null) lines.push(`- Population: ${city.population.toLocaleString()}`);
  if (city.climate_zone) lines.push(`- Climate zone: ${city.climate_zone}`);
  if (city.elevation != null) lines.push(`- Elevation: ${city.elevation} m`);

  if (!assessment?.environmental_data) {
    lines.push('- Risk assessment: Not run yet. No indices available.');
    return lines.join('\n');
  }

  const ed = assessment.environmental_data as Record<string, unknown>;
  const indices = (ed.indices ?? {}) as Record<string, unknown>;
  const hazards = assessment.hazards_detected ?? [];

  lines.push('- Assessment date: ' + (assessment.assessment_date ? new Date(assessment.assessment_date).toISOString().slice(0, 10) : 'N/A'));
  if (indices.ehf_selection_radius_km != null) lines.push(`- Selection radius (analysis): ${indices.ehf_selection_radius_km} km`);
  if (indices.n_points != null) lines.push(`- Sampled points: ${indices.n_points}`);

  lines.push('\n## Indices (from NASA POWER / satellite; use only these values)');
  if (indices.ehf != null) lines.push(`- EHF (Excess Heat Factor): ${indices.ehf}`);
  if (indices.ehf_details != null) lines.push(`  - EHF details: T95, T3, T30, EHI_sig, EHI_accl (from data)`);
  if (indices.spi != null) lines.push(`- SPI-12: ${indices.spi}`);
  if (indices.current_month_precip_mm != null) lines.push(`- Current 12-month precip (mm): ${indices.current_month_precip_mm}`);
  if (indices.ndvi != null) lines.push(`- NDVI: ${indices.ndvi}`);
  if (indices.nbr != null) lines.push(`- NBR: ${indices.nbr}`);
  if (indices.dnbr != null) lines.push(`- dNBR: ${indices.dnbr}`);
  if (indices.mndwi != null) lines.push(`- MNDWI: ${indices.mndwi}`);
  if (indices.bsi != null) lines.push(`- BSI: ${indices.bsi}`);
  if (indices.nbr_label != null) lines.push(`- NBR label: ${indices.nbr_label}`);
  if (indices.mndwi_label != null) lines.push(`- MNDWI label: ${indices.mndwi_label}`);
  if (indices.land_class != null) lines.push(`- Land class: ${indices.land_class}`);

  if (ed.temperature_30d && Array.isArray(ed.temperature_30d) && (ed.temperature_30d as unknown[]).length > 0) lines.push('- 30-day temperature series: available');
  if (ed.precipitation_30d && Array.isArray(ed.precipitation_30d) && (ed.precipitation_30d as unknown[]).length > 0) lines.push('- 30-day precipitation series: available');

  if (hazards.length > 0) {
    lines.push('\n## Detected hazards (from indices above)');
    hazards.forEach((h: { type: string; severity?: string; index?: string; value?: string }) => {
      const part = `${h.type} (${h.severity ?? 'N/A'})${h.index ? `, index: ${h.index}` : ''}${h.value != null ? `, value: ${h.value}` : ''}`;
      lines.push(`- ${part}`);
    });
  }

  return lines.join('\n');
}

/** Simple greeting / off-topic check so we don't run RAG on "hello" */
function isGreetingOrOffTopic(message: string): boolean {
  const q = message.toLowerCase().trim();
  if (q.length > 80) return false;
  const greetings = ['hello', 'hi', 'hey', 'howdy', 'thanks', 'thank you', 'bye', 'goodbye', 'ok', 'okay', 'yes', 'no', 'who are you'];
  if (greetings.some(g => q === g || q.startsWith(g + ' ') || q.replace(/[!?.,]+$/, '') === g)) return true;
  const words = q.split(/\s+/);
  if (words.length <= 2 && !/climate|impact|heat|flood|drought|risk|stress|uhi|toronto|city|indices|ehf|spi/.test(q)) return true;
  return false;
}

const SYSTEM_PROMPT = `You are a climate risk analyst for a specific city. You receive (1) real location and indices data for that city, and (2) research excerpts from a RAG database. Use ONLY these two sources. Do not invent, simulate, or assume any numbers, percentages, or statistics.

Response format: **Cascading impact chains** with multiple angles.

1. **Cascading chains**
   - Build 1–3 short chains in the form: [Cause / current state] → [Effect] → [Further effect / future implication].
   - Each step must be a **specific conclusion** supported by either the location data or a cited research excerpt. No generic statements.
   - Use different angles: e.g. health, infrastructure, economy, equity, ecosystems, policy—depending on what the evidence supports.
   - After each chain, cite the source: (Location data) for city indices/hazards, or (Source: filename) for research.
   - Be creative and non-obvious where the evidence allows: e.g. second-order effects, feedbacks, vulnerable groups, spatial or temporal nuances.

2. **Prevention & mitigation**
   - Only if the research excerpts mention or strongly imply measures: list 2–4 concrete steps and cite (Source: filename).
   - If none in the provided context, say: "No prevention measures were found in the provided sources."

3. **References**
   - List every source you used (Location data; and each [Source: filename] from the research context).

Rules:
- Do not use any number, percentage, or statistic that is not in the Location data or in the research excerpts.
- If the question cannot be answered from the two contexts, say so and do not invent chains.
- Keep chains concise and evidence-based. Prefer non-obvious, multi-perspective conclusions when the evidence supports them.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { city, assessment, message, conversationHistory } = await req.json();
    if (!city || !message?.trim()) return Response.json({ error: 'Missing city or message' }, { status: 400 });

    // If RAG chains server is configured, delegate to it (Flask main.py)
    if (RAG_CHAINS_URL) {
      try {
        const chainsRes = await fetch(`${RAG_CHAINS_URL}/chains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: message.trim(), city, assessment: assessment ?? null }),
        });
        if (chainsRes.ok) {
          const data = await chainsRes.json();
          if (data.answer != null) return Response.json({ response: data.answer });
        }
      } catch (_) {
        // Fall through to inline RAG
      }
    }

    const locationBlock = buildLocationBlock(city, assessment ?? null);

    // Greeting: short reply without RAG
    if (isGreetingOrOffTopic(message)) {
      const greetingReply = `Hello! I'm your climate risk assistant for ${city.name}. I use this location's real indices (EHF, SPI, satellite indices) and research from the database to build evidence-based impact chains. Ask me about risks, cascading effects, or mitigation for this city.`;
      return Response.json({ response: greetingReply });
    }

    let ragContext = '';
    let embedding: number[] | null = null;

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const searchText = `${city.name} ${message}`.trim();
        embedding = await getQueryEmbedding(searchText);
        const chunks = await retrieveRagChunks(embedding, RAG_TOP_K);
        const bestSim = chunks.length ? Math.max(...chunks.map(c => c.similarity ?? 0)) : 0;
        if (chunks.length && bestSim >= MIN_SIMILARITY_FOR_RAG) {
          ragContext = chunks.map(c => `[Source: ${(c.metadata?.source ?? 'unknown')}]\n${c.content}`).join('\n\n---\n\n');
        }
      } catch (_) {
        // RAG optional; continue without it
      }
    }

    const userContent = [
      '## Location and indices (use only these values; no fabrication)\n' + locationBlock,
      ragContext ? '\n## Research excerpts (cite as Source: filename)\n' + ragContext : '',
      '\n\nQuestion: ' + message,
    ].filter(Boolean).join('\n');

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(conversationHistory ?? []).slice(-10).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.4,
        max_tokens: 900,
      }),
    });

    if (!openaiResponse.ok) {
      const err = await openaiResponse.text();
      console.error('OpenAI error:', err);
      throw new Error('Failed to get AI response');
    }

    const data = await openaiResponse.json();
    const aiResponse = data.choices[0].message?.content ?? 'No response generated.';

    return Response.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: error.message || 'Failed to process chat request' }, { status: 500 });
  }
});
