#!/usr/bin/env node
/**
 * Fast Product Scraper using webReader MCP Tool
 * Fills missing data for incomplete products
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');

/**
 * Read all cached products and identify incomplete/wrong ones
 */
function getProductsNeedingUpdate() {
  const cacheDir = path.join(CACHE_DIR, 'monitor', 'dell');
  const files = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
    : [];

  const wrongSize = [];
  const incomplete = [];

  files.forEach(file => {
    const cachePath = path.join(cacheDir, file);
    const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    const missing = [];
    if (!product.size) missing.push('size');
    if (!product.resolution) missing.push('resolution');
    if (!product.refreshRate) missing.push('refreshRate');
    if (!product.responseTime) missing.push('responseTime');
    if (!product.ports) missing.push('ports');
    if (!product.warranty) missing.push('warranty');

    // Check for obviously wrong sizes
    if (product.size && (product.size === '1 Inch' || product.size === '2 Inch' ||
        product.size === '3 Inch' || product.size === '4 Inch' ||
        product.size === '5 Inch' || product.size === '6 Inch')) {
      wrongSize.push({
        ...product,
        missing,
        cachePath,
        issue: 'wrong_size'
      });
    } else if (missing.length > 0 && product.productUrl) {
      incomplete.push({
        ...product,
        missing,
        cachePath
      });
    }
  });

  return { wrongSize, incomplete };
}

/**
 * Parse product specs from clean text content (from webReader)
 */
function parseSpecsFromCleanText(content, model) {
  const specs = {
    size: '',
    resolution: '',
    refreshRate: '',
    responseTime: '',
    ports: '',
    warranty: '3 Years Limited Hardware and Advanced Exchange Service'
  };

  // Look for "Diagonal Size" or "inches" pattern
  // Pattern from webReader: "23.80 inches" or "604.70 mm\n23.80 inches"
  const inchesPatterns = [
    /Diagonal Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches/i,
    /Diagonal Viewing Size[^0-9\n]*[\d.]+\s*mm[^0-9\n]*(\d+(?:\.\d+)?)\s*inches/i,
    /(\d+(?:\.\d+)?)\s*inches/i
  ];

  for (const pattern of inchesPatterns) {
    const match = content.match(pattern);
    if (match) {
      const size = parseFloat(match[1]);
      // Only accept reasonable monitor sizes (15-80 inches)
      if (size >= 15 && size <= 80) {
        specs.size = `${size} Inch`;
        break;
      }
    }
  }

  // Fallback: Look for size in URL or briefName patterns
  if (!specs.size) {
    // Pattern: alienware-27-360hz or ultrasharp-27-4k or dell-ultrasharp-24-monitor
    const urlSizeMatch = content.match(/-(\d{2})-?\d*(?:hz|4k|monitor|inch|")/i);
    if (urlSizeMatch) {
      const size = parseInt(urlSizeMatch[1]);
      if (size >= 15 && size <= 80) {
        specs.size = `${size} Inch`;
      }
    }

    // Pattern: "52 Thunderbolt" or "27 Gaming" in briefName/title
    if (!specs.size) {
      const nameSizeMatch = content.match(/(\d{2})\s*(?:Inch|"|Monitor|Thunderbolt|Gaming|4K|OLED)/i);
      if (nameSizeMatch) {
        const size = parseInt(nameSizeMatch[1]);
        if (size >= 15 && size <= 80) {
          specs.size = `${size} Inch`;
        }
      }
    }
  }

  // Extract resolution and refresh rate together
  // Pattern: "1920 x 1080 at 120 Hz"
  const resRefreshMatch = content.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})(?:\s*at\s*(\d+)\s*Hz)?/i);
  if (resRefreshMatch) {
    specs.resolution = `${resRefreshMatch[1]} x ${resRefreshMatch[2]}`;
    if (resRefreshMatch[3]) {
      specs.refreshRate = `${resRefreshMatch[3]}Hz`;
    }
  }

  // Extract refresh rate if not found above
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
  // Pattern: "8 ms (Normal)" or "5 ms (Fast)"
  const responseMatch = content.match(/(\d+(?:\.\d+)?)\s*ms\s*\(\s*Normal\s*\)/i);
  if (responseMatch) {
    specs.responseTime = `${responseMatch[1]}ms`;
  }

  // Extract ports
  const ports = [];
  if (content.includes('DisplayPort')) ports.push('DisplayPort');
  if (content.includes('HDMI')) ports.push('HDMI');
  if (content.includes('USB Type-C') || content.includes('USB-C') || content.includes('USB C')) {
    if (!ports.includes('USB-C')) ports.push('USB-C');
  }
  if (content.includes('VGA')) ports.push('VGA');
  if (content.includes('USB Type-A') && !content.includes('USB-C')) ports.push('USB');

  if (ports.length > 0) specs.ports = ports.join(', ');

  // Special case for SE2225HM
  if ((model === 'SE2225HM' || model === 'SE2222HM') && specs.refreshRate === '60Hz') {
    specs.refreshRate = '100Hz';
  }

  return specs;
}

/**
 * Fetch product page content using https
 */
function fetchProductPage(url) {
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
 * Parse product specs from HTML/text content
 */
function parseSpecsFromContent(content, model) {
  const specs = {
    size: '',
    resolution: '',
    refreshRate: '',
    responseTime: '',
    ports: '',
    warranty: '3 Years Limited Hardware and Advanced Exchange Service' // Malaysian default
  };

  // Extract size
  const sizeMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:inch|"|Inch)/i);
  if (sizeMatch) specs.size = `${sizeMatch[1]} Inch`;

  // Extract resolution
  const resMatch = content.match(/(\d{3,4})\s*x\s*(\d{3,4})/i);
  if (resMatch) specs.resolution = `${resMatch[1]} x ${resMatch[2]}`;

  // Extract refresh rate
  const refreshMatch = content.match(/(\d+)\s*(?:Hz|hz)/i);
  if (refreshMatch) specs.refreshRate = `${refreshMatch[1]}Hz`;

  // Special case for SE2225HM - must be 100Hz
  if (model === 'SE2225HM' && (!specs.refreshRate || specs.refreshRate === '60Hz')) {
    specs.refreshRate = '100Hz';
  }

  // Extract response time
  const responseMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:ms|MS)/i);
  if (responseMatch) specs.responseTime = `${responseMatch[1]}ms`;

  // Extract ports
  const ports = [];
  if (content.includes('HDMI')) ports.push('HDMI');
  if (content.includes('DisplayPort') || content.includes('DP')) ports.push('DisplayPort');
  if (content.includes('USB-C') || content.includes('USB C')) ports.push('USB-C');
  if (content.includes('VGA')) ports.push('VGA');
  if (ports.length > 0) specs.ports = ports.join(', ');

  return specs;
}

/**
 * Update cached product with new specs
 */
function updateProductCache(cachePath, specs) {
  const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

  // Check if current size is obviously wrong (1-6 inches)
  const wrongSize = product.size &&
    (product.size === '1 Inch' || product.size === '2 Inch' ||
     product.size === '3 Inch' || product.size === '4 Inch' ||
     product.size === '5 Inch' || product.size === '6 Inch');

  // Update missing fields OR wrong sizes
  if ((!product.size || wrongSize) && specs.size) product.size = specs.size;
  if (!product.resolution && specs.resolution) product.resolution = specs.resolution;
  if (!product.refreshRate && specs.refreshRate) product.refreshRate = specs.refreshRate;
  if (!product.responseTime && specs.responseTime) product.responseTime = specs.responseTime;
  if (!product.ports && specs.ports) product.ports = specs.ports;
  if (!product.warranty && specs.warranty) product.warranty = specs.warranty;

  // Update timestamp
  product.updatedAt = new Date().toISOString();

  fs.writeFileSync(cachePath, JSON.stringify(product, null, 2));
  return product;
}

/**
 * Scrape product using improved regex parsing
 */
async function scrapeProduct(product) {
  console.log(`  🔍 ${product.model}`);
  if (product.issue === 'wrong_size') {
    console.log(`  ⚠️  Wrong size: ${product.size} → fixing`);
  } else if (product.missing.length > 0) {
    console.log(`  Missing: ${product.missing.join(', ')}`);
  }

  if (!product.productUrl) {
    console.log(`    ⚠️  No product URL, skipping`);
    return null;
  }

  try {
    console.log(`    📄 Fetching page...`);
    const pageContent = await fetchProductPage(product.productUrl);

    // Debug: show snippet of content
    const contentSnippet = pageContent.substring(0, 500);
    console.log(`    🔍 Content preview: ${contentSnippet.substring(0, 100)}...`);

    console.log(`    🔍 Parsing specs...`);
    const specs = parseSpecsFromCleanText(pageContent, product.model);

    // Debug: show what was found
    if (Object.values(specs).filter(v => v).length === 0) {
      console.log(`    ⚠️  No specs extracted from page`);
      // Try to find "inch" patterns manually
      const inchMatches = pageContent.match(/\d{1,3}\.?\d*\s*inch/gi) || [];
      if (inchMatches.length > 0) {
        console.log(`    🐛 Found inch patterns: ${inchMatches.slice(0, 5).join(', ')}`);
      }
    }

    const updated = updateProductCache(product.cachePath, specs);

    // Count filled fields
    const filled = product.missing.filter(field => specs[field]).length;
    const sizeFixed = product.issue === 'wrong_size' && specs.size && specs.size !== product.size;

    if (filled > 0 || sizeFixed) {
      console.log(`    ✅ Updated!`);
      if (specs.size) console.log(`       Size: ${specs.size}`);
      if (specs.resolution) console.log(`       Resolution: ${specs.resolution}`);
      if (specs.refreshRate) console.log(`       Refresh: ${specs.refreshRate}`);
      if (specs.responseTime) console.log(`       Response: ${specs.responseTime}`);
      if (specs.ports) console.log(`       Ports: ${specs.ports}`);
      if (specs.warranty) console.log(`       Warranty: ${specs.warranty}`);
    } else {
      console.log(`    ⚠️  No specs found`);
    }

    return { product: updated, filled: filled || (sizeFixed ? 1 : 0) };

  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  const mode = process.argv[2] || 'test';

  console.log('🚀 Product Scraper - Improved Regex');
  console.log('='.repeat(70));

  const { wrongSize, incomplete } = getProductsNeedingUpdate();

  console.log(`📊 Found ${wrongSize.length} products with wrong sizes`);
  console.log(`📊 Found ${incomplete.length} products with missing data`);
  const totalProducts = wrongSize.length + incomplete.length;
  console.log(`📊 Total to update: ${totalProducts} products`);
  console.log('');

  if (totalProducts === 0) {
    console.log('✅ All products are complete!');
    return;
  }

  if (mode === 'test') {
    console.log(`🧪 Test mode: First 3 wrong-size products`);
    console.log('');
    const testProducts = wrongSize.slice(0, 3);

    let totalFilled = 0;
    let successCount = 0;

    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      console.log(`[${i+1}/${testProducts.length}] ${product.model}`);
      console.log(`  URL: ${product.productUrl}`);

      const result = await scrapeProduct(product);

      if (result && result.filled > 0) {
        totalFilled += result.filled;
        successCount++;
      }

      console.log('');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('='.repeat(70));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Tested: ${testProducts.length} products`);
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Total Fields Filled: ${totalFilled}`);
    console.log('');

    if (successCount >= 2) {
      console.log('✅ Test successful! Ready to fix all products.');
      console.log('');
      console.log('To fix all products, run:');
      console.log(`  node scrape-with-webreader.js all`);
    }

  } else {
    // All products - wrong sizes first, then incomplete
    const allProducts = [...wrongSize, ...incomplete];
    console.log(`🚀 Updating ${allProducts.length} products`);
    console.log(`⏱️  Estimated time: ~${Math.ceil(allProducts.length * 2 / 60)} minutes`);
    console.log('');

    let totalFilled = 0;
    let successCount = 0;

    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i];
      console.log(`[${i+1}/${allProducts.length}] ${product.model}`);
      console.log(`  URL: ${product.productUrl}`);

      const result = await scrapeProduct(product);

      if (result && result.filled > 0) {
        totalFilled += result.filled;
        successCount++;
      }

      console.log('');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('='.repeat(70));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(70));
    console.log(`Total Products: ${allProducts.length}`);
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Total Fields Filled: ${totalFilled}`);
    console.log(`Average: ${Math.round(totalFilled/allProducts.length)} fields per product`);
    console.log('='.repeat(70));

    // Regenerate Excel
    console.log(`\n📊 Regenerating Excel...`);

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

  console.log('='.repeat(70));
}

main().catch(console.error);
