const fs = require('fs');
const path = require('path');
const ScoutAgent = require('./agents/scout');
const IntelligenceAgent = require('./agents/intelligence');
const RiskAgent = require('./agents/risk');
const ExecutionAgent = require('./agents/execution');
const LoggingAgent = require('./agents/logging');
const NotificationAgent = require('./agents/notification');
const { getStockXPrice } = require('../skills/market_data');

/**
 * System Orchestrator: Coordinates specialized agents, enforces architecture,
 * and ensures scalable, production-grade execution.
 */
class Orchestrator {
    constructor() {
        this.configPath = path.join(__dirname, '../config/config.json');
        this.loadConfig();
        
        // Initialize Agents
        this.scout = new ScoutAgent(this.config);
        this.intel = new IntelligenceAgent(this.config);
        this.risk = new RiskAgent(this.config);
        this.exec = new ExecutionAgent(this.config);
        this.logger = new LoggingAgent(this.config);
        this.notifier = new NotificationAgent(this.config, null);

        // System Health Check
        this.validateConfig();

        // Phase 25: Observability & Watchdog
        this.cycleMetrics = {
            startTime: null,
            signalsFound: 0,
            signalsProcessed: 0,
            decisions: { 'STRONG BUY': 0, 'BUY SMALL': 0, 'WATCH': 0, 'SKIP': 0 },
            errors: []
        };
    }

    resetMetrics() {
        this.cycleMetrics = {
            startTime: new Date(),
            signalsFound: 0,
            signalsProcessed: 0,
            decisions: { 'STRONG BUY': 0, 'BUY SMALL': 0, 'WATCH': 0, 'SKIP': 0 },
            errors: []
        };
    }

    async sendHeartbeat(status = 'START') {
        const timestamp = new Date().toISOString();
        if (status === 'START') {
            console.log(`\n[${timestamp}] --- CYCLE START ---`);
        } else {
            const m = this.cycleMetrics;
            console.log(`\n[${timestamp}] --- CYCLE REPORT ---`);
            console.log(`- Timestamp: ${timestamp}`);
            console.log(`- Signals Found: ${m.signalsFound}`);
            console.log(`- Signals Processed: ${m.signalsProcessed}`);
            console.log(`- Trades Evaluated: ${m.signalsProcessed}`);
            console.log(`- STRONG BUY count: ${m.decisions['STRONG BUY'] || 0}`);
            console.log(`- BUY SMALL count: ${m.decisions['BUY SMALL'] || 0}`);
            console.log(`- WATCH count: ${m.decisions['WATCH'] || 0}`);
            console.log(`- SKIP count: ${m.decisions['SKIP'] || 0}`);
            console.log(`- Errors Detected: ${m.errors.length}`);
            
            if (m.signalsFound === 0) {
                console.log('No valid signals this cycle');
            }
            console.log('----------------------------\n');
        }
    }

    validateConfig() {
        console.log('[ORCHESTRATOR] Running System Health Check...');
        const required = ['EliteKeywordTiers', 'TargetURLs', 'MaxCapitalPerTradePercent'];
        for (const key of required) {
            if (!this.config[key] || (Array.isArray(this.config[key]) && this.config[key].length === 0)) {
                console.error(`[CRITICAL] Missing or empty config key: ${key}`);
                process.exit(1);
            }
        }
        console.log('✅ Config Integrity Verified');
    }

    validateSignal(signal) {
        if (!signal.product.title || isNaN(signal.product.price) || signal.product.price <= 0) {
            throw new Error('INVALID_SIGNAL_DATA: Missing title or invalid price');
        }
    }

    loadConfig() {
        try {
            this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (error) {
            console.error('[ORCHESTRATOR ERROR] Failed to load config.json');
            process.exit(1);
        }
    }

    setDiscordClient(client) {
        this.notifier.client = client;
    }

    /**
     * The Core Pipeline: Product Signal -> Trade Result
     */
    async processProduct(rawProduct, browser) {
        this.cycleMetrics.signalsProcessed++;
        
        let signal = {
            tradeId: `T-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            userId: 'default',
            sessionId: 'default',
            timestamp: new Date().toISOString(),
            product: rawProduct,
            market: { price: null }, 
            intelligence: {},
            risk: {},
            execution: {},
            logging: {},
            diagnostics: { anomalies: [] }
        };

        try {
            // STEP 0: Data Sanity Governance
            this.validateSignal(signal);

            // STEP 1: Market Intelligence with 10s Timeout
            const marketPromise = getStockXPrice(browser, signal.product.title);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MARKET_SKILL_TIMEOUT')), 10000));
            signal.market.price = await Promise.race([marketPromise, timeoutPromise]).catch(() => null);

            // STEP 2: Intelligence (Scoring)
            signal = await this.intel.analyze(signal);

            // STEP 3: Risk (Capital Protection)
            signal = await this.risk.assess(signal);

            // STEP 4: Execution (Decision)
            signal = await this.exec.decide(signal);

            // STEP 5: Logging (State)
            signal = await this.logger.persist(signal);

            // STEP 6: Notification (Alerting)
            await this.notifier.send(signal);
            
            this.cycleMetrics.decisions[signal.execution.verdict] = (this.cycleMetrics.decisions[signal.execution.verdict] || 0) + 1;

            return signal;
        } catch (error) {
            this.cycleMetrics.errors.push(error.message);
            console.error(`[ORCHESTRATOR ERROR] Pipeline failed for ${rawProduct.title}: ${error.message}`);
            await this.logger.logError(error, 'PIPELINE_FLOW');
            this.cycleMetrics.decisions['SKIP']++;
            return null;
        }
    }

    async runCycle(browser) {
        this.resetMetrics();
        await this.sendHeartbeat('START');
        
        // 60s Global Cycle Timeout
        const cycleTimeout = setTimeout(() => {
            console.error('[WATCHDOG] Cycle timed out! Forcing closure.');
            this.cycleMetrics.errors.push('GLOBAL_CYCLE_TIMEOUT');
        }, 60000);

        try {
            // 1. Scout Stage
            let allProducts = [];
            for (const target of this.config.TargetURLs) {
                try {
                    if (target.url.includes('products.json')) {
                        const products = await this.scout.scanShopify(target, 'Mozilla/5.0...');
                        allProducts = allProducts.concat(products);
                    } else {
                        const page = await browser.newPage();
                        page.setDefaultNavigationTimeout(15000); // 15s page load timeout
                        const products = await this.scout.scanBrowser(target, page);
                        allProducts = allProducts.concat(products);
                        await page.close();
                    }
                } catch (e) {
                    this.cycleMetrics.errors.push(`SCOUT_FAILED_${target.site}`);
                }
            }

            this.cycleMetrics.signalsFound = allProducts.length;

            // 2. Process all potential signals
            for (const product of allProducts) {
                if (product.available) {
                    await this.processProduct(product, browser);
                }
            }
        } finally {
            clearTimeout(cycleTimeout);
            await this.sendHeartbeat('END');
        }
    }
}

module.exports = Orchestrator;
