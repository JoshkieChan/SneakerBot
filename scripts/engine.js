const fs = require('fs');
const path = require('path');

const TRADES_FILE = path.join(__dirname, '../agent/rules/trades.json');

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

function evaluateTrade(title, retailPrice, marketPrice, isLimited, isRestock, originalPrice = null) {
    const titleL = title.toLowerCase();
    
    // 1. BRAND STRENGTH
    let brandStrength = 'Low';
    let brandScore = 0;
    const strongBrands = ['jordan', 'travis scott', 'off-white', 'kobe', 'chrome hearts', 'supreme', 'asics'];
    const medBrands = ['stussy', 'fear of god', 'essentials', 'kith', 'dunk sb', 'new balance', 'sp5der', 'bape'];
    
    if (strongBrands.some(b => titleL.includes(b))) { brandStrength = 'High'; brandScore = 20; }
    else if (medBrands.some(b => titleL.includes(b))) { brandStrength = 'Medium'; brandScore = 12; }
    else { brandScore = 5; }
    
    // 2. DISCOUNT QUALITY
    let discount = 0;
    let discountScore = 0;
    if (originalPrice && originalPrice > retailPrice) {
        discount = Math.round(((originalPrice - retailPrice) / originalPrice) * 100);
    }
    if (discount >= 30) { discountScore = 15; }
    else if (discount >= 15) { discountScore = 8; }
    
    // 3. CATEGORY STRENGTH
    let categoryStrength = 'Weak';
    let categoryScore = 0;
    if (titleL.includes('jacket') || titleL.includes('hoodie') || titleL.includes('outerwear') || titleL.includes('jordan 1') || titleL.includes('kobe') || isLimited) {
        categoryStrength = 'Strong'; categoryScore = 15;
    } else if (titleL.includes('pant') || titleL.includes('crewneck') || titleL.includes('sweat')) {
        categoryStrength = 'Medium'; categoryScore = 8;
    } else {
        categoryStrength = 'Weak'; categoryScore = -5; // Penalty for weak basics
    }

    // 8. PRICE GAP CALCULATION
    const tax = retailPrice * 0.08;
    const shipping = 10.00;
    const totalCost = retailPrice + tax + shipping;
    
    let resaleEvidence = 'Weak';
    let evidenceScore = -25; // MAJOR penalty by default (Anti-Hype Filter)
    
    const expectedResale = marketPrice || 0;
    let estimatedProfit = 0;
    let profitScore = 0;

    if (expectedResale > 0) {
        if (expectedResale > retailPrice * 1.2) {
            resaleEvidence = 'Strong'; evidenceScore = 20;
        } else if (expectedResale >= retailPrice) {
            resaleEvidence = 'Moderate'; evidenceScore = 5;
        }
        
        estimatedProfit = (expectedResale * 0.88) - totalCost;
        if (estimatedProfit >= 25) { profitScore = 25; }
        else if (estimatedProfit >= 5) { profitScore = 10; }
        else { profitScore = -15; } // Penalty for thin/no margin
    }

    // 4. LIQUIDITY
    let liquidity = 'Low';
    let liquidityScore = -10;
    if (resaleEvidence === 'Strong' && (isLimited || brandStrength === 'High')) { liquidity = 'High'; liquidityScore = 15; }
    else if (resaleEvidence === 'Moderate' || brandStrength === 'Medium') { liquidity = 'Medium'; liquidityScore = 5; }
    
    // 6. SIZE INTELLIGENCE (Default assumption based on category)
    let sizeIntelScore = 5; // Default assumption that M/L/XL is prioritized

    // SCORING
    let finalScore = brandScore + discountScore + categoryScore + evidenceScore + profitScore + liquidityScore + sizeIntelScore;
    if (finalScore > 100) finalScore = 100;
    if (finalScore < 0) finalScore = 0;
    
    // CAPTIAL RULES
    const data = getTradesData();
    const availableCap = data.portfolio;
    const maxPerItem = 150; // 30% of 500 max
    
    let verdict = 'SKIP';
    let recommendedUnits = 0;
    let riskLevel = 'High';
    let flipType = 'FAST';
    let timeSensitivity = 'Immediate';
    
    if (finalScore >= 80) { verdict = 'STRONG BUY'; recommendedUnits = 1; riskLevel = 'Low'; }
    else if (finalScore >= 65) { verdict = 'BUY SMALL'; recommendedUnits = 1; riskLevel = 'Medium'; }
    else if (finalScore >= 50) { verdict = 'WATCH'; recommendedUnits = 0; riskLevel = 'Medium'; timeSensitivity = 'Low'; }
    
    if (finalScore >= 90 && liquidity === 'High' && (totalCost * 2) <= maxPerItem) {
        recommendedUnits = 2; 
    }
    
    if (categoryStrength === 'Strong' && liquidity === 'High') { flipType = 'FAST'; }
    else { flipType = 'HOLD'; }

    // Enforce Budget
    if (availableCap - (totalCost * recommendedUnits) < 100) { // Maintain 20% unused rule
        recommendedUnits = Math.floor((availableCap - 100) / totalCost);
        if (recommendedUnits <= 0) {
            verdict = 'SKIP (Capital Limit Reached)';
            recommendedUnits = 0;
        }
    }

    let tradeId = 'N/A';
    if (recommendedUnits > 0) {
        tradeId = 'TRD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        saveTrade({
            id: tradeId,
            item: title,
            buyPrice: totalCost,
            units: recommendedUnits,
            estimatedResale: expectedResale,
            expectedProfit: estimatedProfit * recommendedUnits,
            dateOpened: new Date().toISOString()
        });
    }

    return {
        brandStrength, categoryStrength, liquidity, resaleEvidence, expectedResale, estimatedProfit, totalCost,
        discount, finalScore, verdict, recommendedUnits, tradeId, riskLevel, flipType, timeSensitivity, availableCap
    };
}

module.exports = { evaluateTrade, getTradesData };
