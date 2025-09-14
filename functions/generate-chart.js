// Version: 2.1
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const { analyzeDharmaType, analyzeChakra } = require('./analysisEngine');

const API_HOST = 'https://api.prokerala.com';
const TOKEN_URL = `${API_HOST}/token`;

// Helper to get the auth token
const getAuthToken = async (clientId, clientSecret) => {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        body: params,
    });

    if (!response.ok) {
        throw new Error('Failed to authenticate with Prokerala API');
    }
    const data = await response.json();
    return data.access_token;
};

// Helper to make an authenticated API call
const fetchWithAuth = async (url, token) => {
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.detail || 'A Prokerala API call failed.');
    }
    return response;
};

exports.handler = async (event, context) => {
    try {
        const { PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET } = process.env;
        const { datetime, coordinates, ayanamsa, chart_style } = JSON.parse(event.body);

        if (!datetime || !coordinates) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required birth data.' }) };
        }
        
        const token = await getAuthToken(PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET);

        // --- FIX: Create two sets of params ---
        // 1. Simple params for most endpoints
        const simpleParams = new URLSearchParams({ datetime, coordinates, ayanamsa });

        // 2. Special nested params for natal-planet-position
        const planetParams = new URLSearchParams({
            'profile[datetime]': datetime,
            'profile[coordinates]': coordinates,
            ayanamsa
        });

        const kundliUrl = `${API_HOST}/v2/astrology/kundli?${simpleParams}`;
        const dashaUrl = `${API_HOST}/v2/astrology/dasha-periods?${simpleParams}`;
        const planetsUrl = `${API_HOST}/v2/astrology/natal-planet-position?${planetParams}`;
        
        const [kundliResponse, dashaResponse, planetsResponse] = await Promise.all([
            fetchWithAuth(kundliUrl, token),
            fetchWithAuth(dashaUrl, token),
            fetchWithAuth(planetsUrl, token)
        ]);

        const kundliData = await kundliResponse.json();
        const dashaData = await dashaResponse.json();
        const planetData = await planetsResponse.json();
        
        // Now fetch the chart SVG
        const chartParams = new URLSearchParams({ datetime, coordinates, ayanamsa, chart_type: 'rasi', chart_style });
        const chartUrl = `${API_HOST}/v2/astrology/chart?${chartParams}`;
        const chartResponse = await fetchWithAuth(chartUrl, token);
        const svg = await chartResponse.text();

        // Perform analysis using the fetched data
        const dharmaProfile = analyzeDharmaType(planetData);
        const chakraProfile = analyzeChakra(dashaData, planetData);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                svg,
                kundliData: kundliData.data,
                dashaData: dashaData.data,
                planetData: planetData.data,
                dharmaProfile,
                chakraProfile
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

