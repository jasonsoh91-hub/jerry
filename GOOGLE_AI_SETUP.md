# How to Use Gemma 4 for Scraping

## 🚀 Option 1: Google AI Studio (RECOMMENDED - Free)

### Step 1: Get API Key
1. Go to: https://aistudio.google.com/app/apikey
2. Click "Create API Key" (or "Create API key in new project")
3. Copy your API key (looks like: AIzaSy...)

### Step 2: Set Environment Variable
```bash
export GOOGLE_AI_KEY="your-api-key-here"
```

### Step 3: Run the Scraper
```bash
# Test with 5 products
node scrape-with-google-ai.js 5

# Scrape all 12 products
node scrape-with-google-ai.js 12
```

### 💰 Free Tier Limits:
- **15 requests per minute**
- **1,500 requests per day**
- Enough to scrape all 74+ monitors!

### 💰 Pricing (if you exceed free tier):
- **Input**: $0.075 per 1M characters
- **Output**: $0.30 per 1M characters
- Our usage (~10K chars per product) = ~$0.003 per product

---

## 🚀 Option 2: Install Locally (Requires GPU)

### Using Ollama (Mac/Linux):
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download Gemma 2 (7B model)
ollama pull gemma2:9b

# Run interactive
ollama run gemma2:9b

# Use via API
ollama serve &
curl http://localhost:11434/api/generate -d '{
  "model": "gemma2:9b",
  "prompt": "What is 2+2?"
}'
```

### System Requirements:
- **8GB RAM** minimum (for 7B model)
- **16GB RAM** recommended (for 27B model)
- **M1/M2 Mac** with 8GB+ RAM works well
- **GPU** with 8GB+ VRAM (NVIDIA/AMD)

---

## 🚀 Option 3: Kaggle Notebooks (Free GPU)

1. Go to https://www.kaggle.com/code
2. Create new notebook
3. Select GPU accelerator (free: T4 or P100)
4. Install: `!pip install -q accelerate transformers`
5. Run Gemma 2 code in notebook

---

## 🎯 Recommended: Google AI Studio

**Why?**
- ✅ No installation needed
- ✅ Free tier is generous
- ✅ Fast API response
- ✅ Works from any machine
- ✅ No GPU required

**Next Steps:**
1. Get API key: https://aistudio.google.com/app/apikey
2. Run: `export GOOGLE_AI_KEY="your-key"`
3. Run: `node scrape-with-google-ai.js 12`
