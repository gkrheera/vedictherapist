// Version: 1.4
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    //
// Version: 1.3
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { datetime, coordinates, ayanamsa, chart_type, chart_style } = JSON.parse(event.body);
    const { PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET } = process.env;

    const AUTH_URL = 'https://api.prokerala.com/token';
    const CHART_API_URL = 'https://api.prokerala.com/v2/astrology/chart';

    try {
        // Step 1: Get Bearer Token
        console.log('Fetching auth token from Prokerala...');
        const authResponse = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': PROKERALA_CLIENT_ID,
                'client_secret': PROKERALA_CLIENT_SECRET
            })
        });

        if (!authResponse.ok) {
            const errorBody = await authResponse.text();
            console.error('Prokerala Auth API Error:', errorBody);
            return {
                statusCode: authResponse.status,
                body: JSON.stringify({ error: 'Failed to authenticate with Prokerala API.' })
            };
        }
        const authData = await authResponse.json();
        const accessToken = authData.access_token;
        console.log('Successfully fetched auth token.');

        // Step 2: Request the chart using the token
        const params = new URLSearchParams({
            datetime,
            coordinates,
            ayanamsa,
            chart_type,
            chart_style
        });

        const chartUrl = `${CHART_API_URL}?${params.toString()}`;
        console.log(`Requesting chart from: ${chartUrl}`);

        const prokeralaResponse = await fetch(chartUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        // ** THE FIX IS HERE **
        // Check the content type to handle SVG or JSON error responses
        const contentType = prokeralaResponse.headers.get("content-type");

        if (prokeralaResponse.ok && contentType && contentType.includes("image/svg+xml")) {
             // If we get an SVG, read it as text
            const svgText = await prokeralaResponse.text();
            // Wrap it in the JSON structure the frontend expects
            const responseBody = {
                data: {
                    svg: svgText
                }
            };
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responseBody)
            };
        } else {
            // If it's not an SVG or not a 200 OK response, it must be a JSON error
            const errorData = await prokeralaResponse.json();
            console.error('Prokerala API responded with an error:', JSON.stringify(errorData, null, 2));
            const errorMessage = errorData.errors?.[0]?.detail || 'An unknown API error occurred.';
             return {
                statusCode: prokeralaResponse.status,
                body: JSON.stringify({ error: errorMessage })
            };
        }

    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

