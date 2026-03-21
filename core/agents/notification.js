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
🚨 **HIGH-CONFIDENCE FLIP (Score: ${signal.score}%)**

📦 **Product:** ${signal.title}
💰 **Price:** $${signal.price.toFixed(2)}
📊 **Demand:** ${signal.demandSignal}

🔥 **Why this works:**
- **Undervalued:** ${signal.description.length < 150 ? 'Minimal listing effort indicates unpolished gem.' : 'Price-to-value gap detected based on niche standard.'}
- **Demand Signal:** ${signal.demandSignal} confirms market interest.
- **Positioning Gap:** Clear opportunity to optimize and relist for 2x profit.

💡 **Flip Plan:**
1. **Optimize:** Refine title & description for maximum SEO/Appeal.
2. **Platform:** Relist on niche-specific marketplaces (Websites/SaaS).
3. **Expected Price:** $${(signal.price * 2).toFixed(2)} - $${(signal.price * 3).toFixed(2)}

⚠️ **Risks:**
- Transfer of assets/domain logic.
- Platform-specific seller verification.

👉 **Verdict: BUY**
🔗 **Link:** ${signal.link}
`;
            await channel.send(msg);
            console.log(`[MONEY] SNIPER ALERT SENT: ${signal.title} (${signal.score}%)`);
        } catch (error) {
            console.error(`[NOTIFICATION ERROR] ${error.message}`);
        }
    }
}

module.exports = NotificationAgent;
