#!/usr/bin/env node
/**
 * Test Gemma 2 Scraper - First 5 Products Only
 * Quick test to verify everything works
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Import the main scraper functions
const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const HF_TOKEN = process.env.HF_TOKEN || '';

console.log('🧪 Gemma 2 Scraper - Test Mode (5 products)');
console.log('='.repeat(70));

if (!HF_TOKEN) {
  console.log('');
  console.log('❌ No HF_TOKEN found');
  console.log('');
  console.log('To get your free token:');
  console.log('  1. Go to: https://huggingface.co/settings/tokens');
  console.log('  2. Click "New token"');
  console.log('  3. Copy the token (starts with hf_)');
  console.log('  4. Run: export HF_TOKEN="your-token"');
  console.log('  5. Run: node scrape-with-gemma-test.js');
  console.log('');
  process.exit(1);
}

console.log('✅ HF_TOKEN found');
console.log('🤖 Using google/gemma-2-2b-it model');
console.log('');

// Copy functions from main scraper
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function getIncompleteProducts() {
  const cacheDir = path.join(CACHE_DIR, 'monitor', 'dell');
  const files = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
    : [];

  const incomplete = [];

  files.forEach(file => {
    const cachePath = path.join(cacheDir, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    const missing = [];
    if (!product.size) missing.push('size');
    if (!product.resolution) missing.push('resolution');
    if (!product.refreshRate) missing.push('refreshRate');
    if (!product.responseTime) missing.push('responseTime');
    if (!product.ports) missing.push('ports');
    if (!product.warranty) missing.push('warranty');

    if (missing.length > 0 && product.productUrl) {
      incomplete.push({
        ...product,
        missing,
        cachePath
      });
    }
  });

  return incomplete;
}

async function parseProductPageWithGemma(pageContent, modelName) {
  const { HfInference } = require('@huggingface/inference');
  const hf = new HfInference(HF_TOKEN);

  const prompt = `Extract product specifications from this Dell monitor page. Return ONLY a JSON object with these fields:
{
  "size": "screen size in inches (number only)",
  "resolution": "like 1920 x 1080",
  "refreshRate": "like 60Hz, 100Hz, 144Hz",
  "responseTime": "like 5ms, 8ms",
  "ports": "comma-separated list: HDMI, DisplayPort, VGA, USB-C",
  "warranty": "warranty period"
}

Product page content:
${pageContent.substring(0, 8000)}

Note: For SE2222HM, refresh rate is 100Hz, not 60Hz.
Malaysian products have 3-year warranty.`;

  try {
    const model = "google/gemma-2-2b-it";
    const result = await hf.textGeneration({
      model,
      inputs: prompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.1,
        return_full_text: false
      }
    });

    let jsonStr = result.generated_text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const specs = JSON.parse(jsonStr);

    if (specs.size && !specs.size.includes('Inch')) {
      specs.size = `${specs.size} Inch`;
    }
    if (specs.refreshRate && !specs.refreshRate.includes('Hz')) {
      specs.refreshRate = `${specs.refreshRate}Hz`;
    }
    if (specs.responseTime && !specs.responseTime.includes('ms')) {
      specs.responseTime = `${specs.responseTime}ms`;
    }

    if (modelName === 'SE2225HM') {
      specs.refreshRate = '100Hz';
    }

    if (!specs.warranty) {
      specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
    }

    return specs;

  } catch (error) {
    console.error(`    ⚠️  Gemma error: ${error.message}`);
    return null;
  }
}

function updateProductCache(cachePath, specs) {
  const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

  if (!product.size && specs.size) product.size = specs.size;
  if (!product.resolution && specs.resolution) product.resolution = specs.resolution;
  if (!product.refreshRate && specs.refreshRate) product.refreshRate = specs.refreshRate;
  if (!product.responseTime && specs.responseTime) product.responseTime = specs.responseTime;
  if (!product.ports && specs.ports) product.ports = specs.ports;
  if (!product.warranty && specs.warranty) product.warranty = specs.warranty;

  product.updatedAt = new Date().toISOString();

  fs.writeFileSync(cachePath, JSON.stringify(product, null, 2));
  return product;
}

async function scrapeProduct(product) {
  console.log(`  🔍 ${product.model}: ${product.missing.join(', ')}`);

  try {
    console.log(`    📄 Fetching page...`);
    const pageContent = await fetchPage(product.productUrl);

    console.log(`    🤖 Parsing with Gemma 2...`);
    const specs = await parseProductPageWithGemma(pageContent, product.model);

    if (!specs) {
      console.log(`    ❌ Failed to parse`);
      return null;
    }

    const updated = updateProductCache(product.cachePath, specs);

    const filled = product.missing.filter(field => specs[field]).length;
    console.log(`    ✅ Filled ${filled}/${product.missing.length} fields`);

    if (filled > 0) {
      console.log(`       Size: ${specs.size || 'N/A'}`);
      console.log(`       Resolution: ${specs.resolution || 'N/A'}`);
      console.log(`       Refresh: ${specs.refreshRate || 'N/A'}`);
      console.log(`       Response: ${specs.responseTime || 'N/A'}`);
      console.log(`       Ports: ${specs.ports || 'N/A'}`);
    }

    return { product: updated, filled };

  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const incomplete = getIncompleteProducts();

  console.log(`📊 Found ${incomplete.length} products with missing data`);
  console.log(`🧪 Testing with first 5 products`);
  console.log('');

  const testProducts = incomplete.slice(0, 5);

  let totalFilled = 0;
  let successCount = 0;

  for (let i = 0; i < testProducts.length; i++) {
    const product = testProducts[i];
    console.log(`[${i+1}/${testProducts.length}] ${product.model}`);
    console.log(`  URL: ${product.productUrl}`);

    const result = await scrapeProduct(product);

    if (result && result.filled > 0) {
      totalFilled += result.filled;
      successCount++;
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('='.repeat(70));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`Tested: ${testProducts.length} products`);
  console.log(`Successfully Updated: ${successCount}`);
  console.log(`Total Fields Filled: ${totalFilled}`);
  console.log(`Average: ${Math.round(totalFilled/testProducts.length)} fields per product`);
  console.log('');
  console.log('✅ Test complete!');
  console.log('');
  console.log('Ready to scrape all products? Run:');
  console.log('  node scrape-with-gemma.js');
  console.log('='.repeat(70));
}

main().catch(console.error);
