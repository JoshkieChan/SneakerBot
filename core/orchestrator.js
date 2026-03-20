const fs = require('fs');
const path = require('path');
const ScoutAgent = require('./agents/scout');
const IntelligenceAgent = require('./agents/intelligence');
const RiskAgent = require('./agents/risk');
const ExecutionAgent = require('./agents/execution');
const LoggingAgent = require('./agents/logging');
const NotificationAgent = require('./agents/notification');
const { getStockXPrice } = require('../skills/market_data');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * System Orchestrator: Coordinates specialized agents, enforces architecture,
 * and ensures scalable, production-grade execution.
 */
class Orchestrator {
    constructor() {
        this.configPath = path.join(__dirname, '../config/config.json');
        this.loadConfig();
        
        // Initialize Agents
        this.scout = new ScoutAgent(this.config, this);
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
        this.batchSize = 24; // Phase 34: Scaled for Hetzner Dedicated CPU
        // Phase 28: Signal Quality Feedback Loop
        this.emptyCycleCount = 0;
        this.siteFailures = new Map(); // Phase 30: Track consecutive failures
        this.isShuttingDown = false; // Phase 33: Global Shutdown Flag
        this.processedSignals = new Map(); // Phase 31: Persistent Deduplication (24h)
        this.notificationCount = 0;

        // Phase 35: Standardized Metrics Initialization
        this.metrics = {
            signalsFound: 0,
            signalsProcessed: 0,
            strongBuy: 0,
            buySmall: 0,
            watch: 0,
            errors: {
                transient: 0,
                critical: 0
            }
        };

        // Phase 33: Global Process Resilience
        process.on('unhandledRejection', (reason, promise) => {
            console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
            // Do not exit
        });
        process.on('uncaughtException', (err) => {
            console.error('[CRITICAL] Uncaught Exception:', err);
            // Do not exit
        });
    }

    resetMetrics() {
        // Phase 35: Defensive Metrics Guard & Debug Logging
        console.log(`[DEBUG] Metrics State: ${JSON.stringify(this.metrics || {})}`);
        if (!this.metrics) {
            this.metrics = { signalsFound: 0, signalsProcessed: 0, strongBuy: 0, buySmall: 0, watch: 0, errors: { transient: 0, critical: 0 }};
        }
        this.metrics.errors = this.metrics.errors || { transient: 0, critical: 0 };

        this.notificationCount = 0;
        
        // Phase 31: 24-Hour Persistent Deduplication Cleanup
        const now = Date.now();
        const signals = this.processedSignals || new Map();
        for (const [key, timestamp] of (signals.entries ? signals.entries() : [])) {
            if (now - timestamp > 24 * 60 * 60 * 1000) {
                signals.delete(key);
            }
        }

        this.cycleMetrics = {
            startTime: new Date(),
            signalsFound: 0,
            signalsProcessed: 0,
            decisions: { 'STRONG BUY': 0, 'BUY SMALL': 0, 'WATCH': 0, 'SKIP': 0 },
            transientErrors: 0,
            criticalErrors: 0,
            topRejected: [],
            topWatch: [],
            topActionable: [],
            dataStats: { sold: 0, listings: 0 }
        };
    }

    async sendHeartbeat(status = 'START') {
        const timestamp = new Date().toISOString();
        if (status === 'START') {
            const modeLabel = this.softModeActive ? ' [SOFT MODE ACTIVE]' : ' [HETZNER PERFORMANCE MODE]';
            console.log(`\n[${timestamp}] --- CYCLE START (Batch: ${this.batchPointer})${modeLabel} ---`);
        } else {
            const m = this.cycleMetrics;
            console.log(`\n[${timestamp}] --- CYCLE REPORT [HETZNER] ---`);
            console.log(`- Batch Pointer: ${this.batchPointer}`);
            console.log(`- Signals Found: ${m.signalsFound}`);
            console.log(`- Signals Processed: ${m.signalsProcessed}`);
            console.log(`- STRONG BUY: ${m.decisions['STRONG BUY'] || 0} | BUY SMALL: ${m.decisions['BUY SMALL'] || 0}`);
            console.log(`- WATCH: ${m.decisions['WATCH'] || 0}`);
            console.log(`- TRANSIENT Errors: ${m.transientErrors}`);
            console.log(`- CRITICAL Errors: ${m.criticalErrors}`);
            console.log(`- Alerts Sent: ${this.notificationCount}`);
            
            if (m.dataStats) {
                const total = m.signalsProcessed || 1;
                console.log(`- Data Quality: Sold ${(m.dataStats.sold/total*100).toFixed(1)}% | Listings ${(m.dataStats.listings/total*100).toFixed(1)}%`);
            }

            if (m.topActionable && m.topActionable.length > 0) {
                console.log('\n[TOP 5 ACTIONABLE SIGNALS]');
                m.topActionable.slice(0, 5).forEach(s => {
                    const profit = s.risk?.worstCaseProfit || 0;
                    console.log(`- ${s.product.title} | Score: ${s.intelligence.score} | Est. Profit: $${profit.toFixed(2)}`);
                });
            }

            if (m.topRejected && m.topRejected.length > 0) {
                console.log('\n[TOP REJECTED SIGNALS]');
                m.topRejected.slice(0, 3).forEach(s => console.log(`- ${s.product.title}: ${s.execution?.reason || 'Unknown'}`));
            }
            
            if (m.signalsFound === 0) console.log('\nNo valid signals this cycle');
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
        // Phase 1: Data Validity Gate (Phase 37)
        const price = rawProduct.price;
        const hasRetail = price && !isNaN(price) && price > 0;
        if (!hasRetail) return null;

        const signalKey = `${rawProduct.title}-${rawProduct.price}`;
        if (this.processedSignals.has(signalKey)) return null;
        
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

            // Phase 33: Pass orchestrator for shutdown resilience
            const marketPromise = getStockXPrice(browser, signal.product.title, this);
            
            // Phase 30: Relaxed 12s Market Data Timeout
            signal.market.price = await Promise.race([
                marketPromise, 
                new Promise((_, reject) => setTimeout(() => reject(new Error('TRANSIENT_TIMEOUT')), 12000))
            ]).catch(e => {
                if (e.message.includes('TRANSIENT')) this.cycleMetrics.transientErrors++;
                return null;
            });

            // Phase 37: Data Quality Detection for Summary
            const hasSold = signal.market.hasSoldData;
            const hasListings = signal.market.hasListings;
            if (hasSold) this.cycleMetrics.dataStats.sold++;
            else if (hasListings) this.cycleMetrics.dataStats.listings++;

            // Phase 36: Guaranteed Agent Resilience
            try {
                signal = await this.intel.analyze(signal);
                signal = await this.risk.assess(signal);
                signal = await this.exec.decide(signal);
                signal = await this.logger.persist(signal);
            } catch (agentErr) {
                console.error(`[ORCHESTRATOR] Agent Error (Transient): ${agentErr.message}`);
                this.cycleMetrics.transientErrors++;
                return null;
            }

            const verdict = signal.execution.verdict;
            
            // Phase 36: Track for Logging Summary
            if (verdict === 'SKIP' || verdict === 'ERROR') {
                this.cycleMetrics.topRejected.push(signal);
            } else if (verdict === 'WATCH') {
                this.cycleMetrics.topWatch.push(signal);
            }

            // Phase 31/36: Persistent Deduplication & Alerting
            if (['STRONG BUY', 'BUY SMALL', 'WATCH'].includes(verdict)) {
                const signalKey = `${signal.product.title}-${signal.product.price}`;
                const alertedAt = this.processedSignals.get(signalKey);
                
                // Only alert if not already alerted within 24h
                if (!alertedAt || alertedAt === 0) {
                    await this.notifier.send(signal);
                    this.processedSignals.set(signalKey, Date.now());
                    this.notificationCount++;
                }
            }
            
            this.cycleMetrics.decisions[verdict] = (this.cycleMetrics.decisions[verdict] || 0) + 1;
            return signal;
        } catch (error) {
            const isTransient = error.message.includes('TRANSIENT') || 
                                error.message.includes('TIMEOUT') || 
                                error.message.includes('Target closed') ||
                                error.message.includes('Navigation');
            
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
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        
        // Phase 33: Disable User-Agent Override (Source of crashes)
        const stealth = StealthPlugin();
        stealth.enabledEvasions.delete('user-agent-override');
        puppeteer.use(stealth);

        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote'
                // --single-process removed for Hetzner 8GB stability
            ] 
        });

        this.isShuttingDown = false;

        // Phase 34: Relaxed 300s (5m) Global Cycle Timeout for Hetzner
        const cycleTimeout = setTimeout(async () => {
            console.error('[WATCHDOG] Cycle timed out! Reclaiming resources.');
            this.isShuttingDown = true;
            await sleep(500); // Larger buffer for agents
            await browser.close().catch(() => {});
        }, 300000);

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
                        try {
                            // Phase 33: Manual User Agent (Avoid stealth override crash)
                            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
                            
                            // Lightweight Mode: Block heavy resources
                            await page.setRequestInterception(true);
                            page.on('request', (req) => {
                                if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
                                else req.continue();
                            });

                            page.setDefaultNavigationTimeout(15000); // Phase 30: 15s page load
                            
                            if (this.isShuttingDown) throw new Error('SHUTDOWN_IN_PROGRESS');
                            const products = await this.scout.scanBrowser(target, page);
                            allProducts = allProducts.concat(products);
                            this.siteFailures.set(target.site, 0); // Reset on success
                        } catch (e) {
                            if (e.message.includes('Target closed') || this.isShuttingDown) {
                                console.log(`[ORCHESTRATOR] Site ${target.site} skipped during shutdown.`);
                            } else {
                                throw e;
                            }
                        } finally {
                            if (!page.isClosed()) await page.close().catch(() => {});
                        }
                    }
                } catch (e) {
                    this.cycleMetrics.transientErrors++;
                    this.siteFailures.set(target.site, (this.siteFailures.get(target.site) || 0) + 1);
                    console.warn(`[ORCHESTRATOR] Site ${target.site} failure count: ${this.siteFailures.get(target.site)}`);
                }
            }

            this.cycleMetrics.signalsFound = allProducts.length;

            // Sequential processing to avoid CPU spikes
            for (const product of allProducts) {
                if (product.available) {
                    const signal = await this.processProduct(product, browser);
                    if (signal && ['STRONG BUY', 'BUY SMALL', 'WATCH'].includes(signal.execution?.verdict)) {
                        alertQueue.push(signal);
                    }
                }
            }

            // Phase 37: Alert Rate Control & Prioritization
            // 1. Sort by score DESC
            alertQueue.sort((a, b) => (b.intelligence?.score || 0) - (a.intelligence?.score || 0));
            
            // 2. Cap at 20 alerts per cycle
            const activeAlerts = alertQueue.slice(0, 20);
            
            for (const signal of activeAlerts) {
                const signalKey = `${signal.product.title}-${signal.product.price}`;
                const alertedAt = this.processedSignals.get(signalKey);
                
                if (!alertedAt || alertedAt === 0) {
                    await this.notifier.send(signal);
                    this.processedSignals.set(signalKey, Date.now());
                    this.notificationCount++;
                }
            }

            // Prepare Top 5 Actionable for Heartbeat
            this.cycleMetrics.topActionable = alertQueue
                .filter(s => s.risk?.worstCaseProfit >= -5)
                .slice(0, 5);

            // Phase 36: Mandatory Output Policy (Self-Healing Flow)
            if (this.notificationCount === 0 && this.cycleMetrics.signalsProcessed > 50) {
                console.log('⚠️ [PHASE 36] Zero-Output detected. Force-promoting Top 5 signals to WATCH.');
                
                // Combine and sort all processed signals by score
                const candidates = [...this.cycleMetrics.topWatch, ...this.cycleMetrics.topRejected]
                    .sort((a, b) => (b.intelligence?.score || 0) - (a.intelligence?.score || 0))
                    .slice(0, 5);

                for (const signal of candidates) {
                    signal.execution.verdict = 'WATCH';
                    signal.execution.reason = 'PHASE_36_FORCE_PROMOTE';
                    
                    const signalKey = `${signal.product.title}-${signal.product.price}`;
                    await this.notifier.send(signal);
                    this.processedSignals.set(signalKey, Date.now());
                    this.notificationCount++;
                    this.cycleMetrics.decisions['WATCH']++;
                }
            }

            // Phase 28: Adaptive Feedback Loop Logic
            const totalBuys = (this.cycleMetrics.decisions['STRONG BUY'] || 0) + (this.cycleMetrics.decisions['BUY SMALL'] || 0);
            
            if (totalBuys === 0) {
                this.emptyCycleCount++;
                if (this.emptyCycleCount >= 3 && !this.softModeActive) {
                    console.log('🔄 [ADAPTIVE] 3 empty cycles detected. Entering SOFT MODE for 2 cycles.');
                    this.softModeActive = true;
                }
            } else {
                this.emptyCycleCount = 0;
                this.softModeActive = false;
            }

        } finally {
            clearTimeout(cycleTimeout);
            await browser.close().catch(() => {});
            await this.sendHeartbeat('END');
        }
    }
}

module.exports = Orchestrator;
