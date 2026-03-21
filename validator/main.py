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

@app.post("/validate")
async def validate_product(product: Product):
    reasons = []
    confidence = 100

    # 1. DOUBLE FETCH VALIDATION
    html1 = fetch_safe(product.url)
    if not html1:
        return {"approved": False, "confidence": 0, "reason": "Failed to fetch product pages for validation"}

    # 2. LIVE HTML VALIDATION (Price & Reviews)
    price_matches = re.findall(r'\$[\d,]+(?:\.\d+)?', html1)
    if price_matches:
        prices = [float(p.replace('$', '').replace(',', '')) for p in price_matches]
        match_found = any(abs(p - product.price) / product.price <= 0.10 for p in prices)
        if not match_found:
            return {"approved": False, "confidence": 0, "reason": f"Price not verified on page. Scraped: {product.price}"}

    # 3. SCAM DETECTION
    scam_keywords = ["send screenshot", "gmail.com", "telegram", "@", "whatsapp", "signals", "guaranteed profit", "referral"]
    desc_lower = product.description.lower()
    for kw in scam_keywords:
        if kw in desc_lower:
            return {"approved": False, "confidence": 0, "reason": f"Scam trigger detected: {kw}"}

    # 4. BASE CONFIDENCE SCORING
    if product.reviews < 5: confidence -= 25
    elif product.reviews < 10: confidence -= 10
    if product.price < 10: confidence -= 15
    if len(product.title.split()) < 3: confidence -= 10

    # 5. RESALE INTELLIGENCE LAYER (New)
    resell_adjust, reject_reason = analyze_resellability(product)
    if reject_reason:
        return {"approved": False, "confidence": 0, "reason": reject_reason}
    
    confidence += resell_adjust
    
    # Final Clamp & Decision
    confidence = max(0, min(100, confidence))
    approved = confidence >= 85
    
    return {
        "approved": approved,
        "confidence": confidence,
        "reason": "Passed Truth Gate" if approved else f"Confidence too low: {confidence}%"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
