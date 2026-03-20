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

            // 2. Market Data Analysis (Phase 39: Realism & Liquidity)
            const market = signal.market || {};
            let resaleConfidence = signal.market.isEstimated ? 'ESTIMATED' : (market.hasSoldData ? 'HIGH' : 'LOW');
            if (!market.hasListings && !market.hasSoldData) resaleConfidence = 'NONE';
            
            if (resaleConfidence === 'HIGH') {
                score += 20;
            } else if (resaleConfidence === 'LOW' || resaleConfidence === 'ESTIMATED') {
                score -= 10;
            }

            // 3. Category & Alpha Filtering (Phase 39: Scarcity Boost)
            const titleLower = signal.product.title.toLowerCase();
            const genericTerms = ['basic', 'tee', 'socks', 'essentials', 'beanie'];
            const isGeneric = genericTerms.some(term => titleLower.includes(term));
            
            // Scarcity Boost: XL/XXL Outerwear
            const isOuterwear = ['jacket', 'hoodie', 'outerwear', 'coat'].some(cat => titleLower.includes(cat));
            const isScareSize = ['xl', 'xxl', '2xl'].some(s => titleLower.includes(s));
            
            if (isOuterwear && isScareSize) {
                console.log(`[INTELLIGENCE] Scarcity Boost (+10) for ${signal.product.title}`);
                score += 10;
            } else if (isGeneric && !matchedTier) {
                score -= 15;
            }

            // 4. Liquidity Simulation Engine (Phase 39)
            let liquidity = 'LOW';
            const tier1Brands = ['nike', 'jordan', 'supreme', 'travis', 'adidas', 'yeezy'];
            const tier2Brands = ['stussy', 'kith', 'ald', 'aimé leon dore', 'palace'];
            const brandMatch = titleLower.split(' ')[0]; // Simple brand extraction

            if (tier1Brands.some(b => titleLower.includes(b)) || matchedTier === 'Tier1') {
                liquidity = 'HIGH';
            } else if (tier2Brands.some(b => titleLower.includes(b)) || matchedTier === 'Tier2') {
                liquidity = 'MEDIUM';
            }

            // Phase 39: Scoring Intelligence Boost (Caps)
            if (resaleConfidence === 'NONE') score = Math.min(score, 60);
            if (resaleConfidence === 'ESTIMATED') score = Math.min(score, 65);
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
                liquidity,
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
