/**
 * Execution Agent: Final verdict and Flip potential.
 */
class ExecutionAgent {
    constructor(config) {
        this.config = config;
    }

    process(signal) {
        const flipScore = signal.flipScore || 50;
        
        let verdict = 'WATCH';
        if (flipScore >= 75) verdict = 'BUY';

        // Simplified flip potential string
        let minFlip = signal.price * 1.5;
        let maxFlip = signal.price * 3.0;
        
        if (signal.niche === 'AI' || signal.niche === 'Domain') {
            maxFlip = signal.price * 10.0;
        }

        return {
            ...signal,
            verdict,
            estimatedFlip: `$${minFlip.toFixed(0)}-$${maxFlip.toFixed(0)}+`,
            reason: `High liquidity in ${signal.niche} niche.`
        };
    }
}

module.exports = ExecutionAgent;
