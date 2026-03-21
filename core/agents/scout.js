const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

/**
 * Scout Agent: High-Confidence Digital Deal Detection.
 */
class ScoutAgent {
    constructor(config, orchestrator) {
        this.config = config;
        this.orchestrator = orchestrator;
    }

    async scanFlippa() {
        console.log(`[SCOUT] Sniping Flippa (Local Chrome)...`);
        const browser = await puppeteer.launch({ 
            headless: "new", 
            executablePath: process.platform === 'darwin' 
                ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
                : (require('fs').existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        try {
            let allResults = [];
            const keywords = ["saas", "template", "plugin", "source code", "automation", "tool"];
            
            for (const kw of keywords) {
                const url = `https://flippa.com/search?filter%5Bprice%5D%5Bmin%5D=25&filter%5Bprice%5D%5Bmax%5D=1000&filter%5Bproperty_type%5D%5B%5D=website&filter%5Bstatus%5D%5B%5D=open&q=${encodeURIComponent(kw)}`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 10000)); 
                
                const results = await page.evaluate(() => {
                    const cards = Array.from(document.querySelectorAll('div.tw-rounded-lg.tw-border-gray-300'));
                    return cards.map(c => {
                        const title = c.querySelector('h6')?.innerText || c.querySelector('a')?.innerText || 'Unknown';
                        const link = c.querySelector('a.GTM-search-result-card')?.href || '';
                        
                        const getVal = (labels) => {
                            const spans = Array.from(c.querySelectorAll('span, div'));
                            const labelEl = spans.find(s => labels.some(l => s.innerText.toLowerCase().includes(l.toLowerCase())));
                            if (!labelEl) return '';
                            const parent = labelEl.parentElement;
                            const nextSib = parent?.nextElementSibling;
                            if (nextSib?.innerText.includes('$')) return nextSib.innerText;
                            const cardText = c.innerText;
                            const labelIndex = cardText.toLowerCase().indexOf(labels[0].toLowerCase());
                            if (labelIndex !== -1) {
                                const sub = cardText.substring(labelIndex);
                                const match = sub.match(/\$[\d,]+/);
                                if (match) return match[0];
                            }
                            return '';
                        };

                        const priceStr = getVal(['asking price', 'starting price', 'price']);
                        const revStr = getVal(['net profit', 'profit']);
                        const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
                        const revenue = parseFloat(revStr.replace(/[^0-9.]/g, '')) || 0;

                        return { title, price, revenue, source: 'Flippa', link, description: c.innerText.substring(0, 300), timestamp: Date.now() };
                    });
                });
                allResults.push(...results);
            }

            return allResults.filter(r => r.price >= 25 && r.link); 
        } catch (error) {
            console.error(`[SCOUT FLIPPA ERROR] ${error.message}`);
            return [];
        } finally {
            await browser.close().catch(() => {});
        }
    }

    async scanGumroad() {
        console.log(`[SCOUT] Sniping Gumroad (Local Chrome)...`);
        const browser = await puppeteer.launch({ 
            headless: "new",
            executablePath: process.platform === 'darwin' 
                ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
                : (require('fs').existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        try {
            let allResults = [];
            const keywords = ["template", "theme", "plugin", "micro SaaS", "source code", "automation", "tool", "dashboard"];
            
            for (const kw of keywords) {
                await page.goto(`https://gumroad.com/discover?query=${encodeURIComponent(kw)}`, { waitUntil: 'domcontentloaded' });
                await new Promise(r => setTimeout(r, 7000)); 

                const results = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href*="/l/"]')).filter(a => a.innerText.length > 5);
                    return links.map(l => {
                        const container = l.closest('div') || l.parentElement;
                        const text = container.innerText;
                        
                        const priceMatch = text.match(/\$[\d,]+(\.\d+)?/);
                        const price = priceMatch ? parseFloat(priceMatch[0].replace(/[^0-9.]/g, '')) : 0;
                        
                        return {
                            title: l.innerText.split('\n')[0],
                            price: price,
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

            return allResults.filter(r => r.price >= 25 && r.price <= 1000); 
        } catch (error) {
            console.error(`[SCOUT GUMROAD ERROR] ${error.message}`);
            return [];
        } finally {
            await browser.close().catch(() => {});
        }
    }
}

module.exports = ScoutAgent;
