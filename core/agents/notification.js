/**
 * Notification Agent: High-Impact Deal Alerts.
 */
class NotificationAgent {
    constructor(config, client) {
        this.config = config;
        this.client = client;
    }

    async send(signal) {
        if (!this.client || !this.client.isReady()) return;
        const channelId = process.env.DISCORD_CHANNEL_ID;
        if (!channelId) return;

        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) return;

            // MANDATORY FORMAT
            const msg = `
----------------------------------
🚨 **DEAL DETECTED**

**Title:** ${signal.title}
**Platform:** ${signal.source}
**Price:** $${signal.price.toFixed(2)}

**Estimated Resale:** $${signal.estimatedResale.toFixed(0)}
**Estimated Profit:** $${signal.profit.toFixed(0)}
**Score:** ${signal.score}

**Why this is valuable:**
- High liquidity in ${signal.niche} niche
- Significant flip potential identified
- Passing all hard security gates

**Next Actions:**
1. Review demo immediately
2. Compare similar listings on ${signal.source}
3. Post resale listing (X/Discord)

**Link:**
${signal.link}
----------------------------------
`;
            await channel.send(msg);
            console.log(`[ALERT SENT] ${signal.title} | Profit: $${signal.profit.toFixed(0)}`);
        } catch (error) {
            console.error(`[NOTIFICATION ERROR] ${error.message}`);
        }
    }
}

module.exports = NotificationAgent;
