const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Market Data Skill: Handles scraping and fetching price data from 
 * external marketplaces like StockX.
 */
async function getStockXPrice(browser, productName, orchestrator = null) {
    if (!browser || (orchestrator && orchestrator.isShuttingDown)) return null;
    
    console.log(`[SKILL] Fetching StockX price for: ${productName}...`);
    let attempts = 0;
    while (attempts < 2) {
        if (orchestrator && orchestrator.isShuttingDown) break;
        
        let page;
        try {
            page = await browser.newPage();
            const searchUrl = `https://stockx.com/search?s=${encodeURIComponent(productName)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            
            if (orchestrator && orchestrator.isShuttingDown) break;

            const price = await page.evaluate(() => {
                const gridItems = document.querySelectorAll('[data-testid="product-tile"]');
                if (gridItems.length > 0) {
                    const priceEl = gridItems[0].querySelector('[data-testid="product-tile-price"]');
                    if (priceEl && priceEl.innerText.includes('$')) return parseFloat(priceEl.innerText.replace(/[^0-9.]/g, ''));
                }
                return null;
            });
            if (price) return price;
        } catch (error) {
            const isClosing = error.message.includes('Target closed') || 
                              error.message.includes('Session closed') || 
                              (orchestrator && orchestrator.isShuttingDown);
            if (isClosing) {
                console.log(`[SKILL] Browser closed during StockX fetch for ${productName} (Transient).`);
                break;
            }
        } finally { 
            if (page && !page.isClosed()) await page.close().catch(() => {}); 
        }
        attempts++;
        await sleep(2000);
    }
    return null;
}

module.exports = { getStockXPrice };
