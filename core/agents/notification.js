const { EmbedBuilder } = require('discord.js');

/**
 * Notification Agent: Sends Discord alerts ONLY for Score >= 50.
 * Formats output strictly according to the mandatory system schema.
 */
class NotificationAgent {
    constructor(config, client) {
        this.config = config;
        this.client = client;
    }

    async send(signal) {
        if (!this.client || !this.client.isReady()) return;
        
        const verdict = signal.execution?.verdict || 'WATCH';
        const score = signal.intelligence?.score || 0;
        const channelId = process.env.DISCORD_CHANNEL_ID;
        if (!channelId) return;

        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) return;

            const en = { ...signal.intelligence, ...signal.risk, ...signal.execution };
            const prod = signal.product;

            const embedColor = en.verdict === 'STRONG BUY' ? 0x00FF00 : (en.verdict === 'EARLY WATCH' ? 0x00FFFF : (en.verdict === 'BUY SMALL' ? 0x0000FF : 0xFFD700));
            const isEarly = en.verdict === 'EARLY WATCH';
            const ticketHeader = isEarly ? '🛰️ [EARLY SIGNAL]' : (['STRONG BUY', 'BUY SMALL'].includes(en.verdict) ? '🎫 EXECUTION TICKET' : `🚨 ${en.verdict}`);
            
            const descriptionBlock = `
**Item**: ${prod.title}
**Price**: $${prod.price.toFixed(2)} | **Est. Resale**: $${signal.market.price || 'N/A'}

${isEarly ? `✨ **Early Insight**: ${en.earlyReason || 'Potential before market moves'}\n` : ''}
**Financial Intelligence**:
- **True Profit**: $${en.trueProfit ? en.trueProfit.toFixed(2) : 'N/A'}
- **Worst-Case Profit**: $${en.worstCaseProfit ? en.worstCaseProfit.toFixed(2) : 'N/A'}
- **Liquidity**: ${en.liquidity}
- **Confidence**: ${en.resaleConfidence}

**Verdict Analysis**:
- **ACTION**: **${en.verdict}**
- **Score**: ${score}/100
- **Units**: ${en.units || 0}

**Trade ID**: ${signal.tradeId || 'N/A'}
---
*Signal prioritized by Market Edge (Phase 42)*
            `;

            const isEarlySignal = signal.intelligence?.earlySignal;
            const verdictTitle = isEarlySignal ? `⚡ EARLY BUY ⚡` : (en.verdict === 'STRONG BUY' ? '🔥 STRONG BUY 🔥' : (en.verdict === 'BUY SMALL' ? '✅ BUY SMALL' : (en.verdict === 'EARLY WATCH' ? '👀 EARLY WATCH' : '⏳ WATCH')));
            
            let headerColorInt = en.verdict === 'STRONG BUY' ? 0x00FF00 : (en.verdict === 'EARLY WATCH' ? 0x00FFFF : (en.verdict === 'BUY SMALL' ? 0x0000FF : 0xFFD700));
            if (isEarlySignal) headerColorInt = 0xF1C40F; // Gold for Early Alpha

            const embed = new EmbedBuilder()
                .setTitle(`${verdictTitle}: ${prod.title}`)
                .setURL(prod.url || prod.link)
                .setColor(headerColorInt)
                .addFields(
                    { name: '💰 Retail', value: `$${prod.price.toFixed(2)}`, inline: true },
                    { name: '📈 Est. Resale', value: `$${(signal.market.price || 0).toFixed(2)}`, inline: true },
                    { name: '💵 Worst-Case Profit', value: isEarlySignal ? 'N/A (Pre-Market)' : `$${(en.worstCaseProfit || 0).toFixed(2)}`, inline: true },
                    { name: '📊 Liquidity', value: en.liquidity || 'MEDIUM', inline: true },
                    { name: '🎯 Score', value: `${score}/100`, inline: true },
                    { name: '🛡️ Confidence', value: en.confidence || 'MODEL', inline: true }
                )
                .setFooter({ text: `SneakerBot 2.0 | ${prod.site}` })
                .setTimestamp();

            if (isEarlySignal) {
                embed.setDescription(`**[EARLY SIGNAL]** Primary detection within 6 hours of drop.\n**Strategy:** Buy before price discovery occurs. High risk, extreme alpha potential.`);
            } else {
                embed.setDescription(descriptionBlock);
            }

            await channel.send({ embeds: [embed] });
            console.log(`[NOTIFICATION] Alert sent for ${prod.title} [${en.verdict}]`);
        } catch (error) {
            console.error(`[NOTIFICATION ERROR] ${error.message}`);
        }
    }

    async purgeChannel(channelId) {
        if (!this.client || !this.client.isReady()) return;
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) return;

            console.log(`[NOTIFICATION] Purging channel: ${channelId}...`);
            let fetched;
            do {
                fetched = await channel.messages.fetch({ limit: 100 });
                // Only delete bot's own messages to be safe
                const botMessages = fetched.filter(m => m.author.id === this.client.user.id);
                if (botMessages.size > 0) {
                    await channel.bulkDelete(botMessages, true);
                    console.log(`[NOTIFICATION] Deleted ${botMessages.size} alerts.`);
                }
            } while (fetched.size >= 10); // Small buffer
            
            console.log('[NOTIFICATION] Discord Purge Complete.');
        } catch (error) {
            console.error(`[NOTIFICATION PURGE ERROR] ${error.message}`);
        }
    }
}

module.exports = NotificationAgent;
