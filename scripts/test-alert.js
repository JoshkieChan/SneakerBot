const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function testAlert() {
    console.log("🚀 Testing Sniper Alert System...");
    
    const payload = {
        embeds: [{
            title: "🚨 SYSTEM TEST: SNIPER READY",
            color: 0x00FF00,
            description: "Verification complete. Sniper Engine is live on Cloud VPS.",
            fields: [
                { name: 'Product', value: 'SYSTEM TEST ITEM' },
                { name: 'Status', value: '✅ OPERATIONAL' },
                { name: 'True Profit', value: '+$1337.00 (SIMULATED)', inline: true },
                { name: 'Verdict', value: '✅ SNIPE', inline: true }
            ],
            timestamp: new Date().toISOString()
        }]
    };

    const response = await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        console.log("✅ Alert sent successfully! Check your Discord.");
    } else {
        const err = await response.text();
        console.error("❌ Failed to send alert:", err);
    }
}

testAlert();
