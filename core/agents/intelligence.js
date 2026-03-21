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

        // 1. Point System (+Values)
        if (signal.price < 500) score += 20;
        if (signal.revenue > 0 || text.includes('revenue') || text.includes('sales')) score += 20;
        if (signal.ratingCount > 10 || text.includes('stars')) score += 15;
        
        const niches = ['shopify', 'notion', 'saas', 'boilerplate', 'template'];
        if (niches.some(n => text.includes(n))) score += 10;

        // "Unpolished Gem" Flip Indicator
        if (text.length < 150) score += 15; 

        // 2. Red Flags (-Values)
        if (text.includes('vague') || text.includes('sketchy')) score -= 20;
        if (!text.includes('demo') && !text.includes('preview')) score -= 10;

        // 3. AUTO-REJECT LOGIC (Handled here or in Risk)
        let isTransferable = !text.includes('personal license only') && !text.includes('not transferable');
        if (!isTransferable) score = -100;

        return {
            ...signal,
            score: Math.max(score, 0),
            isTransferable
        };
    }
}

module.exports = IntelligenceAgent;
