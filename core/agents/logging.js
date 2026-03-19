const fs = require('fs');
const path = require('path');

/**
 * Logging Agent: Stores structured trade data, prevents duplicates,
 * and maintains system history and runtime logs.
 */
class LoggingAgent {
    constructor(config) {
        this.config = config;
        this.tradesPath = path.join(__dirname, '../../data/trades.json');
        this.engineLogPath = path.join(__dirname, '../../logs/engine.log');
        this.errorLogPath = path.join(__dirname, '../../logs/errors.log');
        
        // Ensure directories exist
        if (!fs.existsSync(path.dirname(this.tradesPath))) fs.mkdirSync(path.dirname(this.tradesPath), { recursive: true });
        if (!fs.existsSync(path.dirname(this.engineLogPath))) fs.mkdirSync(path.dirname(this.engineLogPath), { recursive: true });
        
        // Eagerly initialize log files to satisfy Phase 26 requirements
        if (!fs.existsSync(this.engineLogPath)) fs.writeFileSync(this.engineLogPath, '');
        if (!fs.existsSync(this.errorLogPath)) fs.writeFileSync(this.errorLogPath, '');
    }

    async persist(signal) {
        const timestamp = new Date().toISOString();
        console.log(`[LOGGING] Persisting Signal: ${signal.product.title}...`);
        
        let store = { history: {}, trades: [] };
        if (fs.existsSync(this.tradesPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.tradesPath, 'utf8'));
                if (Array.isArray(data)) store.trades = data; // Legacy array mapping
                else if (data && !data.history) Object.assign(store.history, data); // Legacy object mapping
                else store = data;
            } catch (e) {
                console.error('[LOGGING ERROR] trades.json corruption, resetting store.');
            }
        }

        // 1. Update History (Deduplication)
        store.history[signal.product.link] = {
            price: signal.product.price,
            status: signal.product.available ? 'Available' : 'Sold Out',
            timestamp
        };

        // 2. Engine Log (Decision history)
        const logEntry = `[${timestamp}] [${signal.execution.verdict}] ${signal.product.title} | Price: $${signal.product.price}\n`;
        fs.appendFileSync(this.engineLogPath, logEntry);

        // 3. Log Trade (Full Cargo for BUYs)
        if (signal.execution.verdict.includes('BUY')) {
            store.trades.push({
                tradeId: signal.tradeId,
                userId: signal.userId || 'default',
                sessionId: signal.sessionId || 'default',
                ...signal
            });
        }

        fs.writeFileSync(this.tradesPath, JSON.stringify(store, null, 2));

        return signal;
    }

    async logError(error, context = 'GENERAL') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${context}] ${error.message}\n${error.stack}\n---\n`;
        fs.appendFileSync(this.errorLogPath, logMessage);
    }
}

module.exports = LoggingAgent;
