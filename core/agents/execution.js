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
        const worstCaseProfit = signal.risk.worstCaseProfit;
        
        // Phase 25: Failsafe Trade Guard (Profit Floor)
        // Phase 36: Zero-Profit Relaxation (Convert to WATCH instead of SKIP)
        if (worstCaseProfit <= 0) {
            console.log(`[EXECUTION GOVERNANCE] Downgrade: Worst-case profit ($${worstCaseProfit}) is non-positive.`);
            signal.execution = { 
                verdict: 'WATCH', 
                reason: 'PROFIT_FLOOR_VIOLATION',
                tags: ['LOW CONFIDENCE / BREAK-EVEN RISK']
            };
            return signal;
        }

        let verdict = 'SKIP';
        if (isSafe && score >= 80) verdict = 'STRONG BUY';
        else if (isSafe && score >= 65) verdict = 'BUY SMALL';
        else if (score >= 50) verdict = 'WATCH';

        // Autonomy Gating & Capital Management
        const price = signal.product.price;
        const maxCapital = (this.config.TotalCapital * this.config.MaxCapitalPerTradePercent) / 100;
        
        if (verdict.includes('BUY') && price > maxCapital) {
            console.log(`[EXECUTION GOVERNANCE] Downgrade: Price ($${price}) exceeds MaxCapital ($${maxCapital})`);
            verdict = 'WATCH';
        }

        // Phase 28: Allow Medium Confidence for BUY SMALL
        if (verdict === 'STRONG BUY' && signal.risk?.resaleConfidence !== 'High') {
            verdict = 'BUY SMALL'; 
        }

        signal.execution = {
            verdict,
            units: (verdict.includes('BUY')) ? 1 : 0,
            allocatedCapital: (verdict.includes('BUY')) ? price : 0
        };

        return signal;
    }
}

module.exports = ExecutionAgent;
