const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

console.log("🔍 Checking Discord Token...");
console.log(`Token Prefix: ${token ? token.substring(0, 10) + "..." : "MISSING"}`);

client.login(token)
    .then(() => {
        console.log("✅ SUCCESS: Token is valid!");
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ FAILURE: " + err.message);
        console.log("\nTIP: Make sure your token is copied EXACTLY from the Discord Developer Portal.");
        console.log("Ensure there are no quotes or spaces in your .env file.");
        process.exit(1);
    });
