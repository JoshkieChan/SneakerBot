const axios = require('axios');
const ScoutAgent = require('./scout');
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// 1. CONFIG & CLIENT
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const VALIDATOR_URL = 'http://validator:8000/validate';
const scout = new ScoutAgent();

// 2. ERROR HANDLING (Truth Gate Security)
process.on("unhandledRejection", err => {
    console.error("🚨 UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", err => {
    console.error("🚨 UNCAUGHT EXCEPTION:", err);
});

// 3. CORE LOGIC
async function processSignal(signal) {
    try {
        const validation = await axios.post(VALIDATOR_URL, {
            title: signal.title,
            price: signal.price,
            reviews: signal.ratingCount || 0,
            description: signal.description || "N/A",
            url: signal.link
        });

        const result = validation.data;

        if (result.approved) {
            console.log(`✅ [APPROVED] ${signal.title} (${result.confidence}%)`);
            await sendDiscordAlert(signal, result);
        } else {
            console.log(`❌ [REJECTED] ${signal.title}: ${result.reason}`);
        }
    } catch (vError) {
        console.error(`[VALIDATOR ERROR] ${vError.message}`);
    }
}

async function runCycle() {
    console.log(`\n=== EXTRACTION CYCLE START: ${new Date().toISOString()} ===`);
    
    try {
        const flippa = await scout.scanFlippa();
        const gumroad = await scout.scanGumroad();
        const signals = [...flippa, ...gumroad];

        console.log(`[BOT] Scanned: ${signals.length}. Passing to Truth Gate...`);

        for (const signal of signals) {
            await processSignal(signal);
        }
    } catch (error) {
        console.error("CYCLE FAILURE:", error.message);
    }

    console.log("=== CYCLE COMPLETE ===\n");
}

async function sendDiscordAlert(signal, validation) {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId || !client.isReady()) return;

    try {
        const channel = await client.channels.fetch(channelId);
        const alertMsg = `
🚨 **HIGH-CONFIDENCE FLIP**

📦 **Product:** ${signal.title}
💰 **Price:** $${signal.price.toFixed(2)}
📊 **Reviews:** ${signal.ratingCount || 0}

🔒 **Verified:** Passed Truth Gate
🧠 **Confidence:** ${validation.confidence}%

👉 **Link:** ${signal.link}
`;
        await channel.send(alertMsg);
    } catch (e) {
        console.error(`[DISCORD ERROR] ${e.message}`);
    }
}

// 4. DAEMON LOOP
async function startBot() {
    console.log("🚀 BOT STARTED: Running continuous scan loop (Truth Gate Mode)");
    
    // Attempt Discord Login
    try {
        await client.login(process.env.DISCORD_TOKEN);
        console.log("✅ Discord Authentication Successful");
    } catch (loginError) {
        console.error("❌ DISCORD LOGIN FAILED:", loginError.message);
        // We continue anyway, the loop will just fail the alert part but keeps scraping
    }

    while (true) {
        try {
            await runCycle();
        } catch (err) {
            console.error("CRITICAL CYCLE ERROR:", err.message);
        }

        console.log("Sleeping for 10 minutes...");
        await new Promise(resolve => setTimeout(resolve, 600000)); // 10 minutes
    }
}

startBot();
