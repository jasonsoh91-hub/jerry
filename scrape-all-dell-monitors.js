#!/usr/bin/env node
/**
 * Scrape all 74 Dell monitors from the all-monitors page
 * Extract complete specs and create new Excel sheet
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(process.cwd(), 'product-cache', 'monitor', 'dell-all');
const OUTPUT_EXCEL = path.join(process.cwd(), 'product-cache', 'Dell_All_Monitors.xlsx');

console.log('🚀 Dell All Monitors Scraper');
console.log('='.repeat(70));

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extract products from listing page JSON
 */
function extractProductsFromPage(content) {
  const products = [];

  // Look for product JSON blocks in the content
  // Pattern: {"identifier":"ag-monp1425","productData":{...},"metrics":{...}}
  // Updated regex to capture nested objects properly
  const jsonPattern = /\{\"identifier\":\"ag-[^\"]+\"\,\"productData\":\{[^\"]+\},\"metrics\":\{[^\}]+\}\}/g;

  const matches = content.match(jsonPattern) || [];

  matches.forEach(match => {
    try {
      const product = JSON.parse(match);
      products.push({
        identifier: product.identifier,
        productId: product.metrics?.productid || product.identifier,
        shopUrl: product.productData?.shopUrl || '',
        price: product.productData?.marketPrice || product.productData?.dellPrice || '',
        stockStatus: product.metrics?.stockstatus || 'unknown'
      });
    } catch (e) {
      console.log(`  ⚠️  Failed to parse product JSON`);
    }
  });

  return products;
}

/**
 * Fetch page content
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
    warranty: '3 years', // Malaysian standard
    features: []
  };

  // Extract brief name/title
  const titleMatch = content.match(/<title>([^<]+)\|/i);
  if (titleMatch) {
    specs.briefName = titleMatch[1].trim();
  }

  // Extract size from Diagonal Size section
  const sizePatterns = [
    /Diagonal Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches/i,
    /Diagonal Viewing Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches/i,
    /(\d+(?:\.\d+)?)\s*inches/i
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
    const refreshMatch = content.match(/(\d+)\s*Hz/i);
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
    /panel[^>]*>([^<]{5,50})</i
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
  const worksheet = workbook.addWorksheet('Dell All Monitors');

  // Define columns
  worksheet.columns = [
    { header: 'Model', key: 'model', width: 15 },
    { header: 'Name', key: 'name', width: 35 },
    { header: 'Size', key: 'size', width: 10 },
    { header: 'Resolution', key: 'resolution', width: 20 },
    { header: 'Refresh Rate', key: 'refreshRate', width: 15 },
    { header: 'Response Time', key: 'responseTime', width: 15 },
    { header: 'Panel Type', key: 'panelType', width: 15 },
    { header: 'Ports', key: 'ports', width: 30 },
    { header: 'Adjustability', key: 'adjustability', width: 20 },
    { header: 'Features', key: 'features', width: 20 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Warranty', key: 'warranty', width: 12 }
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

  files.forEach(file => {
    const cachePath = path.join(OUTPUT_DIR, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    // Count data completeness
    const fields = ['size', 'resolution', 'refreshRate', 'responseTime', 'ports'];
    const filled = fields.filter(f => product[f]).length;

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

  return workbook.xlsx.writeFile(OUTPUT_EXCEL)
    .then(() => ({ complete, partial, minimal, total: files.length }));
}

/**
 * Main function
 */
async function main() {
  const mode = process.argv[2] || 'scrape';

  const listingUrl = 'https://www.dell.com/en-my/shop/monitors-monitor-accessories/sac/monitors/all-monitors';

  console.log(`📄 Fetching listing page...`);

  try {
    const content = await fetchPage(listingUrl);

    console.log(`🔍 Extracting products...`);
    const products = extractProductsFromPage(content);

    console.log(`✅ Found ${products.length} products on page 1`);
    console.log('');

    if (mode === 'list') {
      console.log('📋 Product List:');
      console.log('='.repeat(70));
      products.forEach((p, i) => {
        console.log(`${i+1}. ${p.productId} - ${p.shopUrl ? '✅' : '❌ no URL'}`);
      });
      return;
    }

    // Scrape all products
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
      await new Promise(resolve => setTimeout(resolve, 2000));
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

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

main().catch(console.error);
