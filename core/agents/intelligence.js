/**
 * Intelligence Agent: Flipper Scoring Engine.
 */
class IntelligenceAgent {
    constructor(config) {
        this.config = config;
    }

    analyze(signal) {
        const text = (signal.title + " " + (signal.description || "")).toLowerCase();
        let score = 0;

        // 1. PROFIT & EFFICIENCY (+65 possible)
        if (signal.price < 300) score += 20;
        else if (signal.price < 700) score += 10;

        const revenueKeywords = ['revenue', 'mrr', 'sales', 'profit', 'earning', 'income'];
        if (signal.revenue > 0 || revenueKeywords.some(kw => text.includes(kw))) {
            score += 25;
        }

        const highDemand = ['saas', 'plr', 'micro-saas', 'source code', 'lifetime', 'plugin', 'theme'];
        if (highDemand.some(kw => text.includes(kw))) {
            score += 20;
        }

        // 2. FLIP POTENTIAL (+25 possible)
        // Short description often implies a lazy/unpolished listing = potential flip
        if (text.length < 150) score += 15;
        if (signal.ratingCount === 0 && text.includes('new')) score += 10;

        // 3. RED FLAGS & REJECTION (-100 possible)
        if (text.includes('personal use only') || text.includes('non-transferable') || text.includes('not for resale')) {
            score -= 60;
        }
        
        if (text.includes('vague') || text.includes('sketchy') || text.includes('low quality')) {
            score -= 20;
        }

        if (!text.includes('demo') && !text.includes('preview') && !text.includes('link')) {
            score -= 10;
        }

        // Normalize to 0-100
        const finalScore = Math.min(Math.max(score, 0), 100);

        return {
            ...signal,
            score: finalScore,
            isTransferable: score > -30, // Rough proxy for transferability
            confidence: `${finalScore}%`
        };
    }
}

module.exports = IntelligenceAgent;
