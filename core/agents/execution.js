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
        
        // Phase 39/42/43/45/46/48: Optimized Pivot Thresholds
        const isModel = confidence === 'MODEL_ESTIMATED';
        const isEarly = signal.intelligence.earlySignal;
        const isTier1 = signal.intelligence.matchedTier === 'Tier1';
        
        if (isEarly && liquidity === 'HIGH' && signal.intelligence.matchedTier) {
            verdict = 'EARLY BUY';
            reason = 'PRE_MARKET_ALPHA';
        } else if (worstCaseProfit >= 15 && (liquidity === 'HIGH' || isTier1)) {
            verdict = 'STRONG BUY';
        } else if (worstCaseProfit >= 5 || (isTier1 && worstCaseProfit >= 0 && liquidity === 'HIGH')) {
            verdict = 'BUY SMALL';
        } else if (worstCaseProfit >= -5) {
            verdict = 'WATCH';
        }

        // Apply Positioning (How many to buy)
        let units = 0;
        if (verdict === 'STRONG BUY') units = 2;
        if (verdict === 'BUY SMALL') units = 1;
        if (verdict === 'EARLY BUY') units = 1;

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
