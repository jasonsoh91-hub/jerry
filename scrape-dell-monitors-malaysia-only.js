#!/usr/bin/env node
/**
 * Dell Monitor Scraper - Malaysia Only
 * Scrapes ONLY from Malaysian Dell website (dell.com/en-my)
 * Uses SerpAPI with Malaysia-specific filters
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// SerpAPI Configuration
const SERPAPI_KEY = 'b120c565c5435875d430037cf36a3bb46d4c20e79275f202dede71a8f1a12376';

// Cache Configuration
const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const CACHE_EXPIRY_DAYS = 30;

/**
 * Helper function to make HTTPS requests
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}

/**
 * Extract screen size from text
 */
function extractSizeFromText(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*["']/);
  if (match) {
    return `${match[1]} Inch`;
  }
  return "";
}

/**
 * Extract resolution from text
 */
function extractResolutionFromText(text) {
  const match = text.match(/(\d{3,4})\s*x\s*(\d{3,4})/);
  if (match) {
    let resolution = `${match[1]} x ${match[2]}`;

    if (text.includes('4K') || text.includes('UHD')) {
      resolution += " 4K";
    } else if (text.includes('QHD') || text.includes('2560')) {
      resolution += " QHD";
    } else if (text.includes('Full HD') || text.includes('FHD') || text.includes('1080p')) {
      resolution += " FHD";
    }

    return resolution;
  }
  return "";
}

/**
 * Extract refresh rate from text
 */
function extractRefreshRateFromText(text) {
  const match = text.match(/(\d+)\s*Hz/i);
  if (match) {
    return `${match[1]}Hz`;
  }
  return "";
}

/**
 * Extract response time from text
 */
function extractResponseTimeFromText(text) {
  const match = text.match(/(\d+)\s*ms/i);
  if (match) {
    return `${match[1]}ms`;
  }
  return "";
}

/**
 * Extract warranty from text (prioritize Malaysian 3-year)
 */
function extractWarrantyFromText(text) {
  // Check for 3-year warranty first (Malaysia standard)
  if (text.includes('3 year') || text.includes('3 Years') || text.includes('3-Year')) {
    return '3 Years Limited Hardware and Advanced Exchange Service';
  }
  // Fallback to 1-year
  if (text.includes('1 year') || text.includes('1 Year') || text.includes('1-Year')) {
    return '1 Year Limited Hardware and Advanced Exchange Service';
  }
  return "";
}

/**
 * Detect product category from product name
 */
function detectCategory(name) {
  const categories = {
    'monitor': ['monitor', 'display', 'screen'],
    'laptop': ['laptop', 'notebook', 'chromebook'],
    'phone': ['phone', 'smartphone', 'iphone', 'galaxy']
  };

  const lowerName = name.toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category;
      }
    }
  }

  return 'generic';
}

/**
 * Detect brand from product name
 */
function detectBrand(name) {
  const brands = {
    'DELL': ['Dell'],
    'HP': ['HP', 'Hewlett-Packard'],
    'Samsung': ['Samsung'],
    'LG': ['LG'],
    'Asus': ['Asus', 'ASUS']
  };

  for (const [brandKey, brandName] of Object.entries(brands)) {
    if (name.includes(brandKey)) {
      return brandName;
    }
  }

  return 'generic';
}

/**
 * Generate cache path for a product
 */
function getCachePath(model, productName) {
  const category = detectCategory(productName);
  const brand = detectBrand(productName);

  // Use model as filename if available, otherwise generate from product name
  const identifier = (model || productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).toLowerCase();

  // Create organized path: product-cache/monitor/dell/u2424h.json
  const organizedPath = path.join(CACHE_DIR, category, brand, `${identifier}.json`);

  // Ensure parent directories exist
  const parentDir = path.dirname(organizedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
    console.log(`📁 Created cache subdirectory: ${parentDir}`);
  }

  return organizedPath;
}

/**
 * Save product to cache
 */
function saveToCache(model, productName, productInfo, source, productUrl) {
  try {
    const cachePath = getCachePath(model, productName);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const cachedData = {
      model: productInfo.model || model,
      briefName: productInfo.briefName || productName,
      size: productInfo.size || '',
      resolution: productInfo.resolution || '',
      refreshRate: productInfo.refreshRate || '',
      responseTime: productInfo.responseTime || '',
      ports: productInfo.ports || '',
      warranty: productInfo.warranty || '',
      source: source,
      productUrl: productUrl,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    fs.writeFileSync(cachePath, JSON.stringify(cachedData, null, 2));
    console.log(`💾 Saved to cache: ${model || productName} (${cachePath})`);

    return cachedData;
  } catch (error) {
    console.error(`❌ Error saving to cache: ${error}`);
    return null;
  }
}

/**
 * Check if product exists in cache
 */
function getCachedProduct(model, productName) {
  try {
    const cachePath = getCachePath(model, productName);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    // Read cached data
    const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    // Check if cache has expired
    const now = new Date();
    const expiresAt = new Date(cachedData.expiresAt);

    if (now > expiresAt) {
      console.log(`⏰ Cache expired for: ${model || productName}`);
      fs.unlinkSync(cachePath); // Delete expired cache
      return null;
    }

    console.log(`✅ Cache hit for: ${model || productName}`);
    return cachedData;

  } catch (error) {
    console.error(`❌ Error reading cache: ${error}`);
    return null;
  }
}

/**
 * Scrape Google Shopping for Dell monitors in Malaysia
 */
async function scrapeGoogleShopping() {
  console.log('📊 Stage 1: Fetching product list from Google Shopping (Malaysia)...');

  const url = `https://serpapi.com/search.json?engine=google_shopping&q=Dell%20monitor%20Malaysia&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=100`;

  try {
    const data = await httpsGet(url);

    if (!data.shopping_results) {
      console.log('  ⚠️ No shopping results found');
      return [];
    }

    console.log(`  📊 Found ${data.shopping_results.length} products`);

    const products = [];

    for (const result of data.shopping_results) {
      try {
        const productTitle = result.title || '';
        const productId = result.product_id || '';
        const source = result.source || '';

        // Only get Dell monitors
        if (!productTitle.toLowerCase().includes('dell')) {
          continue;
        }

        // Extract price
        let price = '';
        if (result.price !== undefined) {
          price = `RM ${result.price}`;
        }

        // Extract specs from title
        const size = extractSizeFromText(productTitle);
        const resolution = extractResolutionFromText(productTitle);
        const refreshRate = extractRefreshRateFromText(productTitle);

        const product = {
          model: productId,
          briefName: productTitle,
          size: size,
          resolution: resolution,
          refreshRate: refreshRate,
          responseTime: '',
          ports: '',
          warranty: '',
          price: price,
          source: `Google Shopping (${source})`
        };

        products.push(product);

      } catch (error) {
        console.error(`    ❌ Error parsing product: ${error.message}`);
      }
    }

    return products;

  } catch (error) {
    console.error(`❌ Error scraping Google Shopping: ${error.message}`);
    return [];
  }
}

/**
 * Enrich product specs from Malaysian Dell website only
 */
async function enrichProductSpecsFromMalaysianSite(productName) {
  // SPECIFICALLY target Malaysian Dell site
  const query = encodeURIComponent(`${productName} site:dell.com/en-my specifications warranty ports`);
  const url = `https://serpapi.com/search.json?engine=google&q=${query}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}`;

  try {
    const data = await httpsGet(url);

    const specs = {
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: '',
      warranty: ''
    };

    // Check knowledge graph
    if (data.knowledge_graph) {
      const kg = data.knowledge_graph;
      const description = kg.description || '';

      specs.size = extractSizeFromText(description);
      specs.resolution = extractResolutionFromText(description);
      specs.refreshRate = extractRefreshRateFromText(description);
      specs.responseTime = extractResponseTimeFromText(description);
      specs.warranty = extractWarrantyFromText(description);
    }

    // Check organic results for Malaysian Dell pages
    if (data.organic_results) {
      for (let i = 0; i < Math.min(5, data.organic_results.length); i++) {
        const result = data.organic_results[i];
        const link = result.link || '';
        const snippet = result.snippet || '';

        // ONLY process results from dell.com/en-my
        if (!link.includes('dell.com/en-my')) {
          continue;
        }

        // Extract from snippet
        if (!specs.size) specs.size = extractSizeFromText(snippet);
        if (!specs.resolution) specs.resolution = extractResolutionFromText(snippet);
        if (!specs.refreshRate) specs.refreshRate = extractRefreshRateFromText(snippet);
        if (!specs.responseTime) specs.responseTime = extractResponseTimeFromText(snippet);
        if (!specs.warranty) specs.warranty = extractWarrantyFromText(snippet);

        // Look for port information
        if (snippet.includes('HDMI') || snippet.includes('DisplayPort')) {
          const portsFound = [];
          if (snippet.includes('HDMI')) portsFound.push('HDMI');
          if (snippet.includes('DisplayPort')) portsFound.push('DisplayPort');
          if (snippet.includes('USB-C')) portsFound.push('USB-C');
          if (snippet.includes('VGA')) portsFound.push('VGA');
          if (portsFound.length > 0) {
            specs.ports = portsFound.join(', ');
          }
        }

        console.log(`      ✓ Extracted specs from Malaysian Dell page: ${result.title || 'Unknown'}`);

        // Return the Malaysian Dell URL
        return { specs, productUrl: link };
      }
    }

    return { specs, productUrl: '' };

  } catch (error) {
    console.error(`    ❌ Error searching Malaysian Dell specs: ${error.message}`);
    return {
      specs: {
        size: '',
        resolution: '',
        refreshRate: '',
        responseTime: '',
        ports: '',
        warranty: ''
      },
      productUrl: ''
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Dell Monitor Scraper - Malaysia Only');
  console.log('=' .repeat(60));

  try {
    // Stage 1: Get product list from Google Shopping (Malaysia)
    const products = await scrapeGoogleShopping();

    if (products.length === 0) {
      console.log('❌ No products found!');
      return;
    }

    console.log(`\n📊 Stage 1 Complete: ${products.length} products found`);

    // Stage 2: Check cache and enrich missing products
    console.log(`\n🔍 Stage 2: Checking cache and enriching from Malaysian Dell site...`);

    let cacheHits = 0;
    let enrichedCount = 0;
    let malaysiaSiteHits = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productName = product.briefName;

      console.log(`\n  [${i+1}/${products.length}] ${productName}`);

      // Extract model number from product name
      const modelMatch = productName.match(/[A-Z]\d{4}[A-Z]?/i);
      const model = modelMatch ? modelMatch[0].toUpperCase() : product.model;

      // Check if product is already in cache
      const cached = getCachedProduct(model, productName);
      if (cached) {
        cacheHits++;
        console.log(`    ✅ Using cached data`);
        continue;
      }

      // Enrich with specs from Malaysian Dell site only
      console.log(`    🔍 Fetching specs from Malaysian Dell website...`);
      const { specs, productUrl } = await enrichProductSpecsFromMalaysianSite(productName);

      // Merge existing product data with enriched specs
      product.size = product.size || specs.size;
      product.resolution = product.resolution || specs.resolution;
      product.refreshRate = product.refreshRate || specs.refreshRate;
      product.responseTime = product.responseTime || specs.responseTime;
      product.ports = product.ports || specs.ports;
      product.warranty = product.warranty || specs.warranty;

      if (productUrl) {
        malaysiaSiteHits++;
        product.source = `Malaysian Dell Website: ${productUrl}`;
        product.productUrl = productUrl;
      }

      // Save to cache
      saveToCache(model, productName, product, product.source, productUrl);
      enrichedCount++;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total products found: ${products.length}`);
    console.log(`Cache hits: ${cacheHits}`);
    console.log(`Newly enriched: ${enrichedCount}`);
    console.log(`Malaysian Dell site hits: ${malaysiaSiteHits}`);
    console.log(`Total in cache: ${cacheHits + enrichedCount}`);

    // List all models
    console.log(`\n📋 ALL MODELS:`);
    console.log('='.repeat(60));

    const allModels = [];
    const cacheDir = path.join(CACHE_DIR, 'monitor', 'dell');

    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = path.join(cacheDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          allModels.push({
            model: data.model,
            briefName: data.briefName,
            warranty: data.warranty,
            source: data.source
          });
        }
      });
    }

    // Sort by model
    allModels.sort((a, b) => (a.model || '').localeCompare(b.model || ''));

    allModels.forEach(item => {
      console.log(`  - ${item.model || 'Unknown'}: ${item.briefName}`);
      console.log(`    Warranty: ${item.warranty || 'N/A'}`);
      console.log(`    Source: ${item.source}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('✅ Scraping complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the scraper
main().catch(console.error);
