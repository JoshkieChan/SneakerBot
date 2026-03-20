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
        // Phase 28: Signal Quality Feedback Loop
        this.emptyCycleCount = 0;
        this.softModeActive = false;
        this.processedSignals = new Map(); // Phase 31: Persistent Deduplication (24h)
        this.notificationCount = 0;
        this.siteFailures = new Map(); // Phase 30: Track consecutive failures
    }

    resetMetrics() {
        this.notificationCount = 0;
        
        // Phase 31: 24-Hour Persistent Deduplication Cleanup
        const now = Date.now();
        for (const [key, timestamp] of this.processedSignals.entries()) {
            if (now - timestamp > 24 * 60 * 60 * 1000) {
                this.processedSignals.delete(key);
            }
        }

        this.cycleMetrics = {
            startTime: new Date(),
            signalsFound: 0,
            signalsProcessed: 0,
            decisions: { 'STRONG BUY': 0, 'BUY SMALL': 0, 'WATCH': 0, 'SKIP': 0 },
            transientErrors: 0,
            criticalErrors: 0
        };
    }

    async sendHeartbeat(status = 'START') {
        const timestamp = new Date().toISOString();
        if (status === 'START') {
            const modeLabel = this.softModeActive ? ' [SOFT MODE ACTIVE]' : '';
            console.log(`\n[${timestamp}] --- CYCLE START (Batch: ${this.batchPointer})${modeLabel} ---`);
        } else {
            const m = this.cycleMetrics;
            console.log(`\n[${timestamp}] --- CYCLE REPORT ---`);
            console.log(`- Batch Pointer: ${this.batchPointer}`);
            console.log(`- Signals Found: ${m.signalsFound}`);
            console.log(`- Signals Processed: ${m.signalsProcessed}`);
            console.log(`- STRONG BUY: ${m.decisions['STRONG BUY'] || 0} | BUY SMALL: ${m.decisions['BUY SMALL'] || 0}`);
            console.log(`- WATCH: ${m.decisions['WATCH'] || 0}`);
            console.log(`- TRANSIENT Errors: ${m.transientErrors}`);
            console.log(`- CRITICAL Errors: ${m.criticalErrors}`);
            console.log(`- Alerts Sent: ${this.notificationCount}`);
            
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
        // Phase 28.2: Hard Deduplication (Cycle-Level & Persistent)
        const signalKey = `${rawProduct.title}-${rawProduct.price}`;
        if (this.processedSignals.has(signalKey)) return null;
        
        // Mark as 'seen' for this session/day with a 0 timestamp (not yet alerted)
        this.processedSignals.set(signalKey, 0); 

        this.cycleMetrics.signalsProcessed++;
        
        let signal = {
            tradeId: `T-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            userId: 'default',
            sessionId: 'default',
            timestamp: new Date().toISOString(),
            product: rawProduct,
            market: { price: null }, 
            intelligence: { softMode: this.softModeActive },
            risk: {},
            execution: {},
            logging: {},
            diagnostics: { anomalies: [] }
        };

        try {
            this.validateSignal(signal);

            // Limited 8s Market Data Timeout for VPS
            const marketPromise = getStockXPrice(browser, signal.product.title);
            
            // Phase 30: Relaxed 12s Market Data Timeout
            signal.market.price = await Promise.race([
                marketPromise, 
                new Promise((_, reject) => setTimeout(() => reject(new Error('TRANSIENT_TIMEOUT')), 12000))
            ]).catch(e => {
                if (e.message.includes('TRANSIENT')) this.cycleMetrics.transientErrors++;
                return null;
            });

            signal = await this.intel.analyze(signal);
            signal = await this.risk.assess(signal);
            signal = await this.exec.decide(signal);
            signal = await this.logger.persist(signal);
            
            // Phase 31: Hard 24-Hour Deduplication
            const verdict = signal.execution.verdict;
            if (['STRONG BUY', 'BUY SMALL'].includes(verdict) && this.notificationCount < 3) {
                const signalKey = `${signal.product.title}-${signal.product.price}`;
                if (this.processedSignals.has(signalKey)) {
                    console.log(`[ORCHESTRATOR] Deduplicating: Alert already sent for ${signalKey}`);
                } else {
                    await this.notifier.send(signal);
                    this.processedSignals.set(signalKey, Date.now());
                    this.notificationCount++;
                }
            }
            
            this.cycleMetrics.decisions[verdict] = (this.cycleMetrics.decisions[verdict] || 0) + 1;
            return signal;
        } catch (error) {
            const isTransient = error.message.includes('TRANSIENT') || error.message.includes('TIMEOUT');
            if (isTransient) {
                this.cycleMetrics.transientErrors++;
            } else {
                this.cycleMetrics.criticalErrors++;
                await this.logger.logError(error, 'PIPELINE_FLOW');
            }
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

        // Phase 30: Relaxed 120s Global Cycle Timeout
        const cycleTimeout = setTimeout(async () => {
            console.error('[WATCHDOG] Cycle timed out! Reclaiming resources.');
            await browser.close().catch(() => {});
        }, 120000);

        try {
            const allTargets = this.config.TargetURLs;
            const start = this.batchPointer * this.batchSize;
            const batch = allTargets.slice(start, start + this.batchSize);
            
            // Advance pointer for next cycle
            this.batchPointer = (start + this.batchSize >= allTargets.length) ? 0 : this.batchPointer + 1;

            let allProducts = [];
            for (const target of batch) {
                // Phase 30: Site-level Failure Penalty (Skip if 2+ consecutive failures)
                const failures = this.siteFailures.get(target.site) || 0;
                if (failures >= 2) {
                    console.log(`[ORCHESTRATOR] Skipping ${target.site} due to persistent failures.`);
                    continue;
                }

                try {
                    // Phase 27: Strict Sequential & Lightweight
                    if (target.url.includes('products.json')) {
                        const products = await this.scout.scanShopify(target, 'Mozilla/5.0...');
                        allProducts = allProducts.concat(products);
                        this.siteFailures.set(target.site, 0); // Reset on success
                    } else {
                        const page = await browser.newPage();
                        // Lightweight Mode: Block heavy resources
                        await page.setRequestInterception(true);
                        page.on('request', (req) => {
                            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
                            else req.continue();
                        });

                        page.setDefaultNavigationTimeout(15000); // Phase 30: 15s page load
                        const products = await this.scout.scanBrowser(target, page);
                        allProducts = allProducts.concat(products);
                        this.siteFailures.set(target.site, 0); // Reset on success
                        await page.close();
                    }
                } catch (e) {
                    this.cycleMetrics.transientErrors++;
                    this.siteFailures.set(target.site, failures + 1);
                    console.warn(`[ORCHESTRATOR] Site ${target.site} failure count: ${failures + 1}`);
                }
            }

            this.cycleMetrics.signalsFound = allProducts.length;

            // Sequential processing to avoid CPU spikes
            for (const product of allProducts) {
                if (product.available) {
                    await this.processProduct(product, browser);
                }
            }

            // Phase 28: Adaptive Feedback Loop Logic
            const totalBuys = (this.cycleMetrics.decisions['STRONG BUY'] || 0) + (this.cycleMetrics.decisions['BUY SMALL'] || 0);
            
            if (totalBuys === 0) {
                this.emptyCycleCount++;
                if (this.emptyCycleCount >= 3 && !this.softModeActive) {
                    console.log('🔄 [ADAPTIVE] 3 empty cycles detected. Entering SOFT MODE for 2 cycles.');
                    this.softModeActive = true;
                    this.softModeStartCycle = this.batchPointer; // Marker
                }
            } else {
                this.emptyCycleCount = 0;
                if (this.softModeActive) {
                    console.log('✅ [ADAPTIVE] Signal found. Resetting SOFT MODE.');
                    this.softModeActive = false;
                }
            }

            // Auto-revert Soft Mode after 2 cycles
            if (this.softModeActive && this.emptyCycleCount >= 5) {
                console.log('🔄 [ADAPTIVE] Soft Mode duration reached (2 cycles). Reverting to Standard Strictness.');
                this.softModeActive = false;
                this.emptyCycleCount = 0;
            }

        } finally {
            clearTimeout(cycleTimeout);
            await browser.close().catch(() => {});
            await this.sendHeartbeat('END');
        }
    }
}

module.exports = Orchestrator;
