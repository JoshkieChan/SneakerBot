const axios = require('axios');
const ScoutAgent = require('./scout');
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const VALIDATOR_URL = 'http://validator:8000/validate';

async function start() {
    console.log('--- Digital Arbitrage Bot: Truth Gate Version ---');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Discord Authentication Successful');

    const scout = new ScoutAgent();

    while (true) {
        console.log(`[BOT] --- EXTRACTION CYCLE START: ${new Date().toISOString()} ---`);
        
        try {
            const flippa = await scout.scanFlippa();
            const gumroad = await scout.scanGumroad();
            const signals = [...flippa, ...gumroad];

            console.log(`[BOT] Scanned: ${signals.length}. Passing to Truth Gate...`);

            for (const signal of signals) {
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
        } catch (error) {
            console.error(`[CYCLE ERROR] ${error.message}`);
        }

        console.log('Next cycle in 10m...');
        await new Promise(r => setTimeout(r, 10 * 60 * 1000));
    }
}

async function sendDiscordAlert(signal, validation) {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        const embed = `
🚨 **HIGH-CONFIDENCE FLIP**

📦 **Product:** ${signal.title}
💰 **Price:** $${signal.price.toFixed(2)}
📊 **Reviews:** ${signal.ratingCount || 0}

🔒 **Verified:** Passed Truth Gate
🧠 **Confidence:** ${validation.confidence}%

👉 **Link:** ${signal.link}
`;
        await channel.send(embed);
    } catch (e) {
        console.error(`[DISCORD ERROR] ${e.message}`);
    }
}

client.on('ready', () => start());
