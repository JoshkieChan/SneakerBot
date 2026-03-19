const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Market Data Skill: Handles scraping and fetching price data from 
 * external marketplaces like StockX.
 */
async function getStockXPrice(browser, productName) {
    console.log(`[SKILL] Fetching StockX price for: ${productName}...`);
    let attempts = 0;
    while (attempts < 2) {
        const page = await browser.newPage();
        try {
            const searchUrl = `https://stockx.com/search?s=${encodeURIComponent(productName)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            const price = await page.evaluate(() => {
                const gridItems = document.querySelectorAll('[data-testid="product-tile"]');
                if (gridItems.length > 0) {
                    const priceEl = gridItems[0].querySelector('[data-testid="product-tile-price"]');
                    if (priceEl && priceEl.innerText.includes('$')) return parseFloat(priceEl.innerText.replace(/[^0-9.]/g, ''));
                }
                return null;
            });
            if (price) return price;
        } catch (error) {} finally { await page.close(); }
        attempts++;
        await sleep(2000);
    }
    return null;
}

module.exports = { getStockXPrice };
