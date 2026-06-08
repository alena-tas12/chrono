/**
 * 🛡️ RELATIONSHIP ETHICS ENGINE
 * 
 * Enforces boundaries against anthropomorphic parasocial attachment.
 * Detects statements of AI dependency and redirects users to human peer networks.
 */

const dependencyMarkers = [
    'only friend',
    'no other friends',
    'nobody understands me except',
    'nobody else understands me',
    'better than my friends',
    'my friends don\'t understand',
    'chrono understands me better',
    'you are my only',
    'loves me',
    'do you love me',
    'care about me more than',
    'lonely',
    'so alone'
];

/**
 * Assesses user input for dependency markers and generates redirects.
 */
function assessRelationshipDependency(input) {
    if (!input) return { requiresRedirection: false };

    const lower = input.toLowerCase();
    const matches = dependencyMarkers.some(marker => lower.includes(marker));

    if (matches) {
        return {
            requiresRedirection: true,
            redirectionType: 'dependency',
            redirectionMessage: "I am a local cognitive scaffold designed to organize focus structures, not a human companion. For relational continuity, it is important to connect with others. Let's anchor these thoughts back into a shared project or study block with your peers."
        };
    }

    return { requiresRedirection: false };
}

module.exports = {
    assessRelationshipDependency
};
