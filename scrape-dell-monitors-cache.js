#!/usr/bin/env node
/**
 * Dell Monitor Scraper with Cache Integration
 * Scrapes all Dell monitors and saves to product-cache/monitor/dell/
 * Uses SerpAPI for data extraction
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
 * Detect product category from product name
 */
function detectCategory(productName) {
  const name = productName.toLowerCase();

  if (name.includes('monitor') || name.includes('display') || /[\d]{2,3}[\s-]*inch/i.test(name)) {
    return 'monitor';
  }
  if (name.includes('tablet') || name.includes('ipad') || name.includes('galaxy tab') || name.includes('surface')) {
    return 'tablet';
  }
  if (name.includes('iphone') || name.includes('samsung galaxy') && !name.includes('galaxy tab') || name.includes('pixel') || name.includes('oneplus') || name.includes('phone')) {
    return 'phone';
  }
  if (name.includes('laptop') || name.includes('notebook') || name.includes('thinkpad') || name.includes('macbook') || name.includes('xps')) {
    return 'laptop';
  }

  return 'other';
}

/**
 * Detect brand from product name
 */
function detectBrand(productName) {
  const name = productName.toLowerCase();

  const brands = {
    'dell': 'dell',
    'hp': 'hp',
    'lenovo': 'lenovo',
    'thinkpad': 'lenovo',
    'samsung': 'samsung',
    'lg': 'lg',
    'asus': 'asus',
    'acer': 'acer',
    'msi': 'msi',
    'apple': 'apple',
    'macbook': 'apple',
    'ipad': 'apple',
    'iphone': 'apple',
    'microsoft': 'microsoft',
    'surface': 'microsoft',
    'google': 'google',
    'pixel': 'google',
    'oneplus': 'oneplus',
    'razer': 'razer',
    'logitech': 'logitech',
    'corsair': 'corsair'
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
 * Scrape Google Shopping for Dell monitors
 */
async function scrapeGoogleShopping() {
  console.log('📊 Stage 1: Fetching product list from Google Shopping...');

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
          rating: result.rating || '',
          reviews: result.reviews || '',
          source: source,
          productUrl: result.link || '',
          imageUrl: result.thumbnail || '',
          stockStatus: result.in_stock !== false ? 'available' : 'out of stock'
        };

        products.push(product);
        console.log(`  ✓ Extracted: ${productTitle} - ${price}`);

      } catch (e) {
        console.log(`  ⚠️ Error extracting product: ${e.message}`);
        continue;
      }
    }

    return products;

  } catch (error) {
    console.error(`  ❌ Error fetching Google Shopping: ${error.message}`);
    return [];
  }
}

/**
 * Enrich product with detailed specifications using Google Search
 */
async function enrichProductSpecs(productName) {
  const query = encodeURIComponent(`${productName} specifications ports response time`);
  const url = `https://serpapi.com/search.json?engine=google&q=${query}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}`;

  try {
    const data = await httpsGet(url);

    const specs = {
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: ''
    };

    // Check knowledge graph
    if (data.knowledge_graph) {
      const kg = data.knowledge_graph;
      const description = kg.description || '';

      specs.size = extractSizeFromText(description);
      specs.resolution = extractResolutionFromText(description);
      specs.refreshRate = extractRefreshRateFromText(description);
      specs.responseTime = extractResponseTimeFromText(description);
    }

    // Check organic results for spec pages
    if (data.organic_results) {
      for (let i = 0; i < Math.min(3, data.organic_results.length); i++) {
        const result = data.organic_results[i];
        const snippet = result.snippet || '';

        // Extract from snippet
        if (!specs.size) specs.size = extractSizeFromText(snippet);
        if (!specs.resolution) specs.resolution = extractResolutionFromText(snippet);
        if (!specs.refreshRate) specs.refreshRate = extractRefreshRateFromText(snippet);
        if (!specs.responseTime) specs.responseTime = extractResponseTimeFromText(snippet);

        // Look for port information
        if (snippet.includes('HDMI') || snippet.includes('DisplayPort')) {
          const portsFound = [];
          if (snippet.includes('HDMI')) portsFound.push('HDMI');
          if (snippet.includes('DisplayPort')) portsFound.push('DisplayPort');
          if (snippet.includes('USB-C')) portsFound.push('USB-C');
          if (portsFound.length > 0) {
            specs.ports = portsFound.join(', ');
          }
        }

        console.log(`      ✓ Extracted specs from: ${result.title || 'Unknown'}`);
      }
    }

    return specs;

  } catch (error) {
    console.error(`    ❌ Error searching specs: ${error.message}`);
    return {
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: ''
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Dell Monitor Scraper with Cache Integration');
  console.log('=' .repeat(60));

  try {
    // Stage 1: Get product list from Google Shopping
    const products = await scrapeGoogleShopping();

    if (products.length === 0) {
      console.log('❌ No products found!');
      return;
    }

    console.log(`\n📊 Stage 1 Complete: ${products.length} products found`);

    // Stage 2: Check cache and enrich missing products
    console.log(`\n🔍 Stage 2: Checking cache and enriching products...`);

    let cacheHits = 0;
    let enrichedCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productName = product.briefName;

      console.log(`\n  [${i+1}/${products.length}] ${productName}`);

      // Extract model number from product name
      const modelMatch = productName.match(/[A-Z]\d{4}[A-Z]?/);
      const model = modelMatch ? modelMatch[0] : product.model;

      // Check if product is already in cache
      const cached = getCachedProduct(model, productName);
      if (cached) {
        cacheHits++;
        console.log(`    ✅ Using cached data`);
        continue;
      }

      // Enrich with detailed specs
      if (model) {
        console.log(`    🔍 Searching specs for: Dell ${model} monitor`);
        const specs = await enrichProductSpecs(`Dell ${model} monitor`);

        // Merge specs into product
        if (specs.size && !product.size) product.size = specs.size;
        if (specs.resolution && !product.resolution) product.resolution = specs.resolution;
        if (specs.refreshRate && !product.refreshRate) product.refreshRate = specs.refreshRate;
        if (specs.responseTime && !product.responseTime) product.responseTime = specs.responseTime;
        if (specs.ports && !product.ports) product.ports = specs.ports;

        enrichedCount++;
      }

      // Save to cache
      saveToCache(
        model,
        productName,
        product,
        'SerpAPI (Google Shopping + Google Search)',
        product.productUrl
      );

      // Rate limiting
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n📊 Stage 2 Complete:`);
    console.log(`  - Cache hits: ${cacheHits} products`);
    console.log(`  - Newly enriched: ${enrichedCount} products`);
    console.log(`  - Total in cache: ${cacheHits + enrichedCount} products`);

    // Save summary
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const summaryFile = `dell_monitors_summary_${timestamp}.json`;

    const summary = {
      scrapeDate: new Date().toISOString(),
      source: 'SerpAPI (Hybrid: Google Shopping + Google Search)',
      totalProducts: products.length,
      cacheHits: cacheHits,
      newlyEnriched: enrichedCount,
      products: products
    };

    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Summary saved to: ${summaryFile}`);

    // Print summary
    console.log(`\n📊 Final Summary:`);
    console.log(`  Total products: ${products.length}`);
    console.log(`  Products with price: ${products.filter(p => p.price).length}`);
    console.log(`  Products with size: ${products.filter(p => p.size).length}`);
    console.log(`  Products with resolution: ${products.filter(p => p.resolution).length}`);
    console.log(`  Products with refresh rate: ${products.filter(p => p.refreshRate).length}`);
    console.log(`  Products with response time: ${products.filter(p => p.responseTime).length}`);
    console.log(`  Products with ports: ${products.filter(p => p.ports).length}`);
    console.log(`  Products with rating: ${products.filter(p => p.rating).length}`);

    console.log(`\n✅ Successfully scraped and cached ${products.length} Dell monitors!`);
    console.log(`📁 Cache location: ${path.join(CACHE_DIR, 'monitor', 'dell')}`);

  } catch (error) {
    console.error(`❌ Error in main: ${error.message}`);
    throw error;
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
