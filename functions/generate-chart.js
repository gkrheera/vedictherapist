// Version: 2.0 (MVP Analysis Engine)
const fetch = require('node-fetch');
const { getDharmaType, getChakraProfile } = require('./analysisEngine');

// Helper to create API URLs
const createApiUrl = (baseUrl, endpoint, params) => {
    const url = new URL(endpoint, baseUrl);
    url.search = new URLSearchParams(params).toString();
    return url.toString();
};

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const { datetime, coordinates, chart_style, ayanamsa } = JSON.parse(event.body);
    const clientId = process.env.PROKERALA_CLIENT_ID;
    const clientSecret = process.env.PROKERALA_CLIENT_SECRET;
    const API_BASE_URL = 'https://api.prokerala.com/';

    if (!clientId || !clientSecret) {
        return { statusCode: 500, body: JSON.stringify({ error: 'API credentials are not configured.' }) };
    }

    try {
        // 1. Fetch OAuth2 Token
        const tokenResponse = await fetch(`${API_BASE_URL}token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            }),
        });
        if (!tokenResponse.ok) throw new Error('Failed to authenticate with Prokerala API.');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const authHeader = { 'Authorization': `Bearer ${accessToken}` };

        // 2. Prepare parameters for parallel API calls
        const commonParams = { datetime, coordinates, ayanamsa };
        const chartParams = { ...commonParams, chart_style, chart_type: 'rasi' };
        
        const chartUrl = createApiUrl(API_BASE_URL, 'v2/astrology/chart', chartParams);
        const kundliUrl = createApiUrl(API_BASE_URL, 'v2/astrology/kundli/advanced', commonParams);
        const dashaUrl = createApiUrl(API_BASE_URL, 'v2/astrology/dasha-periods', commonParams);

        // 3. Make API calls in parallel
        const [chartRes, kundliRes, dashaRes] = await Promise.all([
            fetch(chartUrl, { headers: authHeader }),
            fetch(kundliUrl, { headers: authHeader }),
            fetch(dashaUrl, { headers: authHeader }),
        ]);

        if (!chartRes.ok || !kundliRes.ok || !dashaRes.ok) {
            throw new Error('One or more Prokerala API requests failed.');
        }

        const chartSvg = await chartRes.text();
        const kundliData = await kundliRes.json();
        const dashaData = await dashaRes.json();
        
        // 4. Run the Analysis Engine
        const dharmaProfile = getDharmaType(kundliData.data);
        const chakraProfile = getChakraProfile(dashaData.data);

        // 5. Return the comprehensive payload
        return {
            statusCode: 200,
            body: JSON.stringify({
                svg: chartSvg,
                kundliData: kundliData.data,
                dashaData: dashaData.data,
                dharmaProfile: dharmaProfile,
                chakraProfile: chakraProfile
            }),
        };

    } catch (error) {
        console.error('Error in generate-chart function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

