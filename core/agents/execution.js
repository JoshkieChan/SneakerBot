/**
 * Execution Agent: Assigns final Trade Decision (STRONG BUY / BUY SMALL / WATCH / SKIP)
 * and determines unit allocation based on available capital.
 */
class ExecutionAgent {
    constructor(config) {
        this.config = config;
    }

    async decide(signal) {
        console.log(`[EXECUTION] Deciding for: ${signal.product.title}...`);
        
        const score = signal.intelligence.score;
        const isSafe = signal.risk.isSafe;
        const riskLevel = signal.risk.riskLevel;
        
        let verdict = 'SKIP';
        if (isSafe && score >= 85) verdict = 'STRONG BUY';
        else if (isSafe && score >= 70) verdict = 'BUY SMALL';
        else if (score >= 60) verdict = 'WATCH';

        // Autonomy Gating
        if (verdict === 'STRONG BUY' && signal.risk.simConfidence !== 'High') {
            verdict = 'BUY SMALL'; // Downgrade if no sold data
        }

        signal.execution = {
            verdict,
            units: (verdict === 'STRONG BUY') ? 1 : 0,
            allocatedCapital: (verdict !== 'SKIP' && verdict !== 'WATCH') ? signal.product.price : 0
        };

        return signal;
    }
}

module.exports = ExecutionAgent;
