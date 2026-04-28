#!/usr/bin/env node
/**
 * Fix resolution labels and simplify warranty text
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');

/**
 * Get resolution format label
 */
function getResolutionLabel(resolution) {
  if (!resolution) return '';

  // Extract dimensions
  const match = resolution.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (!match) return resolution;

  const width = parseInt(match[1]);
  const height = parseInt(match[2]);

  // Common resolution formats
  const formats = {
    '1920x1080': 'FHD',
    '2560x1440': 'QHD',
    '3840x2160': '4K UHD',
    '5120x1440': 'DQHD',
    '5120x2880': '5K',
    '7680x4320': '8K',
    '1920x1200': 'WUXGA',
    '2560x1600': 'WQXGA',
    '3440x1440': 'UWQHD',
    '3840x1600': 'WUHD',
    '2560x1080': 'UWFHD',
  };

  const key = `${width}x${height}`;
  if (formats[key]) {
    return `${width} x ${height} ${formats[key]}`;
  }

  // Calculate aspect ratio and determine format
  const ratio = width / height;
  const totalPixels = width * height;

  // Ultra-wide monitors
  if (ratio > 2.3) {
    if (totalPixels >= 7370000) return `${width} x ${height} DQHD`; // 5120x1440
    if (totalPixels >= 4900000) return `${width} x ${height} UWQHD`; // 3440x1440
    if (totalPixels >= 2700000) return `${width} x ${height} UWFHD`; // 2560x1080
  }

  // Standard and wide monitors
  if (totalPixels >= 8290000) return `${width} x ${height} 4K UHD`; // ~3840x2160
  if (totalPixels >= 3680000) return `${width} x ${height} QHD`; // ~2560x1440
  if (totalPixels >= 2070000) return `${width} x ${height} FHD`; // ~1920x1080

  return `${width} x ${height}`;
}

/**
 * Simplify warranty text
 */
function simplifyWarranty(warranty) {
  if (!warranty) return '';

  // Extract number of years
  const yearMatch = warranty.match(/(\d+)\s*(?:Year|Years)/i);
  if (yearMatch) {
    const years = parseInt(yearMatch[1]);
    if (years === 1) return '1 year';
    return `${years} years`;
  }

  return warranty;
}

/**
 * Update all products
 */
function updateAllProducts() {
  const cacheDir = path.join(CACHE_DIR, 'monitor', 'dell');
  const files = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
    : [];

  let updatedCount = 0;
  const updates = [];

  console.log(`📊 Processing ${files.length} products...`);
  console.log('');

  files.forEach(file => {
    const cachePath = path.join(cacheDir, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    let modified = false;
    const changes = [];

    // Fix resolution
    if (product.resolution) {
      const newResolution = getResolutionLabel(product.resolution);
      if (newResolution !== product.resolution) {
        product.resolution = newResolution;
        modified = true;
        changes.push(`Resolution: ${newResolution}`);
      }
    }

    // Simplify warranty
    if (product.warranty) {
      const newWarranty = simplifyWarranty(product.warranty);
      if (newWarranty !== product.warranty) {
        product.warranty = newWarranty;
        modified = true;
        changes.push(`Warranty: ${newWarranty}`);
      }
    }

    if (modified) {
      product.updatedAt = new Date().toISOString();
      fs.writeFileSync(cachePath, JSON.stringify(product, null, 2));
      updatedCount++;

      console.log(`✅ ${product.model || file}`);
      changes.forEach(change => console.log(`   ${change}`));
      console.log('');
    }
  });

  console.log('='.repeat(70));
  console.log(`📊 Updated ${updatedCount} products`);
  console.log('='.repeat(70));

  return updatedCount;
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Fix Resolution Labels & Simplify Warranty');
  console.log('='.repeat(70));
  console.log('');

  updateAllProducts();

  console.log('');
  console.log('📊 Regenerating Excel...');

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

main().catch(console.error);
