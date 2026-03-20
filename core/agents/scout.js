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

    async scanShopify(target, userAgent) {
        const url = target.url;
        console.log(`[SCOUT] Scanning Shopify: ${target.site}...`);

        try {
            // Phase 30: Relaxed 15s Timeout for Shopify JSON
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                headers: { 'User-Agent': userAgent },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) throw new Error(`HTTP_${response.status}`);
            const data = await response.json();
            
            const results = (data.products || []).slice(0, 50).map(p => ({
                title: p.title,
                handle: p.handle,
                price: parseFloat(p.variants[0]?.price) || 0,
                available: p.variants.some(v => v.available),
                url: `https://${new URL(url).hostname}/products/${p.handle}`,
                image: p.images[0]?.src,
                site: target.site
            }));

            // Phase 30: Signal Relaxation (Minimal Data = Found)
            return results.filter(p => p.title && p.price > 0);
        } catch (error) {
            throw error;
        }
    }

    async scanBrowser(target, page) {
        console.log(`[SCOUT] Scanning Browser-site: ${target.site}...`);
        
        try {
            // Orchestrator handles images/font blocking & 15s navigation timeout
            await page.goto(target.url, { waitUntil: 'domcontentloaded' });
            
            // Phase 30: Relaxed 12s extraction + Fallback Scavenger Mode
            const products = await page.evaluate((selector) => {
                let items = Array.from(document.querySelectorAll(selector || '.product, [class*="product"], [class*="item"]'));
                
                // Fallback: If no structured items, scavenge from raw text
                if (items.length === 0) {
                    const title = document.title || document.querySelector('h1')?.innerText || 'Unknown Product';
                    const priceMatch = document.body.innerText.match(/\$\s?(\d+\.\d+|\d+)/);
                    if (priceMatch) {
                        return [{
                            title: title.trim(),
                            available: true,
                            price: parseFloat(priceMatch[1]),
                            isFallback: true
                        }];
                    }
                    return [];
                }

                return items.slice(0, 15).map(item => ({
                    title: item.innerText.split('\n')[0].trim(),
                    available: !item.innerText.toLowerCase().includes('sold out'),
                    price: parseFloat(item.innerText.match(/\d+\.\d+/)?.[0] || item.innerText.match(/\$\s?(\d+)/)?.[1] || 0)
                }));
            }, target.selector);

            return products.map(p => ({
                ...p,
                url: target.url,
                site: target.site
            }));
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ScoutAgent;
