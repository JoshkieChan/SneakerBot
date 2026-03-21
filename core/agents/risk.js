/**
 * Risk Agent: Safety & Transferability.
 */
class RiskAgent {
    constructor(config) {
        this.config = config;
    }

    evaluate(signal) {
        // 1. TRANSFERABILITY (The #1 Rule)
        if (signal.isTransferable === false || signal.score < 0) {
            return { valid: false, reason: 'NON_TRANSFERABLE_OR_AUTO_REJECT' };
        }

        // 2. Price Safety
        if (signal.price > 1000) {
            return { valid: false, reason: 'PRICE_OUT_OF_RANGE' };
        }

        // 3. Scam Detection
        const text = (signal.title + " " + (signal.description || "")).toLowerCase();
        const scamKeywords = ['scam', 'fake', 'hacked', 'bot generated'];
        if (scamKeywords.some(kw => text.includes(kw))) {
            return { valid: false, reason: 'SCAM_DETECTED' };
        }

        return { valid: true };
    }
}

module.exports = RiskAgent;
