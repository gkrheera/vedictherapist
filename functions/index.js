/**
 * Cloudflare Worker for VedicTherapist v1.0.0
 * Based on the official Prokerala API proxy example.
 * This worker securely forwards requests from the frontend to the Prokerala API,
 * handling authentication and caching the access token.
 */
import fetchToken from './token';

// This is the main entry point for the worker.
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
                method: request.method,
                body: request.body,
                redirect: 'follow'
            });
            
            const apiResponse = await fetch(apiRequest);

            // Create a new response with CORS headers to allow the browser to read it
            const responseWithCors = new Response(apiResponse.body, apiResponse);
            responseWithCors.headers.set('Access-Control-Allow-Origin', '*');

            return responseWithCors;

        } catch (e) {
            console.error(e);
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

