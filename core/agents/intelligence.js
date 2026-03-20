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
                // Phase 36: Reduced penalty (Listings-only)
                resaleConfidence = 'Low';
                score -= 10;
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

            // Phase 31: Scavenger Mode Penalty (-15)
            // Ensures fallback data must hit a very high keyword threshold to trigger alerts.
            if (signal.product.isFallback) {
                console.log(`[INTELLIGENCE] Applying Fallback Penalty (-15) for ${signal.product.title}`);
                score -= 15;
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
