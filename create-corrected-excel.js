#!/usr/bin/env node
/**
 * Create Corrected Dell Monitors Excel
 * Uses proper Dell naming convention and accurate cache data
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const OUTPUT_FILE = path.join(CACHE_DIR, 'Dell_Monitors_Corrected.xlsx');

// Dell Series Naming Convention
const DELL_SERIES = [
  { code: 'SE', seriesName: 'SE SERIES', monitorType: 'LED MONITOR' },
  { code: 'S', seriesName: 'S SERIES', monitorType: 'LED MONITOR' },
  { code: 'P', seriesName: 'P SERIES', monitorType: 'MONITOR' },
  { code: 'U', seriesName: 'ULTRASHARP', monitorType: 'MONITOR' },
  { code: 'E', seriesName: 'E SERIES', monitorType: 'MONITOR' },
  { code: 'G', seriesName: 'GAMING SERIES', monitorType: 'MONITOR' },
  { code: 'AW', seriesName: 'ALIENWARE', monitorType: 'GAMING MONITOR' },
];

/**
 * Format Dell brief name using proper naming convention
 * Example: P2419H → "DELL P SERIES MONITOR"
 */
function formatDellBriefName(model) {
  if (!model) {
    return 'DELL MONITOR';
  }

  const modelUpper = model.toUpperCase();

  // Extract series code from model
  let seriesInfo;

  // Check for two-letter codes first (AW, SE, etc.)
  for (const series of DELL_SERIES) {
    if (modelUpper.startsWith(series.code)) {
      seriesInfo = series;
      break;
    }
  }

  // If no series found, default to basic naming
  if (!seriesInfo) {
    return `DELL ${modelUpper} MONITOR`;
  }

  // Format according to Dell naming convention
  // Example: "DELL P SERIES MONITOR" or "DELL SE SERIES LED MONITOR"
  const briefName = `DELL ${seriesInfo.seriesName} ${seriesInfo.monitorType}`;

  return briefName;
}

/**
 * Read all Dell monitor cache files and get actual data
 */
function readActualCacheData() {
  const products = [];
  const dellCacheDir = path.join(CACHE_DIR, 'monitor', 'dell');

  if (!fs.existsSync(dellCacheDir)) {
    console.log('⚠️  Dell cache directory not found');
    return products;
  }

  const files = fs.readdirSync(dellCacheDir);

  files.forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const filePath = path.join(dellCacheDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Only include monitors
        const briefName = (data.briefName || '').toLowerCase();
        if (!briefName.includes('monitor')) {
          return;
        }

        products.push(data);
      } catch (error) {
        console.error(`Error reading ${file}: ${error.message}`);
      }
    }
  });

  return products;
}

/**
 * Consolidate products by model code
 */
function consolidateProducts(products) {
  const productsMap = new Map();

  products.forEach(data => {
    // Extract model code
    let modelCode = data.model || '';

    // Try to extract model from brief name or filename
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

    // Calculate completeness
    const completeness = calculateCompleteness(data);

    // Check if we already have this model
    if (productsMap.has(modelCode)) {
      const existing = productsMap.get(modelCode);
      const existingPriority = existing._priority || 0;
      const existingCompleteness = existing._completeness || 0;

      // Replace if new entry has higher priority or more complete data
      if (priority > existingPriority || completeness > existingCompleteness) {
        productsMap.set(modelCode, {
          ...data,
          model: modelCode,
          _priority: priority,
          _completeness: completeness
        });
      }
    } else {
      productsMap.set(modelCode, {
        ...data,
        model: modelCode,
        _priority: priority,
        _completeness: completeness
      });
    }
  });

  // Convert map to array and remove internal fields
  return Array.from(productsMap.values()).map(p => {
    const { _priority, _completeness, ...cleanData } = p;
    return cleanData;
  });
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
 * Normalize and clean field values
 */
function normalizeFieldValue(value, fieldName) {
  if (!value) return '';

  let cleaned = value.trim();

  // Clean up common text issues
  cleaned = cleaned
    .replace(/\s+/g, ' ')  // Multiple spaces to single
    .replace(/port\(s\)?/gi, '')
    .replace(/supports up to/gi, '')
    .replace(/as per specified in/gi, '')
    .trim();

  // Specific field normalizations
  switch(fieldName) {
    case 'refreshRate':
      // Ensure "Hz" format (100Hz not 100 Hz)
      cleaned = cleaned.replace(/\s+Hz/g, 'Hz');
      break;
    case 'responseTime':
      // Ensure "ms" format
      cleaned = cleaned.replace(/\s+ms/g, 'ms');
      break;
    case 'ports':
      // Clean up port descriptions
      cleaned = cleaned
        .replace(/1 x /g, '')
        .replace(/(\d+) x /g, '$1 ')
        .trim();
      break;
  }

  return cleaned;
}

/**
 * Create corrected Excel file
 */
function createCorrectedExcel(products) {
  console.log(`📊 Creating corrected Excel with ${products.length} models...`);

  // Prepare data for Excel
  const excelData = products.map(product => {
    const modelCode = product.model || '';

    return {
      'Category': 'Monitor',
      'Model': modelCode,
      'Brand': 'DELL',
      'Brief Naming': formatDellBriefName(modelCode),
      'Size': normalizeFieldValue(product.size, 'size'),
      'Resolution': normalizeFieldValue(product.resolution, 'resolution'),
      'Response Time': normalizeFieldValue(product.responseTime, 'responseTime'),
      'Refresh Rate': normalizeFieldValue(product.refreshRate, 'refreshRate'),
      'Compatible Ports': normalizeFieldValue(product.ports, 'ports'),
      'Warranty': normalizeFieldValue(product.warranty, 'warranty')
    };
  });

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
    { wch: 25 },  // Brief Naming
    { wch: 10 },  // Size
    { wch: 18 },  // Resolution
    { wch: 14 },  // Response Time
    { wch: 12 },  // Refresh Rate
    { wch: 50 },  // Compatible Ports
    { wch: 35 },  // Warranty
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Dell Monitors');

  // Write file
  XLSX.writeFile(wb, OUTPUT_FILE);

  console.log(`✅ Corrected Excel created: ${OUTPUT_FILE}`);

  return excelData;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Creating Corrected Dell Monitors Excel');
  console.log('='.repeat(70));

  try {
    // Read actual cache data
    console.log('📂 Reading actual cache data from Dell monitors...');
    const products = readActualCacheData();
    console.log(`   Found ${products.length} Dell monitors in cache`);

    // Consolidate products
    console.log('🔧 Consolidating duplicate models...');
    const consolidated = consolidateProducts(products);
    console.log(`   Consolidated to ${consolidated.length} unique models`);

    // Create corrected Excel
    const excelData = createCorrectedExcel(consolidated);

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 CORRECTED EXCEL SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Unique Models: ${excelData.length}`);
    console.log(`Output File: ${OUTPUT_FILE}`);
    console.log('');

    // Show example for P2419H
    const p2419h = excelData.find(row => row['Model'] === 'P2419H');
    if (p2419h) {
      console.log('Example - P2419H (CORRECTED):');
      console.log('-'.repeat(70));
      console.log(`Category: ${p2419h['Category']}`);
      console.log(`Model: ${p2419h['Model']}`);
      console.log(`Brand: ${p2419h['Brand']}`);
      console.log(`Brief Naming: ${p2419h['Brief Naming']}`);
      console.log(`Size: ${p2419h['Size']}`);
      console.log(`Resolution: ${p2419h['Resolution']}`);
      console.log(`Response Time: ${p2419h['Response Time']}`);
      console.log(`Refresh Rate: ${p2419h['Refresh Rate']}`);
      console.log(`Compatible Ports: ${p2419h['Compatible Ports']}`);
      console.log(`Warranty: ${p2419h['Warranty']}`);
      console.log('');
    }

    // Show examples for other models
    console.log('Sample Models (First 5 with data):');
    console.log('-'.repeat(70));
    let count = 0;
    excelData.forEach(row => {
      if (row['Size'] && count < 5) {
        console.log(`${row['Model'].padEnd(12)} | ${row['Brief Naming'].padEnd(25)} | ${row['Size'].padEnd(10)} | ${row['Resolution'].padEnd(18)} | ${row['Warranty']}`);
        count++;
      }
    });

    console.log('');
    console.log('✅ Corrected Excel complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the export
main().catch(console.error);
