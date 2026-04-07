# 🔍 Real Web Search Setup Guide

## Quick Setup (Recommended: SerpAPI)

### Step 1: Get SerpAPI Key (5 minutes)
1. Go to https://serpapi.com/
2. Click "Get API Key" (top right)
3. Sign up with Google/GitHub or email
4. Copy your API key from the dashboard

### Step 2: Add to Project
1. Create file: `.env.local` in project root
2. Add this line:
```
SERPAPI_KEY=your_actual_api_key_here
```
3. Replace `your_actual_api_key_here` with your key from Step 1

### Step 3: Test It
1. Restart the development server:
```bash
npm run dev
```
2. Try searching for "Dell UltraSharp 24 Monitor U2424H"
3. You'll see real search results!

## Alternative Options

### Option 2: Google Custom Search API (Free: 100 searches/day)

**Setup (10 minutes):**

1. **Get Google API Key:**
   - Go to https://console.cloud.google.com/
   - Create new project
   - Enable "Custom Search API"
   - Create API key → Copy it

2. **Create Search Engine:**
   - Go to https://cse.google.com/cse/
   - Click "Add"
   - Enter sites to search (or choose "Search the entire web")
   - Click "Create"
   - Go to "Control Panel" → Copy "Search engine ID"

3. **Add to `.env.local`:**
```
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### Option 3: ScrapingBee (Advanced)

**Setup:**
1. Go to https://www.scrapingbee.com/
2. Sign up for free trial (1,000 credits)
3. Copy API key
4. Add to `.env.local`:
```
SCRAPINGBEE_API_KEY=your_scrapingbee_key
```

## How It Works

Once configured, the system will:

1. **Real Web Search** - Searches the actual internet
2. **Find Product Pages** - Locates official product info
3. **Extract Specifications** - Pulls real specs, features, descriptions
4. **Display Results** - Shows accurate product information

## Testing

After setup, test with:
- "Dell UltraSharp 24 Monitor U2424H"
- "Apple MacBook Pro 14 M3"
- "Sony WH-1000XM5 headphones"

## Troubleshooting

**Not working? Check:**
1. `.env.local` file exists in project root
2. API key is correct (no extra spaces)
3. Development server is restarted
4. No error messages in console

**Check if it's working:**
- Look at the console when searching
- You should see: `🌐 Using SerpAPI for real web search`
- If not, it's using the fallback system

## Free Tier Limits

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| SerpAPI | 100 searches/month | $50/month |
| Google | 100 searches/day | $5 per 1,000 |
| ScrapingBee | 1,000 credits | $49/month |

For most users, **SerpAPI** is the best choice!

## Example .env.local File

```env
# SerpAPI (Recommended)
SERPAPI_KEY=abc123def456ghi789

# OR Google Custom Search
GOOGLE_API_KEY=AIzaSyD...your_key_here
GOOGLE_SEARCH_ENGINE_ID=0123456789...your_id_here

# OR ScrapingBee
SCRAPINGBEE_API_KEY=SK...your_key_here
```

---

**Need help?** The system will work with the smart fallback even without setup!
