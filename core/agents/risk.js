/**
 * Risk Agent: Digital Asset Hard Gate.
 */
class RiskAgent {
    constructor(config) {
        this.config = config;
    }

    evaluate(signal) {
        const text = (signal.title + " " + (signal.description || "")).toLowerCase();

        // 1. Hard Price Filter
        if (signal.price > 1000) return { valid: false, reason: 'PRICE_EXCEEDS_MAX' };

        // 2. Demo Check
        const hasDemo = text.includes('demo') || text.includes('preview') || text.includes('link') || text.includes('http');
        if (!hasDemo) return { valid: false, reason: 'NO_DEMO_PREVIEW' };

        // 3. Non-Transferable License Check
        const banKeywords = ['non-transferable', 'single use only', 'cannot be resold', 'fake', 'scam'];
        if (banKeywords.some(kw => text.includes(kw))) {
            return { valid: false, reason: 'INVALID_LICENSE_OR_SCAM' };
        }

        return { valid: true };
    }
}

module.exports = RiskAgent;
