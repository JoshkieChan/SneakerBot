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
        
        const score = signal.intelligence.score;
        if (score < (this.config.MinAlertScore || 50)) {
            console.log(`[NOTIFICATION] Skipping: Score (${score}) too low.`);
            return;
        }

        const channelId = process.env.DISCORD_CHANNEL_ID;
        if (!channelId) return;

        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) return;

            const en = { ...signal.intelligence, ...signal.risk, ...signal.execution };
            const prod = signal.product;

            const embedColor = en.verdict === 'STRONG BUY' ? 0x00FF00 : (en.verdict === 'WATCH' ? 0xFFD700 : 0xFF0000);
            
            const descriptionBlock = `
**Item**: ${prod.title}
**Brand**: ${prod.vendor || 'Unknown'}

**Price**: $${prod.price.toFixed(2)}
**Worst Case Profit**: $${en.worstCaseProfit ? en.worstCaseProfit.toFixed(2) : 'N/A'}

**Market Analysis**:
- Resale Confidence: ${en.resaleConfidence}
- Liquidity: ${en.liquidity}
- Brand Strength: ${en.brandStrength}

**Opportunity Score**: ${score}/100

**Validation Layer**:
- Risk Level: ${en.riskLevel}
- Data Quality: ${en.resaleConfidence}
- Anomalies: ${signal.risk.anomalies?.join(', ') || 'None'}

**FINAL DECISION**:
- **${en.verdict}**

**Trade ID**: ${signal.tradeId || 'N/A'}
            `;

            const embed = new EmbedBuilder()
                .setTitle(`🚨 ${en.verdict}: ${prod.title}`)
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
