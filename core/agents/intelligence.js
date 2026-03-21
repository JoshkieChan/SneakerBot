/**
 * Intelligence Agent: Analyzes Digital Asset Niches and Flip Potential.
 */
class IntelligenceAgent {
    constructor(config) {
        this.config = config;
    }

    analyze(signal) {
        const text = signal.title.toLowerCase();
        
        // 1. Niche Detection
        let niche = 'General';
        if (text.includes('ai') || text.includes('gpt')) niche = 'AI';
        else if (text.includes('biz') || text.includes('business') || text.includes('saas')) niche = 'Business';
        else if (text.includes('crypto') || text.includes('nft') || text.includes('solana')) niche = 'Crypto';
        else if (text.includes('meme') || text.includes('joke')) niche = 'Meme';
        else if (text.includes('instagram') || text.includes('tiktok') || text.includes('account')) niche = 'Social';
        else if (text.includes('domain') || text.includes('.com') || text.includes('.io')) niche = 'Domain';

        // 2. Flip Score Logic
        let flipScore = 50;
        if (['AI', 'Business', 'Domain'].includes(niche)) flipScore += 30;
        if (text.includes('urgent') || text.includes('cheap') || text.includes('fire sale')) flipScore += 15;
        if (niche === 'Meme') flipScore -= 20;

        return {
            ...signal,
            niche,
            flipScore: Math.min(flipScore, 100)
        };
    }
}

module.exports = IntelligenceAgent;
