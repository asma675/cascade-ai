import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { query } = await req.json();
    
    if (!query || query.length < 2) {
      return Response.json({ results: [] });
    }
    
    const apiKey = Deno.env.get("OPENCAGE_API_KEY");
    if (!apiKey) {
      return Response.json({ error: 'Geocoding API key not configured' }, { status: 500 });
    }
    
    // Search using OpenCage Geocoding API
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=10&no_annotations=1`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.results) {
      return Response.json({ results: [] });
    }
    
    // Filter for cities and towns, format results
    const cities = data.results
      .filter(result => {
        const type = result.components._type;
        return type === 'city' || type === 'town' || type === 'village' || 
               result.components.city || result.components.town;
      })
      .map(result => {
        const components = result.components;
        const cityName = components.city || components.town || components.village || components.county;
        const country = components.country;
        const state = components.state || components.province || components.region || '';
        
        return {
          name: cityName,
          country: country,
          state: state,
          formatted: result.formatted,
          latitude: result.geometry.lat,
          longitude: result.geometry.lng,
          display: `${cityName}${state ? ', ' + state : ''}, ${country}`
        };
      })
      .filter(city => city.name); // Remove any without a city name
    
    return Response.json({ results: cities });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});