/**
 * JyotishTherapist Cloudflare Worker Backend (v5.1.0 - Production Ready)
 *
 * This version uses the '/functions' directory structure required by Cloudflare Pages
 * for automatic deployment. It correctly handles routing and replicates the original
 * Netlify function's logic of making three parallel API calls and merging the results.
 */

// A simple in-memory cache for the access token to improve performance.
let cachedToken = {
    accessToken: null,
    expiresAt: 0,
};

const TOKEN_URL = 'https://api.prokerala.com/token';

/**
 * Gets a valid OAuth 2.0 access token, using a cache to avoid unnecessary requests.
 * @param {string} clientId Your ProKerala Client ID from Cloudflare secrets.
 * @param {string} clientSecret Your ProKerala Client Secret from Cloudflare secrets.
 * @returns {Promise<string>} The access token.
 */
async function getAccessToken(clientId, clientSecret) {
    if (cachedToken.accessToken && cachedToken.expiresAt > Date.now() + 300 * 1000) {
        return cachedToken.accessToken;
    }

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    });

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('Failed to get access token:', data);
        throw new Error('Could not authenticate with ProKerala. Check API credentials in Cloudflare Secrets.');
    }

    cachedToken.accessToken = data.access_token;
    cachedToken.expiresAt = Date.now() + data.expires_in * 1000;

    return data.access_token;
}

/**
 * Safely parse the response from the ProKerala API.
 * @param {Response} res The fetch Response object.
 * @param {string} name The name of the API endpoint for logging.
 * @returns {Promise<Object>} The parsed JSON data.
 */
const processApiResponse = async (res, name) => {
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

/**
 * The main fetch handler for Cloudflare Pages Functions.
 * @param {object} context The context object for the function.
 * @returns {Promise<Response>} The response to the client.
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // This function acts as a proxy for all /astrology/* calls.
    // The specific endpoint is determined by the frontend.
    if (url.pathname.startsWith('/astrology')) {
        try {
            if (!env.PROKERALA_CLIENT_ID || !env.PROKERALA_CLIENT_SECRET) {
                return new Response(JSON.stringify({ error: 'API credentials are not set up in the Cloudflare environment.' }), { status: 500 });
            }

            const queryString = url.search;
            if (!queryString) {
                return new Response(JSON.stringify({ error: 'Missing required query parameters.' }), { status: 400 });
            }

            const accessToken = await getAccessToken(env.PROKERALA_CLIENT_ID, env.PROKERALA_CLIENT_SECRET);
            const headers = { 'Authorization': `Bearer ${accessToken}` };

            // We now replicate the original Netlify function's logic.
            // The frontend makes ONE call to /astrology, and we make THREE to the API.
            const kundliUrl = `https://api.prokerala.com/v2/astrology/kundli${queryString}`;
            const dashaUrl = `https://api.prokerala.com/v2/astrology/dasha-periods${queryString}`;
            const planetPositionUrl = `https://api.prokerala.com/v2/astrology/natal-planet-position${queryString}`;

            const [kundliResponse, dashaResponse, planetPositionResponse] = await Promise.all([
                fetch(kundliUrl, { headers }),
                fetch(dashaUrl, { headers }),
                fetch(planetPositionUrl, { headers }),
            ]);

            const kundliData = await processApiResponse(kundliResponse, 'Kundli');
            const dashaData = await processApiResponse(dashaResponse, 'Dasha');
            const planetPositionData = await processApiResponse(planetPositionResponse, 'Planet Position');

            // Merge planetary data into the main kundli object, as the frontend expects.
            if (planetPositionData.data) {
                kundliData.data.ascendant = planetPositionData.data.ascendant;
                kundliData.data.planet_positions = planetPositionData.data.planets;
            }

            // Return the combined data in the expected format.
            return new Response(JSON.stringify({ kundliData, dashaData }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (error) {
            console.error('Cloudflare Function CRITICAL Error:', error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    // For all other requests (like loading the homepage), pass the request
    // to the Cloudflare Pages static asset server.
    return context.next();
}

