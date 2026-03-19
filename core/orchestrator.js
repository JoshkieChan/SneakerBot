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
        // Initialize Signal Cargo (SaaS Readiness: UserID/SessionID prep)
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

            // STEP 1: Market Intelligence (Skill Deferral)
            signal.market.price = await getStockXPrice(browser, signal.product.title);

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

            return signal;
        } catch (error) {
            console.error(`[ORCHESTRATOR ERROR] Pipeline failed for ${rawProduct.title}: ${error.message}`);
            await this.logger.logError(error, 'PIPELINE_FLOW');
            return null;
        }
    }

    async runCycle(browser) {
        console.log(`\n--- [${new Date().toISOString()}] Cycle Started ---`);
        this.loadConfig(); // Hot reload

        // 1. Scout Stage
        let allProducts = [];
        for (const target of this.config.TargetURLs) {
            if (target.url.includes('products.json')) {
                const products = await this.scout.scanShopify(target, 'Mozilla/5.0...');
                allProducts = allProducts.concat(products);
            } else {
                const page = await browser.newPage();
                const products = await this.scout.scanBrowser(target, page);
                allProducts = allProducts.concat(products);
                await page.close();
            }
        }

        // 2. Process all potential signals
        for (const product of allProducts) {
            if (product.available) {
                await this.processProduct(product, browser);
            }
        }
        
        console.log(`[ORCHESTRATOR] Cycle Complete. Processed ${allProducts.length} items.`);
    }
}

module.exports = Orchestrator;
