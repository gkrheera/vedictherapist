/**
 * Cloudflare Pages Function for VedicTherapist v8.0.0 (Final Architecture)
 * This version precisely mirrors the official Prokerala Cloudflare example.
 * It correctly reconstructs the request object without manually decoding the URL,
 * which is the definitive fix for the persistent date encoding issue.
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

export async function onRequest(context) {
    const { request, env } = context;

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
        
        // ** THE DEFINITIVE FIX **
        // Reconstruct the URL, pointing it to the Prokerala API endpoint.
        // This is the method used in the official example. It correctly
        // preserves the URL encoding from the original browser request.
        const url = new URL(request.url);
        
        // The original request is to /api/v2/..., we need to remove /api
        url.pathname = url.pathname.replace(/^\/api/, '');
        url.hostname = 'api.prokerala.com';
        
        const apiRequest = new Request(url, {
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

