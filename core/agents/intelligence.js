/**
 * Intelligence Agent: Resale Estimation & Scoring Machine.
 */
class IntelligenceAgent {
    constructor(config) {
        this.config = config;
    }

    analyze(signal) {
        const text = (signal.title + " " + (signal.description || "")).toLowerCase();
        const price = signal.price;

        // 1. Niche & Sales Detection
        let niche = 'General';
        let hasSalesProof = text.includes('revenue') || text.includes('sales') || text.includes('profit');
        let isHighLiquidity = text.includes('shopify') || text.includes('saas') || text.includes('ai');

        if (text.includes('ai') || text.includes('gpt')) niche = 'AI';
        else if (text.includes('shopify')) niche = 'Shopify';
        else if (text.includes('saas') || text.includes('dashboard')) niche = 'SaaS';
        else if (text.includes('wordpress') || text.includes('plugin')) niche = 'Web';

        // 2. Resale Estimation (The Heuristic)
        let multiplier = 2.0;
        if (hasSalesProof) multiplier = 3.5;
        if (isHighLiquidity) multiplier += 0.5;
        if (text.length < 100) multiplier += 0.2; // Poor listing flip boost

        const estimatedResale = price * multiplier;

        // 3. Scoring System
        let score = 0;
        if (price < 200) score += 20;
        if (hasSalesProof) score += 30;
        if (isHighLiquidity) score += 15;
        if (text.length < 150) score += 10; // "Unpolished gem" indicator

        // Red Flags
        if (!text.includes('demo') && !text.includes('preview')) score -= 25;
        if (text.includes('vague') || text.includes('unclear')) score -= 20;

        return {
            ...signal,
            niche,
            estimatedResale,
            profit: estimatedResale - price,
            score: Math.min(score, 100)
        };
    }
}

module.exports = IntelligenceAgent;
