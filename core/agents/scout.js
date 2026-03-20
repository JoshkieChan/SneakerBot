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
            // Strict 8s Timeout for VPS Survival
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(url, {
                headers: { 'User-Agent': userAgent },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) throw new Error(`HTTP_${response.status}`);
            const data = await response.json();
            
            return (data.products || []).slice(0, 50).map(p => ({
                title: p.title,
                handle: p.handle,
                price: parseFloat(p.variants[0]?.price),
                available: p.variants.some(v => v.available),
                url: `https://${new URL(url).hostname}/products/${p.handle}`,
                image: p.images[0]?.src,
                site: target.site
            }));
        } catch (error) {
            throw error;
        }
    }

    async scanBrowser(target, page) {
        console.log(`[SCOUT] Scanning Browser-site: ${target.site}...`);
        
        try {
            // Orchestrator handles images/font blocking & 10s navigation timeout
            await page.goto(target.url, { waitUntil: 'domcontentloaded' });
            
            // Fast extraction (8s max)
            const products = await page.evaluate((selector) => {
                const items = Array.from(document.querySelectorAll(selector || '.product, [class*="product"]'));
                return items.slice(0, 15).map(item => ({
                    title: item.innerText.split('\n')[0].trim(),
                    available: !item.innerText.toLowerCase().includes('sold out'),
                    price: parseFloat(item.innerText.match(/\d+\.\d+/)?.[0] || 0)
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
