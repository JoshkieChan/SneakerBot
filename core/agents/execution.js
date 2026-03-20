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
        const liquidity = signal.intelligence.liquidity;
        const confidence = signal.intelligence.resaleConfidence;
        const worstCaseProfit = signal.risk.worstCaseProfit;
        
        let verdict = 'SKIP';
        
        // Phase 39: Hard Profit Gates
        if (worstCaseProfit >= 20 && liquidity === 'HIGH' && confidence !== 'ESTIMATED') {
            verdict = 'STRONG BUY';
        } else if (worstCaseProfit >= 5) {
            verdict = 'BUY SMALL';
        } else if (worstCaseProfit >= -10) {
            verdict = 'WATCH';
        }

        // Phase 39: Force Downgrade for ESTIMATED
        if (verdict === 'STRONG BUY' && confidence === 'ESTIMATED') {
            verdict = 'BUY SMALL';
        }

        if (verdict === 'SKIP') {
            signal.execution = { verdict, reason: 'PROFIT_THRESHOLD_FAIL' };
            return signal;
        }

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
