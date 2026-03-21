const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

console.log("🔍 Checking Discord Token...");
console.log(`Token Prefix: ${process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 10) + "..." : "MISSING"}`);

client.login(process.env.DISCORD_TOKEN)
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
