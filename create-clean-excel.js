#!/usr/bin/env node
/**
 * Create Clean Dell Monitors Excel
 * Consolidates duplicates and shows only essential columns
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const OUTPUT_FILE = path.join(CACHE_DIR, 'Dell_Monitors_Clean.xlsx');

/**
 * Read and consolidate all cached products
 */
function readAndConsolidateProducts() {
  const productsMap = new Map();

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

          // Only process monitors
          const briefName = (data.briefName || '').toLowerCase();
          if (!briefName.includes('monitor') && !briefName.includes('display')) {
            return;
          }

          // Only process Dell monitors
          if (!briefName.includes('dell')) {
            return;
          }

          // Extract model code
          let modelCode = data.model || '';

          // Try to extract model from brief name if no model field
          if (!modelCode) {
            const modelMatch = (data.briefName || '').match(/([A-Z]+\d{4}[A-Z]?)/i);
            if (modelMatch) {
              modelCode = modelMatch[1].toUpperCase();
            }
          }

          if (!modelCode) {
            return; // Skip if no model code
          }

          // Normalize model code
          modelCode = modelCode.toUpperCase().trim();

          // Determine priority (Malaysian data > others)
          const source = data.source || '';
          const isMalaysian = source.includes('en-my') || source.includes('Malaysia');
          const priority = isMalaysian ? 2 : 1;

          // Check if we already have this model
          if (productsMap.has(modelCode)) {
            const existing = productsMap.get(modelCode);

            // Replace if:
            // 1. New entry is Malaysian and existing is not
            // 2. New entry has more complete data
            const existingPriority = existing._priority || 0;
            const existingCompleteness = existing._completeness || 0;

            const newCompleteness = calculateCompleteness(data);

            if (priority > existingPriority || newCompleteness > existingCompleteness) {
              productsMap.set(modelCode, {
                ...data,
                model: modelCode,
                _priority: priority,
                _completeness: newCompleteness
              });
            }
          } else {
            // Add new entry
            const completeness = calculateCompleteness(data);
            productsMap.set(modelCode, {
              ...data,
              model: modelCode,
              _priority: priority,
              _completeness: completeness
            });
          }

        } catch (error) {
          // Skip invalid files
        }
      }
    });
  }

  walkDir(CACHE_DIR);

  // Convert map to array and remove internal fields
  const products = Array.from(productsMap.values()).map(p => {
    const { _priority, _completeness, ...cleanData } = p;
    return cleanData;
  });

  return products;
}

/**
 * Calculate data completeness score
 */
function calculateCompleteness(data) {
  let score = 0;
  const fields = ['size', 'resolution', 'refreshRate', 'responseTime', 'ports', 'warranty'];
  fields.forEach(field => {
    if (data[field] && data[field].trim() !== '') {
      score++;
    }
  });
  return score;
}

/**
 * Normalize refresh rate format
 */
function normalizeRefreshRate(refreshRate) {
  if (!refreshRate) return '';

  // Convert "100 Hz" to "100Hz"
  return refreshRate.replace(/\s+/g, '').replace('Hz', 'Hz') || refreshRate;
}

/**
 * Clean up ports text
 */
function cleanPorts(ports) {
  if (!ports) return '';

  // Remove redundant text
  return ports
    .replace(/port\(s\)?/gi, '')
    .replace(/supports up to/gi, '')
    .replace(/as per specified in/gi, '')
    .trim();
}

/**
 * Create clean Excel file
 */
function createCleanExcel(products) {
  console.log(`📊 Creating clean Excel with ${products.length} unique models...`);

  // Prepare data for Excel
  const excelData = products.map(product => ({
    'Category': 'Monitor',
    'Model': product.model || '',
    'Brand': 'DELL',
    'Brief Naming': product.briefName || '',
    'Size': product.size || '',
    'Resolution': product.resolution || '',
    'Response Time': product.responseTime || '',
    'Refresh Rate': normalizeRefreshRate(product.refreshRate),
    'Compatible Ports': cleanPorts(product.ports),
    'Warranty': product.warranty || ''
  }));

  // Sort by Model
  excelData.sort((a, b) => a['Model'].localeCompare(b['Model']));

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  ws['!cols'] = [
    { wch: 10 },  // Category
    { wch: 12 },  // Model
    { wch: 8 },   // Brand
    { wch: 45 },  // Brief Naming
    { wch: 10 },  // Size
    { wch: 18 },  // Resolution
    { wch: 14 },  // Response Time
    { wch: 12 },  // Refresh Rate
    { wch: 40 },  // Compatible Ports
    { wch: 35 },  // Warranty
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Dell Monitors');

  // Write file
  XLSX.writeFile(wb, OUTPUT_FILE);

  console.log(`✅ Clean Excel created: ${OUTPUT_FILE}`);

  return excelData;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Creating Clean Dell Monitors Excel');
  console.log('=' .repeat(60));

  try {
    // Read and consolidate products
    console.log('📂 Reading and consolidating cached products...');
    const products = readAndConsolidateProducts();
    console.log(`   Found ${products.length} unique Dell monitors`);

    // Create clean Excel
    const excelData = createCleanExcel(products);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEAN EXCEL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Unique Models: ${excelData.length}`);
    console.log(`Output File: ${OUTPUT_FILE}`);
    console.log('');

    // Show sample rows
    console.log('Sample Data (First 5 models):');
    console.log('-'.repeat(60));
    excelData.slice(0, 5).forEach(row => {
      console.log(`${row.Model.padEnd(12)} | ${row.Size.padEnd(10)} | ${row.Resolution.padEnd(15)} | ${row.Warranty.padEnd(10)}`);
    });
    console.log('');

    // Count data completeness
    let completeCount = 0;
    excelData.forEach(row => {
      if (row.Size && row.Resolution && row.Warranty) {
        completeCount++;
      }
    });

    console.log(`Data Quality: ${completeCount}/${excelData.length} models have complete data (${Math.round(completeCount/excelData.length*100)}%)`);
    console.log('');
    console.log('✅ Clean Excel complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the export
main().catch(console.error);
