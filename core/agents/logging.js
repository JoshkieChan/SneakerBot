const fs = require('fs');
const path = require('path');

/**
 * Logging Agent: Stores structured trade data, prevents duplicates,
 * and maintains system history and runtime logs.
 */
class LoggingAgent {
    constructor(config) {
        this.config = config;
        this.historyPath = path.join(__dirname, '../../data/history.json');
        this.tradesPath = path.join(__dirname, '../../data/trades.json');
        this.errorLogPath = path.join(__dirname, '../../logs/errors.log');
        
        // Ensure directories exist
        if (!fs.existsSync(path.dirname(this.historyPath))) fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
        if (!fs.existsSync(path.dirname(this.errorLogPath))) fs.mkdirSync(path.dirname(this.errorLogPath), { recursive: true });
    }

    async persist(signal) {
        console.log(`[LOGGING] Persisting Signal: ${signal.product.title}...`);
        
        // 1. Update History (Deduplication)
        let history = {};
        if (fs.existsSync(this.historyPath)) {
            history = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
        }
        history[signal.product.link] = {
            price: signal.product.price,
            status: signal.product.available ? 'Available' : 'Sold Out',
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2));

        // 2. Log Trade (Full Cargo)
        if (signal.execution.verdict !== 'SKIP') {
            let trades = [];
            if (fs.existsSync(this.tradesPath)) {
                trades = JSON.parse(fs.readFileSync(this.tradesPath, 'utf8'));
            }
            trades.push({
                tradeId: `TRD-${Date.now()}`,
                userId: signal.userId || 'default',
                sessionId: signal.sessionId || 'default',
                ...signal
            });
            fs.writeFileSync(this.tradesPath, JSON.stringify(trades, null, 2));
        }

        return signal;
    }

    async logError(error, context = 'GENERAL') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${context}] ${error.message}\n${error.stack}\n---\n`;
        fs.appendFileSync(this.errorLogPath, logMessage);
    }
}

module.exports = LoggingAgent;
