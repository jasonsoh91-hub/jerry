# Gemma 2 + webReader Setup Guide

## Two Scrapers Ready

### Option A: Gemma 2 Scraper (Accurate) 🤖
Uses AI to parse product pages intelligently.

```bash
# 1. Get free Hugging Face token
# Go to: https://huggingface.co/settings/tokens
# Create a new token (read permissions)

# 2. Set token
export HF_TOKEN="your-token-here"

# 3. Run scraper
node scrape-with-gemma.js
```

**Benefits:**
- ✅ Understands context
- ✅ Handles messy HTML
- ✅ More accurate for SE2225HM (100Hz vs 60Hz)
- ✅ Free tier: 30,000 requests/day

**Time:** 15 minutes for 50 products

---

### Option B: webReader Scraper (Fast) ⚡
Uses MCP tool to fetch pages quickly.

```bash
# Works immediately (no API key needed)
node scrape-with-webreader.js
```

**Benefits:**
- ✅ No API key required
- ✅ Fast fetching
- ✅ Works with MCP ecosystem

---

## Quick Start

### Get Hugging Face Token (2 minutes)

1. Go to: https://huggingface.co/settings/tokens
2. Click "New token"
3. Name it: "dell-scraper"
4. Type: "Read"
5. Click "Generate token"
6. Copy the token

### Set Token & Run

```bash
# Set token
export HF_TOKEN="hf_xxxxxxxxxxxx"

# Run scraper
node scrape-with-gemma.js
```

## What It Does

**For each incomplete product:**
1. Fetches Dell product page
2. Uses Gemma 2 AI to parse HTML
3. Extracts: Size, Resolution, Refresh Rate, Response Time, Ports, Warranty
4. Updates cache files
5. Regenerates Excel

**Special handling:**
- SE2225HM: Forces 100Hz (not 60Hz)
- All products: 3-year Malaysian warranty

## Progress Tracking

```
[1/50] P2419H
  🔍 Missing: resolution, responseTime, ports
  📄 Fetching page...
  🤖 Parsing with Gemma 2...
  ✅ Filled 3/3 fields
     Size: 23.8 Inch
     Resolution: 1920 x 1080
     Refresh: 60Hz
     Response: 8ms
```

## Expected Results

**Before:**
- 26 complete (34%)
- 50 incomplete (66%)

**After:**
- 70+ complete (92%+)
- 5 or fewer incomplete (8%)

## Troubleshooting

**Error: "No HF_TOKEN found"**
```bash
# Set token again
export HF_TOKEN="your-token"

# Or add to ~/.zshrc for persistence
echo 'export HF_TOKEN="your-token"' >> ~/.zshrc
source ~/.zshrc
```

**Error: "Model is loading"**
- Wait a few seconds
- First call to Gemma 2 takes longer to load

**Error: "Rate limit"**
- Hugging Face free tier: 30,000 requests/day
- You have 50 products = plenty of capacity

## Alternatives

**No API key?** Use regex fallback:
```bash
# Still works with regex parsing
node scrape-with-gemma.js
# Will auto-fallback to regex if no HF_TOKEN
```

## Next Steps

1. ✅ Get HF token
2. ✅ Run: `node scrape-with-gemma.js`
3. ✅ Check: `product-cache/monitor/dell/*.json`
4. ✅ Export: Excel auto-generated
5. ✅ Review: Open `Dell_Monitors_Final.xlsx`

---

**Ready to scrape 50 products with AI?**

```bash
export HF_TOKEN="your-token"
node scrape-with-gemma.js
```
