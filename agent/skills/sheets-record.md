# Skill: Google Sheets Records

**Description**: Logs deal alerts and monitoring status changes to a central Google Spreadsheet for historical record-keeping and ROI analysis.

## Instructions

1. **Load Environment**: Access `GOOGLE_SHEETS_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` (path) from the `.env` file.
2. **Authorize**: Initialize the Google Sheets API client using a Service Account or OAuth2.
3. **Format Row**:
   - **Column A**: Timestamp (ISO-8601)
   - **Column B**: Site Name
   - **Column C**: Product Name
   - **Column D**: Status (Price Drop, Back in Stock, etc.)
   - **Column E**: Price ($)
   - **Column F**: URL Link
4. **Append**: Use `spreadsheets.values.append` to add the deal as a new row in the "Records" sheet.
5. **Verify**: Log a success message once the row is appended.

## Constraints

- **SHEET STRUCTURE**: Ensure the header row exists (Timestamp, Site, Product, Status, Price, Link) before the first append.
- **ERROR HANDLING**: If the Sheets API fails, log the error but do NOT block the Discord alert or monitoring process.
- **RATE LIMITS**: Respect Google API quotas; do not exceed 100 requests per 100 seconds per user.
