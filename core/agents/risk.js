/**
 * Risk Agent: Safety gates for Digital Arbitrage.
 */
class RiskAgent {
    constructor(config) {
        this.config = config;
    }

    evaluate(signal) {
        const text = signal.title.toLowerCase();

        // 1. Missing Price Check
        if (!signal.price || signal.price <= 0) {
            return { valid: false, reason: 'PRICE_MISSING' };
        }

        // 2. Scam Detection
        const scamKeywords = ['scam', 'fake', 'hacked', 'method', 'free money'];
        if (scamKeywords.some(kw => text.includes(kw))) {
            return { valid: false, reason: 'SCAM_DETECTED' };
        }

        // 3. Niche Check
        if (signal.niche === 'General' && signal.flipScore < 60) {
            return { valid: false, reason: 'UNKNOWN_LOW_VALUE' };
        }

        return { valid: true };
    }
}

module.exports = RiskAgent;
