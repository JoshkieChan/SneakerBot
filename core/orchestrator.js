const fs = require('fs');
const path = require('path');
const ScoutAgent = require('./agents/scout');
const IntelligenceAgent = require('./agents/intelligence');
const RiskAgent = require('./agents/risk');
const ExecutionAgent = require('./agents/execution');
const NotificationAgent = require('./agents/notification');

/**
 * Orchestrator: Real Money Deal Machine.
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
        this.stats = { scanned: 0, filtered: 0, valid: 0, alertsSent: 0 };
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
        console.log(`\n[MONEY MACHINE] --- CYCLE START: ${new Date().toISOString()} ---`);
        this.stats = { scanned: 0, filtered: 0, valid: 0, alertsSent: 0 };

        try {
            // 1. Sourcing Phase (Flippa & Gumroad)
            const flippaSignals = await this.scout.scanFlippa();
            const gumroadSignals = await this.scout.scanGumroad();
            const rawSignals = [...flippaSignals, ...gumroadSignals];
            
            this.stats.scanned = rawSignals.length;

            for (const signal of rawSignals) {
                // 2. Intelligence (Estimation & Scoring)
                const analyzed = this.intel.analyze(signal);
                
                // 3. Risk Gate (Hard Filters)
                const riskResult = this.risk.evaluate(analyzed);
                if (!riskResult.valid) {
                    this.stats.filtered++;
                    continue;
                }

                this.stats.valid++;

                // 4. Execution (Thresholds)
                const result = this.exec.process(analyzed);
                if (result.verdict === 'DISCARD') continue;

                // 5. Deduplication
                const key = `${signal.title}-${signal.price}`;
                if (this.processedSignals.has(key)) continue;
                this.processedSignals.set(key, Date.now());

                // 6. Alerting (Rate Limited to 3)
                if (this.stats.alertsSent < 3) {
                    await this.notifier.send(analyzed);
                    this.stats.alertsSent++;
                }
            }

            console.log(`[MONEY MACHINE] Stats: Scanned: ${this.stats.scanned} | Filtered: ${this.stats.filtered} | Valid: ${this.stats.valid} | Sent: ${this.stats.alertsSent}`);
        } catch (error) {
            console.error(`[CRITICAL] Cycle Error: ${error.message}`);
        } finally {
            // Memory Cleanup (48h)
            const now = Date.now();
            for (const [k, t] of this.processedSignals.entries()) {
                if (now - t > 172800000) this.processedSignals.delete(k);
            }
        }
    }
}

module.exports = Orchestrator;
