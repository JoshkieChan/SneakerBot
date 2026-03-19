const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');
const path = require('path');

// Resolve path to .env relative to this script
dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages
    ] 
});

client.once('ready', async () => {
    console.log(`[PURGE] Logged in as ${client.user.tag}`);
    const channelId = process.env.DISCORD_CHANNEL_ID;
    
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Channel not found.");
            process.exit(1);
        }

        console.log(`[PURGE] Initializing nuclear wipe on channel: ${channel.name}`);
        let totalDeleted = 0;
        let batch;

        do {
            // bulkDelete clears messages up to 14 days old in batches of 100
            batch = await channel.bulkDelete(100, true);
            totalDeleted += batch.size;
            console.log(`[PURGE] Batch cleared: ${batch.size} messages. Total: ${totalDeleted}`);
        } while (batch.size > 0);

        console.log(`[SUCCESS] Purge complete. ${totalDeleted} legacy alerts removed.`);
        process.exit(0);
    } catch (error) {
        console.error(`[ERROR] Nuclear wipe failed: ${error.message}`);
        process.exit(1);
    }
});

if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
    console.error("❌ Missing Discord credentials in .env");
    process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);
