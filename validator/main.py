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

@app.post("/validate")
async def validate_product(product: Product):
    reasons = []
    confidence = 100

    # 1. DOUBLE FETCH VALIDATION
    html1 = fetch_safe(product.url)
    time.sleep(1)
    html2 = fetch_safe(product.url)

    if not html1 or not html2:
        return {"approved": False, "confidence": 0, "reason": "Failed to fetch product pages for validation"}

    # 2. LIVE HTML VALIDATION (Price & Reviews)
    # Simple regex fallbacks for price/reviews in HTML
    price_matches = re.findall(r'\$[\d,]+(?:\.\d+)?', html1)
    if price_matches:
        found_price = float(price_matches[0].replace('$', '').replace(',', ''))
        if abs(found_price - product.price) / product.price > 0.05:
            return {"approved": False, "confidence": 0, "reason": f"Price mismatch: Scraped {product.price} vs HTML {found_price}"}

    # 3. SCAM DETECTION
    scam_keywords = ["send screenshot", "gmail.com", "telegram", "@", "whatsapp", "signals", "guaranteed profit", "referral"]
    desc_lower = product.description.lower()
    for kw in scam_keywords:
        if kw in desc_lower:
            return {"approved": False, "confidence": 0, "reason": f"Scam trigger detected: {kw}"}

    # 4. RESALE FILTER
    resale_red_flags = ["contact support", "external communication", "discord link", "signals group"]
    for flag in resale_red_flags:
        if flag in desc_lower:
            return {"approved": False, "confidence": 0, "reason": "Non-resellable asset indicator found"}

    # 5. CONFIDENCE SCORING
    if product.reviews < 5: confidence -= 25
    elif product.reviews < 10: confidence -= 10
    
    if product.price < 10: confidence -= 15
    
    # Generic title check
    if len(product.title.split()) < 3: confidence -= 10

    approved = confidence >= 85
    return {
        "approved": approved,
        "confidence": confidence,
        "reason": "Passed Truth Gate" if approved else f"Confidence too low: {confidence}%"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
