import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from bs4 import BeautifulSoup
import time
import re

app = FastAPI()

class Product(BaseModel):
    title: str
    price: float
    reviews: int
    description: str
    url: str

# 2. FINANCIAL EXTRACTION ENGINE
def parse_financial_value(text, pattern):
    """Extracts and normalizes dollar values (e.g., $1.97K -> 1970)"""
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return 0
    
    val_str = match.group(1).replace('$', '').replace(',', '').lower()
    multiplier = 1
    if 'k' in val_str:
        multiplier = 1000
        val_str = val_str.replace('k', '')
    
    try:
        return float(val_str) * multiplier
    except:
        return 0

def extract_financials(product: Product):
    text = (product.title + " " + product.description).lower()
    
    # regex for monthly revenue/profit
    rev_pattern = r'\$([\d,.]+[k]?)\s*(?:monthly)?\s*(?:revenue|sales)'
    prof_pattern = r'\$([\d,.]+[k]?)\s*(?:monthly)?\s*(?:profit|income|earnings)'

    rev = parse_financial_value(text, rev_pattern)
    prof = parse_financial_value(text, prof_pattern)
    
    return rev, prof

def analyze_resellability(product: Product):
    text = (product.title + " " + product.description).lower()
    adjustment = 0
    
    # 1. HARD REJECTION (Investable Guardrails)
    if product.price < 100:
        return None, "[LOW VALUE] Price too low (<$100)"

    fluff_keywords = ["avatar", "template", "course", "ebook", "3d model"]
    for fluff in fluff_keywords:
        if fluff in text:
            return None, f"Filtered: Non-investable asset ({fluff})"
            
    mandatory_signals = ["revenue", "profit", "sales"]
    if not any(sig in text for sig in mandatory_signals):
        return None, "[NO METRICS] No mention of revenue/profit/sales"

    # Gumroad Specific Hard Rejection
    if "gumroad.com" in product.url.lower():
        if product.reviews == 0:
            return None, "[REJECT] Gumroad product with no social proof"

    # 2. SOFT RISK DETECTION (Penalties)
    risk_keywords = {
        "affiliate site": -30,
        "content site": -30,
        "authority site": -20,
        "easy to scale": -10,
        "starter": -10
    }
    for kw, penalty in risk_keywords.items():
        if kw in text:
            print(f"[RESELL] Penalty: {kw} ({penalty})")
            adjustment += penalty

    if product.price < 200:
        print("[RESELL] Penalty: Price < 200 (-40)")
        adjustment -= 40

    # 3. POSITIVE SIGNALS (Boosts)
    boosts = {
        "recurring revenue": 15,
        "white label": 15,
        "agency license": 10,
        "profit mentioned": 10,
        "saas": 15,
        "margins": 10,
        "conversion rate": 10
    }
    for kw, boost in boosts.items():
        if kw in text:
            print(f"[RESELL] Boost: {kw} (+{boost})")
            adjustment += boost

    return adjustment, None

def score_flippa(product: Product, revenue: float, profit: float):
    print(f"[SCORE] Analyzing Flippa Asset: {product.title}")
    score = 70 
    
    if revenue > 0: score += 20
    if profit > 0: score += 15
    
    return score

def score_gumroad(product: Product, profit: float):
    print(f"[SCORE] Analyzing Gumroad Product: {product.title}")
    score = 80
    if product.reviews > 10: score += 10
    if profit > 0: score += 10
    return score

@app.post("/validate")
async def validate_product(product: Product):
    # 1. HARD REJECTION (Global Truth Gate)
    resell_adjust, reject_reason = analyze_resellability(product)
    if reject_reason:
        print(f"[TRUTH GATE] REJECTED: {reject_reason}")
        return {"approved": False, "confidence": 0, "reason": reject_reason}

    # 2. FINANCIAL EXTRACTION
    rev, prof = extract_financials(product)
    print(f"[FINANCIALS] Revenue: ${rev} | Profit: ${prof}")

    # 3. SOURCE DETECTION
    url = product.url.lower()
    source = "flippa" if "flippa.com" in url else "gumroad" if "gumroad.com" in url else "generic"

    # 4. BASE SCORING
    if source == "flippa":
        confidence = score_flippa(product, rev, prof)
    elif source == "gumroad":
        confidence = score_gumroad(product, prof)
    else:
        confidence = 60

    # 5. OVERLAY ADJUSTMENTS
    confidence += resell_adjust
    
    # 6. CONFIDENCE FLOOR LOGIC
    if rev == 0 and prof == 0:
        print("[LOG] FAKE HYPE DETECTED: No financial metrics found. Clamping to 70.")
        confidence = min(confidence, 70)

    # Final Clamp
    confidence = max(0, min(100, confidence))
    
    # 7. TIER CLASSIFICATION
    is_tier_a = confidence >= 93 and (rev >= 500 or prof >= 300)
    is_tier_b = confidence >= 88
    
    approved = is_tier_a or is_tier_b
    tier = "A" if is_tier_a else "B" if is_tier_b else "C"

    print(f"[TRUTH GATE] Tier: {tier} | Confidence: {confidence}% | Status: {'APPROVED' if approved else 'REJECTED'}")
    
    return {
        "approved": approved,
        "confidence": confidence,
        "tier": tier,
        "monthly_revenue": rev,
        "monthly_profit": prof,
        "reason": "Passed Investable Gate" if approved else f"Filtered: {tier} Tier too low ({confidence}%)"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
