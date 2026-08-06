const memory = require('./memoryEngine');

// ========================================
// 🧠 COMPREHENSIVE USER MODELING SYSTEM
// ========================================

let userProfile = {
    // Basic metrics
    sessionStart: Date.now(),
    totalInteractions: 0,
    lastInteraction: null,
    
    // Communication style profiling
    communication: {
        style: 'unknown', // direct, indirect, formal, casual, expressive, reserved
        messageLength: 'medium', // short, medium, long
        questionFrequency: 0,
        statementFrequency: 0,
        emojiUsage: 0,
        punctuationStyle: 'normal'
    },
    
    // Conversational pacing preferences
    pacing: {
        preferredSpeed: 'medium', // slow, medium, fast
        responseLatency: 0,
        messageBursting: false,
        silenceTolerance: 'medium', // low, medium, high
        topicSwitchingSpeed: 'medium'
    },
    
    // Emotional interaction patterns
    emotional: {
        baseline: 'neutral',
        volatility: 'low', // low, medium, high
        expressionStyle: 'open', // open, reserved, guarded
        triggers: [], // topics that trigger strong emotions
        supportNeeds: 'moderate' // low, moderate, high
    },
    
    // Recurring themes
    themes: {
        primary: [],
        secondary: [],
        avoided: [],
        depth: 'moderate' // shallow, moderate, deep
    },
    
    // Behavioral tendencies
    behavior: {
        consistency: 'unknown',
        taskFocus: 'moderate',
        decisionStyle: 'deliberate', // impulsive, deliberate, avoidant
        stressResponse: 'adaptive', // adaptive, avoidant, confrontational
        helpSeeking: 'moderate'
    },
    
    // Attachment sensitivity
    attachment: {
        style: 'unknown', // secure, anxious, avoidant, disorganized
        dependencyLevel: 'moderate',
        reassuranceNeeds: 'moderate',
        boundaryRespect: 'high'
    },
    
    // Preferred conversational depth
    depth: {
        preferred: 'moderate', // shallow, moderate, deep
        abstractTolerance: 'medium', // low, medium, high
        personalSharing: 'moderate', // low, moderate, high
        philosophicalInterest: 'medium'
    },
    
    // Interaction frequency patterns
    frequency: {
        pattern: 'unknown', // regular, sporadic, bursty, declining
        peakTimes: [],
        averageSessionLength: 0,
        returnRate: 0
    },
    
    // Proactivity configuration and per-domain policies
    proactivity: {
        mode: 'balanced', // 'disabled', 'quiet', 'balanced', 'proactive'
        onboardingCompleted: false,
        domainPolicies: {
            personal: 'balanced',
            study: 'proactive',
            family: 'quiet',
            routine: 'balanced',
            focus: 'quiet'
        }
    }
};

// ========================================
// 📊 USER MODEL UPDATE
// ========================================

function updateUserModel(input, response, metadata = {}) {
    userProfile.totalInteractions++;
    userProfile.lastInteraction = Date.now();
    
    // Analyze communication style
    analyzeCommunicationStyle(input);
    
    // Track pacing patterns
    analyzePacingPatterns(metadata);
    
    // Track emotional patterns
    analyzeEmotionalPatterns(input, metadata);
    
    // Identify recurring themes
    identifyThemes(input);
    
    // Track behavioral tendencies
    analyzeBehavioralTendencies(metadata);
    
    saveUserProfileToDB();
    
    return getUserModel();
}

function analyzeCommunicationStyle(input) {
    const words = input.split(/\s+/).length;
    const sentences = input.split(/[.!?]+/).length;
    
    // Message length classification
    if (words < 10) {
        userProfile.communication.messageLength = 'short';
    } else if (words < 30) {
        userProfile.communication.messageLength = 'medium';
    } else {
        userProfile.communication.messageLength = 'long';
    }
    
    // Question vs statement frequency
    if (input.includes('?')) {
        userProfile.communication.questionFrequency++;
    } else {
        userProfile.communication.statementFrequency++;
    }
    
    // Emoji usage
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    if (emojiRegex.test(input)) {
        userProfile.communication.emojiUsage++;
    }
    
    // Determine overall style
    const questionRatio = userProfile.communication.questionFrequency / userProfile.totalInteractions;
    const emojiRatio = userProfile.communication.emojiUsage / userProfile.totalInteractions;
    
    if (emojiRatio > 0.3) {
        userProfile.communication.style = 'expressive';
    } else if (questionRatio > 0.5) {
        userProfile.communication.style = 'inquisitive';
    } else if (words > 30) {
        userProfile.communication.style = 'elaborate';
    } else {
        userProfile.communication.style = 'direct';
    }
}

function analyzePacingPatterns(metadata) {
    if (metadata.idleTime) {
        userProfile.pacing.responseLatency = metadata.idleTime;
        
        if (metadata.idleTime < 5000) {
            userProfile.pacing.preferredSpeed = 'fast';
        } else if (metadata.idleTime < 30000) {
            userProfile.pacing.preferredSpeed = 'medium';
        } else {
            userProfile.pacing.preferredSpeed = 'slow';
        }
    }
}

function analyzeEmotionalPatterns(input, metadata) {
    const lower = input.toLowerCase();
    
    // Detect emotional triggers
    const emotionalKeywords = {
        overwhelmed: ['overwhelmed', 'stressed', 'anxious', 'panic'],
        frustrated: ['frustrated', 'angry', 'annoyed'],
        sad: ['sad', 'down', 'depressed', 'lonely'],
        energetic: ['excited', 'motivated', 'energetic'],
        calm: ['calm', 'peaceful', 'relaxed']
    };
    
    for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
        if (keywords.some(kw => lower.includes(kw))) {
            if (!userProfile.emotional.triggers.includes(emotion)) {
                userProfile.emotional.triggers.push(emotion);
            }
            userProfile.emotional.baseline = emotion;
        }
    }
    
    // Track volatility based on emotion changes
    if (metadata.emotion && metadata.emotion !== userProfile.emotional.baseline) {
        userProfile.emotional.volatility = 'medium';
    }
}

function identifyThemes(input) {
    const lower = input.toLowerCase();
    
    // Common theme categories
    const themeCategories = {
        work: ['work', 'job', 'career', 'project', 'deadline', 'boss', 'colleague'],
        relationships: ['friend', 'partner', 'relationship', 'family', 'parent', 'sibling'],
        health: ['health', 'exercise', 'diet', 'sleep', 'doctor', 'wellness'],
        creative: ['art', 'music', 'writing', 'creative', 'project', 'idea'],
        personal: ['myself', 'personal', 'growth', 'goals', 'future', 'life'],
        technical: ['code', 'programming', 'software', 'app', 'system', 'debug']
    };
    
    for (const [theme, keywords] of Object.entries(themeCategories)) {
        if (keywords.some(kw => lower.includes(kw))) {
            if (!userProfile.themes.primary.includes(theme)) {
                userProfile.themes.primary.push(theme);
            }
        }
    }
    
    // Keep themes bounded
    if (userProfile.themes.primary.length > 5) {
        userProfile.themes.primary.shift();
    }
}

function analyzeBehavioralTendencies(metadata) {
    if (metadata.tasks) {
        const taskCount = metadata.tasks;
        
        if (taskCount > 5) {
            userProfile.behavior.taskFocus = 'high';
        } else if (taskCount > 2) {
            userProfile.behavior.taskFocus = 'moderate';
        } else {
            userProfile.behavior.taskFocus = 'low';
        }
    }
    
    // Determine consistency based on interaction patterns
    if (userProfile.totalInteractions > 10) {
        const avgFocus = memory.getAverageFocusTime();
        
        if (avgFocus > 60) {
            userProfile.behavior.consistency = 'high';
        } else if (avgFocus > 20) {
            userProfile.behavior.consistency = 'moderate';
        } else {
            userProfile.behavior.consistency = 'low';
        }
    }
}

// ========================================
// 📊 USER MODEL RETRIEVAL
// ========================================

function getUserModel() {
    const avgFocus = memory.getAverageFocusTime();
    const frequentTask = memory.getMostFrequentTask();
    
    return {
        // Legacy fields for compatibility
        avgFocus,
        frequentTask,
        consistency: userProfile.behavior.consistency,
        tendency: userProfile.behavior.taskFocus === 'high' ? 'stable' : 'drifts',
        
        // New comprehensive profile
        communication: userProfile.communication,
        pacing: userProfile.pacing,
        emotional: userProfile.emotional,
        themes: userProfile.themes,
        behavior: userProfile.behavior,
        attachment: userProfile.attachment,
        depth: userProfile.depth,
        frequency: userProfile.frequency,
        
        // Session metrics
        totalInteractions: userProfile.totalInteractions,
        sessionDuration: Date.now() - userProfile.sessionStart
    };
}

function getUserProfileSummary() {
    return {
        style: userProfile.communication.style,
        pacing: userProfile.pacing.preferredSpeed,
        emotionalBaseline: userProfile.emotional.baseline,
        primaryThemes: userProfile.themes.primary,
        consistency: userProfile.behavior.consistency,
        depth: userProfile.depth.preferred
    };
}

function resetUserProfile() {
    userProfile = {
        sessionStart: Date.now(),
        totalInteractions: 0,
        lastInteraction: null,
        communication: {
            style: 'unknown',
            messageLength: 'medium',
            questionFrequency: 0,
            statementFrequency: 0,
            emojiUsage: 0,
            punctuationStyle: 'normal'
        },
        pacing: {
            preferredSpeed: 'medium',
            responseLatency: 0,
            messageBursting: false,
            silenceTolerance: 'medium',
            topicSwitchingSpeed: 'medium'
        },
        emotional: {
            baseline: 'neutral',
            volatility: 'low',
            expressionStyle: 'open',
            triggers: [],
            supportNeeds: 'moderate'
        },
        themes: {
            primary: [],
            secondary: [],
            avoided: [],
            depth: 'moderate'
        },
        behavior: {
            consistency: 'unknown',
            taskFocus: 'moderate',
            decisionStyle: 'deliberate',
            stressResponse: 'adaptive',
            helpSeeking: 'moderate'
        },
        attachment: {
            style: 'unknown',
            dependencyLevel: 'moderate',
            reassuranceNeeds: 'moderate',
            boundaryRespect: 'high'
        },
        depth: {
            preferred: 'moderate',
            abstractTolerance: 'medium',
            personalSharing: 'moderate',
            philosophicalInterest: 'medium'
        },
        frequency: {
            pattern: 'unknown',
            peakTimes: [],
            averageSessionLength: 0,
            returnRate: 0
        }
    };
}

function saveUserProfileToDB() {
    try {
        const { db } = require('./main_db');
        db.prepare("DELETE FROM memory_behavior WHERE type = 'user_profile'").run();
        db.prepare("INSERT INTO memory_behavior (type, value, timestamp) VALUES (?, ?, ?)")
          .run('user_profile', JSON.stringify(userProfile), Date.now());
    } catch (e) {
        console.error("Failed to save user profile:", e);
    }
}

function initializeUserProfile() {
    try {
        const { db } = require('./main_db');
        const row = db.prepare("SELECT value FROM memory_behavior WHERE type = 'user_profile' ORDER BY timestamp DESC LIMIT 1").get();
        if (row) {
            userProfile = JSON.parse(row.value);
            userProfile.sessionStart = Date.now();
            console.log("🧠 User profile loaded from DB.");
        }
    } catch (e) {
        console.error("Failed to load user profile:", e);
    }
}

// Run startup initialization
initializeUserProfile();

function getProactivitySettings() {
    if (!userProfile.proactivity) {
        userProfile.proactivity = {
            mode: 'balanced',
            onboardingCompleted: false,
            domainPolicies: {
                personal: 'balanced',
                study: 'proactive',
                family: 'quiet',
                routine: 'balanced',
                focus: 'quiet'
            }
        };
    }
    return userProfile.proactivity;
}

function setProactivityMode(mode) {
    const settings = getProactivitySettings();
    if (['disabled', 'quiet', 'balanced', 'proactive'].includes(mode)) {
        settings.mode = mode;
        saveUserProfileToDB();
    }
    return settings;
}

function setDomainProactivity(domain, level) {
    const settings = getProactivitySettings();
    const validDomains = ['personal', 'study', 'family', 'routine', 'focus'];
    const validLevels = ['disabled', 'quiet', 'balanced', 'proactive'];
    if (validDomains.includes(domain) && validLevels.includes(level)) {
        settings.domainPolicies[domain] = level;
        saveUserProfileToDB();
    }
    return settings;
}

function completeProactivityOnboarding(mode, domainPolicies = {}) {
    const settings = getProactivitySettings();
    settings.onboardingCompleted = true;
    if (mode) settings.mode = mode;
    if (domainPolicies && typeof domainPolicies === 'object') {
        Object.assign(settings.domainPolicies, domainPolicies);
    }
    saveUserProfileToDB();
    return settings;
}

function evaluateProactiveThought(thoughtContext = {}) {
    const { domain = 'personal', priority = 'medium', confidence = 0.5 } = thoughtContext;
    const settings = getProactivitySettings();
    if (settings.mode === 'disabled') return { allow: false, reason: 'Global proactivity disabled' };
    
    const domainLevel = settings.domainPolicies[domain] || settings.mode;
    if (domainLevel === 'disabled') return { allow: false, reason: `Domain ${domain} proactivity disabled` };
    
    if (domainLevel === 'quiet' && priority !== 'high') {
        return { allow: false, reason: 'Quiet domain policy allows high priority only' };
    }
    
    if (confidence < 0.4) {
        return { allow: false, reason: 'Confidence score below proactivity threshold' };
    }
    
    return { allow: true, domainLevel, globalMode: settings.mode };
}

module.exports = {
    getUserModel,
    updateUserModel,
    getUserProfileSummary,
    resetUserProfile,
    saveUserProfileToDB,
    initializeUserProfile,
    getProactivitySettings,
    setProactivityMode,
    setDomainProactivity,
    completeProactivityOnboarding,
    evaluateProactiveThought
};