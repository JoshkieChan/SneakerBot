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
        const marketPrice = signal.market.price || price; // Default to retail if no market data
        
        // 1. Worst-Case Simulation
        const haircut = marketPrice * 0.90; // 10% lower resale
        const feeHike = (this.config.PlatformFeePercent || 12) + 2; // 2% higher fees
        const shipping = this.config.EstimatedShipping || 12;
        
        const worstCaseProfit = (haircut * (1 - feeHike / 100)) - price - shipping;
        
        signal.risk = {
            worstCaseProfit,
            riskLevel: worstCaseProfit < 0 ? 'High' : (worstCaseProfit < 20 ? 'Medium' : 'Low'),
            isSafe: worstCaseProfit > 0,
            simConfidence: signal.market.price ? 'High' : 'Low'
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
