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

def fetch_safe(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        return response.text if response.status_code == 200 else None
    except:
        return None

def analyze_resellability(product: Product):
    """
    Advanced layer to filter for 'flipped' potential.
    Returns (score_adjustment, rejection_reason)
    """
    text = (product.title + " " + product.description).lower()
    adjustment = 0
    
    # 1. HARD REJECTION (Legal Blockers)
    legal_blockers = [
        "personal use only", "not for resale", "no resale", 
        "non-transferable", "single user license", "cannot be redistributed"
    ]
    for blocker in legal_blockers:
        if blocker in text:
            return None, f"Resale prohibited by license: {blocker}"

    # 2. SOFT RISK DETECTION (Penalties)
    risk_keywords = {
        "notion template": -15,
        "template": -10,
        "course": -20,
        "ebook": -20,
        "digital download": -10
    }
    for kw, penalty in risk_keywords.items():
        if kw in text:
            print(f"[RESELL] Penalty: {kw} ({penalty})")
            adjustment += penalty

    # 3. POSITIVE RESALE SIGNALS (Boosts)
    boost_keywords = {
        "commercial use": 15,
        "resell rights": 25,
        "agency license": 20,
        "unlimited use": 10,
        "lifetime access": 10,
        "white label": 25
    }
    for kw, boost in boost_keywords.items():
        if kw in text:
            print(f"[RESELL] Boost: {kw} (+{boost})")
            adjustment += boost

    # 4. MARKET SATURATION HEURISTIC
    if product.reviews > 100 and product.price < 50:
        print("[RESELL] Penalty: High saturation detected (-10)")
        adjustment -= 10

    return adjustment, None

def score_flippa(product: Product):
    print(f"[SCORE] Using Flippa Investment Logic for: {product.title}")
    score = 70  # Base investment score
    text = (product.title + " " + product.description).lower()

    # POSITIVE SIGNALS
    if "revenue" in text or "profit" in text:
        print("[SCORE] +10: Revenue/Profit proof mentioned")
        score += 10
    if "saas" in text:
        print("[SCORE] +15: SaaS Architecture")
        score += 15
    if "recurring" in text:
        print("[SCORE] +10: Recurring Revenue potential")
        score += 10
    if "automation" in text or "ai" in text:
        print("[SCORE] +5: Tech automation/AI leverage")
        score += 5

    # NEGATIVE SIGNALS
    if "starter" in text or "beginner" in text:
        print("[SCORE] -10: Low-barrier starter site")
        score -= 10
    if "no revenue" in text:
        print("[SCORE] -20: Unset revenue status")
        score -= 20

    return score

def score_gumroad(product: Product):
    print(f"[SCORE] Using Gumroad Product Logic for: {product.title}")
    score = 100 # Base product score
    
    if product.reviews < 5:
        print("[SCORE] -20: Low community trust (<5 reviews)")
        score -= 20
    elif product.reviews < 10:
        print("[SCORE] -10: Moderate community trust (<10 reviews)")
        score -= 10

    if product.price < 10:
        print("[SCORE] -10: Low-ticket price point")
        score -= 10

    text = (product.title + " " + product.description).lower()
    if "template" in text:
        print("[SCORE] -10: Template product penalty")
        score -= 10
    if "commercial use" in text:
        print("[SCORE] +10: Commercial utility boost")
        score += 10

    return score

@app.post("/validate")
async def validate_product(product: Product):
    # 1. HARD REJECTION (Global Truth Gate)
    html1 = fetch_safe(product.url)
    if not html1:
        return {"approved": False, "confidence": 0, "reason": "Failed to fetch product pages for validation"}

    # License/Legal Check (Phase 61 Hard Blocks)
    resell_adjust, reject_reason = analyze_resellability(product)
    if reject_reason:
        return {"approved": False, "confidence": 0, "reason": reject_reason}

    # 2. SOURCE DETECTION
    url = product.url.lower()
    if "flippa.com" in url:
        source = "flippa"
    elif "gumroad.com" in url:
        source = "gumroad"
    else:
        source = "generic"

    # 3. APPLY SOURCE-SPECIFIC SCORING
    if source == "flippa":
        confidence = score_flippa(product)
        threshold = 75
    elif source == "gumroad":
        confidence = score_gumroad(product)
        threshold = 80
    else:
        confidence = 70
        threshold = 85

    # 4. OVERLAY RESALE INTELLIGENCE (Phase 61 Soft adjustments)
    # We apply the adjustments from Phase 61 on top of the base
    confidence += (resell_adjust or 0)
    
    # Final Clamp
    confidence = max(0, min(100, confidence))
    approved = confidence >= threshold
    
    print(f"[TRUTH GATE] Source: {source} | Confidence: {confidence}% | Threshold: {threshold}%")
    
    return {
        "approved": approved,
        "confidence": confidence,
        "reason": "Passed Truth Gate" if approved else f"Confidence too low: {confidence}% (Threshold: {threshold}%)"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
