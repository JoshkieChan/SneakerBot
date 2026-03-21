const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class ScoutAgent {
    async scanFlippa() {
        console.log(`[SCOUT] Hunting Flippa...`);
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        try {
            const keywords = ["saas", "template", "plugin"];
            let allResults = [];
            for (const kw of keywords) {
                const url = `https://flippa.com/search?filter[price][max]=1000&q=${encodeURIComponent(kw)}`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 5000));

                const results = await page.evaluate(() => {
                    const cards = Array.from(document.querySelectorAll('div.tw-rounded-lg.tw-border-gray-300'));
                    return cards.map(c => ({
                        title: c.querySelector('h6')?.innerText || 'Unknown',
                        price: parseFloat(c.innerText.match(/\$[\d,]+/)?.[0].replace(/[^0-9.]/g, '') || '0'),
                        link: c.querySelector('a.GTM-search-result-card')?.href || '',
                        description: c.innerText.substring(0, 300),
                        ratingCount: 0 // Flippa reviews are different
                    }));
                });
                allResults.push(...results);
            }
            return allResults.filter(r => r.price > 0 && r.link);
        } catch (e) { return []; } finally { await browser.close(); }
    }

    async scanGumroad() {
        console.log(`[SCOUT] Hunting Gumroad...`);
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        try {
            const keywords = ["template", "theme", "SaaS"];
            let allResults = [];
            for (const kw of keywords) {
                await page.goto(`https://gumroad.com/discover?query=${encodeURIComponent(kw)}`, { waitUntil: 'domcontentloaded' });
                await new Promise(r => setTimeout(r, 5000));

                const results = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href*="/l/"]')).filter(a => a.innerText.length > 5);
                    return links.map(l => {
                        const container = l.closest('div') || l.parentElement;
                        return {
                            title: l.innerText.split('\n')[0],
                            price: parseFloat(container.innerText.match(/\$[\d,]+/)?.[0].replace(/[^0-9.]/g, '') || '0'),
                            link: l.href,
                            description: container.innerText.substring(0, 200),
                            ratingCount: parseInt(container.innerText.match(/\((\d+)\)/)?.[1] || '0')
                        };
                    });
                });
                allResults.push(...results);
            }
            return allResults.filter(r => r.price > 0);
        } catch (e) { return []; } finally { await browser.close(); }
    }
}

module.exports = ScoutAgent;
