# Google Sheets Integration Setup Guide

Complete setup for integrating Dell monitor scraping with Google Sheets.

## Quick Start

```bash
# 1. Install dependencies
npm install google-spreadsheet

# 2. Create Google Sheet with existing cached data
node google-sheets-integration.js create "Dell Monitors Malaysia"

# 3. Fill missing information
node google-sheets-integration.js fill
```

## Detailed Setup

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### Step 2: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in:
   - Name: `dell-scraper`
   - Description: `Dell monitor data scraper`
4. Click "Create and Continue"
5. Skip granting roles (click "Done")
6. Click on the created service account
7. Go to "Keys" tab → "Add Key" → "Create New Key"
8. Select **JSON** format
9. Click "Create" - this downloads a JSON file

### Step 3: Configure Credentials

1. Rename the downloaded JSON file to `google-credentials.json`
2. Move it to this directory: `/Users/jasonsoh/Documents/Jerry/`

**Important:** Keep this file secure - it contains your private key!

### Step 4: Create Google Sheet

```bash
# Create a new Google Sheet with existing cached data
node google-sheets-integration.js create "Dell Monitors Malaysia"
```

This will:
- Create a new Google Sheet
- Copy all cached products from `product-cache/monitor/dell/`
- Set up the column headers
- Display the Sheet URL

### Step 5: Share Sheet with Service Account

1. Open the created Google Sheet
2. Click "Share" button
3. Add the service account email from `google-credentials.json` (looks like: `dell-scraper@project-id.iam.gserviceaccount.com`)
4. Give it **Editor** permissions
5. Click "Send"

### Step 6: Set Sheet ID

```bash
# Extract Sheet ID from URL
# URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvKdB_3Cksq/edit
# ID: 1BxiMVs0XRA5nFMdKvKdB_3Cksq

export GOOGLE_SHEET_ID='your-sheet-id-here'

# Or add to .bashrc/.zshrc for persistence
echo 'export GOOGLE_SHEET_ID="your-sheet-id"' >> ~/.zshrc
```

## Usage

### Read Data from Sheet

```bash
node google-sheets-integration.js read
```

### Fill Missing Information

```bash
node google-sheets-integration.js fill
```

This will:
1. Read all products from your Google Sheet
2. Identify rows with missing data
3. Visit Dell product pages
4. Fill in missing specifications
5. Update the Google Sheet

## Your Workflow

1. **Manual Scraping** (You):
   - Go to Dell pages (page 2, page 3, etc.)
   - View source to get HTML
   - Add new rows to Google Sheet manually

2. **AI Fills Missing Data** (This Script):
   - Reads your Google Sheet
   - Identifies missing information
   - Fetches details from Dell product pages
   - Updates the Sheet automatically

## Sheet Columns

| Column | Description | Example |
|--------|-------------|---------|
| Model | Model code | P2425H |
| Brief Name | Product name | Dell Pro 24 Plus Monitor |
| Size | Screen size | 23.8 Inch |
| Resolution | Resolution | 1920 x 1080 |
| Refresh Rate | Refresh rate | 60Hz |
| Response Time | Response time | 8ms |
| Ports | Available ports | HDMI, DisplayPort, VGA |
| Warranty | Warranty period | 3 Years Limited... |
| Product URL | Link to product | https://www.dell.com/... |

## Troubleshooting

**Error: "Credentials file not found"**
- Make sure `google-credentials.json` exists in the current directory

**Error: "The caller does not have permission"**
- Share the Google Sheet with your service account email
- Make sure the service account has Editor permissions

**Error: "Requested entity not found"**
- Check that `GOOGLE_SHEET_ID` is correct
- Make sure the Sheet ID is not wrapped in quotes

## Security Notes

- Never commit `google-credentials.json` to Git
- Add to `.gitignore`: `google-credentials.json`
- Keep the JSON file secure and private
- You can revoke access anytime from Google Cloud Console
