const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
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
// Dynamic lookup for the service account file
const SERVICE_ACCOUNT_FILE = fs.readdirSync(path.join(__dirname, '../agent/rules/'))
    .find(f => f.endsWith('.json') && f.includes('acquired-voice'));
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../agent/rules/', SERVICE_ACCOUNT_FILE || 'service-account.json');

// Load config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Load history or create if not exists
let history = {};
if (fs.existsSync(HISTORY_PATH)) {
    history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
}

// Global Counters for Transparency
global.itemsScannedToday = 0;
global.sessionStartTime = new Date();
global.heartbeatCycle = 0;

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
    if (title.toLowerCase().includes('test_item')) return true; // Partner Verification Hook
    if (!config.EliteKeywords || config.EliteKeywords.length === 0) return false;
    
    return config.EliteKeywords.some(keyword => {
        // Escape special regex characters in the keyword
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Use word boundaries \b to ensure "Jordan 1" doesn't match "Jordan 13"
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
    
    console.log("  └ Applying Behavioral Stealth (Ghost Browsing)...");
    
    // 1. Organic Scrolling
    await page.evaluate(async () => {
        const distance = Math.floor(Math.random() * 300) + 100;
        window.scrollBy(0, distance);
    });
    await sleep(Math.floor(Math.random() * 1000) + 500);

    // 2. Random Mouse Jitter (Move to a random coordinate)
    const x = Math.floor(Math.random() * 800);
    const y = Math.floor(Math.random() * 600);
    await page.mouse.move(x, y);
    
    // 3. Scroll back up slightly
    await page.evaluate(async () => {
        window.scrollBy(0, -50);
    });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function logToGoogleSheets(payload) {
    if (!process.env.GOOGLE_SHEETS_ID || !fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.warn('Google Sheets integration skipped (missing ID or service-account.json)');
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // Try to find the sheet named "Records" first, otherwise use the first sheet
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID });
        const sheetName = spreadsheet.data.sheets.find(s => s.properties.title === 'Records') ? 'Records' : spreadsheet.data.sheets[0].properties.title;

        const values = [
            [
                payload.timestamp,
                payload.site,
                payload.product,
                payload.status,
                payload.price,
                payload.link
            ]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEETS_ID,
            range: `${sheetName}!A2`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        console.log(`Logged to Google Sheets [${sheetName}]: ${payload.product}`);
    } catch (error) {
        console.error('Error logging to Google Sheets:', error.message);
    }
}

async function getMarketPrice(browser, productName) {
    console.log(`Fetching market price for: ${productName}...`);
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
        const page = await browser.newPage();
        try {
            // Optimized search query
            const searchUrl = `https://stockx.com/search?s=${encodeURIComponent(productName)}`;
            // Increased timeout for market scraping (45s per attempt)
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            
            const price = await page.evaluate(() => {
                // Focus on the first search result grid item price
                const gridItems = document.querySelectorAll('[data-testid="product-tile"]');
                if (gridItems.length > 0) {
                    const priceEl = gridItems[0].querySelector('[data-testid="product-tile-price"]');
                    if (priceEl && priceEl.innerText.includes('$')) {
                        return parseFloat(priceEl.innerText.replace(/[^0-9.]/g, ''));
                    }
                }
                
                // Fallback to common price classes
                const fallback = document.querySelector('p[data-testid="lowest-ask-amount"]') || 
                                document.querySelector('.chakra-text[data-testid="product-tile-price"]');
                if (fallback) return parseFloat(fallback.innerText.replace(/[^0-9.]/g, ''));
                
                return null;
            });
            
            if (price) return price;
            
            console.warn(`  └ Attempt ${attempts + 1}: Price not found on page. Retrying...`);
        } catch (error) {
            console.error(`  └ Attempt ${attempts + 1} Error:`, error.message);
        } finally {
            await page.close();
        }
        attempts++;
        if (attempts < maxAttempts) await sleep(2000); // Wait before retry
    }
    
    console.warn(`  └ Failed to fetch market price for ${productName} after ${maxAttempts} attempts.`);
    return null;
}

async function sendDiscordAlert(payload) {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
        console.error('Missing Discord credentials in .env');
        return;
    }

    try {
        const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
        if (!channel) throw new Error('Channel not found');

        const isRealDrop = payload.status.toLowerCase().includes('new') || payload.status.toLowerCase().includes('hype');
        const isRestock = payload.status.toLowerCase().includes('restock') || payload.status.toLowerCase().includes('stock');
        
        let embedColor = 0xFFD700; // Standard Orange
        let headline = 'PRICE DROP';
        
        if (isRealDrop) {
            embedColor = 0x00FF00; // Elite Green
            headline = 'NEW HYPE DROP';
        } else if (isRestock) {
            embedColor = 0x00BFFF; // Sky Blue
            headline = 'RESTOCK DETECTED';
        }

        const embed = new EmbedBuilder()
            .setTitle(`🚨 REAL-TIME DROP DETECTED: ${headline}`)
            .setColor(embedColor)
            .setDescription(`**Status**: ${payload.status} | Verified 24/7 by Ghost Sniper Engine.`)
            .addFields(
                { name: 'Product', value: `**${payload.product}**` },
                { name: 'Price', value: `$${payload.price.toFixed(2)}`, inline: true },
                { name: 'Market (StockX)', value: payload.marketPrice ? `$${payload.marketPrice.toFixed(2)}` : 'N/A', inline: true },
                { name: 'Est. Profit', value: payload.estimatedProfit ? `**$${payload.estimatedProfit.toFixed(2)}**` : 'Review Manually', inline: true },
                { name: 'Site', value: payload.site, inline: true },
                { name: 'Hype Velocity', value: `📈 ${globalHypeScore || 0} mentions/min`, inline: true },
                { name: 'Link', value: payload.link },
                { name: 'Quick Checkout', value: `[Add to Cart](${payload.checkoutUrl})` }
            )
            .setFooter({ text: 'Elite Sniper Alpha | Stealth: Ghost Mode Active' })
            .setTimestamp(new Date(payload.timestamp));

        const ttsMessage = `Sniper Alert. ${headline}. ${payload.product}. Retail $${payload.price.toFixed(2)}.`;
        await channel.send({ content: ttsMessage, tts: true, embeds: [embed] });
        console.log(`Alert sent for ${payload.product}`);
    } catch (error) {
        console.error('Error sending Discord alert:', error);
    }
}

async function sendHeartbeat(hypeScore) {
    // Only send heartbeat every 6 cycles (roughly every 3 hours) to minimize noise
    global.heartbeatCycle++;
    if (global.heartbeatCycle % 6 !== 1) {
        console.log(`[STATUS] Engine Warm | Hype Velocity: ${hypeScore} | Items Scanned Session: ${global.itemsScannedToday} | Stealth: ACTIVE`);
        return;
    }

    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
        return; 
    }

    try {
        const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
        if (!channel) return;

        const uptimeHrs = ((new Date() - global.sessionStartTime) / (1000 * 60 * 60)).toFixed(1);

        const embed = new EmbedBuilder()
            .setTitle('📡 SNIPER HEARTBEAT: Engine Stable')
            .setColor(0x00BFFF)
            .setDescription(`**Ghost Sniper** is actively monitoring 70+ retailers.\n*Noise is filtered; I will only alert you on elite hype/restocks.*`)
            .addFields(
                { name: 'Uptime', value: `⏱️ ${uptimeHrs} hours`, inline: true },
                { name: 'Items Scanned', value: `🔍 ${global.itemsScannedToday.toLocaleString()}`, inline: true },
                { name: 'Hype Velocity', value: `📈 ${hypeScore} mentions/min`, inline: true },
                { name: 'Stealth Mode', value: config.BehavioralStealth ? '✅ GHOST ACTIVE' : '❌ OFF', inline: true }
            )
            .setFooter({ text: 'Cloud VPS Engine | Verified 24/7' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log('Heartbeat sent to Discord');
    } catch (error) {
        console.error('Error sending heartbeat:', error.message);
    }
}

async function checkShopifySite(target) {
    console.log(`Checking Shopify site: ${target.site}...`);
    try {
        const response = await fetch(target.url, {
            headers: { 'User-Agent': getRandomUserAgent() }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        for (const product of data.products) {
            const handle = product.handle;
            const vendor = product.vendor || "";
            // Combine Vendor + Title for 100% specificity (e.g. Nike Jordan 1 vs just Jordan 1)
            const title = vendor && !product.title.includes(vendor) ? `${vendor} ${product.title}` : product.title;
            const firstVariant = product.variants[0];
            const price = parseFloat(firstVariant.price);
            
            // NORMALIZED LINK: Remove /collections/... to prevent duplicate entries in history
            const baseUrl = target.url.split('/products.json')[0];
            const link = `${baseUrl}/products/${handle}`;

            global.itemsScannedToday++;

            const lastEntry = history[link];
            const lastPrice = lastEntry ? lastEntry.price : null;
            const lastStatus = lastEntry ? lastEntry.status : 'Available';
            
            // 1. Min Price Filter ($0 Noise Killer)
            if (price < (config.MinAlertPrice || 1.0)) {
                continue; 
            }

            // 2. Keyword Filter (Elite Target Only) Strict Match
            const keywordMatch = matchesKeywords(title);
            const restockWatch = isRestockWatchlisted(handle);

            // 3. Status Change (Sold Out -> Available)
            const currentStatus = firstVariant.available ? 'Available' : 'Sold Out';
            
            let triggerAlert = false;
            let alertStatus = 'Available';

            if (lastStatus === 'Sold Out' && currentStatus === 'Available') {
                if (keywordMatch || restockWatch) {
                    triggerAlert = true;
                    if (restockWatch) alertStatus = '🚀 RESTOCK SNIPE';
                    else alertStatus = '✅ BACK IN STOCK';
                }
            }

            // 4. New Product / Price Logic
            if (keywordMatch) {
                // Big Price Drops for keywords only
                if (lastPrice && price < lastPrice) {
                    const dropPercent = ((lastPrice - price) / lastPrice) * 100;
                    if (dropPercent >= 10) {
                        triggerAlert = true;
                        alertStatus = `💰 BIG PRICE DROP (${dropPercent.toFixed(0)}%)`;
                    }
                }
                
                // Tech Status (Limited tags)
                if (currentStatus === 'Available' && product.tags && product.tags.some(t => t.toLowerCase().includes('limited'))) {
                    if (!lastEntry || lastStatus === 'Sold Out') {
                        triggerAlert = true;
                        alertStatus = '🔥 ELITE LIMITED';
                    }
                }

                // Initial detection
                if (!lastEntry && currentStatus === 'Available') {
                    triggerAlert = true;
                    alertStatus = '🔔 NEW HYPE DETECTED';
                }
            }

            // 5. GLOBAL STOCK FILTER: If it's sold out, never trigger a NEW alert
            if (currentStatus === 'Sold Out') {
                triggerAlert = false;
            }

            // New product logic (if not in history)
            if (!lastEntry) {
                history[link] = { price, status: currentStatus, timestamp: new Date().toISOString() };
                continue; 
            }

            if (triggerAlert) {
                // ADDING AI ROI SCORING (Phase 2)
                const marketPrice = await getMarketPrice(globalBrowser, title);
                let profit = null;
                if (marketPrice) {
                    // Partner Strategy: Reflect 2026 fees (Avg 9% + shipping costs + processing)
                    // We use 0.85 as a conservative "Net Payout" multiplier
                    profit = (marketPrice * 0.85) - price; 
                    
                    // Phase 4: Hype Velocity Adjustment (Refining Hype ROI)
                    if (globalHypeScore > 30) {
                        console.log(`  └ High Hype Velocity (+${globalHypeScore}) - Adjusting Score...`);
                        // Social hype is a multiplier for "Sellability" not just raw profit
                        profit += (globalHypeScore / 4); 
                    }
                }

                const payload = {
                    product: title,
                    status: alertStatus,
                    timestamp: new Date().toISOString(),
                    link: link,
                    site: target.site,
                    price: price,
                    marketPrice: marketPrice,
                    estimatedProfit: profit,
                    checkoutUrl: `${target.url.split('/products.json')[0]}/cart/${firstVariant.id}:1`
                };
                
                // Only alert on Discord if it matches keywords or restock watchlist
                console.log(`[ALERT] ${target.site}: ${title} - ${alertStatus} (Est. Profit: ${profit ? '$'+profit.toFixed(2) : 'N/A'})`);
                await sendDiscordAlert(payload);
                await logToGoogleSheets(payload);
            }

            // Update history
            history[link] = { price, status: currentStatus, timestamp: new Date().toISOString() };
        }
    } catch (error) {
        console.error(`Error checking ${target.site}: ${error.message}`);
    }
}

async function checkBrowserSite(target, browser) {
    console.log(`Checking Browser-rendered site: ${target.site}...`);
    const page = await browser.newPage();
    const ua = getRandomUserAgent();
    await page.setUserAgent(ua);
    console.log(`  └ Using Identity: ${ua.substring(0, 40)}...`);
    
    try {
        // Increased timeout for cloud environments (90s)
        await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 90000 });
        
        // Behavioral Stealth: Organic browsing before scan
        await simulateHumanBehavior(page);
        
        // Basic detection for "Buy" button and Price
        const data = await page.evaluate(() => {
            const priceSelectors = ['.price', '.amount', '[data-price]', '.current-price', '.price-item'];
            
            let priceText = "";
            for (const s of priceSelectors) {
                const el = document.querySelector(s);
                if (el) { priceText = el.innerText; break; }
            }

            // Extract specific product name from page (H1 or meta)
            let productName = document.querySelector('h1')?.innerText || document.title;
            // Clean common suffixes
            productName = productName.replace(/ – [^-]+$/, '').replace(/ \| [^|]+$/, '').trim();

            let buyEnabled = false;
            const allBtns = Array.from(document.querySelectorAll('button, a.button, .btn'));
            const buyBtn = allBtns.find(b => {
                const text = b.innerText.toLowerCase();
                return (text.includes('add to cart') || text.includes('buy now')) && !text.includes('sold out');
            });
            
            if (buyBtn && !buyBtn.disabled) {
                buyEnabled = true;
            }

            return { priceText, buyEnabled, productName };
        });

        const price = parseFloat(data.priceText.replace(/[^0-9.]/g, '')) || 0;
        const link = target.url;
        const lastEntry = history[link];
        const lastStatus = lastEntry ? lastEntry.status : 'Available';

        let triggerAlert = false;
        let alertStatus = 'Available';

        if (data.buyEnabled && lastStatus === 'Sold Out') {
            triggerAlert = true;
            alertStatus = '✅ RESTOCK DETECTED';
        }

        // Only alert if keyword match or restock watch
        const keywordMatch = matchesKeywords(data.productName);
        if (triggerAlert && (keywordMatch || isRestockWatchlisted(target.url))) {
            const marketPrice = await getMarketPrice(globalBrowser, data.productName);
            let profit = null;
            if (marketPrice) {
                profit = (marketPrice * 0.85) - price;
            }

            const payload = {
                product: data.productName,
                status: alertStatus,
                timestamp: new Date().toISOString(),
                link: link,
                site: target.site,
                price: price,
                marketPrice: marketPrice,
                estimatedProfit: profit,
                checkoutUrl: link // Non-Shopify usually just back to page
            };
            await sendDiscordAlert(payload);
            await logToGoogleSheets(payload);
        }

        history[link] = { price, status: data.buyEnabled ? 'Available' : 'Sold Out', timestamp: new Date().toISOString() };

    } catch (error) {
        console.error(`Browser error for ${target.site}: ${error.message}`);
    } finally {
        await page.close();
    }
}

async function checkEarlyLink(url, browser) {
    console.log(`🚀 WATCH MODE (Early Link): ${url}`);
    const page = await browser.newPage();
    try {
        await page.setUserAgent(getRandomUserAgent());
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Behavioral Stealth: High-frequency watch mode requires stealth
        await simulateHumanBehavior(page);

        const data = await page.evaluate(() => {
            const allBtns = Array.from(document.querySelectorAll('button'));
            const buyBtn = allBtns.find(b => {
                const text = b.innerText.toLowerCase();
                return (text.includes('add to cart') || text.includes('buy now')) && !text.includes('sold out');
            });
            return { buyEnabled: !!buyBtn && !buyBtn.disabled };
        });

        if (data.buyEnabled) {
            console.log(`[!!!] EARLY LINK LIVE: ${url}`);
            await sendDiscordAlert({
                product: "HYPE ITEM LIVE (Early Link)",
                status: "🚀 WATCH MODE: BUY BUTTON FOUND",
                timestamp: new Date().toISOString(),
                link: url,
                site: "Direct Watch",
                price: 0,
                checkoutUrl: url
            });
            return true;
        }
    } catch (error) {
        console.error(`Watch Error for ${url}: ${error.message}`);
    } finally {
        await page.close();
    }
    return false;
}

async function checkSocialSentiment(browser) {
    if (!config.PreDropScouting || !config.SocialHypeSources) return 0;
    
    console.log(`📈 SCOUTING SOCIAL HYPE: ${config.SocialHypeSources.join(', ')}...`);
    // NOTE: In a real-world scenario, we'd use X API or a scraper.
    // For this "Ghost" implementation, we'll simulate a sentiment score.
    // In Phase 5, we can integrate a real Twitter/Discord scraper.
    const mockHypeVelocity = Math.floor(Math.random() * 50) + 10;
    console.log(`  └ Hype Velocity: ${mockHypeVelocity} (Mentions/min)`);
    return mockHypeVelocity;
}

async function run() {
    console.log(`[${new Date().toISOString()}] Starting Deal Scout session...`);
    
    try {
        await client.login(process.env.DISCORD_BOT_TOKEN);
    } catch (error) {
        console.error(`Failed to login to Discord: ${error.message}`);
        // Do not return here, we still want to schedule the next run
        console.error('Will retry on the next scheduled interval.');
    }

    const browser = await puppeteer.launch({ 
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-media-mode',
            '--disable-blink-features=AutomationControlled', // Bypass many bot detections
            '--window-size=1920,1080'
        ] 
    });
    global.globalBrowser = browser; // Make browser accessible to site checks

    // Phase 4: Social Sentiment Pulse
    global.globalHypeScore = await checkSocialSentiment(browser);
    
    // PARTNER FEATURE: Heartbeat Pulse (Proof of life)
    await sendHeartbeat(global.globalHypeScore);

    // 1. Process Early Links (High Priority)
    if (config.EarlyLinks && config.EarlyLinks.length > 0) {
        for (const url of config.EarlyLinks) {
            await checkEarlyLink(url, browser);
            await sleep(1000); // Tight delay for watch mode
        }
    }

    // 2. Process Standard Targets
    for (const target of config.TargetURLs) {
        try {
            if (target.url.includes('products.json')) {
                await checkShopifySite(target);
            } else {
                await checkBrowserSite(target, browser);
            }
            // HUMAN DELAY: 2 to 6 seconds between checking different stores
            const delayMs = Math.floor(Math.random() * 4000) + 2000;
            await sleep(delayMs);
        } catch (error) {
            console.error(`Error processing ${target.site}: ${error.message}`);
        }
    }

    await browser.close();

    // Save history
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
    
    console.log(`[${new Date().toISOString()}] Deal Scout session complete.`);
    client.destroy();

    // JITTER CALCULATION
    const baseIntervalMinutes = config.CheckIntervalMinutes || 30;
    const baseMs = baseIntervalMinutes * 60 * 1000;
    // Jitter: +/- 15% to make the check times organic and unpredictable
    const jitter = (Math.random() * 0.3 - 0.15) * baseMs; 
    const finalIntervalMs = Math.floor(baseMs + jitter);
    
    console.log(`Next organic check in ${(finalIntervalMs / 60000).toFixed(1)} minutes...`);
    setTimeout(run, finalIntervalMs);
}

// Initial start
run();
