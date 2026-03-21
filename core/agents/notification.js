/**
 * Notification Agent: Formats Digital Arbitrage Alerts.
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

            const isWatch = signal.verdict === 'WATCH';
            const emoji = isWatch ? '👀' : '🚀';

            const msg = `
${emoji} **DEAL ALERT**
Asset: ${signal.title.substring(0, 100)}...
Price: $${signal.price}
Niche: ${signal.niche}
Flip Potential: ${signal.estimatedFlip}

Action: Contact seller immediately
Link: ${signal.link}
`;
            await channel.send(msg);
            console.log(`[ALERT] Sent digital arbitrage signal: ${signal.niche}`);
        } catch (error) {
            console.error(`[NOTIFICATION ERROR] ${error.message}`);
        }
    }
}

module.exports = NotificationAgent;
