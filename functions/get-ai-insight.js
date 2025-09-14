// Version: 1.0
const fetch = require('node-fetch');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { kundliData, dashaData, dharmaProfile, chakraProfile, userQuestion } = JSON.parse(event.body);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Gemini API key is not configured.' }) };
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

    const systemPrompt = `You are JyotishTherapist, an expert Vedic astrologer and a compassionate coach trained in Acceptance and Commitment Therapy (ACT) and Relational Frame Theory (RFT). 
    Your role is to analyze the provided Vedic Astrology data to understand the user's life context and then guide them through their presenting problem.

    **Framework:**
    1.  **Astrological Context:** The user's Natal Chart (Kundli) is their life's blueprint. Their current Dasha period indicates the active themes.
    2.  **Dharma Type:** This is their innate path of purpose (e.g., Educator, Warrior).
    3.  **Chakra Profile:** This highlights their current core psychological and developmental needs.
    4.  **Your Method:** Do NOT just give astrological predictions. Use the data as context. Guide the user using evocative, RFT-based questions to build psychological flexibility. Your ultimate goal is to help them clarify their values and identify a small, concrete, "Committed Action" they can take, in line with the principles of ACT.

    **User's Data:**
    - Dharma Type: ${dharmaProfile}
    - Active Chakra Theme: ${chakraProfile.primaryChakraTheme} (driven by their current ${chakraProfile.activeDashaLord} Dasha)
    - Key Planetary Positions: [Provide a summary if available, e.g., Ascendant is ${kundliData.ascendant}]

    Now, begin the coaching conversation. The user's presenting problem is: "${userQuestion}"`;

    const payload = {
        contents: [{
            parts: [{ text: systemPrompt }]
        }]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API responded with status ${response.status}: ${errorBody}`);
        }

        const result = await response.json();
        const insightText = result.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            body: JSON.stringify({ insight: insightText })
        };

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to get insight from the AI model.' })
        };
    }
};
