/**
 * Risk Agent: Safety & Transferability.
 */
class RiskAgent {
    constructor(config) {
        this.config = config;
    }

    evaluate(signal) {
        // 1. BILLIONAIRE PARTNER MODE: HIGH CONFIDENCE ONLY
        if (signal.score < 60) {
            return { valid: false, reason: 'LOW_CONFIDENCE_SCORE' };
        }

        // 2. TRANSFERABILITY (The #1 Rule)
        if (signal.isTransferable === false) {
            return { valid: false, reason: 'NON_TRANSFERABLE' };
        }

        // 3. Price Safety
        if (signal.price > 1000) {
            return { valid: false, reason: 'PRICE_OUT_OF_RANGE' };
        }

        // 4. Scam Detection
        const text = (signal.title + " " + (signal.description || "")).toLowerCase();
        const scamKeywords = ['scam', 'fake', 'hacked', 'bot generated', 'stolen'];
        if (scamKeywords.some(kw => text.includes(kw))) {
            return { valid: false, reason: 'SCAM_DETECTED' };
        }

        return { valid: true };
    }
}

module.exports = RiskAgent;
