#!/bin/bash
# Hugging Face Token Setup Guide

echo "🔑 Hugging Face Token Setup"
echo "=". "=" | tr ' ' '='
echo ""
echo "Step 1: Get your free token"
echo "---------------------------"
echo "1. Open this URL in your browser:"
echo ""
echo "   https://huggingface.co/settings/tokens"
echo ""
echo "2. Click 'New token'"
echo "3. Name it: dell-scraper"
echo "4. Type: Read"
echo "5. Click 'Generate token'"
echo "6. Copy the token (starts with hf_...)"
echo ""
echo "Step 2: Set the token"
echo "---------------------"
echo "Paste your token below and press Enter:"
read -s TOKEN

if [ -z "$TOKEN" ]; then
  echo "❌ No token provided"
  exit 1
fi

export HF_TOKEN="$TOKEN"

# Save to .env file
echo "HF_TOKEN=$TOKEN" > .env
echo "✅ Token saved to .env file"

# Test token
echo ""
echo "Testing token..."
if [[ $TOKEN == hf_* ]]; then
  echo "✅ Token format looks correct (starts with hf_)"
else
  echo "⚠️  Warning: Token should start with hf_"
fi

echo ""
echo "Step 3: Run the scraper"
echo "-----------------------"
echo "Choose an option:"
echo ""
echo "1. Test with 5 products first"
echo "2. Scrape all 50 products (~15 min)"
echo "3. Exit (run manually later)"
echo ""
read -p "Choose 1-3: " choice

case $choice in
  1)
    echo ""
    echo "🧪 Testing with 5 products..."
    node scrape-with-gemma-test.js 2>&1 | head -100
    ;;
  2)
    echo ""
    echo "🚀 Scraping all 50 products..."
    echo "This will take ~15 minutes"
    echo ""
    read -p "Press Enter to start..."
    node scrape-with-gemma.js
    ;;
  3)
    echo ""
    echo "✅ Setup complete! Token saved to .env"
    echo ""
    echo "To run later:"
    echo "  source .env"
    echo "  node scrape-with-gemma.js"
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac
