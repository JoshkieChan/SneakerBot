const axios = require('axios');
const ScoutAgent = require('./scout');
require('dotenv').config();

// 1. CONFIG
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const VALIDATOR_URL = 'http://validator:8000/validate';
const scout = new ScoutAgent();

// 2. ERROR HANDLING
process.on("unhandledRejection", err => console.error("🚨 UNHANDLED REJECTION:", err));
process.on("uncaughtException", err => console.error("🚨 UNCAUGHT EXCEPTION:", err));

// 3. CORE LOGIC
async function sendAlert(product, validation) {
    if (!DISCORD_WEBHOOK) {
        console.error("❌ Missing Discord Webhook URL in .env");
        return;
    }

    const payload = {
        content: `🚨 **HIGH-CONFIDENCE FLIP**\n\n📦 **Product:** ${product.title}\n💰 **Price:** $${product.price}\n📊 **Reviews:** ${product.ratingCount || 0}\n\n🔒 **Verified:** Passed Truth Gate\n🧠 **Confidence:** ${validation.confidence}%\n\n👉 ${product.url}`
    };

    try {
        await axios.post(DISCORD_WEBHOOK, payload);
        console.log(`[MONEY] ALERT SENT: ${product.title}`);
    } catch (err) {
        console.error("❌ DISCORD SEND ERROR:", err.message);
    }
}

async function processSignal(url) {
    console.log(`[PROCESS] Validating: ${url}`);
    try {
        const product = await scout.scrapeUrl(url);
        if (!product || !product.price) {
            console.log(`❌ [REJECTED] ${url}: Failed to extract valid price`);
            return;
        }

        const validation = await axios.post(VALIDATOR_URL, {
            title: product.title,
            price: product.price,
            reviews: parseInt(product.ratingCount) || 0,
            description: product.description || "N/A",
            url: product.url
        });

        const result = validation.data;

        if (result.approved) {
            console.log(`✅ [APPROVED] ${product.title} (${result.confidence}%)`);
            await sendAlert(product, result);
        } else {
            console.log(`❌ [REJECTED] ${product.title}: ${result.reason}`);
        }
    } catch (err) {
        console.error(`[PROCESS ERROR] ${url}: ${err.message}`);
    }
}

async function runCycle() {
    console.log(`\n=== SNIPER CYCLE START: ${new Date().toISOString()} ===`);
    
    try {
        const flippaUrls = await scout.discoverFlippa();
        const gumroadUrls = await scout.discoverGumroad();
        const targetUrls = [...flippaUrls, ...gumroadUrls];

        console.log(`[BOT] Discovered ${targetUrls.length} targets. Scrutinizing...`);

        for (const url of targetUrls) {
            await processSignal(url);
            // Small delay to avoid hammering
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (error) {
        console.error("CYCLE FAILURE:", error.message);
    }

    console.log("=== CYCLE COMPLETE ===\n");
}

async function startBot() {
    console.log("🚀 BOT STARTED: Playwright Sniper Mode (Webhook Alerts)");
    
    if (!DISCORD_WEBHOOK) {
        console.warn("⚠️  WARNING: DISCORD_WEBHOOK is not set. Alerts will only be logged.");
    }

    while (true) {
        try {
            await runCycle();
        } catch (err) {
            console.error("CRITICAL ERROR:", err.message);
        }

        console.log("Sleeping for 10 minutes...");
        await new Promise(resolve => setTimeout(resolve, 600000));
    }
}

startBot();
