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
    
    // ENHANCED RESALE VALIDATION
    let resaleEvidence = 'Weak';
    let dataQuality = 'Assumed';
    let resaleConfidence = 'LOW';
    let evidenceScore = -30; // MAJOR penalty default
    
    const expectedResale = marketPrice || 0;
    let estimatedProfit = 0;
    let profitScore = 0;

    if (expectedResale > 0) {
        dataQuality = 'Listings Only'; // Bot scrapes Lowest Ask by default right now
        
        if (expectedResale > retailPrice * 1.5 || (expectedResale > retailPrice * 1.2 && brandStrength === 'High')) {
            resaleEvidence = 'Strong'; 
            resaleConfidence = 'HIGH'; // Upgrade to HIGH if massive gap on a strong brand
            evidenceScore = 5;
        } else if (expectedResale > retailPrice * 1.1) {
            resaleEvidence = 'Moderate';
            resaleConfidence = 'MEDIUM';
            evidenceScore = -10; // Still penalize slightly if just moderate listings
        } else {
            resaleEvidence = 'Weak';
            resaleConfidence = 'LOW';
            evidenceScore = -25;
        }
        
        estimatedProfit = (expectedResale * 0.88) - totalCost;
        if (estimatedProfit >= 25) { profitScore = 15; }
        else if (estimatedProfit >= 15) { profitScore = 5; }
        else if (estimatedProfit >= 5) { profitScore = -10; } // Thin profit penalty
        else { profitScore = -20; } 
    }

    // 4. LIQUIDITY
    let liquidity = 'Low';
    let liquidityScore = -10; // Slow liquidity penalty
    if (resaleConfidence === 'HIGH' && (isLimited || brandStrength === 'High' || categoryStrength === 'Strong')) { 
        liquidity = 'High'; liquidityScore = 10; 
    } else if (resaleConfidence === 'MEDIUM' || brandStrength === 'Medium') { 
        liquidity = 'Medium'; liquidityScore = 0; 
    }
    
    // 6. SIZE INTELLIGENCE (Default assumption based on category)
    let sizeIntelScore = 5; 

    // SCORING
    let finalScore = brandScore + discountScore + categoryScore + evidenceScore + profitScore + liquidityScore + sizeIntelScore;
    if (finalScore > 100) finalScore = 100;
    if (finalScore < 0) finalScore = 0;
    
    // DECISION RESTRICTIONS
    let verdict = 'SKIP';
    let recommendedUnits = 0;
    let riskLevel = 'High';
    let flipType = 'HOLD';
    let timeSensitivity = 'Low';
    let simulationConfidence = 'Low';
    
    // Base categorization before hard restrictions
    if (finalScore >= 80) { verdict = 'STRONG BUY'; recommendedUnits = 1; riskLevel = 'Low'; flipType = 'FAST'; timeSensitivity = 'Immediate'; simulationConfidence = 'High'; }
    else if (finalScore >= 65) { verdict = 'BUY SMALL'; recommendedUnits = 1; riskLevel = 'Medium'; timeSensitivity = 'Short'; simulationConfidence = 'Medium'; }
    else if (finalScore >= 50) { verdict = 'WATCH'; recommendedUnits = 0; riskLevel = 'Medium'; }

    // STRICT OVERRIDES
    // STRONG BUY allowed ONLY if: Profit >= $25 AND Resale Confidence = HIGH AND Liquidity = HIGH or MEDIUM
    if (verdict === 'STRONG BUY' && (estimatedProfit < 25 || resaleConfidence !== 'HIGH' || liquidity === 'Low')) {
        verdict = 'BUY SMALL';
        finalScore = Math.min(finalScore, 79);
        simulationConfidence = 'Medium';
    }
    
    // BUY SMALL allowed ONLY if: Profit >= $10 AND Resale Confidence >= MEDIUM
    if (verdict === 'BUY SMALL' && (estimatedProfit < 10 || resaleConfidence === 'LOW')) {
        verdict = 'WATCH';
        recommendedUnits = 0;
        finalScore = Math.min(finalScore, 64);
        simulationConfidence = 'Low';
    }

    // LOW Confidence block
    if (resaleConfidence === 'LOW') {
        if (verdict === 'STRONG BUY' || verdict === 'BUY SMALL') {
            verdict = 'WATCH';
            recommendedUnits = 0;
            finalScore = Math.min(finalScore, 50);
        }
    }
    
    // CAPTIAL RULES
    const data = getTradesData();
    const availableCap = data.portfolio;
    const maxPerItem = 150; 
    
    if (verdict === 'STRONG BUY' && liquidity === 'High' && (totalCost * 2) <= maxPerItem && estimatedProfit >= 30) {
        recommendedUnits = 2; 
    }

    // Enforce Budget
    if (availableCap - (totalCost * recommendedUnits) < 100) { 
        recommendedUnits = Math.floor((availableCap - 100) / totalCost);
        if (recommendedUnits <= 0 && (verdict === 'STRONG BUY' || verdict === 'BUY SMALL')) {
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
        discount, finalScore, verdict, recommendedUnits, tradeId, riskLevel, flipType, timeSensitivity, availableCap,
        resaleConfidence, dataQuality, simulationConfidence
    };
}

module.exports = { evaluateTrade, getTradesData };
