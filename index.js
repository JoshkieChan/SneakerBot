const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Client, GatewayIntentBits } = require('discord.js');
const Orchestrator = require('./core/orchestrator');
puppeteer.use(StealthPlugin());

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function run() {
    console.log('--- Modular Resale Intelligence Platform | VPS Survival Mode ---');
    
    // 1. Initialize Orchestrator
    const orchestrator = new Orchestrator();

    // 2. Initialize Discord
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    if (DISCORD_BOT_TOKEN) {
        try {
            await client.login(DISCORD_BOT_TOKEN);
            console.log('✅ Discord Authentication Successful');
            orchestrator.setDiscordClient(client);
        } catch (e) {
            console.error('❌ Discord Login Failed:', e.message);
        }
    }

    // 3. Start the Orchestration Loop (Browser lifecycle managed by Orchestrator)
    const startCycle = async () => {
        try {
            await orchestrator.runCycle();
        } catch (e) {
            console.error('[CRITICAL SYSTEM ERROR]', e);
        } finally {
            const interval = (orchestrator.config.CheckIntervalMinutes || 20) * 60000;
            console.log(`\nNext cycle in ${orchestrator.config.CheckIntervalMinutes}m...`);
            setTimeout(startCycle, interval);
        }
    };

    startCycle();
}

run();
