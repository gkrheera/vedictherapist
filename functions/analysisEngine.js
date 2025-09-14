// Version: 1.2

function analyzeDharmaType(planetData) {
    // FIX: Safely access the nested planets array.
    const planets = planetData?.data?.planets;
    
    // The check now correctly verifies the existence of the planets array.
    if (!Array.isArray(planets)) {
        console.error("Planet data for Dharma analysis is missing or not an array:", planetData);
        return "Analysis Inconclusive: Insufficient planet data provided.";
    }
    
    const scores = {
        Educator: 0,
        Warrior: 0,
        Merchant: 0,
        Laborer: 0,
        Outsider: 0
    };

    const planetSignificators = {
        'Jupiter': 'Educator',
        'Mercury': ['Educator', 'Merchant'],
        'Mars': 'Warrior',
        'Sun': 'Warrior',
        'Venus': 'Merchant',
        'Moon': 'Laborer',
        'Saturn': 'Laborer',
        'Rahu': 'Outsider',
        'Ketu': 'Outsider'
    };

    planets.forEach(planet => {
        const significator = planetSignificators[planet.name];
        if (Array.isArray(significator)) {
            significator.forEach(type => scores[type]++);
        } else if (significator) {
            scores[significator]++;
        }
    });

    let dominantType = 'Educator';
    let maxScore = -1; // Start with -1 to handle cases where all scores are 0
    for (const type in scores) {
        if (scores[type] > maxScore) {
            maxScore = scores[type];
            dominantType = type;
        }
    }

    return `Based on planetary strengths, your primary Dharma Type appears to be: The ${dominantType}.`;
}

function analyzeChakra(dashaData) {
    // FIX: Safely access the nested dasha periods array.
    const dashaPeriods = dashaData?.data?.dasha_periods;

    if (!Array.isArray(dashaPeriods) || dashaPeriods.length === 0) {
        return {
            name: "Unknown",
            description: "Analysis Inconclusive: Insufficient Dasha data."
        };
    }
    
    // Find the current dasha based on today's date
    const today = new Date();
    const currentDasha = dashaPeriods.find(d => new Date(d.start_date) <= today && new Date(d.end_date) >= today);
    const currentDashaLord = currentDasha?.name || dashaPeriods[0]?.name || 'Sun';

    const chakraMap = {
        'Sun': { name: "Solar Plexus", description: "Your current life theme revolves around personal power, will, and self-esteem." },
        'Moon': { name: "Sacral", description: "Your current life theme revolves around emotions, relationships, and creativity." },
        'Mars': { name: "Solar Plexus", description: "Your current life theme revolves around assertion, power, and taking action." },
        'Mercury': { name: "Throat", description: "Your current life theme revolves around communication, expression, and learning." },
        'Jupiter': { name: "Third Eye", description: "Your current life theme revolves around wisdom, expansion, and higher knowledge." },
        'Venus': { name: "Heart", description: "Your current life theme revolves around love, connection, and harmony." },
        'Saturn': { name: "Root", description: "Your current life theme revolves around security, structure, and long-term stability." },
        'Rahu': { name: "Third Eye", description: "Your current life theme revolves around ambition, future goals, and unconventional thinking." },
        'Ketu': { name: "Crown", description: "Your current life theme revolves around spirituality, letting go, and past influences." }
    };

    return chakraMap[currentDashaLord] || chakraMap['Sun'];
}

module.exports = {
    analyzeDharmaType,
    analyzeChakra
};

