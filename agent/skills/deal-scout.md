# Skill: Deal Scout & Website Monitor

**Description**: Monitors target URLs for price drops, "Limited Time" tags, and technical status changes (e.g., "Buy" button state).

## Instructions

1. **Plan**: Render the target URL using the 'Browser' tool.
2. **Identify**: Locate the price element and the "Buy" or "Add to Cart" button.
3. **Compare**:
   - Compare current price against `LastKnownPrice` (stored in history).
   - Flag if the price changes by **more than 10%**.
4. **Status Check**:
   - Check if the "Buy" or "Add to Cart" button is **disabled** or missing.
   - Look for "Sold Out", "Coming Soon", or "Limited Time" tags.
5. **Logic**:
   - Proceed to **Alert** if:
     - Price <= `TargetPrice` (from `config.json`).
     - Price drop > 10%.
     - "Buy" button status changes (e.g., from sold out to available).
     - "Limited" tag is present.
   - If No Change: Terminate execution immediately to save tokens.
6. **Alert**: Send a JSON payload to the Discord Bot Skill:

   ```json
   {
     "product": "Product Name",
     "status": "Available / Price Drop / Sold Out",
     "timestamp": "ISO-8601",
     "link": "https://...",
     "site": "Site Name",
     "price": 123.45
   }
   ```

## Constraints

- **NO TRANSACTIONS**: Do NOT click any buttons that initiate financial transactions.
- **DOMAIN LOCK**: Do NOT navigate away from the specified domain.
- **PII PROTECTION**: Do NOT extract or store any PII (emails, phone numbers).
- **BANDWIDTH**: Do NOT load high-res images or videos (use --no-media-mode).
- **REDUNDANCY**: Do NOT refresh more than once every 30 minutes for the same URL.
