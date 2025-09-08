/**
 * Cloudflare Pages Function for VedicTherapist v7.0.0 (Definitive Fix)
 * This function manually constructs the final fetch request to prevent re-encoding of the '+' sign,
 * which has been the root cause of the persistent date format error.
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
    const { request, env, params } = context;

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
        
        const incomingUrl = new URL(request.url);
        const path = `/${params.path.join('/')}`;
        
        // THE FIX: Decode the query string from the incoming browser request.
        // This converts '%2B' back into '+', solving the primary issue.
        const decodedQueryString = decodeURIComponent(incomingUrl.search);
        
        const targetUrl = `https://api.prokerala.com${path}${decodedQueryString}`;

        // Manually make the fetch request without using a Request object,
        // which prevents the '+' from being re-encoded.
        const apiResponse = await fetch(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            redirect: 'follow'
        });

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

