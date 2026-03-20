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
        let reason = 'PROFIT_THRESHOLD_FAIL';
        
        // Phase 39/42/43: Hard Profit Gates & Early Alpha
        const isModel = confidence === 'MODEL_ESTIMATED';
        
        if (worstCaseProfit >= 20 && liquidity === 'HIGH' && confidence !== 'ESTIMATED' && !isModel) {
            verdict = 'STRONG BUY';
        } else if (worstCaseProfit >= (isModel ? 10 : 5)) {
            verdict = 'BUY SMALL';
        } else if (worstCaseProfit >= (isModel ? -5 : -10)) {
            verdict = 'WATCH';
        }

        // Phase 42: Early Alpha Detection (Potential before market moves)
        if (verdict === 'SKIP' && worstCaseProfit >= -10) {
            const isSneaker = signal.product.title.toLowerCase().includes('shoe') || signal.product.title.toLowerCase().includes('sneaker');
            const isOuterwear = ['jacket', 'hoodie', 'outerwear'].some(c => signal.product.title.toLowerCase().includes(c));
            const isHypeSize = ['m', 'l', 'xl', 'xxl'].some(s => signal.product.title.toLowerCase().includes(` ${s} `) || signal.product.title.toLowerCase().endsWith(` ${s}`));
            const isHypeBrand = liquidity === 'HIGH';

            if (isHypeBrand && (isSneaker || isOuterwear) && signal.product.price >= 80) {
                verdict = 'EARLY WATCH';
                reason = 'HYPE_ALPHA_POTENTIAL';
                signal.execution.earlyReason = isCollab ? 'Elite Collaboration detected' : 'High-demand brand/category match';
            }
        }

        // Phase 39: Force Downgrade for ESTIMATED
        if (verdict === 'STRONG BUY' && confidence === 'ESTIMATED') {
            verdict = 'BUY SMALL';
        }

        if (verdict === 'SKIP') {
            signal.execution = { verdict, reason };
            return signal;
        }

        signal.execution = { verdict, reason: 'VERDICT_REACHED' };

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
