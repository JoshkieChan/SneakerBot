/**
 * Risk Agent: Safety & Transferability.
 */
class RiskAgent {
    constructor(config) {
        this.config = config;
    }

    evaluate(signal) {
        // 1. SNIPER MODE: HIGH CONFIDENCE ONLY (Score >= 80)
        if (signal.score < 80) {
            return { valid: false, reason: 'BELOW_SNIPER_THRESHOLD' };
        }

        // 2. MANDATORY PRICE RANGE ($25 - $1000)
        if (signal.price < 25 || signal.price > 1000) {
            return { valid: false, reason: 'PRICE_OUT_OF_SNIPER_RANGE' };
        }

        // 3. TRANSFERABILITY (Non-negotiable)
        if (signal.isTransferable === false) {
            return { valid: false, reason: 'NON_TRANSFERABLE' };
        }

        // 4. DEMAND VERIFICATION
        // (Handled by score >= 80, but adding a hard check for safety)
        if (!signal.demandSignal) {
            return { valid: false, reason: 'NO_DEMAND_SIGNAL' };
        }

        return { valid: true };
    }
}

module.exports = RiskAgent;
