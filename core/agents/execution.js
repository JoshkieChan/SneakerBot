/**
 * Execution Agent: Signal Quality Enforcer.
 */
class ExecutionAgent {
    constructor(config) {
        this.config = config;
    }

    process(signal) {
        // STRICT ALERT CONDITIONS
        const isValidDeal = signal.profit >= 50 && signal.score >= 50;

        if (!isValidDeal) {
            return { verdict: 'DISCARD' };
        }

        return {
            ...signal,
            verdict: 'BUY',
            reason: `Detected ${signal.niche} opportunity with ${signal.score} confidence score.`
        };
    }
}

module.exports = ExecutionAgent;
