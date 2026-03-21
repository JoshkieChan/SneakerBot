const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

/**
 * Scout Agent: Scans X.com for Digital Arbitrage opportunities.
 */
class ScoutAgent {
    constructor(config, orchestrator) {
        this.config = config;
        this.orchestrator = orchestrator;
    }

    async scanX(keywords) {
        console.log(`[SCOUT] Scanning X for keywords: ${keywords.join(', ')}...`);
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
        });
        const page = await browser.newPage();
        
        try {
            let allOpportunities = [];
            for (const kw of keywords) {
                const searchUrl = `https://x.com/search?q=${encodeURIComponent(kw)}&f=live`;
                await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                
                // Extract tweets/opportunities
                const results = await page.evaluate(() => {
                    const tweets = Array.from(document.querySelectorAll('[data-testid="tweetText"]'));
                    return tweets.map(t => ({
                        title: t.innerText,
                        source: 'X',
                        link: window.location.href, // Simplified link
                        timestamp: Date.now()
                    }));
                });
                
                // Simple price extraction from text ($X)
                results.forEach(r => {
                    const priceMatch = r.title.match(/\$(\d+)/);
                    r.price = priceMatch ? parseFloat(priceMatch[1]) : 0;
                });

                allOpportunities.push(...results);
            }
            return allOpportunities;
        } catch (error) {
            console.error(`[SCOUT ERROR] ${error.message}`);
            return [];
        } finally {
            await browser.close().catch(() => {});
        }
    }
}

module.exports = ScoutAgent;
