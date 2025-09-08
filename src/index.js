/**
 * JyotishTherapist Cloudflare Worker Backend v1.0
 *
 * This worker acts as a secure proxy to the ProKerala API.
 * It correctly handles URL parameters passed from the frontend without the
 * encoding issues present in the previous Netlify environment.
 */

// A simple in-memory cache for the access token to improve performance.
let cachedToken = {
    accessToken: null,
    expiresAt: 0,
};

const TOKEN_URL = 'https://api.prokerala.com/token';

/**
 * Gets a valid OAuth 2.0 access token, using a cache to avoid unnecessary requests.
 */
async function getAccessToken(clientId, clientSecret) {
    if (cachedToken.accessToken && cachedToken.expiresAt > Date.now() + 300 * 1000) {
        return cachedToken.accessToken;
    }

    const body = new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': clientId,
        'client_secret': clientSecret
    });

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Failed to get access token:', data);
        throw new Error('Could not authenticate with ProKerala. Check API credentials.');
    }
    
    cachedToken.accessToken = data.access_token;
    cachedToken.expiresAt = Date.now() + (data.expires_in * 1000);
    
    return data.access_token;
}


// The main entry point for the Cloudflare Worker
export default {
    async fetch(request, env, ctx) {
        // We will proxy requests from /astrology/* to the ProKerala API
        const url = new URL(request.url);
        
        // If the request is for the root path, let Cloudflare serve the static site.
        // This is handled by the wrangler.toml configuration and doesn't need code here.
        // We only handle the API proxy logic.
        if (!url.pathname.startsWith('/astrology')) {
            // This allows the static assets from the 'public' folder to be served.
            return env.ASSETS.fetch(request);
        }
        
        const CLIENT_ID = env.PROKERALA_CLIENT_ID;
        const CLIENT_SECRET = env.PROKERALA_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
            return new Response(JSON.stringify({ error: 'API credentials are not set up in the Cloudflare environment.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
        
        try {
            // The query string from the original request
            const queryString = url.search;

            if (!queryString) {
                return new Response(JSON.stringify({ error: 'Missing required query parameters.' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            const accessToken = await getAccessToken(CLIENT_ID, CLIENT_SECRET);
            const headers = { 'Authorization': `Bearer ${accessToken}` };
            
            // Construct the target API URLs
            const kundliUrl = `https://api.prokerala.com/v2/astrology/kundli${queryString}`;
            const dashaUrl = `https://api.prokerala.com/v2/astrology/dasha-periods${queryString}`;
            const planetPositionUrl = `https://api.prokerala.com/v2/astrology/natal-planet-position${queryString}`;

            // Fetch all data in parallel
            const [kundliResponse, dashaResponse, planetPositionResponse] = await Promise.all([
                fetch(kundliUrl, { headers }),
                fetch(dashaUrl, { headers }),
                fetch(planetPositionUrl, { headers })
            ]);

            const processResponse = async (res, name) => {
                if (!res.ok) {
                    const errorText = await res.text();
                    let errorJson;
                    try {
                        errorJson = JSON.parse(errorText);
                    } catch (e) {
                        throw new Error(`${name} API request failed with status ${res.status}: ${errorText}`);
                    }
                    throw new Error(errorJson.errors?.[0]?.detail || `Unknown ${name} API error.`);
                }
                return res.json();
            };

            const kundliData = await processResponse(kundliResponse, 'Kundli');
            const dashaData = await processResponse(dashaResponse, 'Dasha');
            const planetPositionData = await processResponse(planetPositionResponse, 'Planet Position');
            
            // Combine the data as before
            if (planetPositionData.data) {
                kundliData.data.ascendant = planetPositionData.data.ascendant;
                kundliData.data.planet_positions = planetPositionData.data.planets;
            }
            
            const combinedData = { kundliData, dashaData };

            return new Response(JSON.stringify(combinedData), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });

        } catch (error) {
            console.error('Cloudflare Worker CRITICAL Error:', error.message);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
    },
};
