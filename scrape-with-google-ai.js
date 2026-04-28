#!/usr/bin/env node
/**
 * Scrape Dell monitors using Google AI Studio (Gemma 4)
 * Uses Google's Generative AI API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Get your free API key from: https://aistudio.google.com/app/apikey
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY || '';

const OUTPUT_DIR = path.join(process.cwd(), 'product-cache', 'monitor', 'dell-gemma4');
const OUTPUT_EXCEL = path.join(process.cwd(), 'product-cache', 'Dell_Monitors_Gemma4.xlsx');

console.log('🤖 Dell Monitors Scraper with Gemma 4 (Google AI Studio)');
console.log('='.repeat(70));

if (!GOOGLE_AI_KEY) {
  console.log('❌ No GOOGLE_AI_KEY found');
  console.log('');
  console.log('📝 Get your FREE API key:');
  console.log('   1. Go to: https://aistudio.google.com/app/apikey');
  console.log('   2. Click "Create API Key"');
  console.log('   3. Copy the key');
  console.log('   4. Set environment variable:');
  console.log('      export GOOGLE_AI_KEY="your-key-here"');
  console.log('');
  console.log('💰 Free tier: 15 requests/minute, 1500 requests/day');
  console.log('💰 This is enough to scrape all 74 monitors!');
  process.exit(1);
}

console.log('✅ GOOGLE_AI_KEY found');
console.log('');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Call Gemma 4 via Google AI API
 */
async function callGemma4(prompt) {
  // Using Gemini 2.5 Flash (latest model, even better than Gemma 4!)
  const apiKey = GOOGLE_AI_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      }
    });

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.error) {
            reject(new Error(result.error.message));
          } else {
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
            resolve(text);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}. Response: ${responseData.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Fetch product page
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
 * Extract specs using Gemma 4
 */
async function extractSpecsWithGemma4(product) {
  const { productId, shopUrl } = product;

  if (!shopUrl) {
    console.log(`    ⚠️  No URL for ${productId}`);
    return null;
  }

  try {
    console.log(`    📄 Fetching ${productId}...`);
    const pageContent = await fetchPage(shopUrl);

    // Extract text content from HTML (first 6000 chars to stay within limits)
    const textContent = pageContent
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 6000);

    // Create prompt for Gemma 4
    const prompt = `You are a product specification extractor. Extract the following details from this Dell monitor product page.

Product ID: ${productId}

Page content (first 6000 characters):
${textContent}

Extract ONLY these fields and return as valid JSON:
{
  "size": "screen size in inches (just the number)",
  "resolution": "e.g., 1920 x 1080",
  "refreshRate": "refresh rate in Hz (just the number)",
  "responseTime": "response time in ms (just the number)",
  "panelType": "IPS, VA, TN, OLED, QD-OLED, etc.",
  "ports": "comma-separated list: HDMI, DisplayPort, USB-C, VGA, etc.",
  "adjustability": "Height, Tilt, Swivel, Pivot, etc."
}

Rules:
- Return ONLY the JSON object, nothing else
- Use empty string "" if information is not found
- For numeric values, return just the number (e.g., "27" not "27 Inch")
- For ports, list all available ports separated by commas

JSON:`;

    console.log(`    🤖 Analyzing with Gemma 4...`);
    const generatedText = await callGemma4(prompt);

    // Debug: log full response if it's short
    if (generatedText.length < 500) {
      console.log(`    📄 Full response (${generatedText.length} chars):`);
      console.log(`       ${generatedText.substring(0, 300)}...`);
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = generatedText.match(/```\s*([\s\S]*?)\s*```/);
    }
    if (!jsonMatch) {
      jsonMatch = generatedText.match(/\{[\s\S]*?\}/);
    }

    if (!jsonMatch) {
      console.log(`    ⚠️  No JSON found in response`);
      console.log(`    Response preview: ${generatedText.substring(0, 300)}...`);
      console.log(`    Response length: ${generatedText.length} chars`);
      return null;
    }

    const jsonString = jsonMatch[1] || jsonMatch[0];

    const specs = JSON.parse(jsonString);

    // Format specs
    const formattedSpecs = {
      model: productId,
      briefName: productId,
      size: specs.size ? `${specs.size} Inch` : '',
      resolution: specs.resolution || '',
      refreshRate: specs.refreshRate ? `${specs.refreshRate}Hz` : '',
      responseTime: specs.responseTime ? `${specs.responseTime}ms` : '',
      panelType: specs.panelType || '',
      ports: specs.ports || '',
      adjustability: specs.adjustability || '',
      price: product.price ? `RM ${product.price}` : '',
      warranty: '3 years',
      features: [],
      productUrl: shopUrl,
      source: 'Dell Malaysia (Gemma 4 AI)'
    };

    // Extract features
    if (specs.ports) {
      if (specs.ports.toLowerCase().includes('usb-c')) formattedSpecs.features.push('USB-C Hub');
      if (specs.ports.toLowerCase().includes('speaker')) formattedSpecs.features.push('Speakers');
    }
    if (formattedSpecs.adjustability.toLowerCase().includes('height')) {
      formattedSpecs.features.push('Height Adjustable');
    }

    return formattedSpecs;

  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    if (error.message.includes('quota')) {
      console.error(`    💡 Quota exceeded. Free tier: 15 req/min, 1500 req/day`);
    }
    return null;
  }
}

/**
 * Get products from existing cache
 */
function getProductsFromCache() {
  const cacheDir = path.join(process.cwd(), 'product-cache', 'monitor', 'dell-all');
  const files = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
    : [];

  return files.map(file => {
    const cachePath = path.join(cacheDir, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    // Extract shopUrl from cached data
    const shopUrl = product.productUrl || '';

    return {
      productId: product.model,
      shopUrl,
      price: product.price?.replace('RM ', '') || ''
    };
  });
}

/**
 * Save product to cache
 */
function saveProduct(specs) {
  if (!specs || !specs.model) return null;

  const filename = specs.model.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const cachePath = path.join(OUTPUT_DIR, `${filename}.json`);

  const product = {
    ...specs,
    features: specs.features.join(', ') || '',
    cachedAt: new Date().toISOString()
  };

  fs.writeFileSync(cachePath, JSON.stringify(product, null, 2));
  return cachePath;
}

/**
 * Generate Excel from products
 */
async function generateExcel() {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Dell Monitors (Gemma 4)');

  worksheet.columns = [
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Name', key: 'name', width: 35 },
    { header: 'Size', key: 'size', width: 12 },
    { header: 'Resolution', key: 'resolution', width: 22 },
    { header: 'Refresh Rate', key: 'refreshRate', width: 15 },
    { header: 'Response Time', key: 'responseTime', width: 15 },
    { header: 'Panel Type', key: 'panelType', width: 18 },
    { header: 'Ports', key: 'ports', width: 35 },
    { header: 'Adjustability', key: 'adjustability', width: 25 },
    { header: 'Features', key: 'features', width: 20 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Warranty', key: 'warranty', width: 12 }
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));

  let complete = 0;
  let partial = 0;
  let minimal = 0;

  files.forEach(file => {
    const cachePath = path.join(OUTPUT_DIR, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    const fields = ['size', 'resolution', 'refreshRate', 'responseTime', 'ports'];
    const filled = fields.filter(f => product[f] && product[f] !== '').length;

    if (filled >= 4) complete++;
    else if (filled >= 2) partial++;
    else minimal++;

    worksheet.addRow({
      model: product.model || '',
      name: product.briefName || '',
      size: product.size || '',
      resolution: product.resolution || '',
      refreshRate: product.refreshRate || '',
      responseTime: product.responseTime || '',
      panelType: product.panelType || '',
      ports: product.ports || '',
      adjustability: product.adjustability || '',
      features: product.features || '',
      price: product.price || '',
      warranty: product.warranty || ''
    });
  });

  await workbook.xlsx.writeFile(OUTPUT_EXCEL);
  return { complete, partial, minimal, total: files.length };
}

/**
 * Main function
 */
async function main() {
  const numToScrape = parseInt(process.argv[2]) || 5;

  console.log(`📋 Scraping ${numToScrape} products with Gemma 4 AI`);
  console.log(`💰 Free tier quota: 15 requests/minute, 1500 requests/day`);
  console.log(`⏱️  Estimated time: ~${numToScrape * 5} seconds`);
  console.log('');

  const products = getProductsFromCache();

  if (products.length === 0) {
    console.log('❌ No products found in cache');
    console.log('   Run parse-listing-page.js first to create product cache');
    process.exit(1);
  }

  console.log(`📁 Found ${products.length} cached products`);
  console.log('');

  const productsToScrape = products.slice(0, Math.min(numToScrape, products.length));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < productsToScrape.length; i++) {
    const product = productsToScrape[i];
    console.log(`[${i+1}/${productsToScrape.length}] ${product.productId}`);

    const specs = await extractSpecsWithGemma4(product);

    if (specs && (specs.size || specs.resolution)) {
      saveProduct(specs);
      successCount++;

      console.log(`    ✅ ${specs.size || '?'}, ${specs.resolution || '?'}, ${specs.refreshRate || '?'}`);
      console.log(`       Response: ${specs.responseTime || '?'}, Ports: ${specs.ports || '?'}`);
    } else {
      failCount++;
    }

    console.log('');

    // Rate limiting (respect 15 req/min limit)
    if (i < productsToScrape.length - 1) {
      console.log('    ⏳ Waiting 4 seconds to respect rate limits...');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }

  console.log('='.repeat(70));
  console.log('📊 SCRAPING RESULTS (Gemma 4 AI)');
  console.log('='.repeat(70));
  console.log(`Attempted: ${productsToScrape.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('='.repeat(70));
  console.log('');

  if (successCount > 0) {
    console.log(`📊 Generating Excel...`);
    const stats = await generateExcel();

    console.log(`✅ Excel created: ${OUTPUT_EXCEL}`);
    console.log('');
    console.log('📊 DATA COMPLETENESS:');
    console.log(`   Complete (4+ fields): ${stats.complete}`);
    console.log(`   Partial (2-3 fields): ${stats.partial}`);
    console.log(`   Minimal (0-1 field): ${stats.minimal}`);
    console.log(`   Total: ${stats.total}`);
    console.log('='.repeat(70));
  }

  console.log('');
  console.log('💡 To scrape all 12 products:');
  console.log(`   node scrape-with-google-ai.js 12`);
  console.log('');
  console.log('💡 Quota usage:');
  console.log(`   Used: ${productsToScrape.length}/15 (this minute)`);
  console.log(`   Remaining: ${1500 - productsToScrape.length}/1500 (today)`);
}

main().catch(console.error);
