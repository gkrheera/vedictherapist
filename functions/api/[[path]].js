/**
 * Cloudflare Worker for VedicTherapist v3.0.0
 * This function acts as a catch-all proxy for requests to /api/*
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


export async function onRequest(context) {
    // Handle CORS preflight requests
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    try {
        const { request, env, params } = context;
        const token = await fetchToken(env.CLIENT_ID, env.CLIENT_SECRET);

        // Get the path from the catch-all route and the query string
        const path = params.path.join('/');
        const queryString = new URL(request.url).search;

        // Construct the target URL for the Prokerala API
        const targetUrl = `https://api.prokerala.com/${path}${queryString}`;
        
        const apiRequest = new Request(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            redirect: 'follow'
        });
        
        const apiResponse = await fetch(apiRequest);

        // Create a new response with CORS headers
        const responseWithCors = new Response(apiResponse.body, apiResponse);
        responseWithCors.headers.set('Access-Control-Allow-Origin', '*');
        responseWithCors.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');


        return responseWithCors;

    } catch (e) {
        console.error("Worker Error:", e);
        const errorResponse = {
            errors: [{
                title: 'Proxy Error',
                detail: e.message,
                status: 500
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
