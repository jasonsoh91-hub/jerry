#!/usr/bin/env node
/**
 * Fix Model Extraction and Create Final Corrected Excel
 * Properly extracts model codes from brief names and uses Dell naming convention
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');
const OUTPUT_FILE = path.join(CACHE_DIR, 'Dell_Monitors_Final.xlsx');

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
 * Extract proper model code from various sources
 */
function extractModelCode(data) {
  // First try to get from model field
  let modelCode = data.model || '';

  // If model is a numeric ID (from Google Shopping), extract from brief name
  if (/^\d+$/.test(modelCode) || modelCode.length > 10) {
    const briefName = data.briefName || '';

    // Try multiple patterns to extract model code
    const patterns = [
      /([A-Z]+\d{4}[A-Z]?)/i,           // P2419H, U2424H
      /([A-Z]+-\d{4}[A-Z]?)/i,          // P-2419-H (with dashes)
      /\b([A-Z]+ \d{4}[A-Z]?)\b/i,      // P 2419 H (with spaces)
    ];

    for (const pattern of patterns) {
      const match = briefName.match(pattern);
      if (match) {
        modelCode = match[1].toUpperCase().replace(/[-\s]/g, '');
        break;
      }
    }
  }

  return modelCode.toUpperCase().trim();
}

/**
 * Format Dell brief name using proper naming convention
 */
function formatDellBriefName(modelCode) {
  if (!modelCode) {
    return 'DELL MONITOR';
  }

  const modelUpper = modelCode.toUpperCase();

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
  const briefName = `DELL ${seriesInfo.seriesName} ${seriesInfo.monitorType}`;

  return briefName;
}

/**
 * Read all Dell monitor cache files
 */
function readAllDellMonitors() {
  const products = [];

  // Search in both dell and generic folders
  const searchDirs = [
    path.join(CACHE_DIR, 'monitor', 'dell'),
    path.join(CACHE_DIR, 'monitor', 'generic')
  ];

  searchDirs.forEach(cacheDir => {
    if (!fs.existsSync(cacheDir)) {
      return;
    }

    const files = fs.readdirSync(cacheDir);

    files.forEach(file => {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(cacheDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // Only include Dell monitors
          const briefName = (data.briefName || '').toLowerCase();
          if (!briefName.includes('dell') || (!briefName.includes('monitor') && !briefName.includes('display'))) {
            return;
          }

          products.push(data);
        } catch (error) {
          // Skip invalid files
        }
      }
    });
  });

  return products;
}

/**
 * Consolidate products by properly extracted model code
 */
function consolidateByModelCode(products) {
  const productsMap = new Map();

  products.forEach(data => {
    // Extract proper model code
    const modelCode = extractModelCode(data);

    if (!modelCode || modelCode.length < 4) {
      return; // Skip invalid model codes
    }

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
      cleaned = cleaned.replace(/\s+Hz/g, 'Hz');
      break;
    case 'responseTime':
      cleaned = cleaned.replace(/\s+ms/g, 'ms');
      break;
    case 'ports':
      cleaned = cleaned
        .replace(/1 x /g, '')
        .replace(/(\d+) x /g, '$1 ')
        .trim();
      break;
  }

  return cleaned;
}

/**
 * Create final corrected Excel file
 */
function createFinalExcel(products) {
  console.log(`📊 Creating final Excel with ${products.length} models...`);

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

  console.log(`✅ Final Excel created: ${OUTPUT_FILE}`);

  return excelData;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Creating Final Corrected Dell Monitors Excel');
  console.log('='.repeat(80));

  try {
    // Read all Dell monitors
    console.log('📂 Reading all Dell monitor data...');
    const products = readAllDellMonitors();
    console.log(`   Found ${products.length} Dell monitors in cache`);

    // Consolidate by proper model code
    console.log('🔧 Extracting model codes and consolidating...');
    const consolidated = consolidateByModelCode(products);
    console.log(`   Consolidated to ${consolidated.length} unique models`);

    // Create final Excel
    const excelData = createFinalExcel(consolidated);

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL EXCEL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Unique Models: ${excelData.length}`);
    console.log(`Output File: ${OUTPUT_FILE}`);
    console.log('');

    // Show P2419H specifically
    const p2419h = excelData.find(row => row['Model'] === 'P2419H');
    if (p2419h) {
      console.log('✅ P2419H (CORRECTED):');
      console.log('-'.repeat(80));
      console.log(`Category:          ${p2419h['Category']}`);
      console.log(`Model:             ${p2419h['Model']}`);
      console.log(`Brand:             ${p2419h['Brand']}`);
      console.log(`Brief Naming:      ${p2419h['Brief Naming']}`);
      console.log(`Size:              ${p2419h['Size']}`);
      console.log(`Resolution:        ${p2419h['Resolution']}`);
      console.log(`Response Time:     ${p2419h['Response Time']}`);
      console.log(`Refresh Rate:      ${p2419h['Refresh Rate']}`);
      console.log(`Compatible Ports:  ${p2419h['Compatible Ports']}`);
      console.log(`Warranty:          ${p2419h['Warranty']}`);
      console.log('');
    }

    // Show SE2225H for comparison
    const se2225hm = excelData.find(row => row['Model'] === 'SE2225HM');
    if (se2225hm) {
      console.log('✅ SE2225HM (For Reference):');
      console.log('-'.repeat(80));
      console.log(`Category:          ${se2225hm['Category']}`);
      console.log(`Model:             ${se2225hm['Model']}`);
      console.log(`Brand:             ${se2225hm['Brand']}`);
      console.log(`Brief Naming:      ${se2225hm['Brief Naming']}`);
      console.log(`Size:              ${se2225hm['Size']}`);
      console.log(`Resolution:        ${se2225hm['Resolution']}`);
      console.log(`Response Time:     ${se2225hm['Response Time']}`);
      console.log(`Refresh Rate:      ${se2225hm['Refresh Rate']}`);
      console.log(`Compatible Ports:  ${se2225hm['Compatible Ports']}`);
      console.log(`Warranty:          ${se2225hm['Warranty']}`);
      console.log('');
    }

    // Show all models with data
    console.log('All Models with Size Data:');
    console.log('-'.repeat(80));
    excelData.forEach(row => {
      if (row['Size']) {
        console.log(`${row['Model'].padEnd(12)} | ${row['Brief Naming'].padEnd(25)} | ${row['Size'].padEnd(10)} | ${row['Warranty']}`);
      }
    });

    console.log('');
    console.log('✅ Final Excel complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the export
main().catch(console.error);
