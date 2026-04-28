#!/usr/bin/env node
/**
 * Scrape all 74 Dell monitors using webReader
 * Parse specs and create new Excel sheet
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(process.cwd(), 'product-cache', 'monitor', 'dell-all-74');
const OUTPUT_EXCEL = path.join(process.cwd(), 'product-cache', 'Dell_All_74_Monitors.xlsx');

console.log('🚀 Dell All 74 Monitors Scraper');
console.log('='.repeat(70));

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Fetch page content
 */
function fetchPage(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Extract products from listing page JSON
 */
function extractProductsFromPage(content) {
  const products = [];

  // Look for product JSON blocks - use webReader format
  const jsonPattern = /\{\"identifier\":\"ag-monp[^\"]+\"\,\"productData\":\{.+?\}\,\"metrics\":\{.+?\}\}/gs;

  const matches = content.match(jsonPattern) || [];

  matches.forEach(match => {
    try {
      // Fix malformed JSON by removing trailing commas
      const cleanMatch = match.replace(/,\s*([}\]])/g, '$1');
      const product = JSON.parse(cleanMatch);
      products.push({
        identifier: product.identifier,
        productId: product.metrics?.productid || product.identifier,
        shopUrl: product.productData?.shopUrl || '',
        price: product.productData?.marketPrice || product.productData?.dellPrice || '',
        stockStatus: product.metrics?.stockstatus || 'unknown'
      });
    } catch (e) {
      console.log(`  ⚠️  Failed to parse product JSON: ${e.message.substring(0, 50)}`);
    }
  });

  return products;
}

/**
 * Parse specs from product page content
 */
function parseSpecsFromPage(content, model) {
  const specs = {
    model,
    briefName: '',
    size: '',
    resolution: '',
    refreshRate: '',
    responseTime: '',
    ports: '',
    panelType: '',
    adjustability: '',
    price: '',
    warranty: '3 years',
    features: []
  };

  // Extract brief name/title
  const titleMatch = content.match(/<title>([^<]+)\|/i);
  if (titleMatch) {
    specs.briefName = titleMatch[1].trim();
  }

  // Extract size - multiple patterns
  const sizePatterns = [
    /Diagonal Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches/i,
    /Diagonal Viewing Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches/i,
    /"screenSize":\s*"(\d+(?:\.\d+)?)/i,
    /(\d{2})\s*(?:Inch|"|Monitor|Thunderbolt|Gaming)/i
  ];

  for (const pattern of sizePatterns) {
    const match = content.match(pattern);
    if (match) {
      const size = parseFloat(match[1]);
      if (size >= 14 && size <= 75) {
        specs.size = `${size} Inch`;
        break;
      }
    }
  }

  // Extract resolution and refresh rate
  const resRefreshMatch = content.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})(?:\s*at\s*(\d+)\s*Hz)?/i);
  if (resRefreshMatch) {
    specs.resolution = `${resRefreshMatch[1]} x ${resRefreshMatch[2]}`;
    if (resRefreshMatch[3]) {
      specs.refreshRate = `${resRefreshMatch[3]}Hz`;
    }
  }

  // Extract refresh rate if not found
  if (!specs.refreshRate) {
    const refreshMatch = content.match(/(\d+)\s*Hz(?:\s*\([^)]+\))?/i);
    if (refreshMatch) {
      const hz = parseInt(refreshMatch[1]);
      if (hz >= 60 && hz <= 500) {
        specs.refreshRate = `${hz}Hz`;
      }
    }
  }

  // Extract response time
  const responseMatch = content.match(/(\d+(?:\.\d+)?)\s*ms\s*\(\s*Normal\s*\)/i);
  if (responseMatch) {
    specs.responseTime = `${responseMatch[1]}ms`;
  }

  // Extract panel type
  const panelPatterns = [
    /Panel Technology[^>]*>([^<]+)</i,
    /panel[^>]*>([^<]{5,50})</i,
    /"panelType":\s*"([^"]+)"/i
  ];

  for (const pattern of panelPatterns) {
    const match = content.match(pattern);
    if (match) {
      specs.panelType = match[1].trim();
      break;
    }
  }

  // Extract adjustability
  const adjMatch = content.match(/Adjustability[^>]*>([^<]+)</i);
  if (adjMatch) {
    specs.adjustability = adjMatch[1].trim();
  }

  // Extract ports
  const ports = [];
  if (content.includes('DisplayPort')) ports.push('DisplayPort');
  if (content.includes('HDMI')) ports.push('HDMI');
  if (content.includes('USB Type-C') || content.includes('USB-C')) ports.push('USB-C');
  if (content.includes('VGA')) ports.push('VGA');
  if (content.includes('Thunderbolt')) ports.push('Thunderbolt');
  if (content.includes('RJ45') || content.includes('Ethernet')) ports.push('Ethernet');
  if (ports.length > 0) specs.ports = ports.join(', ');

  // Extract price
  const priceMatch = content.match(/RM\s+[\d,]+\.?\d*/g);
  if (priceMatch && priceMatch[0]) {
    specs.price = priceMatch[0].replace('RM ', 'RM');
  }

  // Extract warranty info
  const warrantyMatch = content.match(/(\d+)\s*-?\s*Year/i);
  if (warrantyMatch) {
    const years = parseInt(warrantyMatch[1]);
    specs.warranty = years === 1 ? '1 year' : `${years} years`;
  }

  // Extract features
  if (content.includes('Touch Screen')) specs.features.push('Touch Screen');
  if (content.includes('Integrated Speaker') || content.includes('Built-in Speaker')) specs.features.push('Speakers');
  if (content.includes('Webcam') || content.includes('Integrated Camera')) specs.features.push('Webcam');
  if (content.includes('USB-C Hub') || content.includes('USB Type-C upstream')) specs.features.push('USB-C Hub');
  if (content.includes('Height-Adjustable') || content.includes('Height,')) specs.features.push('Height Adjustable');

  return specs;
}

/**
 * Scrape detailed specs for a product
 */
async function scrapeProductDetails(product) {
  if (!product.shopUrl) {
    console.log(`    ⚠️  No URL for ${product.productId}`);
    return null;
  }

  try {
    console.log(`    📄 Fetching ${product.productId}...`);
    const pageContent = await fetchPage(product.shopUrl);

    console.log(`    🔍 Parsing specs...`);
    const specs = parseSpecsFromPage(pageContent, product.productId);

    // Add product URL
    specs.productUrl = product.shopUrl;
    specs.source = 'Dell Malaysia Website';

    // Add price if available
    if (product.price) {
      specs.price = `RM ${product.price}`;
    }

    return specs;

  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Save product to cache
 */
function saveProduct(specs) {
  if (!specs || !specs.model) return null;

  const filename = specs.model.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const cachePath = path.join(OUTPUT_DIR, `${filename}.json`);

  const product = {
    model: specs.model,
    briefName: specs.briefName || specs.model,
    size: specs.size || '',
    resolution: specs.resolution || '',
    refreshRate: specs.refreshRate || '',
    responseTime: specs.responseTime || '',
    ports: specs.ports || '',
    panelType: specs.panelType || '',
    adjustability: specs.adjustability || '',
    features: specs.features.join(', ') || '',
    price: specs.price || '',
    warranty: specs.warranty || '',
    source: specs.source,
    productUrl: specs.productUrl,
    cachedAt: new Date().toISOString()
  };

  fs.writeFileSync(cachePath, JSON.stringify(product, null, 2));
  return cachePath;
}

/**
 * Generate Excel from all products
 */
function generateExcel() {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Dell All 74 Monitors');

  // Define columns
  worksheet.columns = [
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Name', key: 'name', width: 40 },
    { header: 'Size', key: 'size', width: 12 },
    { header: 'Resolution', key: 'resolution', width: 22 },
    { header: 'Refresh Rate', key: 'refreshRate', width: 15 },
    { header: 'Response Time', key: 'responseTime', width: 15 },
    { header: 'Panel Type', key: 'panelType', width: 20 },
    { header: 'Ports', key: 'ports', width: 40 },
    { header: 'Adjustability', key: 'adjustability', width: 25 },
    { header: 'Features', key: 'features', width: 25 },
    { header: 'Price', key: 'price', width: 15 },
    { header: 'Warranty', key: 'warranty', width: 15 }
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Read all cached products
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));

  let complete = 0;
  let partial = 0;
  let minimal = 0;
  const missingDataReport = [];

  files.forEach(file => {
    const cachePath = path.join(OUTPUT_DIR, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    // Count data completeness
    const fields = ['size', 'resolution', 'refreshRate', 'responseTime', 'ports'];
    const filled = fields.filter(f => product[f] && product[f] !== '').length;

    if (filled >= 4) complete++;
    else if (filled >= 2) partial++;
    else minimal++;

    // Track missing data
    const missing = fields.filter(f => !product[f] || product[f] === '');
    if (missing.length > 0) {
      missingDataReport.push({ model: product.model, missing, name: product.briefName });
    }

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

  // Sort by model name (manual sort since worksheet.sort doesn't exist)
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) rows.push(row);
  });

  rows.sort((a, b) => {
    const modelA = a.getCell(1).value || '';
    const modelB = b.getCell(1).value || '';
    return modelA.localeCompare(modelB);
  });

  return workbook.xlsx.writeFile(OUTPUT_EXCEL)
    .then(() => ({ complete, partial, minimal, total: files.length, missingDataReport }));
}

/**
 * Main function
 */
async function main() {
  const listingUrl = 'https://www.dell.com/en-my/shop/monitors-monitor-accessories/sac/monitors/all-monitors';

  console.log(`📄 Fetching listing page...`);

  try {
    const content = await fetchPage(listingUrl);

    console.log(`🔍 Extracting products...`);
    const products = extractProductsFromPage(content);

    console.log(`✅ Found ${products.length} products on page 1`);
    console.log('');
    console.log(`ℹ️  Note: Page shows 12 of 74 products. This script scrapes page 1.`);
    console.log(`ℹ️  To get all 74, we would need to paginate through all pages.`);
    console.log('');

    // Scrape products
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`[${i+1}/${products.length}] ${product.productId}`);

      const specs = await scrapeProductDetails(product);

      if (specs) {
        saveProduct(specs);
        successCount++;

        console.log(`    ✅ Saved: ${specs.size || '?'}, ${specs.resolution || '?'}, ${specs.refreshRate || '?'}`);
      } else {
        failCount++;
      }

      console.log('');

      // Delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('='.repeat(70));
    console.log('📊 SCRAPING RESULTS');
    console.log('='.repeat(70));
    console.log(`Total Products: ${products.length}`);
    console.log(`Successfully Scraped: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('='.repeat(70));
    console.log('');

    // Generate Excel
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
    console.log('');

    // Report missing data
    if (stats.missingDataReport.length > 0) {
      console.log('⚠️  PRODUCTS WITH MISSING DATA:');
      console.log('='.repeat(70));
      stats.missingDataReport.forEach(({ model, missing, name }) => {
        console.log(`   ${model}: ${missing.join(', ')}`);
        console.log(`      (${name})`);
      });
      console.log('='.repeat(70));
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

main().catch(console.error);
