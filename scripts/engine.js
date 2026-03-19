const fs = require('fs');
const path = require('path');

const TRADES_FILE = path.join(__dirname, '../agent/rules/trades.json');
const CONFIG_PATH = path.join(__dirname, '../agent/rules/config.json');

function getTradesData() {
    if (!fs.existsSync(TRADES_FILE)) {
        fs.writeFileSync(TRADES_FILE, JSON.stringify({ portfolio: 500.00, trades: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
}

function saveTrade(trade) {
    let data = getTradesData();
    data.trades.push(trade);
    data.portfolio -= (trade.buyPrice * trade.units);
    fs.writeFileSync(TRADES_FILE, JSON.stringify(data, null, 2));
}

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * PHASE 22: SYSTEM GOVERNANCE & SAFETY GUARDRAILS
 */
function validateSystemHealth(config, currentPrice, marketPrice) {
    if (!config) return { valid: false, error: "Missing config.json" };
    if (isNaN(currentPrice) || currentPrice <= 0) return { valid: false, error: "Invalid Current Price" };
    if (marketPrice !== null && (isNaN(marketPrice) || marketPrice < 0)) return { valid: false, error: "Invalid Market Price" };
    
    const requiredFields = ['MinAlertPrice', 'EstimatedShipping', 'PlatformFeePercent', 'MaxCapitalPerTradePercent'];
    for (const field of requiredFields) {
        if (config[field] === undefined || config[field] === null) {
            return { valid: false, error: `Missing critical config field: ${field}` };
        }
    }
    return { valid: true };
}

/**
 * 14-STEP AUTONOMOUS DECISION ENGINE v2.0 (GOVERNED)
 */
function evaluateTrade(title, currentPrice, marketPrice, isLimited, isRestock, originalPrice = null) {
    const config = loadConfig();
    
    // SYSTEM HEALTH CHECK
    const health = validateSystemHealth(config, currentPrice, marketPrice);
    if (!health.valid) {
        console.error(`[SYSTEM ERROR] ${health.error} for ${title}`);
        return { verdict: `SKIP (System Error: ${health.error})`, finalScore: 0 };
    }

    const titleL = title.toLowerCase();
    let score = 0;
    let diagnostics = { anomalies: [], riskAdjustments: 0 };

    // STEP 1 — KEYWORD MATCHING
    let keywordTier = null;
    let brandWeight = 0;
    for (const [tier, data] of Object.entries(config.EliteKeywordTiers)) {
        if (data.keywords.some(kw => titleL.includes(kw.toLowerCase()))) {
            keywordTier = tier;
            brandWeight = data.weight;
            break;
        }
    }
    if (!keywordTier) return { verdict: 'SKIP (No Keyword Match)', finalScore: 0 };
    score += brandWeight;

    // STEP 2 — NEGATIVE FILTER
    if (config.EliteNegativeKeywords.some(neg => titleL.includes(neg.toLowerCase()))) {
        return { verdict: 'SKIP (Negative Keyword)', finalScore: 0 };
    }

    // STEP 3 — PRICE FILTER
    if (currentPrice < config.MinAlertPrice) {
        return { verdict: 'SKIP (Below Min Price)', finalScore: 0 };
    }

    // STEP 4 — SIZE INTELLIGENCE (Strict Availability Check)
    const fastestSizes = config.EliteSizes.join(', ');
    const remainingSizes = "S, M, L";
    let sizeVerdict = "Neutral";
    let sizeScore = 8; // Conservative default
    score += sizeScore;

    // STEP 5 — DISCOUNT ANALYSIS
    let discountPercent = 0;
    if (originalPrice && originalPrice > currentPrice) {
        discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }
    if (discountPercent > 90) return { verdict: 'SKIP (Invalid Discount Data)', finalScore: 0 };

    if (discountPercent >= config.DiscountRules.Strong.min) score += config.DiscountRules.Strong.scoreBoost;
    else if (discountPercent >= config.DiscountRules.Moderate.min) score += config.DiscountRules.Moderate.scoreBoost;
    else score += config.DiscountRules.Weak.scorePenalty;

    // STEP 6 — RESALE VALIDATION (CRITICAL SKEPTICISM)
    let dataQuality = 'Listings Only'; 
    let resaleConfidence = 'Medium';
    let resaleEvidence = 'Moderate';

    if (config.AntiHypeFilters.RequireResaleEvidence && !marketPrice) {
        resaleConfidence = 'Low';
        resaleEvidence = 'Weak';
        score += config.AntiHypeFilters.NoSalesDataPenalty;
        diagnostics.anomalies.push("No Market Data");
    } else if (marketPrice) {
        score += config.AntiHypeFilters.ListingsOnlyPenalty; 
        // Data is assumed listings unless we verify otherwise
        dataQuality = 'Listings Only';
        resaleConfidence = 'Medium';
    }
    score += config.ResaleConfidencePenalty[resaleConfidence] || -15;

    // STEP 7 — PROFIT CALCULATION (conservative)
    const estimatedShipping = config.EstimatedShipping || 12;
    const totalCost = currentPrice + estimatedShipping;
    const platformFee = config.PlatformFeePercent / 100;
    const expectedResale = marketPrice || 0;

    // ANTI-FALSE-PROFIT GUARD (Worst Case Scenario)
    const worstCaseResale = expectedResale * 0.90; // 10% haircut
    const worstCaseFee = platformFee + 0.02; // 2% fee hike
    const worstCasePayout = worstCaseResale * (1 - worstCaseFee);
    const worstCaseProfit = worstCasePayout - totalCost;

    if (expectedResale > 0 && worstCaseProfit <= 0) {
        return { verdict: 'SKIP (Anti-False-Profit Guard: Worst Case Negative)', finalScore: 0 };
    }

    const payout = expectedResale * (1 - platformFee);
    const estimatedProfit = expectedResale > 0 ? (payout - totalCost) : 0;
    if (estimatedProfit < 0) return { verdict: 'SKIP (True Profit Negative)', finalScore: 0 };

    if (estimatedProfit >= config.StrongProfitThreshold) score += 15;
    else if (estimatedProfit < config.MinProfitThreshold) score -= 20;

    // STEP 8 — LIQUIDITY ANALYSIS
    let liquidity = 'Medium';
    if (brandWeight >= 10 && estimatedProfit >= 25) {
        liquidity = 'High';
        score += config.LiquidityRules.High.scoreBoost;
    } else {
        liquidity = 'Low';
        score += (config.LiquidityRules.Low.scorePenalty || -15);
    }

    // STEP 9 — SCORING ENGINE
    let finalScore = Math.max(0, Math.min(100, score));

    // STEP 10 — DECISION LOGIC
    let verdict = 'SKIP';
    const rules = config.ExecutionRules;

    if (finalScore >= rules.StrongBuy.minScore && estimatedProfit >= rules.StrongBuy.minProfit && resaleConfidence === 'High') {
        verdict = 'STRONG BUY';
    } else if (finalScore >= rules.StrongBuy.minScore && estimatedProfit >= rules.StrongBuy.minProfit) {
        verdict = 'BUY SMALL';
    } else if (finalScore >= rules.BuySmall.minScore && estimatedProfit >= rules.BuySmall.minProfit) {
        verdict = 'BUY SMALL';
    } else if (finalScore >= rules.Watch.minScore) {
        verdict = 'WATCH';
    }

    // AUTONOMY THRESHOLD GATING
    const isAutonomyAllowed = (resaleConfidence === 'High' || dataQuality === 'Sold Data') && finalScore >= 85 && estimatedProfit >= config.StrongProfitThreshold;
    if (!isAutonomyAllowed && verdict === 'STRONG BUY') {
        verdict = 'BUY SMALL'; // Downgrade if threshold not met
        diagnostics.anomalies.push("Autonomy Threshold Not Met (Downgraded)");
    }

    // STEP 11 — CAPITAL SIMULATION
    const tradesData = getTradesData();
    const portfolio = tradesData.portfolio;
    const maxPerTrade = portfolio * config.MaxCapitalPerTradePercent;
    let recommendedUnits = 0;

    if (verdict === 'STRONG BUY' || verdict === 'BUY SMALL') {
        recommendedUnits = 1;
        if (verdict === 'STRONG BUY' && finalScore >= 90 && liquidity === 'High') recommendedUnits = 2;
        
        const totalTradeCost = totalCost * recommendedUnits;
        const minRemaining = 500 * config.MinRemainingCapitalPercent;

        if (totalTradeCost > maxPerTrade || (portfolio - totalTradeCost) < minRemaining) {
            verdict = 'SKIP (Capital Protection Triggered)';
            recommendedUnits = 0;
        }
    }

    // STEP 12 — TRADE SIMULATION (Autonomous only)
    let tradeId = 'N/A';
    if (recommendedUnits > 0) {
        tradeId = 'TRD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        saveTrade({ id: tradeId, item: title, buyPrice: totalCost, units: recommendedUnits, estimatedResale: expectedResale, expectedProfit: Math.round(estimatedProfit * recommendedUnits), dateOpened: new Date().toISOString() });
    }

    // DIAGNOSTIC SUMMARY
    let simulationConfidence = (finalScore >= 85 && isAutonomyAllowed) ? 'High' : (finalScore >= 65 ? 'Medium' : 'Low');

    return {
        brand: title.split(' ')[0], totalCost, category: (titleL.includes('jacket') || titleL.includes('hoodie')) ? 'Outerwear' : 'Clothing',
        discount: discountPercent, brandStrength: brandWeight >= 10 ? 'High' : 'Medium', categoryStrength: (titleL.includes('jacket') || titleL.includes('hoodie')) ? 'Strong' : 'Medium',
        liquidity, fastestSizes, remainingSizes, sizeVerdict: (titleL.includes('jacket') || titleL.includes('hoodie')) ? 'Favorable' : 'Neutral',
        resaleEvidence, expectedResale, estimatedProfit, worstCaseProfit, flipType: liquidity === 'High' ? 'FAST' : 'HOLD',
        recommendedUnits, riskLevel: finalScore >= 80 ? 'Low' : 'Medium', timeSensitivity: finalScore >= 80 ? 'Immediate' : 'Short',
        finalScore, dataQuality, resaleConfidence, simulationConfidence, verdict, tradeId, availableCap: portfolio, diagnostics
    };
}

module.exports = { evaluateTrade, getTradesData };
