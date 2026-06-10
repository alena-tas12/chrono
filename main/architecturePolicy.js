const LAYERS = Object.freeze({
    FOUNDER: 'founder',
    PRODUCT: 'product'
});

function getChronoLayer() {
    const configured = (process.env.CHRONO_LAYER || '').toLowerCase();
    if (configured === LAYERS.PRODUCT) return LAYERS.PRODUCT;
    return LAYERS.FOUNDER;
}

function isFounderLayer() {
    return getChronoLayer() === LAYERS.FOUNDER;
}

function requireFounderLayer(featureName) {
    if (!isFounderLayer()) {
        return {
            unavailable: true,
            feature: featureName,
            reason: 'This is an Original Chrono founder-layer feature and is disabled in Public Chrono.'
        };
    }
    return null;
}

module.exports = {
    LAYERS,
    getChronoLayer,
    isFounderLayer,
    requireFounderLayer
};
