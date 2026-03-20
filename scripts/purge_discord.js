const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json'), 'utf8'));
const NotificationAgent = require('../core/agents/notification');

async function runPurge() {
    const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;

    console.log(`[DEBUG] Attempting purge with Channel: ${channelId || 'MISSING'}`);
    console.log(`[DEBUG] Token status: ${token ? 'FOUND (LEN: ' + token.length + ')' : 'MISSING'}`);

    if (!token) {
        console.error('❌ ERROR: No DISCORD_BOT_TOKEN or DISCORD_TOKEN found.');
        process.exit(1);
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    
    client.once('ready', async () => {
        console.log('✅ Bot is online. Starting purge...');
        const notifier = new NotificationAgent(config, client);
        
        if (channelId) {
            await notifier.purgeChannel(channelId);
        } else {
            console.error('❌ ERROR: No DISCORD_CHANNEL_ID found in .env');
        }
        
        console.log('🧹 Purge task complete. Exiting.');
        process.exit(0);
    });

    client.login(token);
}

runPurge().catch(err => {
    console.error(err);
    process.exit(1);
});
