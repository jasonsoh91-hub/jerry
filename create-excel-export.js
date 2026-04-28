#!/usr/bin/env node
/**
 * Export Dell Monitor Cache to Excel
 * Creates a summary Excel file with all cached monitor data
 */

const fs = require('fs');
const path = require('path');

// Try to use xlsx library, fallback to CSV if not available
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.log('⚠️  xlsx library not found, installing...');
  console.log('Run: npm install xlsx');
  process.exit(1);
}

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const OUTPUT_FILE = path.join(CACHE_DIR, 'Dell_Monitors_Summary.xlsx');

/**
 * Read all cached products
 */
function readAllCachedProducts() {
  const products = [];

  // Walk through product-cache directory
  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          products.push({
            ...data,
            category: detectCategory(data.briefName || data.model || '')
          });
        } catch (error) {
          console.error(`Error reading ${filePath}: ${error.message}`);
        }
      }
    });
  }

  walkDir(CACHE_DIR);
  return products;
}

/**
 * Detect category from product name
 */
function detectCategory(name) {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('monitor') || lowerName.includes('display') || lowerName.includes('screen')) {
    return 'Monitor';
  } else if (lowerName.includes('laptop') || lowerName.includes('notebook')) {
    return 'Laptop';
  } else if (lowerName.includes('phone') || lowerName.includes('smartphone')) {
    return 'Phone';
  }

  return 'Monitor'; // Default for our case
}

/**
 * Normalize Dell model series
 */
function getDellSeries(model) {
  if (!model) return '';

  const modelUpper = model.toUpperCase();

  if (modelUpper.startsWith('U')) return 'UltraSharp';
  if (modelUpper.startsWith('P')) return 'P Series (Professional)';
  if (modelUpper.startsWith('S') || modelUpper.startsWith('SE')) return 'S/SE Series (Essential)';
  if (modelUpper.startsWith('E')) return 'E Series (Essential)';
  if (modelUpper.startsWith('G') || modelUpper.includes('Gaming')) return 'Gaming';
  if (modelUpper.startsWith('AW') || modelUpper.includes('Alienware')) return 'Alienware';

  return 'Other';
}

/**
 * Extract warranty years
 */
function getWarrantyYears(warranty) {
  if (!warranty) return '';

  if (warranty.includes('3') || warranty.includes('Three')) return '3 Years';
  if (warranty.includes('1') || warranty.includes('One')) return '1 Year';
  if (warranty.includes('2') || warranty.includes('Two')) return '2 Years';

  return warranty;
}

/**
 * Create Excel file
 */
function createExcel(products) {
  console.log(`📊 Creating Excel file with ${products.length} products...`);

  // Filter only Dell monitors
  const dellMonitors = products.filter(p =>
    p.category === 'Monitor' &&
    (p.briefName?.toLowerCase().includes('dell') || p.model?.toLowerCase().includes('dell'))
  );

  console.log(`  Found ${dellMonitors.length} Dell monitors`);

  // Prepare data for Excel
  const excelData = dellMonitors.map(product => ({
    'Category': product.category,
    'Model': product.model || '',
    'Brief Name': product.briefName || '',
    'Series': getDellSeries(product.model),
    'Size (Inch)': product.size || '',
    'Resolution': product.resolution || '',
    'Refresh Rate': product.refreshRate || '',
    'Response Time': product.responseTime || '',
    'Ports': product.ports || '',
    'Warranty': getWarrantyYears(product.warranty),
    'Full Warranty Text': product.warranty || '',
    'Source': product.source || '',
    'Product URL': product.productUrl || '',
    'Cached Date': product.cachedAt ? new Date(product.cachedAt).toLocaleDateString() : '',
    'Expires Date': product.expiresAt ? new Date(product.expiresAt).toLocaleDateString() : ''
  }));

  // Sort by Series, then by Model
  excelData.sort((a, b) => {
    const seriesCompare = a['Series'].localeCompare(b['Series']);
    if (seriesCompare !== 0) return seriesCompare;
    return a['Model'].localeCompare(b['Model']);
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Category
    { wch: 15 }, // Model
    { wch: 40 }, // Brief Name
    { wch: 25 }, // Series
    { wch: 12 }, // Size
    { wch: 18 }, // Resolution
    { wch: 12 }, // Refresh Rate
    { wch: 15 }, // Response Time
    { wch: 35 }, // Ports
    { wch: 10 }, // Warranty
    { wch: 50 }, // Full Warranty Text
    { wch: 30 }, // Source
    { wch: 50 }, // Product URL
    { wch: 12 }, // Cached Date
    { wch: 12 }, // Expires Date
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Dell Monitors');

  // Create summary sheet
  createSummarySheet(wb, dellMonitors);

  // Write file
  XLSX.writeFile(wb, OUTPUT_FILE);

  console.log(`✅ Excel file created: ${OUTPUT_FILE}`);
  console.log(`   Total rows: ${excelData.length + 1}`); // +1 for header

  return excelData;
}

/**
 * Create summary sheet with statistics
 */
function createSummarySheet(wb, products) {
  const summary = [];

  // Count by series
  const seriesCount = {};
  products.forEach(p => {
    const series = getDellSeries(p.model);
    seriesCount[series] = (seriesCount[series] || 0) + 1;
  });

  // Series summary
  summary.push(['Dell Monitor Cache Summary']);
  summary.push([]);
  summary.push(['Metric', 'Value']);
  summary.push(['Total Monitors', products.length]);
  summary.push([]);
  summary.push(['By Series']);
  Object.entries(seriesCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([series, count]) => {
      summary.push([series, count]);
    });

  // Warranty summary
  summary.push([]);
  summary.push(['Warranty Distribution']);
  const warrantyCount = {};
  products.forEach(p => {
    const warranty = getWarrantyYears(p.warranty) || 'Unknown';
    warrantyCount[warranty] = (warrantyCount[warranty] || 0) + 1;
  });
  Object.entries(warrantyCount).forEach(([warranty, count]) => {
    summary.push([warranty, count]);
  });

  // Size distribution
  summary.push([]);
  summary.push(['Size Distribution']);
  const sizeCount = {};
  products.forEach(p => {
    const size = p.size || 'Unknown';
    sizeCount[size] = (sizeCount[size] || 0) + 1;
  });
  Object.entries(sizeCount)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .forEach(([size, count]) => {
      summary.push([size, count]);
    });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws['!cols'] = [{ wch: 30 }, { wch: 15 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Dell Monitor Excel Export');
  console.log('=' .repeat(60));

  try {
    // Read all cached products
    console.log('📂 Reading cached products...');
    const products = readAllCachedProducts();
    console.log(`   Found ${products.length} total products`);

    // Create Excel file
    const excelData = createExcel(products);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 EXPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Dell Monitors: ${excelData.length}`);
    console.log(`Output File: ${OUTPUT_FILE}`);
    console.log('');

    // Count by series
    const seriesCount = {};
    excelData.forEach(item => {
      const series = item['Series'];
      seriesCount[series] = (seriesCount[series] || 0) + 1;
    });

    console.log('Models by Series:');
    Object.entries(seriesCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([series, count]) => {
        console.log(`  ${series}: ${count}`);
      });

    console.log('');
    console.log('✅ Export complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the export
main().catch(console.error);
