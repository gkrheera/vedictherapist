/**
 * Cloudflare Pages Function for VedicTherapist v9.0.0 (Definitive Routing Fix)
 * This version corrects the URL reconstruction to properly handle the /api/ route
 * specific to the Cloudflare Pages environment, which resolves the 400 error.
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
        
        const url = new URL(request.url);
        
        // ** THE DEFINITIVE FIX **
        // The original pathname is /api/v2/... We must remove the /api prefix
        // to get the correct Prokerala API path, which is /v2/...
        url.pathname = url.pathname.replace(/^\/api/, '');
        url.hostname = 'api.prokerala.com';
        
        const apiRequest = new Request(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                // Forward original headers from the client
                ...Object.fromEntries(request.headers),
            },
            method: request.method,
            body: request.body,
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

