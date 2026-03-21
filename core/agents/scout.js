const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

/**
 * Scout Agent: High-Confidence Digital Deal Detection.
 * Targeted: Flippa, Gumroad, Creative Market.
 */
class ScoutAgent {
    constructor(config, orchestrator) {
        this.config = config;
        this.orchestrator = orchestrator;
        this.keywords = ["theme", "template", "plugin", "saas template", "shopify store for sale"];
    }

    async scanFlippa() {
        console.log(`[SCOUT] Scanning Flippa for digital assets...`);
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
        });
        const page = await browser.newPage();
        
        try {
            // Target: Digital Assets / Apps / Domains under $1000
            const url = `https://flippa.com/search?filter%5Bprice%5D%5Bmax%5D=1000&filter%5Bproperty_type%5D%5B%5D=website&filter%5Bstatus%5D%5B%5D=open`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            const results = await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('.SearchCard'));
                return cards.map(c => ({
                    title: c.querySelector('.SearchCard__title')?.innerText || 'Unknown Asset',
                    price: parseFloat((c.querySelector('.SearchCard__price')?.innerText || '0').replace(/[^0-9.]/g, '')),
                    source: 'Flippa',
                    link: c.querySelector('a')?.href || '',
                    description: c.querySelector('.SearchCard__description')?.innerText || '',
                    timestamp: Date.now()
                }));
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
        console.log(`[SCOUT] Scanning Gumroad for templates/themes...`);
        // Gumroad often requires a simpler search/browser approach or keyword-based discovery.
        // For efficiency, we will focus on high-traffic keywords.
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        try {
            let allResults = [];
            for (const kw of ["shopify theme", "saas template", "figma ui kit"]) {
                await page.goto(`https://gumroad.com/discover?query=${encodeURIComponent(kw)}`, { waitUntil: 'networkidle2' });
                const results = await page.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('.product-card'));
                    return items.map(i => ({
                        title: i.querySelector('.product-card__title')?.innerText || '',
                        price: parseFloat((i.querySelector('.product-card__price')?.innerText || '0').replace(/[^0-9.]/g, '')),
                        source: 'Gumroad',
                        link: i.querySelector('a')?.href || '',
                        timestamp: Date.now()
                    }));
                });
                allResults.push(...results);
            }
            return allResults.filter(r => r.price > 0 && r.price <= 500); 
        } catch (error) {
            return [];
        } finally {
            await browser.close().catch(() => {});
        }
    }
}

module.exports = ScoutAgent;
