const fs = require('fs');
const path = require('path');
const ScoutAgent = require('./agents/scout');
const IntelligenceAgent = require('./agents/intelligence');
const RiskAgent = require('./agents/risk');
const ExecutionAgent = require('./agents/execution');
const NotificationAgent = require('./agents/notification');

/**
 * Orchestrator: Money Extraction Machine.
 */
class Orchestrator {
    constructor() {
        this.configPath = path.join(__dirname, '../config/config.json');
        this.loadConfig();
        
        this.scout = new ScoutAgent(this.config, this);
        this.intel = new IntelligenceAgent(this.config);
        this.risk = new RiskAgent(this.config);
        this.exec = new ExecutionAgent(this.config);
        this.notifier = new NotificationAgent(this.config, null);

        this.processedSignals = new Map();
        this.stats = { scanned: 0, filtered: 0, sent: 0 };
    }

    loadConfig() {
        try {
            this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (error) {
            process.exit(1);
        }
    }

    setDiscordClient(client) {
        this.notifier.client = client;
    }

    async runCycle() {
        console.log(`\n[MONEY] --- EXTRACTION CYCLE START: ${new Date().toISOString()} ---`);
        this.stats = { scanned: 0, filtered: 0, sent: 0 };

        try {
            // 1. Scrape Platforms
            const signals = [];
            const flippa = await this.scout.scanFlippa();
            const gumroad = await this.scout.scanGumroad();
            signals.push(...flippa, ...gumroad);
            
            this.stats.scanned = signals.length;

            if (this.stats.scanned === 0) {
                console.log(`[MONEY] No signals found. Scrapers may need keyword expansion.`);
            }

            for (const signal of signals) {
                // 2. Analyze
                const analyzed = this.intel.analyze(signal);
                
                // 3. Risk Gate
                const risk = this.risk.evaluate(analyzed);
                if (!risk.valid) {
                    this.stats.filtered++;
                    continue;
                }

                // 4. Score Threshold
                if (analyzed.score < 60) continue;

                // 5. Dedupe
                const key = `${signal.title}-${signal.price}`;
                if (this.processedSignals.has(key)) continue;
                this.processedSignals.set(key, Date.now());

                // 6. Alert (Limited to 3)
                if (this.stats.sent < 3) {
                    await this.notifier.send(analyzed);
                    this.stats.sent++;
                }
            }

            console.log(`[MONEY] Cycle Complete. Scanned: ${this.stats.scanned} | Sent: ${this.stats.sent}`);
        } catch (error) {
            console.error(`[MONEY ERROR] ${error.message}`);
        } finally {
            // Cleanup memory
            const now = Date.now();
            for (const [k, t] of this.processedSignals.entries()) {
                if (now - t > 172800000) this.processedSignals.delete(k);
            }
        }
    }
}

module.exports = Orchestrator;
