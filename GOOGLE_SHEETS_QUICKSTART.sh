#!/bin/bash
# Quick Start for Google Sheets Integration

echo "🚀 Google Sheets Integration for Dell Monitor Scraping"
echo "======================================================"
echo ""
echo "📋 This script helps you set up Google Sheets integration"
echo ""
echo "What you can do:"
echo "  1. Create a new Google Sheet with your cached data"
echo "  2. Read products from your Google Sheet"
echo "  3. Fill missing information automatically"
echo ""
echo "📖 Full setup guide: GOOGLE_SHEETS_SETUP.md"
echo ""
echo "Quick Start:"
echo ""
echo "Step 1: Setup Google Cloud (one-time)"
echo "  → Go to: https://console.cloud.google.com"
echo "  → Create a project and enable 'Google Sheets API'"
echo "  → Create a Service Account and download JSON credentials"
echo "  → Save JSON as: google-credentials.json"
echo ""
echo "Step 2: Install dependencies (one-time)"
echo "  npm install google-spreadsheet"
echo ""
echo "Step 3: Create Google Sheet"
echo "  node google-sheets-integration.js create 'Dell Monitors Malaysia'"
echo ""
echo "Step 4: Share sheet with service account email"
echo "  → Open the created Google Sheet"
echo "  → Click 'Share' and add the service account email"
echo "  → Give Editor permissions"
echo ""
echo "Step 5: Set Sheet ID"
echo "  export GOOGLE_SHEET_ID='your-sheet-id'"
echo ""
echo "Step 6: Fill missing information"
echo "  node google-sheets-integration.js fill"
echo ""
echo "======================================================"
echo "Your workflow:"
echo "  1. You: Manually scrape HTML from Dell pages (page 2, 3, etc.)"
echo "  2. You: Add new rows to Google Sheet with Model and Product URL"
echo "  3. AI: Reads your Sheet, identifies missing data"
echo "  4. AI: Visits Dell pages and fills in specifications"
echo "  5. AI: Updates your Google Sheet automatically"
echo "======================================================"
echo ""
echo "Ready to start? Choose an option:"
echo ""
read -p "1. Show setup guide | 2. Test installation | 3. Exit : " choice

case $choice in
  1)
    echo ""
    echo "📖 Opening setup guide..."
    cat GOOGLE_SHEETS_SETUP.md
    ;;
  2)
    echo ""
    echo "🧪 Testing installation..."
    if [ -f "node_modules/google-spreadsheet/lib/index.js" ]; then
      echo "✅ google-spreadsheet is installed"
    else
      echo "❌ google-spreadsheet not found. Run: npm install google-spreadsheet"
    fi

    if [ -f "google-credentials.json" ]; then
      echo "✅ google-credentials.json found"
    else
      echo "⚠️  google-credentials.json not found (see setup guide)"
    fi
    ;;
  *)
    echo "Goodbye!"
    exit 0
    ;;
esac
