const { chromium } = require('playwright');

class ScoutAgent {
    constructor() {
        this.browser = null;
    }

    async init() {
        if (!this.browser) {
            console.log("[SCOUT] Initializing Global Playwright Browser...");
            this.browser = await chromium.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }

    async scrapeUrl(url) {
        if (!this.browser) await this.init();
        const context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000); // Allow dynamic values to settle

            const title = await page.title();
            
            // Precise Price Extraction (DOM-based)
            const priceText = await page.locator("text=/\\$\\d+/").first().textContent().catch(() => null);
            let price = null;
            if (priceText) {
                const match = priceText.match(/\$([0-9,]+(\.[0-9]{1,2})?)/);
                if (match) price = parseFloat(match[1].replace(',', ''));
            }

            const bodyText = await page.locator("body").innerText();

            return {
                title,
                price,
                description: bodyText.substring(0, 1000),
                url,
                ratingCount: (bodyText.match(/\((\d+)\)/)?.[1]) || 0, // Fallback for reviews count
                timestamp: Date.now()
            };
        } catch (e) {
            console.error(`[SCRAPE ERROR] ${url}: ${e.message}`);
            return null;
        } finally {
            await context.close();
        }
    }

    // High-level discovery (scans discovery pages to find URLs)
    async discoverFlippa() {
        if (!this.browser) await this.init();
        const page = await this.browser.newPage();
        try {
            const keywords = ["saas", "template", "plugin"];
            let urls = [];
            for (const kw of keywords) {
                const searchUrl = `https://flippa.com/search?filter%5Bprice%5D%5Bmax%5D=1000&q=${encodeURIComponent(kw)}`;
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(5000);
                const pageUrls = await page.evaluate(() => 
                    Array.from(document.querySelectorAll('a.GTM-search-result-card')).map(a => a.href)
                );
                urls.push(...pageUrls);
            }
            return [...new Set(urls)];
        } catch (e) { return []; } finally { await page.close(); }
    }

    async discoverGumroad() {
        if (!this.browser) await this.init();
        const page = await this.browser.newPage();
        try {
            const keywords = ["template", "theme", "SaaS"];
            let urls = [];
            for (const kw of keywords) {
                await page.goto(`https://gumroad.com/discover?query=${encodeURIComponent(kw)}`, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(5000);
                const pageUrls = await page.evaluate(() => 
                    Array.from(document.querySelectorAll('a[href*="/l/"]')).map(a => a.href)
                );
                urls.push(...pageUrls);
            }
            return [...new Set(urls)];
        } catch (e) { return []; } finally { await page.close(); }
    }

    async close() {
        if (this.browser) await this.browser.close();
    }
}

module.exports = ScoutAgent;
