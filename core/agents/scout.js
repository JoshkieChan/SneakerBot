const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

/**
 * Scout Agent: Robust Money Extraction.
 * Targets: Flippa, Gumroad.
 */
class ScoutAgent {
    constructor(config, orchestrator) {
        this.config = config;
        this.orchestrator = orchestrator;
    }

    async scanFlippa() {
        console.log(`[SCOUT] Hunting Flippa (SaaS & Websites)...`);
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
        });
        const page = await browser.newPage();
        
        try {
            // Focus on Website/SaaS under $1000
            const url = `https://flippa.com/search?filter%5Bprice%5D%5Bmax%5D=1000&filter%5Bproperty_type%5D%5B%5D=website&filter%5Bstatus%5D%5B%5D=open`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
            
            const results = await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('a.GTM-search-result-card'));
                return cards.map(c => {
                    const title = c.querySelector('h6')?.innerText || '';
                    const url = c.href;
                    
                    // Logic to extract labels (Starting Price, Net Profit, etc.)
                    const gridItems = Array.from(c.querySelectorAll('div > div > div'));
                    let price = 0;
                    let revenue = 0;
                    
                    gridItems.forEach(item => {
                        const text = item.innerText.toLowerCase();
                        if (text.includes('asking price') || text.includes('starting price')) {
                            price = parseFloat(item.innerText.replace(/[^0-9.]/g, '')) || 0;
                        }
                        if (text.includes('net profit')) {
                            revenue = parseFloat(item.innerText.replace(/[^0-9.]/g, '')) || 0;
                        }
                    });

                    return {
                        title,
                        price,
                        revenue,
                        source: 'Flippa',
                        link: url,
                        description: c.innerText.substring(0, 200),
                        timestamp: Date.now()
                    };
                });
            });

            return results.filter(r => r.price > 0 && r.price <= 1000);
        } catch (error) {
            console.error(`[SCOUT FLIPPA ERROR] ${error.message}`);
            return [];
        } finally {
            await browser.close().catch(() => {});
        }
    }

    async scanGumroad() {
        console.log(`[SCOUT] Hunting Gumroad (Templates & themes)...`);
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        try {
            let allResults = [];
            const keywords = ["notion", "template", "theme", "saas", "boilerplate", "lifetime deal"];
            
            for (const kw of keywords) {
                await page.goto(`https://gumroad.com/discover?query=${encodeURIComponent(kw)}`, { waitUntil: 'networkidle2' });
                const results = await page.evaluate(() => {
                    const articles = Array.from(document.querySelectorAll('article'));
                    return articles.map(a => {
                        const linkEl = a.querySelector('a[href*="layout=discover"]');
                        const priceEl = a.querySelector('.product-card__price') || a.querySelector('span[class*="badge"]');
                        const ratingEl = Array.from(a.querySelectorAll('span')).find(s => s.innerText.includes('('));
                        
                        return {
                            title: linkEl?.innerText || 'Unknown',
                            price: parseFloat(priceEl?.innerText.replace(/[^0-9.]/g, '') || '0'),
                            source: 'Gumroad',
                            link: linkEl?.href || '',
                            description: a.innerText.substring(0, 150),
                            ratingCount: ratingEl ? parseInt(ratingEl.innerText.match(/\((\d+)\)/)?.[1] || '0') : 0,
                            timestamp: Date.now()
                        };
                    });
                });
                allResults.push(...results);
            }
            return allResults.filter(r => r.price > 0 && r.price <= 1000); 
        } catch (error) {
            console.error(`[SCOUT GUMROAD ERROR] ${error.message}`);
            return [];
        } finally {
            await browser.close().catch(() => {});
        }
    }
}

module.exports = ScoutAgent;
