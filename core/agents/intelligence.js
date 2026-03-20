/**
 * Intelligence Agent: Performs Scoring, Applies Keyword Tiers,
 * and evaluates Resale/Size/Liquidity potential.
 */
class IntelligenceAgent {
    constructor(config) {
        this.config = config;
    }

    async analyze(signal) {
        try {
            console.log(`[INTELLIGENCE] Analyzing: ${signal.product.title}...`);
            
            let score = 50; // Base score
            const tiers = this.config.EliteKeywordTiers || {};
            
            // 1. Keyword Tier Scoring
            let matchedTier = null;
            for (const [tierName, tierData] of Object.entries(tiers)) {
                const match = tierData.keywords && tierData.keywords.find(k => {
                    const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    return regex.test(signal.product.title);
                });
                if (match) {
                    matchedTier = tierName;
                    score += (tierData.weight || 0);
                    break;
                }
            }

            // 2. Market Data Analysis (Phase 28 Adjustments)
            const market = signal.market || {};
            let resaleConfidence = 'Low';
            
            if (market.hasSoldData) {
                resaleConfidence = 'High';
                score += 20;
            } else if (market.hasListings) {
                // Phase 28: Reduced penalty from -30 to -15
                resaleConfidence = 'Medium';
                score -= 15;
            }

            // 3. Anti-Hype Filter (Phase 28: Downgraded Severity)
            const hypeKeywords = ['travis', 'spiderman', 'jordan 1 high', 'off-white'];
            const isHyped = hypeKeywords.some(hk => signal.product.title.toLowerCase().includes(hk));
            if (isHyped) {
                // Moderate penalty (-5) instead of high rejection
                score -= 5;
            }

            // 4. Negative keyword check
            const negativeMatch = this.config.EliteNegativeKeywords && this.config.EliteNegativeKeywords.some(neg => {
                const regex = new RegExp(`\\b${neg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                return regex.test(signal.product.title);
            });
            // Phase 28: Adaptive Feedback (Soft Mode)
            if (signal.intelligence?.softMode) {
                score += 5;
            }

            signal.intelligence = {
                ...signal.intelligence,
                score,
                matchedTier,
                resaleConfidence,
                liquidity: market.hasSoldData ? 'High' : 'Medium',
                brandStrength: matchedTier ? 'High' : 'Medium'
            };

            return signal;
        } catch (error) {
            console.error(`[INTELLIGENCE ERROR] ${error.message}`);
            signal.intelligence = { score: 0, status: 'ERROR' };
            return signal;
        }
    }
}

module.exports = IntelligenceAgent;
