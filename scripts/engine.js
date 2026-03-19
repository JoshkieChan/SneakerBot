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
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * 14-STEP AUTONOMOUS DECISION ENGINE
 */
function evaluateTrade(title, currentPrice, marketPrice, isLimited, isRestock, originalPrice = null) {
    const config = loadConfig();
    const titleL = title.toLowerCase();
    let score = 0;
    let logs = [];

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

    // STEP 4 — SIZE INTELLIGENCE
    // Logic: Favor M/L/XL. Penalize S/XS. XXL conditional.
    // For this engine, we assume the variant being checked is the one passed.
    // However, since we scan the whole products.json, we look for the "Alpha" sizes.
    const fastestSizes = config.EliteSizes.join(', ');
    const remainingSizes = "S, XXL";
    let sizeVerdict = "Neutral";
    let sizeScore = config.SizeWeighting["L"] || 10; // Default to neutral Large weight
    score += sizeScore;

    // STEP 5 — DISCOUNT ANALYSIS
    let discountPercent = 0;
    if (originalPrice && originalPrice > currentPrice) {
        discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }
    
    if (discountPercent >= config.DiscountRules.Strong.min) {
        score += config.DiscountRules.Strong.scoreBoost;
    } else if (discountPercent >= config.DiscountRules.Moderate.min) {
        score += config.DiscountRules.Moderate.scoreBoost;
    } else {
        score += config.DiscountRules.Weak.scorePenalty;
    }

    // STEP 6 — RESALE VALIDATION (CRITICAL)
    let dataQuality = 'Listings Only'; // Scraper default
    let resaleConfidence = 'Medium';
    let resaleEvidence = 'Moderate';

    // Anti-Hype Logic
    if (config.AntiHypeFilters.RequireResaleEvidence && !marketPrice) {
        resaleConfidence = 'Low';
        resaleEvidence = 'Weak';
        score += config.AntiHypeFilters.NoSalesDataPenalty;
    } else if (marketPrice) {
        score += config.AntiHypeFilters.ListingsOnlyPenalty; 
    }

    // Resale Confidence Penalty
    score += config.ResaleConfidencePenalty[resaleConfidence] || -15;

    // STEP 7 — PROFIT CALCULATION
    const estimatedShipping = config.EstimatedShipping || 12;
    const totalCost = currentPrice + estimatedShipping;
    const platformFee = config.PlatformFeePercent / 100;
    
    const expectedResale = marketPrice || 0;
    const payout = expectedResale * (1 - platformFee);
    const estimatedProfit = expectedResale > 0 ? (payout - totalCost) : 0;

    if (estimatedProfit >= config.StrongProfitThreshold) {
        score += 20; // Internal boost for high margin
    } else if (estimatedProfit < config.MinProfitThreshold) {
        score -= 20; // Internal penalty for thin margin
    }

    // STEP 8 — LIQUIDITY ANALYSIS
    let liquidity = 'Medium';
    if (brandWeight >= 10 && estimatedProfit >= 25) {
        liquidity = 'High';
        score += config.LiquidityRules.High.scoreBoost;
    } else {
        liquidity = 'Low';
        score += config.LiquidityRules.Low.scorePenalty;
    }

    // STEP 9 — SCORING ENGINE (Final normalization)
    let finalScore = Math.max(0, Math.min(100, score));

    // STEP 10 — DECISION LOGIC
    let verdict = 'SKIP';
    const rules = config.ExecutionRules;

    if (finalScore >= rules.StrongBuy.minScore && estimatedProfit >= rules.StrongBuy.minProfit && resaleConfidence === 'High') {
        verdict = 'STRONG BUY';
    } else if (finalScore >= rules.StrongBuy.minScore && estimatedProfit >= rules.StrongBuy.minProfit) {
        // Downgrade if confidence isn't HIGH
        verdict = 'BUY SMALL';
    } else if (finalScore >= rules.BuySmall.minScore && estimatedProfit >= rules.BuySmall.minProfit) {
        verdict = 'BUY SMALL';
    } else if (finalScore >= rules.Watch.minScore) {
        verdict = 'WATCH';
    }

    // STRICT RULE: If Resale Confidence = LOW -> STRONG BUY is NOT allowed
    if (resaleConfidence === 'Low' && verdict === 'STRONG BUY') {
        verdict = 'BUY SMALL';
    }

    // STEP 11 — CAPITAL SIMULATION
    const tradesData = getTradesData();
    const portfolio = tradesData.portfolio;
    const maxPerTrade = portfolio * config.MaxCapitalPerTradePercent;
    let recommendedUnits = 0;

    if (verdict === 'STRONG BUY' || verdict === 'BUY SMALL') {
        recommendedUnits = 1;
        if (verdict === 'STRONG BUY' && finalScore >= 90 && liquidity === 'High') {
            recommendedUnits = 2;
        }
        
        const totalTradeCost = totalCost * recommendedUnits;
        const remainingCapPercent = (portfolio - totalTradeCost) / 500; // Original 500 baseline

        if (totalTradeCost > maxPerTrade || remainingCapPercent < config.MinRemainingCapitalPercent) {
            verdict = 'SKIP (Capital Limit)';
            recommendedUnits = 0;
        }
    }

    // STEP 12 — TRADE SIMULATION
    let tradeId = 'N/A';
    if (recommendedUnits > 0) {
        tradeId = 'TRD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        saveTrade({
            id: tradeId,
            item: title,
            buyPrice: totalCost,
            units: recommendedUnits,
            estimatedResale: expectedResale,
            expectedProfit: Math.round(estimatedProfit * recommendedUnits),
            dateOpened: new Date().toISOString()
        });
    }

    // STEP 13/14 — OUTPUT PREP
    return {
        brand: title.split(' ')[0],
        totalCost,
        category: (titleL.includes('jacket') || titleL.includes('hoodie')) ? 'Outerwear' : 'Clothing',
        discount: discountPercent,
        brandStrength: brandWeight >= 10 ? 'High' : 'Medium',
        categoryStrength: (titleL.includes('jacket') || titleL.includes('hoodie')) ? 'Strong' : 'Medium',
        liquidity,
        fastestSizes,
        remainingSizes,
        sizeVerdict: (titleL.includes('jacket') || titleL.includes('hoodie')) ? 'Favorable' : 'Neutral',
        resaleEvidence,
        expectedResale,
        estimatedProfit,
        flipType: liquidity === 'High' ? 'FAST' : 'HOLD',
        recommendedUnits,
        riskLevel: finalScore >= 80 ? 'Low' : 'Medium',
        timeSensitivity: finalScore >= 80 ? 'Immediate' : 'Short',
        finalScore,
        dataQuality,
        resaleConfidence,
        simulationConfidence: finalScore >= 85 ? 'High' : 'Medium',
        verdict,
        tradeId,
        availableCap: portfolio
    };
}

module.exports = { evaluateTrade, getTradesData };
