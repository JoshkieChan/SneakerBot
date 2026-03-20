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

            // 2. Market Data Analysis (Phase 39/43: Realism & Modeling)
            const market = signal.market || {};
            let resaleConfidence = signal.market.isModelEstimated ? 'MODEL_ESTIMATED' : 
                                   (signal.market.isEstimated ? 'ESTIMATED' : 
                                   (market.hasSoldData ? 'HIGH' : 'LOW'));
            
            if (!market.hasListings && !market.hasSoldData && !signal.market.isModelEstimated) resaleConfidence = 'NONE';
            
            if (resaleConfidence === 'HIGH') {
                score += 20;
            } else if (['LOW', 'ESTIMATED', 'MODEL_ESTIMATED'].includes(resaleConfidence)) {
                score -= 10;
            }

            // 3. Category & Alpha Filtering (Phase 42: Quality Control)
            const titleLower = signal.product.title.toLowerCase();
            const genericTerms = ['basic', 'tee', 'essentials', 'beanie'];
            const isGeneric = genericTerms.some(term => titleLower.includes(term));
            
            // Scarcity Boost: XL/XXL Outerwear
            const isOuterwear = ['jacket', 'hoodie', 'outerwear', 'coat'].some(cat => titleLower.includes(cat));
            const isScareSize = ['xl', 'xxl', '2xl'].some(s => titleLower.includes(s));
            
            if (isOuterwear && isScareSize) {
                score += 10;
            } else if (isGeneric && !matchedTier) {
                score -= 15;
            }

            // 4. Hype & Liquidity Activation (Phase 42)
            let liquidity = 'LOW';
            const tier1Brands = ['nike', 'jordan', 'supreme', 'travis', 'adidas', 'yeezy'];
            const tier2Brands = ['stussy', 'kith', 'ald', 'aimé leon dore', 'palace', 'engineered garments'];
            
            const isTier1 = tier1Brands.some(b => titleLower.includes(b)) || matchedTier === 'Tier1';
            const isTier2 = tier2Brands.some(b => titleLower.includes(b)) || matchedTier === 'Tier2';
            const isCollab = signal.product.title.includes(' x ') || signal.product.title.includes(' / ');

            if (isTier1 || (isTier2 && isCollab)) {
                liquidity = 'HIGH';
                score += 15; // Hype Boost
            } else if (isTier2) {
                liquidity = 'MEDIUM';
                score += 5;
            }

            // Phase 39/42: Scoring Intelligence Caps
            if (resaleConfidence === 'NONE') score = Math.min(score, 60);
            if (resaleConfidence === 'MODEL_ESTIMATED') score = Math.min(score, 60);
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
