#!/usr/bin/env node
/**
 * Gemma 2 Product Scraper via Hugging Face
 * Uses AI to parse Dell product pages accurately
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { HfInference } = require('@huggingface/inference');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const HF_TOKEN = process.env.HF_TOKEN || '';

/**
 * Helper function to fetch web page content
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Read all cached products and identify incomplete ones
 */
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

/**
 * Use Gemma 2 to parse product page and extract specs
 */
async function parseProductPageWithGemma(pageContent, modelName) {
  if (!HF_TOKEN) {
    console.log('    ⚠️  No HF_TOKEN found, using regex fallback');
    return parseWithRegex(pageContent, modelName);
  }

  try {
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
    // Extract JSON from response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const specs = JSON.parse(jsonStr);

    // Format specs
    if (specs.size && !specs.size.includes('Inch')) {
      specs.size = `${specs.size} Inch`;
    }
    if (specs.refreshRate && !specs.refreshRate.includes('Hz')) {
      specs.refreshRate = `${specs.refreshRate}Hz`;
    }
    if (specs.responseTime && !specs.responseTime.includes('ms')) {
      specs.responseTime = `${specs.responseTime}ms`;
    }

    // Special case for SE2225HM
    if (modelName === 'SE2225HM') {
      specs.refreshRate = '100Hz';
      specs.warranty = specs.warranty || '3 Years Limited Hardware and Advanced Exchange Service';
    }

    // Malaysian warranty default
    if (!specs.warranty) {
      specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
    }

    return specs;

  } catch (error) {
    console.error(`    ⚠️  Gemma error: ${error.message}, using regex`);
    return parseWithRegex(pageContent, modelName);
  }
}

/**
 * Fallback regex-based parser
 */
function parseWithRegex(content, modelName) {
  const specs = {
    size: '',
    resolution: '',
    refreshRate: '',
    responseTime: '',
    ports: '',
    warranty: '3 Years Limited Hardware and Advanced Exchange Service'
  };

  // Extract size
  const sizeMatch = content.match(/Diagonal Size[\s\w"']*(\d+(?:\.\d+)?)/i);
  if (sizeMatch) specs.size = `${sizeMatch[1]} Inch`;

  // Extract resolution
  const resMatch = content.match(/(\d{3,4})\s*x\s*(\d{3,4})/i);
  if (resMatch) specs.resolution = `${resMatch[1]} x ${resMatch[2]}`;

  // Extract refresh rate
  const refreshMatch = content.match(/(\d+)\s*Hz/i);
  if (refreshMatch) specs.refreshRate = `${refreshMatch[1]}Hz`;

  // Special case for SE2225HM
  if (modelName === 'SE2225HM' && (!specs.refreshRate || specs.refreshRate === '60Hz')) {
    specs.refreshRate = '100Hz';
  }

  // Extract response time
  const responseMatch = content.match(/(\d+(?:\.\d+)?)\s*ms/i);
  if (responseMatch) specs.responseTime = `${responseMatch[1]}ms`;

  // Extract ports
  const ports = [];
  if (content.includes('HDMI')) ports.push('HDMI');
  if (content.includes('DisplayPort') || content.includes('DP')) ports.push('DisplayPort');
  if (content.includes('USB-C')) ports.push('USB-C');
  if (content.includes('VGA')) ports.push('VGA');
  if (ports.length > 0) specs.ports = ports.join(', ');

  return specs;
}

/**
 * Update cached product with new specs
 */
function updateProductCache(cachePath, specs) {
  const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

  // Update only missing fields
  if (!product.size && specs.size) product.size = specs.size;
  if (!product.resolution && specs.resolution) product.resolution = specs.resolution;
  if (!product.refreshRate && specs.refreshRate) product.refreshRate = specs.refreshRate;
  if (!product.responseTime && specs.responseTime) product.responseTime = specs.responseTime;
  if (!product.ports && specs.ports) product.ports = specs.ports;
  if (!product.warranty && specs.warranty) product.warranty = specs.warranty;

  // Update timestamp
  product.updatedAt = new Date().toISOString();

  fs.writeFileSync(cachePath, JSON.stringify(product, null, 2));
  return product;
}

/**
 * Scrape a single product
 */
async function scrapeProduct(product) {
  console.log(`  🔍 ${product.model}: ${product.missing.join(', ')}`);

  try {
    console.log(`    📄 Fetching page...`);
    const pageContent = await fetchPage(product.productUrl);

    console.log(`    🤖 Parsing with Gemma 2...`);
    const specs = await parseProductPageWithGemma(pageContent, product.model);

    const updated = updateProductCache(product.cachePath, specs);

    const filled = product.missing.filter(field => specs[field]).length;
    console.log(`    ✅ Filled ${filled}/${product.missing.length} fields`);

    if (filled > 0) {
      console.log(`       Size: ${specs.size || 'N/A'}`);
      console.log(`       Resolution: ${specs.resolution || 'N/A'}`);
      console.log(`       Refresh: ${specs.refreshRate || 'N/A'}`);
      console.log(`       Response: ${specs.responseTime || 'N/A'}`);
    }

    return { product: updated, filled };

  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Gemma 2 Product Scraper');
  console.log('='.repeat(70));

  if (!HF_TOKEN) {
    console.log('');
    console.log('⚠️  No HF_TOKEN environment variable found');
    console.log('');
    console.log('To use Gemma 2:');
    console.log('  1. Get free token: https://huggingface.co/settings/tokens');
    console.log('  2. Set: export HF_TOKEN="your-token-here"');
    console.log('  3. Run: node scrape-with-gemma.js');
    console.log('');
    console.log('Falling back to regex-based parsing...');
    console.log('');
  } else {
    console.log('✅ HF_TOKEN found');
    console.log('🤖 Using google/gemma-2-2b-it model');
    console.log('');
  }

  const incomplete = getIncompleteProducts();

  console.log(`📊 Found ${incomplete.length} products with missing data`);
  console.log('');

  if (incomplete.length === 0) {
    console.log('✅ All products are complete!');
    return;
  }

  let totalFilled = 0;
  let successCount = 0;

  for (let i = 0; i < incomplete.length; i++) {
    const product = incomplete[i];
    console.log(`\n[${i+1}/${incomplete.length}] ${product.model}`);
    console.log(`  URL: ${product.productUrl}`);

    const result = await scrapeProduct(product);

    if (result && result.filled > 0) {
      totalFilled += result.filled;
      successCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Products: ${incomplete.length}`);
  console.log(`Successfully Updated: ${successCount}`);
  console.log(`Total Fields Filled: ${totalFilled}`);
  console.log(`Average: ${Math.round(totalFilled/incomplete.length)} fields per product`);
  console.log('='.repeat(70));

  // Regenerate Excel
  console.log(`\n📊 Regenerating Excel...`);

  const excelProcess = spawn('node', ['fix-model-extraction.js'], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  await new Promise((resolve, reject) => {
    excelProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Excel generation failed with code ${code}`));
    });
  });

  console.log(`\n✅ Complete!`);
  console.log(`📁 Excel: ${path.join(CACHE_DIR, 'Dell_Monitors_Final.xlsx')}`);
}

main().catch(console.error);
