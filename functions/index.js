/**
 * Cloudflare Worker for VedicTherapist v2.0.0
 * This worker securely forwards requests from the frontend to the Prokerala API,
 * handling authentication and caching the access token.
 * This version is simplified to act as a pure proxy, matching the successful example code.
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
        throw new Error('Failed to fetch token from Prokerala API.');
    }

    const data = await res.json();
    
    cachedToken.accessToken = data.access_token;
    cachedToken.expiresAt = Date.now() + (data.expires_in - 300) * 1000;

    return cachedToken.accessToken;
}

export default {
    async fetch(request, env) {
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
            
            const url = new URL(request.url);
            url.hostname = 'api.prokerala.com';

            const apiRequest = new Request(url, {
                headers: {
                    ...request.headers,
                    'Authorization': `Bearer ${token}`,
                },
                redirect: 'follow'
            });
            
            const apiResponse = await fetch(apiRequest);

            const responseWithCors = new Response(apiResponse.body, apiResponse);
            responseWithCors.headers.set('Access-Control-Allow-Origin', '*');

            return responseWithCors;

        } catch (e) {
            const errorResponse = {
                status: 'error',
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
    },
};
