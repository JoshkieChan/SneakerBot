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
        
        // Phase 28.1: Hardened Verdict Filter
        const verdict = signal.execution?.verdict;
        if (verdict !== 'STRONG BUY' && verdict !== 'BUY SMALL') {
            return; // Silent discard for WATCH/SKIP/ERROR
        }

        // Phase 36: Alert Floor Removal (Unlock Flow)
        const score = signal.intelligence?.score || 0;
        if (score < 50) {
            console.log(`[NOTIFICATION] Suppressing alert: Score ${score} < 50`);
            return;
        }

        const channelId = process.env.DISCORD_CHANNEL_ID;
        if (!channelId) return;

        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) return;

            const en = { ...signal.intelligence, ...signal.risk, ...signal.execution };
            const prod = signal.product;

            const isBuy = ['STRONG BUY', 'BUY SMALL'].includes(en.verdict);
            const embedColor = en.verdict === 'STRONG BUY' ? 0x00FF00 : (en.verdict === 'WATCH' ? 0xFFD700 : 0xFF0000);
            
            const ticketHeader = isBuy ? '🎫 EXECUTION TICKET' : `🚨 ${en.verdict}`;
            
            const descriptionBlock = `
**Item**: ${prod.title}
**Brand**: ${prod.vendor || 'Unknown'}
**Price**: $${prod.price.toFixed(2)}

**Market Analysis**:
- Expected Profit (Worst Case): $${en.worstCaseProfit ? en.worstCaseProfit.toFixed(2) : 'N/A'}
- Risk Level: ${en.riskLevel}
- Data Quality: ${en.resaleConfidence}

**Intelligence**:
- Opportunity Score: ${score}/100
- Liquidity: ${en.liquidity}

**RECOMMENDED ACTION**:
- **${en.verdict}**

**Trade ID**: ${signal.tradeId || 'N/A'}
---
*This ticket requires human approval before manual execution.*
            `;

            const embed = new EmbedBuilder()
                .setTitle(`${ticketHeader}: ${prod.title}`)
                .setURL(prod.link)
                .setColor(embedColor)
                .setDescription(descriptionBlock)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log(`[NOTIFICATION] Alert sent for ${prod.title}`);
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
