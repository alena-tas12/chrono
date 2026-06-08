const { getUserModel } = require("./userModel");

function detectState(input) {
    if (!input || typeof input !== 'string') return "neutral";
    const msg = input.toLowerCase();
    if (msg.includes("overwhelmed")) return "overwhelmed";
    if (msg.includes("tired")) return "low";
    if (msg.includes("ready")) return "focused";
    return "neutral";
}

function applyAlignment(response, state) {
    const user = getUserModel();
    let final = response;
    
    if (user?.tone === "calm") final = "Take it slowly. " + final;
    if (user?.tone === "direct") final = "Focus. " + final;
    if (state === "overwhelmed") final = "It’s okay. " + final;
    if (state === "low") final = "Start small. " + final;
    
    if (final.length > 120) {
        final = final.slice(0, 120) + "...";
    }
    
    return final;
}

module.exports = {
    detectState,
    applyAlignment
};