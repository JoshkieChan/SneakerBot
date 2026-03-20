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
        
        // Phase 28: Direct Verdict Filter (No Alert Spam for WATCH)
        const verdict = signal.execution?.verdict;
        if (!['STRONG BUY', 'BUY SMALL'].includes(verdict)) {
            console.log(`[NOTIFICATION] Ignoring ${verdict || 'SKIP'}: Not an Execution Signal.`);
            return;
        }

        const score = signal.intelligence.score;
        if (score < (this.config.MinAlertScore || 65)) {
            console.log(`[NOTIFICATION] Skipping: Score (${score}) below alert threshold.`);
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
}

module.exports = NotificationAgent;
