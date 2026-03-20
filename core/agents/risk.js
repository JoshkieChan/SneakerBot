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
        
        // Phase 39/43: Real Profit Detection
        const platformFeePercent = this.config.PlatformFeePercent || 12;
        const estimatedShipping = this.config.EstimatedShipping || 10;
        const isModel = signal.market.isModelEstimated;

        const trueProfit = (marketPrice * (1 - platformFeePercent / 100)) - price - estimatedShipping;
        
        // Worst-Case Simulation
        const adjustedResale = marketPrice * 0.90;
        const adjustedFees = platformFeePercent + 2;
        const worstCaseProfit = (adjustedResale * (1 - adjustedFees / 100)) - price - estimatedShipping;
        
        // Phase 43/46/48: Adjusted Model Thresholds
        const isEarly = signal.intelligence.earlySignal;
        const isTier1 = signal.intelligence.matchedTier === 'Tier1';
        const skipFloor = isEarly ? -999 : (isTier1 ? -10 : (isModel ? -5 : -5));

        if (worstCaseProfit < skipFloor) {
            console.log(`[RISK] KILL: Worst-case loss ($${worstCaseProfit.toFixed(2)}) below ${isTier1 ? 'Tier1' : (isModel ? 'model' : 'market')} floor.`);
            signal.risk = { isSafe: false, trueProfit, worstCaseProfit, verdict: 'SKIP' };
            return signal;
        }

        signal.risk = {
            trueProfit,
            worstCaseProfit,
            riskLevel: isEarly ? 'HIGH (PRE-MARKET)' : (worstCaseProfit < 0 ? 'HIGH' : (worstCaseProfit < 20 ? 'MEDIUM' : 'LOW')),
            isSafe: isEarly || worstCaseProfit >= (isTier1 && signal.intelligence.liquidity === 'HIGH' ? 0 : 0),
            confidence: isEarly ? 'EARLY_SIGNAL' : (isModel ? 'MODEL_ESTIMATED' : (signal.intelligence.resaleConfidence || 'LOW')),
            tags: isEarly ? ['PRE-MARKET PRICE DISCOVERY'] : (worstCaseProfit < 0 ? ['LOW CONFIDENCE / BREAK-EVEN RISK'] : [])
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
