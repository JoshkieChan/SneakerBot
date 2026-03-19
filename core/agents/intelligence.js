/**
 * Intelligence Agent: Performs Scoring, Applies Keyword Tiers,
 * and evaluates Resale/Size/Liquidity potential.
 */
class IntelligenceAgent {
    constructor(config) {
        this.config = config;
    }

    async analyze(signal) {
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

        // 2. Negative keyword check
        const negativeMatch = this.config.EliteNegativeKeywords && this.config.EliteNegativeKeywords.some(neg => {
            const regex = new RegExp(`\\b${neg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(signal.product.title);
        });
        if (negativeMatch) score -= 50;

        // 3. Category/Brand analysis (Mocked or logic-based)
        signal.intelligence = {
            score,
            matchedTier,
            matchedKeywords: [],
            resaleConfidence: score >= 70 ? 'High' : (score >= 50 ? 'Medium' : 'Low'),
            liquidity: 'Medium',
            brandStrength: 'Medium'
        };

        return signal;
    }
}

module.exports = IntelligenceAgent;
