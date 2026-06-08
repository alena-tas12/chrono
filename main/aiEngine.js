let lastState = null;
let repeatCount = 0;

function getState({ tasks, currentTask }) {
    if (!tasks || tasks === 0) return "idle";
    if (!currentTask) return "planning";
    return "focus";
}

function getBehaviorTrend(currentState) {
    if (currentState === lastState) {
        repeatCount++;
    } else {
        repeatCount = 0;
        lastState = currentState;
    }

    return repeatCount;
}

function generateResponse(state, data) {
    const idleTime = data.idleTime || 0;
    const model = data.model || {};
    const strict = data.strict;

    // 🔴 STRICT MODE
    if (strict && idleTime > 10) {
        return "Stop. Get back to work.";
    }

    // 🔴 DRIFT
    if (idleTime > 20 && state === "focus") {
        return "You’re slipping. Come back.";
    }

    // 🧠 PERSONALITY LAYER

    if (model.consistency === "low") {
        return "It’s okay. Just stay a little longer this time.";
    }

    if (model.consistency === "high") {
        return "You’re doing well. Keep going.";
    }

    // 🟢 BASE

    switch (state) {
        case "idle":
            return "You don’t have to rush. Just begin.";

        case "planning":
            return "Pick one. Stay with it.";

        case "focus":
            return "I’m here. Stay with this.";

        default:
            return "Just begin.";
    }
}

module.exports = {
    getState,
    generateResponse
};