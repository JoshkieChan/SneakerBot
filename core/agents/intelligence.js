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

        // 1. Price Valid [20 pts] ($25 - $1000)
        if (signal.price >= 25 && signal.price <= 1000) {
            score += 20;
        }

        // 2. Demand Signal [25 pts] (Reviews/Sales)
        const demandKeywords = ['sale', 'revenue', 'mrr', 'sold', 'customer', 'user', 'purchased'];
        if (signal.ratingCount > 0 || demandKeywords.some(kw => text.includes(kw)) || (signal.revenue && signal.revenue > 0)) {
            score += 25;
        }

        // 3. Undervalued Signals [25 pts] (Listing Quality/Positioning)
        // Short description [10 pts]
        if (text.length < 150) score += 10;
        // Unpolished keywords [15 pts]
        const unpolished = ['simple', 'starter', 'basic', 'raw', 'fixer', 'minimal'];
        if (unpolished.some(kw => text.includes(kw))) score += 15;

        // 4. Clear Flip Angle [20 pts] (Niche Clarity)
        const niches = ['template', 'theme', 'plugin', 'micro saas', 'source code', 'automation', 'tool', 'dashboard'];
        if (niches.some(kw => text.includes(kw))) {
            score += 20;
        }

        // 5. No Red Flags [10 pts]
        const redFlags = ['personal use only', 'non-transferable', 'scam', 'fake', 'hacked', 'stolen', 'PLR'];
        const hasRedFlag = redFlags.some(kw => text.includes(kw));
        if (!hasRedFlag) {
            score += 10;
        } else {
            score -= 100; // Nuclear reject if red flag found
        }

        // Final score check
        const finalScore = Math.min(Math.max(score, 0), 100);

        return {
            ...signal,
            score: finalScore,
            isTransferable: !hasRedFlag,
            confidence: `${finalScore}%`,
            demandSignal: signal.ratingCount > 0 ? `${signal.ratingCount} reviews` : (signal.revenue ? 'Revenue proof' : 'Contextual sales mention')
        };
    }
}

module.exports = IntelligenceAgent;
