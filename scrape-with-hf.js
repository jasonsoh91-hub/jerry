#!/usr/bin/env node
/**
 * Free Hugging Face Scraper
 * Uses free models or regex fallback
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const HF_TOKEN = process.env.HF_TOKEN || '';

console.log('🚀 Free Hugging Face Scraper');
console.log('='.repeat(70));

if (!HF_TOKEN) {
  console.log('⚠️  No HF_TOKEN - using regex parsing');
}

// Free models that work on HF Inference API
const FREE_MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.2',
  'meta-llama/Llama-2-7b-chat-hf',
  'microsoft/DialoGPT-medium'
];

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

function parseWithRegex(content, modelName) {
  const specs = {
    size: '',
    resolution: '',
    refreshRate: '',
    responseTime: '',
    ports: '',
    warranty: '3 Years Limited Hardware and Advanced Exchange Service'
  };

  // Extract size - look for diagonal size patterns
  const sizePatterns = [
    /Diagonal\s+Size[^0-9]*([\d.]+)/i,
    /"screenSize":"([\d.]+)"/i,
    /(\d+(?:\.\d+)?)\s*(?:inch|"|Inch)/i
  ];

  for (const pattern of sizePatterns) {
    const match = content.match(pattern);
    if (match) {
      specs.size = `${match[1]} Inch`;
      break;
    }
  }

  // Extract resolution
  const resPatterns = [
    /Resolution[^0-9]*(\d{3,4})\s*x\s*(\d{3,4})/i,
    /"resolution":"(\d{3,4})\s*x\s*(\d{3,4})"/i
  ];

  for (const pattern of resPatterns) {
    const match = content.match(pattern);
    if (match) {
      specs.resolution = `${match[1]} x ${match[2]}`;
      break;
    }
  }

  // Extract refresh rate
  const refreshPatterns = [
    /(\d+)\s*Hz/i,
    /RefreshRate[^0-9]*(\d+)/i
  ];

  for (const pattern of refreshPatterns) {
    const match = content.match(pattern);
    if (match) {
      specs.refreshRate = `${match[1]}Hz`;
      break;
    }
  }

  // Special case for SE2225HM
  if (modelName === 'SE2225HM' || modelName === 'SE2222HM') {
    specs.refreshRate = '100Hz';
  }

  // Extract response time
  const responsePatterns = [
    /Response\s+Time[^0-9]*(\d+(?:\.\d+)?)\s*ms/i,
    /(\d+(?:\.\d+)?)\s*ms\s*(?:GTG|gtg)/i
  ];

  for (const pattern of responsePatterns) {
    const match = content.match(pattern);
    if (match) {
      specs.responseTime = `${match[1]}ms`;
      break;
    }
  }

  // Extract ports
  const ports = [];
  if (content.includes('HDMI')) ports.push('HDMI');
  if (content.includes('DisplayPort') || content.includes('DP')) ports.push('DisplayPort');
  if (content.includes('USB-C') || content.includes('USB C')) ports.push('USB-C');
  if (content.includes('VGA')) ports.push('VGA');
  if (content.includes('USB') && !content.includes('USB-C')) ports.push('USB');
  if (ports.length > 0) specs.ports = ports.join(', ');

  return specs;
}

async function parseWithAI(content, modelName) {
  if (!HF_TOKEN) {
    return parseWithRegex(content, modelName);
  }

  try {
    const { HfInference } = require('@huggingface/inference');
    const hf = new HfInference(HF_TOKEN);

    // Try mistral model (free tier friendly)
    const model = 'mistralai/Mistral-7B-Instruct-v0.2';

    const prompt = `<s>[INST] Extract these specs from the Dell monitor page:
Size in inches, Resolution (e.g. 1920 x 1080), Refresh Rate in Hz, Response Time in ms, Ports (HDMI, DisplayPort, VGA, USB-C), Warranty.

Return JSON only:
{
  "size": "21.5",
  "resolution": "1920 x 1080",
  "refreshRate": "100Hz",
  "responseTime": "8ms",
  "ports": "HDMI, VGA",
  "warranty": "3 Years"
}

Page content (first 3000 chars):
${content.substring(0, 3000)}
[/INST]</s>`;

    const result = await hf.textGeneration({
      model,
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

    if (!specs.warranty) {
      specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
    }

    return specs;

  } catch (error) {
    console.log(`    ⚠️  AI parsing failed: ${error.message}`);
    console.log(`    📝 Using regex fallback`);
    return parseWithRegex(content, modelName);
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

    console.log(`    🤖 Parsing specs...`);
    const specs = await parseWithAI(pageContent, product.model);

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

  const incomplete = getIncompleteProducts();

  console.log(`📊 Found ${incomplete.length} products with missing data`);
  console.log('');

  if (mode === 'test') {
    console.log(`🧪 Test mode: First 5 products`);
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

    if (successCount >= 3) {
      console.log('✅ Test successful! Ready to scrape all products.');
      console.log('');
      console.log('To scrape all products, run:');
      console.log('  node scrape-with-hf.js all');
    } else {
      console.log('⚠️  Test had mixed results. You can still try scraping all.');
    }

  } else {
    // All products
    console.log(`🚀 Scraping all ${incomplete.length} products`);
    console.log(`⏱️  Estimated time: ~${Math.ceil(incomplete.length * 2 / 60)} minutes`);
    console.log('');

    let totalFilled = 0;
    let successCount = 0;

    for (let i = 0; i < incomplete.length; i++) {
      const product = incomplete[i];
      console.log(`[${i+1}/${incomplete.length}] ${product.model}`);
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
