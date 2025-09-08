/**
 * Cloudflare Pages Function for VedicTherapist v6.0.0
 * This function uses file-based routing to catch all requests to /api/* and proxy them.
 * This is the standard and correct way to implement a proxy for a Pages project.
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

// The onRequest handler is the entry point for Pages Functions.
export async function onRequest(context) {
    const { request, env, params } = context;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    try {
        const token = await fetchToken(env.CLIENT_ID, env.CLIENT_SECRET);
        
        // Reconstruct the Prokerala API URL from the wildcard path and query string.
        // params.path will be an array of path segments from the URL.
        // e.g., for a request to /api/v2/astrology/kundli, params.path will be ['v2', 'astrology', 'kundli']
        const path = `/${params.path.join('/')}`;
        const queryString = new URL(request.url).search;
        
        // IMPORTANT: We must decode the query string to handle special characters like '+' correctly.
        const decodedQueryString = decodeURIComponent(queryString);
        
        const targetUrl = `https://api.prokerala.com${path}${decodedQueryString}`;

        const apiRequest = new Request(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            redirect: 'follow'
        });
        
        const apiResponse = await fetch(apiRequest);

        const responseWithCors = new Response(apiResponse.body, apiResponse);
        responseWithCors.headers.set('Access-Control-Allow-Origin', '*');

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

