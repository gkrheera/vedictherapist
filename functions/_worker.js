/**
 * Cloudflare Pages Function for VedicTherapist v4.0.0
 * This function acts as a catch-all proxy for requests that are not static files.
 * It correctly reconstructs the URL and forwards it to the Prokerala API.
 */

let cachedToken = {
    accessToken: null,
    expiresAt: 0,
};

async function fetchToken(clientId, clientSecret) {
    if (cachedToken.accessToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.accessToken;
    }
    if (!clientId || !clientSecret) {
        throw new Error('API credentials are not configured.');
    }
    const res = await fetch('https://api.prokerala.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });
    if (!res.ok) {
        console.error("Token API Error Response:", await res.text());
        throw new Error('Failed to fetch token from Prokerala API.');
    }
    const data = await res.json();
    cachedToken.accessToken = data.access_token;
    cachedToken.expiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return cachedToken.accessToken;
}

export default {
    async fetch(request, env) {
        try {
            const token = await fetchToken(env.CLIENT_ID, env.CLIENT_SECRET);
            
            const url = new URL(request.url);
            
            // Reconstruct the Prokerala API URL from the incoming request path
            // e.g., https://vedictherapist.pages.dev/api/v2/astrology/kundli -> https://api.prokerala.com/v2/astrology/kundli
            const path = url.pathname.replace('/api/', '/');
            const targetUrl = `https://api.prokerala.com${path}${url.search}`;

            const apiRequest = new Request(targetUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                redirect: 'follow'
            });
            
            const apiResponse = await fetch(apiRequest);

            // Create a new response with CORS headers to allow the browser to read it
            const responseWithCors = new Response(apiResponse.body, apiResponse);
            responseWithCors.headers.set('Access-Control-Allow-Origin', '*');
            responseWithCors.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            responseWithCors.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            return responseWithCors;

        } catch (e) {
            console.error("Worker Error:", e.message);
            const errorResponse = {
                errors: [{
                    title: 'Proxy Error',
                    detail: e.message,
                }]
            };
            return new Response(JSON.stringify(errorResponse), {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }
    }
};
