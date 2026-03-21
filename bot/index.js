const axios = require('axios');
const ScoutAgent = require('./scout');
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// 1. CONFIG
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const VALIDATOR_URL = 'http://validator:8000/validate';
const scout = new ScoutAgent();

// 2. ERROR HANDLING
process.on("unhandledRejection", err => console.error("🚨 UNHANDLED REJECTION:", err));
process.on("uncaughtException", err => console.error("🚨 UNCAUGHT EXCEPTION:", err));

// 3. CORE LOGIC
async function sendAlert(product, validation) {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId || !client.isReady()) {
        console.warn("⚠️  Discord Client not ready or Channel ID missing.");
        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);
        const alertMsg = `
🚨 **HIGH-CONFIDENCE FLIP**

📦 **Product:** ${product.title}
💰 **Price:** $${product.price}
📊 **Reviews:** ${product.ratingCount || 0}

🔒 **Verified:** Passed Truth Gate
🧠 **Confidence:** ${validation.confidence}%

👉 **Link:** ${product.url}
`;
        await channel.send(alertMsg);
        console.log(`[MONEY] ALERT SENT: ${product.title}`);
    } catch (err) {
        console.error("❌ DISCORD BOT SEND ERROR:", err.message);
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
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (error) {
        console.error("CYCLE FAILURE:", error.message);
    }

    console.log("=== CYCLE COMPLETE ===\n");
}

async function startBot() {
    console.log("🚀 BOT STARTED: Playwright Sniper Mode (Bot Token Alerts)");
    
    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    
    try {
        await client.login(token);
        console.log("✅ Discord Authentication Successful");
    } catch (loginError) {
        console.error("❌ DISCORD LOGIN FAILED:", loginError.message);
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
