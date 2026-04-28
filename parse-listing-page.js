#!/usr/bin/env node
/**
 * Parse products from saved listing page content
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(process.cwd(), 'product-cache', 'monitor', 'dell-all');
const OUTPUT_EXCEL = path.join(process.cwd(), 'product-cache', 'Dell_All_Monitors.xlsx');

console.log('🚀 Parse Dell Monitors from Listing Page');
console.log('='.repeat(70));

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extract products from listing page content
 */
function extractProductsFromPage(content) {
  const products = [];

  // Look for product JSON blocks in the content
  // Pattern: {"identifier":"ag-monp1425","productData":{...},"metrics":{...}}
  const jsonPattern = /\{\"identifier\":\"ag-[^\"]+\"\,\"productData\":\{.+?\}\,\"metrics\":\{.+?\}\}/gs;

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
 * Parse specs from product section in listing page
 */
function parseSpecsFromListing(content, product) {
  const specs = {
    model: product.productId,
    briefName: '',
    size: '',
    resolution: '',
    refreshRate: '',
    responseTime: '',
    ports: '',
    panelType: '',
    adjustability: '',
    price: product.price ? `RM ${product.price}` : '',
    warranty: '3 years', // Malaysian standard
    features: [],
    productUrl: product.shopUrl,
    source: 'Dell Malaysia Website'
  };

  // Find the product section by searching for the productId
  const productIndex = content.indexOf(product.identifier);
  if (productIndex === -1) {
    return specs;
  }

  // Get text from product JSON to next product JSON (or end)
  const nextProductIndex = content.indexOf('{"identifier"', productIndex + 1);
  const productSection = content.substring(
    productIndex,
    nextProductIndex === -1 ? productIndex + 5000 : nextProductIndex
  );

  // Extract product name/title
  const titleMatch = productSection.match(/###\s+([^\n]+)/);
  if (titleMatch) {
    specs.briefName = titleMatch[1].trim();
  }

  // Extract diagonal size
  const sizeMatch = productSection.match(/Diagonal Size\s*\n\s*(\d+(?:\.\d+)?)"/);
  if (sizeMatch) {
    const size = parseFloat(sizeMatch[1]);
    specs.size = `${size} Inch`;
  }

  // Extract resolution and refresh rate
  const resRefreshMatch = productSection.match(/Resolution\s*\/\s*Refresh Rate\s*\n\s*(.+)/i);
  if (resRefreshMatch) {
    const resText = resRefreshMatch[1].trim();

    // Extract resolution
    const resMatch = resText.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
    if (resMatch) {
      specs.resolution = `${resMatch[1]} x ${resMatch[2]}`;
    }

    // Extract refresh rate
    const refreshMatch = resText.match(/(\d+)\s*Hz/i);
    if (refreshMatch) {
      specs.refreshRate = `${refreshMatch[1]}Hz`;
    }

    // Check for resolution labels
    if (resText.toLowerCase().includes('fhd') && specs.resolution === '1920 x 1080') {
      specs.resolution = '1920 x 1080 FHD';
    } else if (resText.toLowerCase().includes('qhd') && specs.resolution === '2560 x 1440') {
      specs.resolution = '2560 x 1440 QHD';
    } else if (resText.toLowerCase().includes('4k') && specs.resolution === '3840 x 2160') {
      specs.resolution = '3840 x 2160 4K UHD';
    }
  }

  // Extract panel technology
  const panelMatch = productSection.match(/Panel Technology\s*\n\s*([^\n]+)/);
  if (panelMatch) {
    specs.panelType = panelMatch[1].trim();
  }

  // Extract adjustability
  const adjMatch = productSection.match(/Adjustability\s*\n\s*([^\n]+)/);
  if (adjMatch) {
    specs.adjustability = adjMatch[1].trim();
  }

  // Extract ports
  const portsMatch = productSection.match(/Ports\s*\n\s*([^\n]+(?:\n\s+[^\n]+)*)/);
  if (portsMatch) {
    const portsText = portsMatch[1].trim();
    const ports = [];
    if (portsText.includes('DisplayPort')) ports.push('DisplayPort');
    if (portsText.includes('HDMI')) ports.push('HDMI');
    if (portsText.includes('USB Type-C') || portsText.includes('USB-C')) ports.push('USB-C');
    if (portsText.includes('VGA')) ports.push('VGA');
    if (portsText.includes('Thunderbolt')) ports.push('Thunderbolt');
    if (portsText.includes('RJ45') || portsText.includes('Ethernet')) ports.push('Ethernet');
    specs.ports = ports.join(', ');
  }

  // Extract features
  if (specs.briefName.toLowerCase().includes('touch')) specs.features.push('Touch Screen');
  if (specs.briefName.toLowerCase().includes('webcam')) specs.features.push('Webcam');
  if (specs.ports.includes('USB-C')) specs.features.push('USB-C Hub');
  if (specs.adjustability.toLowerCase().includes('height')) specs.features.push('Height Adjustable');
  if (specs.briefName.toLowerCase().includes('speaker')) specs.features.push('Speakers');

  return specs;
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
  const listingContentFile = path.join(process.cwd(), 'listing-page-content.txt');

  if (!fs.existsSync(listingContentFile)) {
    console.error(`❌ Listing page content not found: ${listingContentFile}`);
    console.error('   Please fetch the page content first using webReader.');
    return;
  }

  console.log(`📄 Reading listing page content...`);

  const content = fs.readFileSync(listingContentFile, 'utf-8');

  console.log(`🔍 Extracting products...`);
  const products = extractProductsFromPage(content);

  console.log(`✅ Found ${products.length} products on page 1`);
  console.log('');

  if (products.length === 0) {
    console.log('❌ No products found.');
    return;
  }

  // Parse specs from listing page
  let successCount = 0;
  let failCount = 0;
  const missingData = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`[${i+1}/${products.length}] ${product.productId}`);

    const specs = parseSpecsFromListing(content, product);

    if (specs.size || specs.resolution) {
      saveProduct(specs);
      successCount++;

      console.log(`    ✅ Saved: ${specs.size || '?'}, ${specs.resolution || '?'}, ${specs.refreshRate || '?'}`);

      // Track missing fields
      const missing = [];
      if (!specs.size) missing.push('size');
      if (!specs.resolution) missing.push('resolution');
      if (!specs.refreshRate) missing.push('refresh rate');
      if (!specs.ports) missing.push('ports');
      if (!specs.panelType) missing.push('panel type');

      if (missing.length > 0) {
        missingData.push({ model: product.productId, missing });
      }
    } else {
      failCount++;
      console.log(`    ⚠️  Insufficient data extracted`);
      missingData.push({ model: product.productId, missing: ['all major specs'] });
    }

    console.log('');
  }

  console.log('='.repeat(70));
  console.log('📊 SCRAPING RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Products: ${products.length}`);
  console.log(`Successfully Scraped: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('='.repeat(70));
  console.log('');

  // Report missing data
  if (missingData.length > 0) {
    console.log('⚠️  PRODUCTS WITH MISSING DATA:');
    console.log('='.repeat(70));
    missingData.forEach(({ model, missing }) => {
      console.log(`   ${model}: Missing ${missing.join(', ')}`);
    });
    console.log('='.repeat(70));
    console.log('');
  }

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
}

main().catch(console.error);
