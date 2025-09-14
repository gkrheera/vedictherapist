// Version: 1.0
// This module contains the logic for translating raw astrological data
// into the Dharma Type and Chakra profiles based on the framework.

/**
 * Determines the Dharma Type based on key planetary strengths.
 * This is a simplified model for the MVP.
 * @param {object} kundliData - The detailed kundli data from Prokerala.
 * @returns {string} The calculated Dharma Type.
 */
function getDharmaType(kundliData) {
    const planets = kundliData.planets;
    // Simple logic for MVP: Find the strongest planet based on dignity or house.
    // This can be expanded with more sophisticated rules later.
    const sun = planets.find(p => p.name === 'Sun');
    const mars = planets.find(p => p.name === 'Mars');
    const jupiter = planets.find(p => p.name === 'Jupiter');
    const mercury = planets.find(p => p.name === 'Mercury');
    const venus = planets.find(p => p.name === 'Venus');
    const moon = planets.find(p => p.name === 'Moon');
    const saturn = planets.find(p => p.name === 'Saturn');
    const rahu = planets.find(p => p.name === 'Rahu');

    // A very basic priority system for the MVP
    if (jupiter.position > 8 || mercury.position > 8) return 'The Educator';
    if (sun.house === 10 || mars.house === 10 || sun.house === 1 || mars.house === 1) return 'The Warrior';
    if (venus.house === 2 || venus.house === 7 || mercury.house === 11) return 'The Merchant';
    if (moon.house === 4 || saturn.house === 6) return 'The Laborer';
    if (rahu.house === 12) return 'The Outsider';
    
    return 'The Educator'; // Default for MVP
}

/**
 * Determines the key Chakra themes based on the current Dasha.
 * @param {object} dashaData - The Dasha period data from Prokerala.
 * @returns {object} A profile of the most active chakra.
 */
function getChakraProfile(dashaData) {
    const currentMahaDashaLord = dashaData.dasha_periods[0].name.toLowerCase();
    
    const chakraMap = {
        'sun': 'Solar Plexus',
        'moon': 'Sacral',
        'mars': 'Solar Plexus',
        'mercury': 'Throat',
        'jupiter': 'Heart',
        'venus': 'Sacral',
        'saturn': 'Root',
        'rahu': 'Third Eye',
        'ketu': 'Crown'
    };

    const activeChakra = chakraMap[currentMahaDashaLord] || 'Unknown';

    return {
        activeDashaLord: currentMahaDashaLord,
        primaryChakraTheme: activeChakra,
        description: `Your current life chapter (Dasha) is ruled by ${currentMahaDashaLord}, highlighting themes related to the ${activeChakra} Chakra.`
    };
}

module.exports = { getDharmaType, getChakraProfile };
