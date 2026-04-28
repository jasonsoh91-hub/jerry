# 🚀 Quick Start: Gemma 2 Scraper

## Step 1: Get Your Free Token (2 minutes)

1. **Open this URL:** https://huggingface.co/settings/tokens

2. **Click "New token"**
   - Name: `dell-scraper`
   - Type: `Read`
   - Click "Generate token"

3. **Copy the token** (starts with `hf_`)

## Step 2: Set the Token

```bash
export HF_TOKEN="paste-your-token-here"
```

## Step 3: Test First (Recommended)

Test with 5 products to verify it works:

```bash
node scrape-with-gemma-test.js
```

**What you'll see:**
```
🧪 Gemma 2 Scraper - Test Mode (5 products)
======================================================================
✅ HF_TOKEN found
🤖 Using google/gemma-2-2b-it model

📊 Found 58 products with missing data
🧪 Testing with first 5 products

[1/5] SE2225HM
  URL: https://www.dell.com/en-my/shop/dell-22-monitor-se2225hm/...
  🔍 SE2225HM: size, resolution, refreshRate, responseTime, ports
    📄 Fetching page...
    🤖 Parsing with Gemma 2...
    ✅ Filled 5/5 fields
       Size: 21.5 Inch
       Resolution: 1920 x 1080
       Refresh: 100Hz
       Response: 8ms
       Ports: 1 HDMI port, 1 VGA port
```

**Expected time:** ~1-2 minutes for 5 products

## Step 4: Scrape All Products

If test looks good, scrape all 58 products:

```bash
node scrape-with-gemma.js
```

**Expected time:** ~15-20 minutes

## What Happens

1. ✅ Fetches Dell product pages
2. ✅ Uses Gemma 2 AI to parse specifications
3. ✅ Updates cache files
4. ✅ Auto-generates Excel

**Result:** 70+ complete products

## After Scraping

Check your results:

```bash
# View updated cache
ls -lh product-cache/monitor/dell/*.json | tail -10

# Open Excel
open product-cache/Dell_Monitors_Final.xlsx
```

## Troubleshooting

**Error: "No HF_TOKEN found"**
```bash
# Set token again
export HF_TOKEN="your-token"
```

**Error: "Model is loading"**
- First call takes longer
- Wait 10-20 seconds

**Weird results in test?**
- Check the product URL in browser
- Some pages may be redirected
- Try with different products

**Want to stop mid-scrape?**
```bash
# Press Ctrl+C
# Progress is saved automatically
```

## Token Storage (Optional)

To save token permanently:

```bash
# Save to .env file
echo 'HF_TOKEN="your-token"' > .env

# Load in future sessions
source .env

# Or add to ~/.zshrc
echo 'export HF_TOKEN="your-token"' >> ~/.zshrc
source ~/.zshrc
```

## Summary

✅ **Get token:** https://huggingface.co/settings/tokens
✅ **Test first:** `node scrape-with-gemma-test.js`
✅ **Scrape all:** `node scrape-with-gemma.js`
✅ **Check results:** Excel auto-generated

**Ready? Get your token and let's go!** 🚀
