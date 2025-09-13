// Version: 1.4
/*
 * This is our secure serverless function. It runs on Netlify's servers, not in the browser.
 * It now uses the correct OAuth 2.0 two-step flow:
 * 1. Fetch a short-lived Bearer Token from the /token endpoint.
 * 2. Use that Bearer Token to make the authenticated GET request for the chart.
 */
exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET } = process.env;

    try {
        // --- Step 1: Fetch the Bearer Token ---
        console.log('Fetching auth token from Prokerala...');
        const tokenResponse = await fetch('https://api.prokerala.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': PROKERALA_CLIENT_ID,
                'client_secret': PROKERALA_CLIENT_SECRET
            })
        });

        if (!tokenResponse.ok) {
            const errorBody = await tokenResponse.text();
            console.error('Failed to get auth token:', errorBody);
            throw new Error('Could not authenticate with the API provider.');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        console.log('Successfully fetched auth token.');

        // --- Step 2: Use the Bearer Token to get the chart ---
        const params = JSON.parse(event.body);
        const API_ENDPOINT = 'https://api.prokerala.com/v2/astrology/chart';
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${API_ENDPOINT}?${queryString}`;

        console.log(`Requesting chart from: ${fullUrl}`);
        const chartResponse = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}` // Using the correct Bearer token
            }
        });

        const data = await chartResponse.json();
        
        if (!chartResponse.ok) {
             console.error('Prokerala API responded with an error:', data);
             // Forward the specific error from Prokerala to the front-end
             throw new Error(data.errors && data.errors[0] ? data.errors[0].detail : 'Failed to generate chart.');
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

