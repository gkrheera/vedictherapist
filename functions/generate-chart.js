// Version: 1.2
/*
 * This is our secure serverless function. It runs on Netlify's servers, not in the browser.
 * It receives the birth details from our web page, adds the secret API key,
 * and then safely calls the Prokerala API.
 */
exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    // Get API keys from environment variables for security
    const { PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET } = process.env;

    // Base64 encode the credentials for the Authorization header
    const authString = Buffer.from(`${PROKERALA_CLIENT_ID}:${PROKERALA_CLIENT_SECRET}`).toString('base64');
    const API_ENDPOINT = 'https://api.prokerala.com/v2/astrology/chart';

    try {
        // Get the parameters from the client-side request
        const params = JSON.parse(event.body);

        // Make the actual call to the Prokerala API
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authString}`
            },
            body: JSON.stringify(params)
        });

        const data = await response.json();

        // Pass the response from Prokerala back to our client
        return {
            statusCode: response.status,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred.' })
        };
    }
};

