const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

/**
 * Scout Agent: Scans URLs, Detects Products, and Extracts Raw Data.
 * Role: Data Acquisition & Signal Initializer.
 */
class ScoutAgent {
    constructor(config) {
        this.config = config;
    }

    async scanShopify(target, userAgent, retries = 2) {
        console.log(`[SCOUT] Scanning Shopify: ${target.site}...`);
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(target.url, {
                    headers: { 'User-Agent': userAgent },
                    timeout: 10000 // 10s fetch timeout
                });
                if (!response.ok) throw new Error(`HTTP_${response.status}`);
                const data = await response.json();
                return data.products.map(p => ({
                    title: p.title,
                    vendor: p.vendor,
                    handle: p.handle,
                    price: parseFloat(p.variants[0].price),
                    available: p.variants[0].available,
                    tags: p.tags || [],
                    link: `${target.url.split('/products.json')[0]}/products/${p.handle}`,
                    site: target.site,
                    variantId: p.variants[0].id
                }));
            } catch (error) {
                if (i === retries) {
                    console.error(`[SCOUT ERROR] ${target.site} exhausted retries: ${error.message}`);
                    return [];
                }
                console.log(`[SCOUT] Retrying ${target.site} (${i + 1}/${retries})...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    async scanBrowser(target, page, retries = 1) {
        console.log(`[SCOUT] Scanning Browser-site: ${target.site}...`);
        for (let i = 0; i <= retries; i++) {
            try {
                await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 15000 });
                const data = await page.evaluate(() => {
                    const titleEl = document.querySelector('h1');
                    const priceEl = document.querySelector('[class*="price"]');
                    const buyBtn = Array.from(document.querySelectorAll('button')).find(b => 
                        b.innerText.toLowerCase().includes('add') || b.innerText.toLowerCase().includes('buy')
                    );
                    return {
                        productName: titleEl ? titleEl.innerText : document.title,
                        priceText: priceEl ? priceEl.innerText : '0',
                        buyEnabled: !!buyBtn && !buyBtn.disabled
                    };
                });

                return [{
                    title: data.productName,
                    price: parseFloat(data.priceText.replace(/[^0-9.]/g, '')) || 0,
                    available: data.buyEnabled,
                    link: target.url,
                    site: target.site,
                    tags: [] 
                }];
            } catch (error) {
                if (i === retries) {
                    console.error(`[SCOUT ERROR] ${target.site} exhausted browser retries: ${error.message}`);
                    return [];
                }
                console.log(`[SCOUT] Retrying browser ${target.site} (${i + 1}/${retries})...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
}

module.exports = ScoutAgent;
