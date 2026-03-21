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
            const url = `https://flippa.com/search?filter%5Bprice%5D%5Bmax%5D=1000&filter%5Bproperty_type%5D%5B%5D=website&filter%5Bstatus%5D%5B%5D=open`;
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            await page.waitForSelector('a.GTM-search-result-card', { timeout: 30000 });
            
            const results = await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('a.GTM-search-result-card'));
                return cards.map(c => {
                    const title = c.querySelector('h6')?.innerText || '';
                    const url = c.href;
                    
                    // Robust label extraction
                    const text = c.innerText.toLowerCase();
                    let price = 0;
                    let revenue = 0;
                    
                    const priceMatch = text.match(/(starting|asking) price\s*\$?([\d,]+)/);
                    if (priceMatch) price = parseFloat(priceMatch[2].replace(/,/g, ''));
                    
                    const revMatch = text.match(/net profit\s*\$?([\d,]+)/);
                    if (revMatch) revenue = parseFloat(revMatch[1].replace(/,/g, ''));

                    return {
                        title,
                        price,
                        revenue,
                        source: 'Flippa',
                        link: url,
                        description: c.innerText.substring(0, 300),
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
                await page.waitForTimeout(3000); // Wait for dynamic grid

                const results = await page.evaluate(() => {
                    // Target links that look like products
                    const links = Array.from(document.querySelectorAll('a[href*="/l/"]')).filter(a => a.innerText.length > 5);
                    
                    return links.map(l => {
                        const container = l.closest('div') || l.parentElement;
                        const priceEl = container.querySelector('span[class*="badge"]') || container.querySelector('div[class*="price"]');
                        
                        return {
                            title: l.innerText.split('\n')[0],
                            price: parseFloat(priceEl?.innerText.replace(/[^0-9.]/g, '') || '0'),
                            source: 'Gumroad',
                            link: l.href,
                            description: container.innerText.substring(0, 200),
                            ratingCount: container.innerText.includes('(') ? parseInt(container.innerText.match(/\((\d+)\)/)?.[1] || '0') : 0,
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
