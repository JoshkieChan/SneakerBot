const fs = require('fs');
const path = require('path');
const ScoutAgent = require('./agents/scout');
const IntelligenceAgent = require('./agents/intelligence');
const RiskAgent = require('./agents/risk');
const ExecutionAgent = require('./agents/execution');
const NotificationAgent = require('./agents/notification');

/**
 * Digital Arbitrage Orchestrator: Finds underpriced digital assets.
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

        this.keywords = ["selling instagram account", "selling tiktok account", "domain for sale"];
        this.processedSignals = new Map(); 
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
        console.log(`\n[ARBITRAGE] --- CYCLE START: ${new Date().toISOString()} ---`);
        
        try {
            // 1. Scout raw opportunities
            const rawSignals = await this.scout.scanX(this.keywords);
            console.log(`[ARBITRAGE] Found ${rawSignals.length} raw opportunities.`);

            let processedSignals = [];
            for (const signal of rawSignals) {
                // 2. Intelligence
                const analyzed = this.intel.analyze(signal);
                
                // 3. Risk Gate
                const riskResult = this.risk.evaluate(analyzed);
                if (!riskResult.valid) continue;

                // 4. Execution Logic
                const ticket = this.exec.process(analyzed);
                processedSignals.push(ticket);
            }

            // 5. Alerting Pipeline
            let alertsSent = 0;
            const uniqueSignals = processedSignals.filter(s => {
                const key = `${s.title}-${s.price}`;
                if (this.processedSignals.has(key)) return false;
                this.processedSignals.set(key, Date.now());
                return true;
            });

            // 6. Force-Send Logic: If zero "BUY" alerts, send TOP 3 "WATCH"
            const buys = uniqueSignals.filter(s => s.verdict === 'BUY');
            const alertsToProcess = buys.length > 0 ? buys : uniqueSignals.slice(0, 3);

            for (const alert of alertsToProcess) {
                await this.notifier.send(alert);
                alertsSent++;
            }

            console.log(`[ARBITRAGE] Cycle complete. Alerts sent: ${alertsSent}`);
        } catch (error) {
            console.error(`[ARBITRAGE CRITICAL] Cycle crashed: ${error.message}`);
        } finally {
            // Cleanup memory (24h)
            const now = Date.now();
            for (const [key, timestamp] of this.processedSignals.entries()) {
                if (now - timestamp > 86400000) this.processedSignals.delete(key);
            }
        }
    }
}

module.exports = Orchestrator;
