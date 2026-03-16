require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function test() {
    console.log('Testing Discord Bot connection...');
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
        console.error('Missing Discord credentials in .env');
        process.exit(1);
    }

    try {
        await client.login(process.env.DISCORD_BOT_TOKEN);
        const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
        
        if (!channel) {
            console.error('Channel not found! Check DISCORD_CHANNEL_ID.');
            process.exit(1);
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ SNEAKER AGENT ONLINE')
            .setColor(0x00AE86)
            .setDescription('Autonomous monitoring has been successfully initialized.')
            .addFields(
                { name: 'Status', value: 'Technical Monitoring Active', inline: true },
                { name: 'Sites', value: '40+ Boutiques Configured', inline: true }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log('Test message sent successfully!');
    } catch (error) {
        console.error('Discord API Error:', error.message);
    } finally {
        client.destroy();
    }
}

test();
