# Google Sheets Integration - Dell Monitor Scraping

## What's Ready ✅

**Your workflow is now automated:**
1. You manually scrape HTML from Dell pages (page 2, 3, etc.)
2. You add new rows to Google Sheet with Model + Product URL
3. AI reads your Sheet, identifies missing data
4. AI visits Dell pages and fills in specifications
5. AI updates your Google Sheet automatically

## Files Created

| File | Purpose |
|------|---------|
| **google-sheets-integration.js** | Main integration script |
| **GOOGLE_SHEETS_SETUP.md** | Complete setup guide |
| **GOOGLE_SHEETS_README.md** | Quick reference |
| **GOOGLE_SHEETS_QUICKSTART.sh** | Interactive helper |
| **.gitignore** | Added google-credentials.json |

## Installation Status

✅ google-spreadsheet package installed (v4.1.5)
✅ Integration scripts created
✅ Security configured (.gitignore updated)

## Quick Start (3 Steps)

### Step 1: Setup Google Credentials (5 minutes, one-time)

1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable "Google Sheets API"
4. Create a Service Account:
   - Name: `dell-scraper`
   - Description: `Dell monitor data scraper`
5. Create and download JSON key
6. Save as `google-credentials.json` in this directory

**Security:** Never commit this file or share it publicly!

### Step 2: Create Google Sheet

```bash
node google-sheets-integration.js create "Dell Monitors Malaysia"
```

This will:
- Create a new Google Sheet
- Copy all 76 cached products from `product-cache/monitor/dell/`
- Set up headers (Model, Brief Name, Size, Resolution, etc.)
- Display the Sheet URL

### Step 3: Share Sheet with Service Account

1. Open the created Google Sheet
2. Click "Share"
3. Add the service account email from `google-credentials.json`
4. Give it **Editor** permissions
5. Set Sheet ID:
   ```bash
   export GOOGLE_SHEET_ID='your-sheet-id'
   ```

## Usage

### Read from Sheet
```bash
node google-sheets-integration.js read
```

### Fill Missing Information
```bash
node google-sheets-integration.js fill
```

This will:
- Read all products from your Google Sheet
- Identify rows with missing data
- Visit Dell product pages
- Fill in specifications (Size, Resolution, Refresh Rate, Response Time, Ports, Warranty)
- Update the Google Sheet automatically

## Your Daily Workflow

**Morning:**
```bash
# 1. Open Google Sheets
# 2. Add new rows manually (Model + Product URL)
# 3. Run fill script
node google-sheets-integration.js fill
```

**Afternoon:**
```bash
# Check what's complete
node google-sheets-integration.js read
```

**Result:**
- Google Sheet has complete specifications
- Cache files updated automatically
- Excel file ready for export

## Google Sheet Structure

| Column | Required? | Description |
|--------|-----------|-------------|
| Model | ✅ Yes | P2425H, SE2225HM, etc. |
| Brief Name | ❌ No | Dell Pro 24 Plus Monitor |
| Size | ❌ Auto | 23.8 Inch |
| Resolution | ❌ Auto | 1920 x 1080 |
| Refresh Rate | ❌ Auto | 60Hz |
| Response Time | ❌ Auto | 8ms |
| Ports | ❌ Auto | HDMI, DisplayPort, VGA |
| Warranty | ❌ Auto | 3 Years Limited... |
| Product URL | ✅ Yes | https://www.dell.com/... |

**Required columns:** Model, Product URL
**Auto-filled:** All other columns

## Example

**You add to Google Sheet:**
```
Model: SE2725HM
Product URL: https://www.dell.com/en-my/shop/dell-27-monitor-se2725hm/apd/210-bqlh/monitors-monitor-accessories
```

**AI fills automatically:**
```
Model: SE2725HM
Brief Name: Dell 27 Monitor
Size: 27 Inch
Resolution: 1920 x 1080
Refresh Rate: 100Hz
Response Time: 8ms
Ports: 1 HDMI port (HDCP 1.4), 1 VGA port
Warranty: 3 Years Limited Hardware and Advanced Exchange Service
Product URL: https://www.dell.com/en-my/shop/dell-27-monitor-se2725hm/apd/210-bqlh/monitors-monitor-accessories
```

## Current Cache Status

**76 products** already cached in `product-cache/monitor/dell/`
- 12 products with complete specs (from page content)
- 64 products with partial data

When you run `create`, all 76 will be copied to Google Sheet.

## Troubleshooting

**Error: "Credentials file not found"**
- Make sure `google-credentials.json` exists
- Check it's in the current directory

**Error: "The caller does not have permission"**
- Share the Google Sheet with your service account email
- Make sure the service account has Editor permissions

**Error: "Requested entity not found"**
- Check that `GOOGLE_SHEET_ID` is correct
- Extract ID from URL: `docs.google.com/spreadsheets/d/[THIS_IS_THE_ID]/edit`

## Next Steps

1. Read `GOOGLE_SHEETS_SETUP.md` for detailed setup
2. Create Google credentials
3. Run `node google-sheets-integration.js create`
4. Start adding products to your Google Sheet!
