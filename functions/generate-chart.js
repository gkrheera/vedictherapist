// Version: 1.3
/*
 * This is our secure serverless function. It runs on Netlify's servers, not in the browser.
 * It receives the birth details from our web page, adds the secret API key,
 * and then safely calls the Prokerala API using the correct GET method.
 */
exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET } = process.env;
    const authString = Buffer.from(`${PROKERALA_CLIENT_ID}:${PROKERALA_CLIENT_SECRET}`).toString('base64');
    
    // The base URL for the chart endpoint.
    const API_ENDPOINT = 'https://api.prokerala.com/v2/astrology/chart';

    try {
        const params = JSON.parse(event.body);

        // Convert the parameters into a URL query string for the GET request.
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${API_ENDPOINT}?${queryString}`;

        // Make the call to the Prokerala API using GET.
        const response = await fetch(fullUrl, {
            method: 'GET', // Corrected method
            headers: {
                'Authorization': `Basic ${authString}`
                // 'Content-Type' is not needed for GET requests with no body.
            }
        });

        const data = await response.json();

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

