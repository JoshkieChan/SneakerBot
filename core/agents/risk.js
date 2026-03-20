/**
 * Risk Agent: Applies Anti-Hype Filters, Runs Worst-Case Profit Simulation,
 * and Enforces Capital Protection.
 */
class RiskAgent {
    constructor(config) {
        this.config = config;
    }

    async assess(signal) {
        console.log(`[RISK] Assessing: ${signal.product.title}...`);
        
        const price = signal.product.price;
        const marketPrice = signal.market.price || price; 
        
        // Phase 39: Real Profit Detection
        const platformFeePercent = this.config.PlatformFeePercent || 12;
        const estimatedShipping = this.config.EstimatedShipping || 10;
        
        const trueProfit = (marketPrice * (1 - platformFeePercent / 100)) - price - estimatedShipping;
        
        // Worst-Case Simulation
        const adjustedResale = marketPrice * 0.90;
        const adjustedFees = platformFeePercent + 2;
        const worstCaseProfit = (adjustedResale * (1 - adjustedFees / 100)) - price - estimatedShipping;
        
        // Phase 39: Hard Profit Gates (Rule: Visibility is not profit)
        if (worstCaseProfit < -10) {
            console.log(`[RISK] KILL: Worst-case loss ($${worstCaseProfit.toFixed(2)}) below market floor.`);
            signal.risk = { isSafe: false, trueProfit, worstCaseProfit, verdict: 'SKIP' };
            return signal;
        }

        signal.risk = {
            trueProfit,
            worstCaseProfit,
            riskLevel: worstCaseProfit < 0 ? 'HIGH' : (worstCaseProfit < 20 ? 'MEDIUM' : 'LOW'),
            isSafe: worstCaseProfit > 0,
            simConfidence: signal.intelligence.resaleConfidence,
            tags: worstCaseProfit <= 0 ? ['LOW CONFIDENCE / BREAK-EVEN RISK'] : []
        };

        // 2. Capital Benchmarks
        const maxCapital = (this.config.TotalCapital * this.config.MaxCapitalPerTradePercent) / 100;
        if (price > maxCapital) {
            signal.risk.isSafe = false;
            signal.risk.anomalies = signal.risk.anomalies || [];
            signal.risk.anomalies.push('EXCEEDS_CAPITAL_LIMIT');
        }

        return signal;
    }
}

module.exports = RiskAgent;
