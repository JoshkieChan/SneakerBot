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

        // Phase 25/27: Observability & Resource Guard
        this.cycleMetrics = {
            startTime: null,
            signalsFound: 0,
            signalsProcessed: 0,
            decisions: { 'STRONG BUY': 0, 'BUY SMALL': 0, 'WATCH': 0, 'SKIP': 0 },
            errors: []
        };

        // Phase 27: Persistent Batch State
        this.batchPointer = 0;
        this.batchSize = 12; // Standard 10-15 range
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
            console.log(`\n[${timestamp}] --- CYCLE START (Batch: ${this.batchPointer}) ---`);
        } else {
            const m = this.cycleMetrics;
            console.log(`\n[${timestamp}] --- CYCLE REPORT ---`);
            console.log(`- Batch Pointer: ${this.batchPointer}`);
            console.log(`- Signals Found: ${m.signalsFound}`);
            console.log(`- Signals Processed: ${m.signalsProcessed}`);
            console.log(`- STRONG BUY: ${m.decisions['STRONG BUY'] || 0} | BUY SMALL: ${m.decisions['BUY SMALL'] || 0}`);
            console.log(`- Errors: ${m.errors.length}`);
            
            if (m.signalsFound === 0) console.log('No valid signals this cycle');
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
        // Force Survival Interval
        if (!this.config.CheckIntervalMinutes || this.config.CheckIntervalMinutes < 20) {
            console.log('[PERFORMANCE] Normalizing CheckIntervalMinutes to 20 for VPS survival.');
            this.config.CheckIntervalMinutes = 20;
        }
        console.log('✅ Config Integrity Verified');
    }

    validateSignal(signal) {
        if (!signal.product.title || isNaN(signal.product.price) || signal.product.price <= 0) {
            throw new Error('INVALID_SIGNAL_DATA');
        }
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
            this.validateSignal(signal);

            // Limited 8s Market Data Timeout for VPS
            const marketPromise = getStockXPrice(browser, signal.product.title);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000));
            signal.market.price = await Promise.race([marketPromise, timeoutPromise]).catch(() => null);

            signal = await this.intel.analyze(signal);
            signal = await this.risk.assess(signal);
            signal = await this.exec.decide(signal);
            signal = await this.logger.persist(signal);
            await this.notifier.send(signal);
            
            this.cycleMetrics.decisions[signal.execution.verdict] = (this.cycleMetrics.decisions[signal.execution.verdict] || 0) + 1;
            return signal;
        } catch (error) {
            this.cycleMetrics.errors.push(error.message);
            await this.logger.logError(error, 'PIPELINE_FLOW');
            this.cycleMetrics.decisions['SKIP']++;
            return null;
        }
    }

    async runCycle() {
        this.resetMetrics();
        await this.sendHeartbeat('START');
        
        // Phase 27: Zero-Persistent Browser Lifecycle
        const puppeteer = require('puppeteer-extra');
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process' // Hard memory limit for 1GB VPS
            ] 
        });

        // 60s Global Cycle Timeout
        const cycleTimeout = setTimeout(async () => {
            console.error('[WATCHDOG] Cycle timed out! Reclaiming resources.');
            await browser.close().catch(() => {});
        }, 60000);

        try {
            const allTargets = this.config.TargetURLs;
            const start = this.batchPointer * this.batchSize;
            const batch = allTargets.slice(start, start + this.batchSize);
            
            // Advance pointer for next cycle
            this.batchPointer = (start + this.batchSize >= allTargets.length) ? 0 : this.batchPointer + 1;

            let allProducts = [];
            for (const target of batch) {
                try {
                    // Phase 27: Strict Sequential & Lightweight
                    if (target.url.includes('products.json')) {
                        const products = await this.scout.scanShopify(target, 'Mozilla/5.0...');
                        allProducts = allProducts.concat(products);
                    } else {
                        const page = await browser.newPage();
                        // Lightweight Mode: Block heavy resources
                        await page.setRequestInterception(true);
                        page.on('request', (req) => {
                            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
                            else req.continue();
                        });

                        page.setDefaultNavigationTimeout(10000); // 10s page load
                        const products = await this.scout.scanBrowser(target, page);
                        allProducts = allProducts.concat(products);
                        await page.close();
                    }
                } catch (e) {
                    this.cycleMetrics.errors.push(`SCOUT_FAILED_${target.site}`);
                }
            }

            this.cycleMetrics.signalsFound = allProducts.length;

            // Sequential processing to avoid CPU spikes
            for (const product of allProducts) {
                if (product.available) {
                    await this.processProduct(product, browser);
                }
            }
        } finally {
            clearTimeout(cycleTimeout);
            await browser.close().catch(() => {});
            await this.sendHeartbeat('END');
        }
    }
}

module.exports = Orchestrator;
