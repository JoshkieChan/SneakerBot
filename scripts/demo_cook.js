const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function sendDemoAlert() {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    
    const embed = new EmbedBuilder()
        .setTitle('🚨 HYPE DETECTED: [SAMPLE COOK]')
        .setColor(0x00FF00)
        .setDescription('**Ghost Sniper Mode**: This is what a real item alert looks like.')
        .addFields(
            { name: 'Product', value: 'Jordan 1 Retro High OG "Travis Scott"' },
            { name: 'Price', value: '$190.00', inline: true },
            { name: 'Market (StockX)', value: '$1,450.00', inline: true },
            { name: 'Est. Profit', value: '**$1,086.00**', inline: true },
            { name: 'Hype Velocity', value: '📈 88 mentions/min (CRITICAL)', inline: true },
            { name: 'Status', value: '✅ BACK IN STOCK', inline: true },
            { name: 'Link', value: 'https://kith.com/products/travis-jordan-sample' },
            { name: 'Quick Checkout', value: '[Add to Cart](https://kith.com/cart/441234567890:1)' }
        )
        .setFooter({ text: 'Sniper Phase 4: Behavioral Stealth Active' })
        .setTimestamp();

    const ttsMessage = `Sniper Alert. NEW HYPE DROP. Jordan 1 Retro High OG "Travis Scott". Retail $190.`;
    
    await channel.send({ content: ttsMessage, tts: true, embeds: [embed] });
    console.log('Demo alert sent.');
    process.exit(0);
}

sendDemoAlert();
