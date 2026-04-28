#!/usr/bin/env node
/**
 * Generate comprehensive Excel report from scraped Dell monitors
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.cwd(), 'product-cache', 'monitor', 'dell-all');
const OUTPUT_EXCEL = path.join(process.cwd(), 'product-cache', 'Dell_Scraping_Report.xlsx');

console.log('📊 Dell Monitors Scraping Report Generator');
console.log('='.repeat(70));

/**
 * Generate comprehensive Excel report
 */
async function generateReport() {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();

  // Create main products sheet
  const worksheet = workbook.addWorksheet('All Products');

  // Define columns
  worksheet.columns = [
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Product Name', key: 'name', width: 40 },
    { header: 'Size', key: 'size', width: 12 },
    { header: 'Resolution', key: 'resolution', width: 22 },
    { header: 'Refresh Rate', key: 'refreshRate', width: 15 },
    { header: 'Response Time', key: 'responseTime', width: 15 },
    { header: 'Panel Type', key: 'panelType', width: 20 },
    { header: 'Ports', key: 'ports', width: 40 },
    { header: 'Adjustability', key: 'adjustability', width: 25 },
    { header: 'Features', key: 'features', width: 25 },
    { header: 'Price', key: 'price', width: 15 },
    { header: 'Warranty', key: 'warranty', width: 15 },
    { header: 'Source', key: 'source', width: 25 }
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  worksheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Read all cached products
  const files = fs.existsSync(CACHE_DIR)
    ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))
    : [];

  console.log(`📁 Found ${files.length} cached products`);
  console.log('');

  let complete = 0;
  let partial = 0;
  let minimal = 0;
  const missingDataReport = [];
  const allProducts = [];

  files.forEach(file => {
    const cachePath = path.join(CACHE_DIR, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    allProducts.push(product);

    // Count data completeness
    const fields = ['size', 'resolution', 'refreshRate', 'responseTime', 'ports'];
    const filled = fields.filter(f => product[f] && product[f] !== '').length;

    if (filled >= 4) complete++;
    else if (filled >= 2) partial++;
    else minimal++;

    // Track missing data
    const missing = fields.filter(f => !product[f] || product[f] === '');
    if (missing.length > 0) {
      missingDataReport.push({
        model: product.model,
        missing,
        name: product.briefName,
        filled
      });
    }

    // Add row
    const row = worksheet.addRow({
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
      warranty: product.warranty || '',
      source: product.source || ''
    });

    // Color-code based on completeness
    if (filled >= 4) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC6EFCE' } // Light green
      };
    } else if (filled >= 2) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB9C' } // Light yellow
      };
    } else {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' } // Light red
      };
    }
  });

  // Freeze header row
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1 }
  ];

  // Create summary sheet
  const summarySheet = workbook.addWorksheet('Summary');

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 40 },
    { header: 'Value', key: 'value', width: 30 }
  ];

  summarySheet.getRow(1).font = { bold: true, size: 12 };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };

  // Add summary data
  summarySheet.addRow({ metric: 'Scraping Date', value: new Date().toLocaleDateString() });
  summarySheet.addRow({ metric: 'Total Products Scraped', value: files.length });
  summarySheet.addRow({ metric: 'Complete (4+ fields)', value: complete });
  summarySheet.addRow({ metric: 'Partial (2-3 fields)', value: partial });
  summarySheet.addRow({ metric: 'Minimal (0-1 field)', value: minimal });
  summarySheet.addRow({ metric: 'Data Completeness', value: `${Math.round((complete / files.length) * 100)}%` });
  summarySheet.addRow({ metric: 'Products on Dell Site', value: '74 total (12 per page × ~7 pages)' });
  summarySheet.addRow({ metric: 'Pages Scraped', value: '1 of 7' });
  summarySheet.addRow({ metric: 'Remaining Products', value: '62' });

  // Style summary rows
  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.getCell(1).font = { bold: true };
      if (rowNumber === 2) { // Total row
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' }
        };
      }
    }
  });

  // Create missing data sheet
  if (missingDataReport.length > 0) {
    const missingSheet = workbook.addWorksheet('Missing Data');

    missingSheet.columns = [
      { header: 'Model', key: 'model', width: 25 },
      { header: 'Product Name', key: 'name', width: 40 },
      { header: 'Fields Filled', key: 'filled', width: 15 },
      { header: 'Missing Fields', key: 'missing', width: 40 }
    ];

    missingSheet.getRow(1).font = { bold: true, size: 12 };
    missingSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF0000' }
    };
    missingSheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    missingDataReport.forEach(item => {
      missingSheet.addRow({
        model: item.model,
        name: item.name,
        filled: `${item.filled}/5`,
        missing: item.missing.join(', ')
      });
    });
  }

  // Create field statistics sheet
  const statsSheet = workbook.addWorksheet('Field Statistics');

  statsSheet.columns = [
    { header: 'Field', key: 'field', width: 20 },
    { header: 'Filled', key: 'filled', width: 15 },
    { header: 'Missing', key: 'missing', width: 15 },
    { header: 'Fill Rate', key: 'rate', width: 15 }
  ];

  statsSheet.getRow(1).font = { bold: true, size: 12 };
  statsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };

  const fields = ['size', 'resolution', 'refreshRate', 'responseTime', 'ports', 'panelType', 'adjustability'];
  fields.forEach(field => {
    const filled = allProducts.filter(p => p[field] && p[field] !== '').length;
    const missing = files.length - filled;
    const rate = Math.round((filled / files.length) * 100);

    statsSheet.addRow({
      field: field.charAt(0).toUpperCase() + field.slice(1),
      filled,
      missing,
      rate: `${rate}%`
    });
  });

  // Save workbook
  await workbook.xlsx.writeFile(OUTPUT_EXCEL);

  return {
    complete,
    partial,
    minimal,
    total: files.length,
    missingDataReport,
    allProducts
  };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('📊 Generating comprehensive Excel report...');
    console.log('');

    const stats = await generateReport();

    console.log(`✅ Excel report created: ${OUTPUT_EXCEL}`);
    console.log('');
    console.log('📊 SCRAPING SUMMARY:');
    console.log('='.repeat(70));
    console.log(`Total Products: ${stats.total}`);
    console.log(`✅ Complete (4+ fields): ${stats.complete} (${Math.round((stats.complete/stats.total)*100)}%)`);
    console.log(`⚠️  Partial (2-3 fields): ${stats.partial} (${Math.round((stats.partial/stats.total)*100)}%)`);
    console.log(`❌ Minimal (0-1 field): ${stats.minimal} (${Math.round((stats.minimal/stats.total)*100)}%)`);
    console.log('='.repeat(70));
    console.log('');

    // Show sample product
    if (stats.allProducts.length > 0) {
      const sample = stats.allProducts[0];
      console.log('📋 Sample Product:');
      console.log(`   Model: ${sample.model}`);
      console.log(`   Name: ${sample.briefName}`);
      console.log(`   Size: ${sample.size || 'N/A'}`);
      console.log(`   Resolution: ${sample.resolution || 'N/A'}`);
      console.log(`   Refresh: ${sample.refreshRate || 'N/A'}`);
      console.log(`   Ports: ${sample.ports || 'N/A'}`);
      console.log(`   Price: ${sample.price || 'N/A'}`);
      console.log('');
    }

    // Report missing data
    if (stats.missingDataReport.length > 0) {
      console.log('⚠️  PRODUCTS WITH MISSING DATA:');
      console.log('='.repeat(70));
      stats.missingDataReport.forEach(({ model, missing, filled }) => {
        console.log(`   ${model}: ${filled}/5 fields - Missing: ${missing.join(', ')}`);
      });
      console.log('='.repeat(70));
      console.log('');
    }

    console.log('📑 Excel Sheets Created:');
    console.log('   - All Products: Full list with color-coded completeness');
    console.log('   - Summary: Overall statistics and metrics');
    console.log('   - Missing Data: Products with incomplete information');
    console.log('   - Field Statistics: Fill rate per field');
    console.log('='.repeat(70));
    console.log('');
    console.log('💡 Note: This is page 1 of 7 (12 of 74 products)');
    console.log('💡 To scrape all 74 products, pagination would be needed');

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

main().catch(console.error);
