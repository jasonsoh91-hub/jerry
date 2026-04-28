#!/usr/bin/env node
/**
 * Gemma 4 Scraper via Hugging Face
 * Uses the new Gemma 4 model for accurate web scraping
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { HfInference } = require('@huggingface/inference');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const HF_TOKEN = process.env.HF_TOKEN || '';

console.log('🚀 Gemma 4 Scraper');
console.log('='.repeat(70));

if (!HF_TOKEN) {
  console.log('❌ No HF_TOKEN found');
  console.log('');
  console.log('Get your free token: https://huggingface.co/settings/tokens');
  console.log('Set: export HF_TOKEN="your-token"');
  process.exit(1);
}

console.log('✅ HF_TOKEN found');
console.log('🤖 Testing Gemma 4 models...');
console.log('');

// Gemma 4 models on Hugging Face
const GEMMA_4_MODELS = [
  'google/gemma-4-2b-it',
  'google/gemma-4-9b-it',
  'google/gemma-4-27b-it'
];

async function testGemma4Models() {
  const hf = new HfInference(HF_TOKEN);

  for (const model of GEMMA_4_MODELS) {
    try {
      console.log(`Testing: ${model}...`);

      const result = await hf.textGeneration({
        model,
        inputs: 'What is 2+2? Answer with just the number.',
        parameters: {
          max_new_tokens: 10,
          temperature: 0.1
        }
      });

      console.log(`✅ SUCCESS! Model: ${model}`);
      console.log(`   Response: ${result.generated_text.trim()}`);
      return model;

    } catch (error) {
      console.log(`❌ Failed: ${error.message.substring(0, 100)}`);
    }
  }

  console.log('\n⚠️  Gemma 4 models not available on Hugging Face Inference API');
  console.log('   They may be available for download, but not for API usage yet.');
  console.log('   Falling back to Gemma 2...');

  // Try Gemma 2 as fallback
  try {
    const result = await hf.textGeneration({
      model: 'google/gemma-2-2b-it',
      inputs: 'What is 2+2? Answer with just the number.',
      parameters: {
        max_new_tokens: 10,
        temperature: 0.1
      }
    });

    console.log(`✅ Gemma 2 works! Response: ${result.generated_text.trim()}`);
    return 'google/gemma-2-2b-it';

  } catch (error) {
    console.log(`❌ Gemma 2 also failed: ${error.message}`);
    return null;
  }
}

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

async function parseWithGemma4(pageContent, modelName, modelId) {
  const { HfInference } = require('@huggingface/inference');
  const hf = new HfInference(HF_TOKEN);

  const prompt = `<s>[INST] You are a product specification extractor. Extract the following details from this Dell monitor product page:

1. Screen size (in inches, number only)
2. Resolution (e.g. 1920 x 1080)
3. Refresh rate (in Hz, number only)
4. Response time (in ms, number only)
5. Available ports (HDMI, DisplayPort, VGA, USB-C, etc.)
6. Warranty (years)

Return ONLY a JSON object:
{
  "size": "24",
  "resolution": "1920 x 1080",
  "refreshRate": "60",
  "responseTime": "5",
  "ports": "HDMI, DisplayPort",
  "warranty": "3"
}

Product page content (first 4000 characters):
${pageContent.substring(0, 4000)}
[/INST]</s>`;

  try {
    const result = await hf.textGeneration({
      model: modelId,
      inputs: prompt,
      parameters: {
        max_new_tokens: 300,
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
    if (modelName === 'SE2225HM' || modelName === 'SE2222HM') {
      specs.refreshRate = '100Hz';
    }

    // Malaysian warranty default
    if (!specs.warranty || specs.warranty === '3') {
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

async function scrapeProduct(product, modelId) {
  console.log(`  🔍 ${product.model}: ${product.missing.join(', ')}`);

  try {
    console.log(`    📄 Fetching page...`);
    const pageContent = await fetchPage(product.productUrl);

    console.log(`    🤖 Parsing with Gemma 4...`);
    const specs = await parseWithGemma4(pageContent, product.model, modelId);

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
      console.log(`       Warranty: ${specs.warranty || 'N/A'}`);
    }

    return { product: updated, filled };

  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const mode = process.argv[2] || 'test';

  // First, test which Gemma model works
  const workingModel = await testGemma4Models();

  if (!workingModel) {
    console.log('\n❌ No working Gemma model found');
    console.log('Gemms 4 may not be available on Hugging Face Inference API yet.');
    console.log('You may need to:');
    console.log('  1. Download model weights and run locally');
    console.log('  2. Use Google AI Studio');
    console.log('  3. Use Gemma 2 as fallback');
    process.exit(1);
  }

  console.log('');
  console.log(`🤖 Using model: ${workingModel}`);
  console.log('');

  const incomplete = getIncompleteProducts();

  console.log(`📊 Found ${incomplete.length} products with missing data`);
  console.log('');

  if (mode === 'test') {
    console.log(`🧪 Test mode: First 3 products`);
    console.log('');
    const testProducts = incomplete.slice(0, 3);

    let totalFilled = 0;
    let successCount = 0;

    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      console.log(`[${i+1}/${testProducts.length}] ${product.model}`);
      console.log(`  URL: ${product.productUrl}`);

      const result = await scrapeProduct(product, workingModel);

      if (result && result.filled > 0) {
        totalFilled += result.filled;
        successCount++;
      }

      console.log('');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('='.repeat(70));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Tested: ${testProducts.length} products`);
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Total Fields Filled: ${totalFilled}`);
    console.log(`Average: ${Math.round(totalFilled/testProducts.length)} fields per product`);
    console.log('');

    if (successCount >= 2) {
      console.log('✅ Test successful! Ready to scrape all products.');
      console.log('');
      console.log('To scrape all products, run:');
      console.log(`  node scrape-with-gemma4.js all`);
    }

  } else {
    // All products
    console.log(`🚀 Scraping all ${incomplete.length} products`);
    console.log(`⏱️  Estimated time: ~${Math.ceil(incomplete.length * 3 / 60)} minutes`);
    console.log('');

    let totalFilled = 0;
    let successCount = 0;

    for (let i = 0; i < incomplete.length; i++) {
      const product = incomplete[i];
      console.log(`[${i+1}/${incomplete.length}] ${product.model}`);
      console.log(`  URL: ${product.productUrl}`);

      const result = await scrapeProduct(product, workingModel);

      if (result && result.filled > 0) {
        totalFilled += result.filled;
        successCount++;
      }

      console.log('');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('='.repeat(70));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(70));
    console.log(`Total Products: ${incomplete.length}`);
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Total Fields Filled: ${totalFilled}`);
    console.log(`Average: ${Math.round(totalFilled/incomplete.length)} fields per product`);
    console.log('='.repeat(70));

    // Regenerate Excel
    console.log(`\n📊 Regenerating Excel...`);

    const { spawn } = require('child_process');
    const excelProcess = spawn('node', ['fix-model-extraction.js'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    await new Promise((resolve, reject) => {
      excelProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Excel generation failed`));
      });
    });

    console.log(`\n✅ Complete!`);
    console.log(`📁 Excel: ${path.join(CACHE_DIR, 'Dell_Monitors_Final.xlsx')}`);
  }

  console.log('='.repeat(70));
}

main().catch(console.error);
