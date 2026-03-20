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

            // 2. Market Data Analysis (Phase 37: Data Quality Detection)
            const market = signal.market || {};
            let resaleConfidence = 'NONE';
            
            if (market.hasSoldData) {
                resaleConfidence = 'HIGH';
                score += 20;
            } else if (market.hasListings) {
                resaleConfidence = 'LOW';
                score -= 10;
            }

            // 3. Category & Alpha Filtering (Phase 37)
            const genericTerms = ['basic', 'tee', 'socks', 'essentials', 'hoodie', 'beanie'];
            const titleLower = signal.product.title.toLowerCase();
            const isGeneric = genericTerms.some(term => titleLower.includes(term));
            if (isGeneric && !matchedTier) {
                console.log(`[INTELLIGENCE] Generic Item Penalty (-15) for ${signal.product.title}`);
                score -= 15;
            }

            // Phase 37: Scoring Intelligence Boost (Caps)
            if (resaleConfidence === 'NONE') score = Math.min(score, 60);
            if (resaleConfidence === 'LOW') score = Math.min(score, 70);

            // Phase 31: Scavenger Mode Penalty (-15)
            if (signal.product.isFallback) {
                score -= 15;
            }

            signal.intelligence = {
                ...signal.intelligence,
                score: Math.max(0, Math.min(100, score)),
                matchedTier,
                resaleConfidence,
                liquidity: resaleConfidence,
                brandStrength: matchedTier ? 'HIGH' : 'MEDIUM'
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
