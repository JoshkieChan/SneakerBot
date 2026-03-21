/**
 * Notification Agent: Flip Opportunity Alerts.
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

            const msg = `
----------------------------------
🔥 **DIGITAL FLIP OPPORTUNITY**

**Title:** ${signal.title}
**Price:** $${signal.price.toFixed(2)}
**Platform:** ${signal.source}
**Score:** ${signal.score}/100

**Why this is interesting:**
1. High demand niche (${signal.source === 'Gumroad' ? 'Creator Tool' : 'SaaS'})
2. Price is significantly below standard market value
3. Unpolished listing indicates immediate flip potential

**Potential Flip Angle:**
${signal.price < 100 ? 'Rebrand + Resell at 3-5x price' : 'Optimize SEO + Listing for passive income'}

**Next Actions:**
1. Verify ownership / rights
2. Check similar listings pricing
3. Prepare resale positioning

**Link:**
${signal.link}
----------------------------------
`;
            await channel.send(msg);
            console.log(`[MONEY] ALERT SENT: ${signal.title}`);
        } catch (error) {
            console.error(`[NOTIFICATION ERROR] ${error.message}`);
        }
    }
}

module.exports = NotificationAgent;
