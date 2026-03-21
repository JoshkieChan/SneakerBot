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
// 3. TIERING & ROUTING
function classifyTier(confidence) {
    if (confidence >= 90) return "A";
    if (confidence >= 80) return "B";
    return "C";
}

function getChannelIdForTier(tier) {
    if (tier === "A") return process.env.CHANNEL_ID_PRIORITY;
    if (tier === "B") return process.env.CHANNEL_ID_REVIEW;
    return null; // Tier C filtered
}

async function sendAlert(client, product, confidence) {
    const tier = classifyTier(confidence);
    
    if (tier === "C") {
        console.log(`[FILTERED] Tier C skipped: ${product.title} (${confidence}%)`);
        return;
    }

    const channelId = getChannelIdForTier(tier);
    if (!channelId || !client.isReady()) {
        console.warn(`⚠️  Missing Channel ID for Tier ${tier} or Client not ready.`);
        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);
        const alertMsg = `
🚨 **TIER ${tier} DEAL**

📦 **Product:** ${product.title}
💰 **Price:** $${product.price}
📊 **Confidence:** ${confidence}%

🔗 **Link:** ${product.url}
`;
        await channel.send(alertMsg);
        console.log(`[TIER ${tier}] Sent: ${product.title}`);
    } catch (err) {
        console.error(`❌ [TIER ${tier}] SEND ERROR:`, err.message);
    }
}

function rankDeals(results) {
    return results
        .sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return b.price - a.price;
        })
        .slice(0, 3);
}

async function sendSummary(client, results) {
    if (!results.length) return;

    const topDeals = rankDeals(results);
    const channelId = process.env.CHANNEL_ID_PRIORITY;
    
    if (!channelId || !client.isReady()) return;

    try {
        const channel = await client.channels.fetch(channelId);
        let summary = `🏆 **TOP DEALS THIS CYCLE**\n\n`;

        topDeals.forEach((deal, index) => {
            summary += `${index + 1}. **${deal.title}**\n`;
            summary += `💰 $${deal.price} | 📊 ${deal.confidence}%\n`;
            summary += `🔗 ${deal.url}\n\n`;
        });

        await channel.send(summary);
        console.log("[SUMMARY] Top deals sent to Priority channel");
    } catch (err) {
        console.error("❌ [SUMMARY] SEND ERROR:", err.message);
    }
}

// 4. CORE LOOP
async function processSignal(url) {
    console.log(`[PROCESS] Validating: ${url}`);
    try {
        const product = await scout.scrapeUrl(url);
        if (!product || !product.price) {
            console.log(`❌ [REJECTED] ${url}: Failed to extract valid price`);
            return null;
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
            await sendAlert(client, product, result.confidence);
            return {
                title: product.title,
                price: product.price,
                confidence: result.confidence,
                url: product.url
            };
        } else {
            console.log(`❌ [REJECTED] ${product.title}: ${result.reason}`);
            return null;
        }
    } catch (err) {
        console.error(`[PROCESS ERROR] ${url}: ${err.message}`);
        return null;
    }
}

async function runCycle() {
    console.log(`\n=== SNIPER CYCLE START: ${new Date().toISOString()} ===`);
    let cycleResults = [];
    
    try {
        const flippaUrls = await scout.discoverFlippa();
        const gumroadUrls = await scout.discoverGumroad();
        const targetUrls = [...flippaUrls, ...gumroadUrls];

        console.log(`[BOT] Discovered ${targetUrls.length} targets. Scrutinizing...`);

        for (const url of targetUrls) {
            const res = await processSignal(url);
            if (res) cycleResults.push(res);
            await new Promise(r => setTimeout(r, 2000));
        }

        if (cycleResults.length > 0) {
            await sendSummary(client, cycleResults);
        }
    } catch (error) {
        console.error("CYCLE FAILURE:", error.message);
    }

    console.log("=== CYCLE COMPLETE ===\n");
}

// 5. STARTUP & INITIALIZATION
async function startBot() {
    console.log("🚀 INITIALIZING SNIPER BOT...");
    
    // ENV AUDIT
    console.log("-----------------------------------------");
    console.log("ENV CHECK:");
    console.log("CHANNEL_ID_PRIORITY:", process.env.CHANNEL_ID_PRIORITY ? "✅ LOADED" : "❌ MISSING");
    console.log("CHANNEL_ID_REVIEW:", process.env.CHANNEL_ID_REVIEW ? "✅ LOADED" : "❌ MISSING");
    console.log("-----------------------------------------");

    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
    
    client.once("ready", async () => {
        console.log(`✅ DISCORD CLIENT READY: Logged in as ${client.user.tag}`);
        console.log(`📡 MONITORING CHANNELS: PRIORITY=${process.env.CHANNEL_ID_PRIORITY}, REVIEW=${process.env.CHANNEL_ID_REVIEW}`);

        // Start the infinite cycle loop
        while (true) {
            try {
                await runCycle();
            } catch (err) {
                console.error("🚨 CRITICAL CYCLE ERROR:", err.message);
            }

            console.log("⏳ Cycle complete. Sleeping for 10 minutes...");
            await new Promise(resolve => setTimeout(resolve, 600000));
        }
    });

    try {
        await client.login(token);
    } catch (loginError) {
        console.error("❌ DISCORD LOGIN FAILED:", loginError.message);
        process.exit(1); 
    }
}

startBot();
