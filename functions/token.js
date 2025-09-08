/**
 * Cloudflare Worker Token Helper for VedicTherapist v1.0.0
 * From the official Prokerala API proxy example.
 * Fetches and caches the OAuth2 access token.
 */

let cachedToken = {
    accessToken: null,
    expiresAt: 0,
};

class ApiError extends Error {
    constructor(title, detail, status = 400) {
        super(detail);
        this.name = 'ApiError';
        this.status = status;
        this.title = title;
        this.detail = detail;
    }
}

export default async function fetchToken(clientId, clientSecret) {
    if (cachedToken.accessToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.accessToken;
    }

    if (!clientId || !clientSecret) {
        console.error('CLIENT_ID or CLIENT_SECRET secrets not set in Cloudflare dashboard.');
        throw new ApiError('Proxy Configuration Error', 'API credentials are not configured.', 500);
    }

    const res = await fetch('https://api.prokerala.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });

    if (!res.ok) {
        throw new ApiError('Token Error', 'Failed to fetch token from Prokerala API.', 500);
    }

    const data = await res.json();
    
    cachedToken.accessToken = data.access_token;
    cachedToken.expiresAt = Date.now() + (data.expires_in - 300) * 1000;

    return cachedToken.accessToken;
}

