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

            const embed = new EmbedBuilder()
                .setTitle(`${ticketHeader}: ${prod.title}`)
                .setURL(prod.url || prod.link)
                .setColor(embedColor)
                .setDescription(descriptionBlock)
                .setTimestamp();

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
