const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    console.warn("⚠️  Warning: Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID in environment.");
} else {
    console.log("✅ Environment Verified: Critical keys are active.");
}
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CONFIG_PATH = path.join(__dirname, '../agent/rules/config.json');
const HISTORY_PATH = path.join(__dirname, '../agent/rules/history.json');
const { evaluateTrade } = require('./engine.js');
// Dynamic lookup for the service account file
const SERVICE_ACCOUNT_FILE = fs.readdirSync(path.join(__dirname, '../agent/rules/'))
    .find(f => f.endsWith('.json') && f.includes('acquired-voice'));
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../agent/rules/', SERVICE_ACCOUNT_FILE || 'service-account.json');

// Process Safety: Catch unhandled crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
});

// Load config dynamically
let config = {};
function loadConfig() {
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
        console.error('⚠️ Error reading config.json, using previous config state:', error.message);
    }
}
loadConfig();

// Load history or create if not exists
let history = {};
if (fs.existsSync(HISTORY_PATH)) {
    try {
        history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    } catch (e) {
        console.error("⚠️ Failed to parse history.json, resetting history.");
        history = {};
    }
}

// Global Counters for Transparency
global.itemsScannedToday = 0;
global.sessionStartTime = new Date();
global.heartbeatCycle = 0;

// Phase 22: Duplication & Noise Control
const alertCache = new Set();
setInterval(() => alertCache.clear(), 24 * 60 * 60 * 1000); // Clear daily

// Array of common, modern User Agents
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Sleep helper for mimicking human delays
const sleep = ms => new Promise(r => setTimeout(r, ms));

function matchesKeywords(title) {
    if (title.toLowerCase().includes('test_item')) return true; 

    const tiers = config.EliteKeywordTiers || {};
    let allKeywords = [];
    for (const tierData of Object.values(tiers)) {
        if (tierData.keywords) allKeywords = allKeywords.concat(tierData.keywords);
    }

    if (allKeywords.length === 0) return false;
    
    const negativeMatch = config.EliteNegativeKeywords && config.EliteNegativeKeywords.some(neg => {
        const regex = new RegExp(`\\b${neg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(title);
    });
    if (negativeMatch) return false;

    return allKeywords.some(keyword => {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        return regex.test(title);
    });
}

function isRestockWatchlisted(handle) {
    if (!config.RestockWatchlist || config.RestockWatchlist.length === 0) return false;
    return config.RestockWatchlist.some(w => handle.toLowerCase().includes(w.toLowerCase()));
}

async function simulateHumanBehavior(page) {
    if (!config.BehavioralStealth) return;
    await page.evaluate(async () => {
        const distance = Math.floor(Math.random() * 300) + 100;
        window.scrollBy(0, distance);
    });
    await sleep(Math.floor(Math.random() * 1000) + 500);
    const x = Math.floor(Math.random() * 800);
    const y = Math.floor(Math.random() * 600);
    await page.mouse.move(x, y);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let sheetsInstance = null;
async function getSheetsInstance() {
    if (sheetsInstance) return sheetsInstance;
    if (!process.env.GOOGLE_SHEETS_ID || !fs.existsSync(SERVICE_ACCOUNT_PATH)) return null;
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        sheetsInstance = google.sheets({ version: 'v4', auth });
        return sheetsInstance;
    } catch (e) {
        return null;
    }
}

async function logToGoogleSheets(payload) {
    const sheets = await getSheetsInstance();
    if (!sheets) return;
    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID });
        const sheetName = spreadsheet.data.sheets.find(s => s.properties.title === 'Records') ? 'Records' : spreadsheet.data.sheets[0].properties.title;
        const values = [[payload.timestamp, payload.site, payload.product, payload.status, payload.price, payload.link]];
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: `${sheetName}!A2`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
    } catch (error) {}
}

async function getMarketPrice(browser, productName) {
    console.log(`Fetching market price for: ${productName}...`);
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

async function sendDiscordAlert(payload) {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CHANNEL_ID) return;
    try {
        const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
        if (!channel) return;
        const en = payload.engine;
        const embedColor = en.verdict === 'STRONG BUY' ? 0x00FF00 : (en.verdict === 'WATCH' ? 0xFFD700 : 0xFF0000);
        const descriptionBlock = `
**Item**: ${payload.product}
**Brand**: ${en.brand}

**Retail Price**: $${payload.price.toFixed(2)}
**Current Price**: $${payload.price.toFixed(2)}
**Estimated Total Cost**: $${en.totalCost.toFixed(2)}

**Category**: ${en.category}
**Discount**: ${en.discount}%

**Market Analysis**:
- Brand Strength: ${en.brandStrength}
- Category Strength: ${en.categoryStrength}
- Liquidity: ${en.liquidity}

**Size Intelligence**:
- Fastest Sizes: ${en.fastestSizes}
- Remaining Sizes: ${en.remainingSizes}
- Verdict: ${en.sizeVerdict}

**Resale Intelligence**:
- Evidence: ${en.resaleEvidence}
- Estimated Resale Price: $${en.expectedResale > 0 ? en.expectedResale.toFixed(2) : 'N/A'}
- Estimated Profit: $${en.estimatedProfit.toFixed(2)}

**Trade Plan**:
- Flip Type: ${en.flipType}
- Recommended Units: ${en.recommendedUnits}
- Exit Strategy: StockX/GOAT/Alias

**Risk Level**: ${en.riskLevel}
**Time Sensitivity**: ${en.timeSensitivity}

**Opportunity Score**: ${en.finalScore}/100

**Governance Benchmarks**:
- Worst Case Profit: $${en.worstCaseProfit ? en.worstCaseProfit.toFixed(2) : 'N/A'}
- Autonomy Permitted: ${en.diagnostics.anomalies.length === 0 ? 'YES' : 'NO'}

**Validation Layer**:
- Data Quality: ${en.dataQuality}
- Resale Confidence: ${en.resaleConfidence}
- Simulation Confidence: ${en.simulationConfidence}
- Anomalies: ${en.diagnostics.anomalies.join(', ') || 'None'}

**FINAL DECISION**:
- **${en.verdict}**

${en.tradeId !== 'N/A' ? `**Trade ID**: ${en.tradeId}` : ''}
**Portfolio Available**: $${en.availableCap.toFixed(2)}
        `;
        const embed = new EmbedBuilder()
            .setTitle(`🚨 ${en.verdict}`)
            .setColor(embedColor)
            .setDescription(descriptionBlock)
            .setTimestamp();
        await channel.send({ embeds: [embed] });
    } catch (error) {}
}

async function sendHeartbeat(hypeScore) {
    global.heartbeatCycle++;
    if (global.heartbeatCycle % 6 !== 1) return;
    try {
        const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
        if (!channel) return;
        const uptimeHrs = ((new Date() - global.sessionStartTime) / (1000 * 60 * 60)).toFixed(1);
        const embed = new EmbedBuilder()
            .setTitle('📡 SNIPER HEARTBEAT')
            .setColor(0x00BFFF)
            .setDescription(`Uptime: ${uptimeHrs}h | Scanned: ${global.itemsScannedToday}`)
            .setTimestamp();
        await channel.send({ embeds: [embed] });
    } catch (error) {}
}

async function checkShopifySite(target) {
    console.log(`Checking Shopify: ${target.site}...`);
    try {
        const response = await fetch(target.url, { headers: { 'User-Agent': getRandomUserAgent() } });
        if (!response.ok) return;
        const data = await response.json();
        for (const product of data.products) {
            const handle = product.handle;
            const link = `${target.url.split('/products.json')[0]}/products/${handle}`;
            const price = parseFloat(product.variants[0].price);
            global.itemsScannedToday++;

            if (alertCache.has(link)) continue;
            if (!product.variants[0].available) continue;

            if (matchesKeywords(product.title)) {
                try {
                    const marketPrice = await getMarketPrice(global.globalBrowser, product.title);
                    const engine = evaluateTrade(product.title, price, marketPrice, false, false, price);
                    if (engine.verdict.includes('SKIP')) {
                        console.log(`[SKIP - GOVERNANCE] ${product.title}`);
                    } else {
                        alertCache.add(link);
                        await sendDiscordAlert({ product: product.title, site: target.site, price, link, engine, timestamp: new Date().toISOString(), status: 'HYPE' });
                        await logToGoogleSheets({ product: product.title, site: target.site, price, link, timestamp: new Date().toISOString(), status: 'HYPE' });
                    }
                } catch (e) {
                    console.error(`[GOVERNANCE ERROR] ${e.message}`);
                }
            }
            history[link] = { price, status: 'Available', timestamp: new Date().toISOString() };
        }
    } catch (error) {}
}

async function checkBrowserSite(target, browser) {
    console.log(`Checking Browser: ${target.site}...`);
    const page = await browser.newPage();
    try {
        await page.setUserAgent(getRandomUserAgent());
        await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 90000 });
        const data = await page.evaluate(() => {
            const titleEl = document.querySelector('h1');
            const priceEl = document.querySelector('[class*="price"]');
            const buyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('add') || b.innerText.toLowerCase().includes('buy'));
            return { productName: titleEl ? titleEl.innerText : document.title, priceText: priceEl ? priceEl.innerText : '0', buyEnabled: !!buyBtn && !buyBtn.disabled };
        });

        const link = target.url;
        if (alertCache.has(link)) return;

        if (data.buyEnabled && matchesKeywords(data.productName)) {
            const price = parseFloat(data.priceText.replace(/[^0-9.]/g, '')) || 0;
            try {
                const marketPrice = await getMarketPrice(browser, data.productName);
                const engine = evaluateTrade(data.productName, price, marketPrice, false, false, price);
                if (!engine.verdict.includes('SKIP')) {
                    alertCache.add(link);
                    await sendDiscordAlert({ product: data.productName, site: target.site, price, link, engine, timestamp: new Date().toISOString(), status: 'HYPE' });
                }
            } catch (e) {}
        }
        history[link] = { status: data.buyEnabled ? 'Available' : 'Sold Out', timestamp: new Date().toISOString() };
    } catch (error) {} finally { await page.close(); }
}

async function run() {
    loadConfig();
    try { if (!client.isReady()) await client.login(process.env.DISCORD_BOT_TOKEN); } catch (e) {}
    
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    global.globalBrowser = browser;
    
    await sendHeartbeat(0);

    for (const target of config.TargetURLs) {
        if (target.url.includes('products.json')) await checkShopifySite(target);
        else await checkBrowserSite(target, browser);
        await sleep(2000 + Math.random() * 4000);
    }

    await browser.close();
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
    setTimeout(run, (config.CheckIntervalMinutes || 30) * 60000);
}

run();
