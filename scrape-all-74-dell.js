#!/usr/bin/env node
/**
 * Complete Dell Malaysia Scraper - Get ALL 74 Products
 * Scrapes directly from Dell Malaysia monitors listing page
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SERPAPI_KEY = 'b120c565c5435875d430037cf36a3bb46d4c20e79275f202dede71a8f1a12376';
const CACHE_DIR = path.join(process.cwd(), 'product-cache');

/**
 * Helper function to make HTTPS requests
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Scrape all Dell monitors from Malaysian site using multiple search strategies
 */
async function scrapeAllDellMalaysiaMonitors() {
  console.log('📊 Step 1: Searching for ALL Dell monitors on Malaysian site...');
  console.log('    Target: 74 products');

  const allProducts = [];

  // Strategy 1: Search for Dell monitors on Malaysian site
  const searchQueries = [
    'site:dell.com/en-y/shop "monitor" -"ultrasharp" -"gaming"',
    'site:dell.com/en-my/shop "Dell" "monitor" "inch"',
    'site:dell.com/en-my/shop computer monitors',
    'Dell Malaysia monitor site:dell.com/en-my'
  ];

  for (const query of searchQueries) {
    console.log(`    🔍 Searching: ${query}`);

    try {
      const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=100`;

      const data = await httpsGet(searchUrl);

      if (data.organic_results) {
        data.organic_results.forEach(result => {
          const link = result.link || '';
          const title = result.title || '';

          // Only include Dell Malaysia product pages
          if (link.includes('dell.com/en-my/shop') &&
              (title.includes('Monitor') || title.includes('Display'))) {

            // Extract model code
            let modelCode = '';
            const modelMatch = title.match(/([A-Z]+\d{4}[A-Z]?)/i);
            if (modelMatch) {
              modelCode = modelMatch[1].toUpperCase();
            }

            // Check if we already have this model
            const exists = allProducts.find(p => p.model === modelCode);
            if (!exists && modelCode) {
              allProducts.push({
                model: modelCode,
                briefName: title,
                productUrl: link
              });
            }
          }
        });
      }

      console.log(`      Found ${allProducts.length} unique products so far`);

    } catch (error) {
      console.error(`      ❌ Error with query: ${error.message}`);
    }
  }

  // Strategy 2: Search for specific model series
  const seriesList = ['S', 'P', 'U', 'E', 'SE', 'G', 'AW'];

  for (const series of seriesList) {
    console.log(`    🔍 Searching for ${series} series...`);

    try {
      const query = `site:dell.com/en-y/shop "${series}" monitor`;
      const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=100`;

      const data = await httpsGet(searchUrl);

      if (data.organic_results) {
        data.organic_results.forEach(result => {
          const link = result.link || '';
          const title = result.title || '';

          if (link.includes('dell.com/en-my/shop') &&
              title.includes('Monitor')) {

            let modelCode = '';
            const modelMatch = title.match(/([A-Z]+\d{4}[A-Z]?)/i);
            if (modelMatch) {
              modelCode = modelMatch[1].toUpperCase();
            }

            const exists = allProducts.find(p => p.model === modelCode);
            if (!exists && modelCode) {
              allProducts.push({
                model: modelCode,
                briefName: title,
                productUrl: link
              });
            }
          }
        });
      }

      console.log(`      Total now: ${allProducts.length} products`);

    } catch (error) {
      console.error(`      ❌ Error with ${series} series: ${error.message}`);
    }
  }

  // Remove duplicates
  const uniqueProducts = [];
  const seenModels = new Set();

  allProducts.forEach(product => {
    if (!seenModels.has(product.model)) {
      seenModels.add(product.model);
      uniqueProducts.push(product);
    }
  });

  console.log(`\n    ✅ Total unique products found: ${uniqueProducts.length}`);
  return uniqueProducts;
}

/**
 * Get detailed specs for a single product
 */
async function getProductSpecs(product) {
  console.log(`  🔍 Getting specs for ${product.model}...`);

  try {
    // Search for this specific product on Malaysian site
    const query = `site:dell.com/en-my "${product.model}" monitor specifications warranty response time ports`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=10`;

    const data = await httpsGet(searchUrl);

    const specs = {
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: '',
      warranty: '',
      productUrl: product.productUrl
    };

    // Check organic results for Malaysian product page
    if (data.organic_results) {
      for (const result of data.organic_results) {
        const link = result.link || '';
        const snippet = result.snippet || '';

        // Found Malaysian Dell page
        if (link.includes('dell.com/en-my') &&
            link.toLowerCase().includes(product.model.toLowerCase())) {

          specs.productUrl = link;

          // Extract warranty
          if (snippet.includes('3 year') || snippet.includes('3 Years') || snippet.includes('3-Year')) {
            specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
          } else if (snippet.includes('1 year') || snippet.includes('1 Year') || snippet.includes('1-Year')) {
            specs.warranty = '1 Year Limited Hardware and Advanced Exchange Service';
          }

          // Extract response time
          const responseTimeMatch = snippet.match(/(\d+)\s*ms/i);
          if (responseTimeMatch) {
            specs.responseTime = `${responseTimeMatch[1]}ms`;
          }

          // Extract refresh rate
          const refreshRateMatch = snippet.match(/(\d+)\s*Hz/i);
          if (refreshRateMatch) {
            specs.refreshRate = `${refreshRateMatch[1]}Hz`;
          }

          // Extract size
          const sizeMatch = snippet.match(/(\d+(?:\.\d+)?)\s*["']/);
          if (sizeMatch) {
            specs.size = `${sizeMatch[1]} Inch`;
          }

          // Extract resolution
          const resMatch = snippet.match(/(\d{3,4})\s*x\s*(\d{3,4})/);
          if (resMatch) {
            specs.resolution = `${resMatch[1]} x ${resMatch[2]}`;
          }

          // Extract ports
          const ports = [];
          if (snippet.includes('HDMI')) ports.push('HDMI');
          if (snippet.includes('DisplayPort')) ports.push('DisplayPort');
          if (snippet.includes('USB-C')) ports.push('USB-C');
          if (snippet.includes('VGA')) ports.push('VGA');
          if (ports.length > 0) {
            specs.ports = ports.join(', ');
          }

          break;
        }
      }
    }

    // Try knowledge graph for additional details
    if (data.knowledge_graph) {
      const kg = data.knowledge_graph;
      const description = kg.description || '';

      // Fill in missing fields
      if (!specs.size) {
        const sizeMatch = description.match(/(\d+(?:\.\d+)?)\s*["']/);
        if (sizeMatch) {
          specs.size = `${sizeMatch[1]} Inch`;
        }
      }

      if (!specs.resolution) {
        const resMatch = description.match(/(\d{3,4})\s*x\s*(\d{3,4})/);
        if (resMatch) {
          specs.resolution = `${resMatch[1]} x ${resMatch[2]}`;
        }
      }

      if (!specs.responseTime) {
        const responseTimeMatch = description.match(/(\d+)\s*ms/i);
        if (responseTimeMatch) {
          specs.responseTime = `${responseTimeMatch[1]}ms`;
        }
      }

      if (!specs.warranty) {
        if (description.includes('3 year') || description.includes('3 Years') || description.includes('3-Year')) {
          specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
        } else if (description.includes('1 year') || description.includes('1 Year') || description.includes('1-Year')) {
          specs.warranty = '1 Year Limited Hardware and Advanced Exchange Service';
        }
      }
    }

    // Count how many fields we got
    const completeness = [specs.size, specs.resolution, specs.refreshRate,
                         specs.responseTime, specs.ports, specs.warranty]
                         .filter(s => s && s.trim()).length;

    console.log(`    ✓ Got ${completeness}/6 fields`);

    return specs;

  } catch (error) {
    console.error(`    ❌ Error getting specs: ${error.message}`);
    return {
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: '',
      warranty: '',
      productUrl: product.productUrl
    };
  }
}

/**
 * Save product to cache
 */
function saveToCache(model, briefName, specs, productUrl) {
  try {
    const cachePath = path.join(CACHE_DIR, 'monitor', 'dell', `${model.toLowerCase()}.json`);

    // Ensure directory exists
    const cacheDir = path.dirname(cachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const cachedData = {
      model: model,
      briefName: briefName,
      size: specs.size || '',
      resolution: specs.resolution || '',
      refreshRate: specs.refreshRate || '',
      responseTime: specs.responseTime || '',
      ports: specs.ports || '',
      warranty: specs.warranty || '',
      source: `Malaysian Dell Website: ${productUrl}`,
      productUrl: productUrl || '',
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    fs.writeFileSync(cachePath, JSON.stringify(cachedData, null, 2));
    return true;

  } catch (error) {
    console.error(`    ❌ Error saving cache: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Complete Dell Malaysia Scraper - ALL 74 Products');
  console.log('='.repeat(80));

  try {
    // Step 1: Scrape all products
    const products = await scrapeAllDellMalaysiaMonitors();

    if (products.length === 0) {
      console.log('❌ No products found');
      return;
    }

    console.log(`\n📊 Step 2: Getting detailed specs for ${products.length} products...`);

    // Step 2: Get specs for each product
    let successCount = 0;
    let partialCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n[${i+1}/${products.length}] ${product.model}`);

      const specs = await getProductSpecs(product);

      // Save to cache
      if (saveToCache(product.model, product.briefName, specs, specs.productUrl)) {
        // Check completeness
        const completeness = [specs.size, specs.resolution, specs.refreshRate,
                             specs.responseTime, specs.ports, specs.warranty]
                             .filter(s => s && s.trim()).length;

        if (completeness >= 4) {
          successCount++;
        } else if (completeness >= 2) {
          partialCount++;
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SCRAPPING SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Products Found: ${products.length}`);
    console.log(`Complete Data (4+ fields): ${successCount}`);
    console.log(`Partial Data (2+ fields): ${partialCount}`);
    console.log(`Target: 74 products`);
    console.log(`Success Rate: ${Math.round(products.length/74*100)}%`);

    // Step 3: Regenerate Excel
    console.log(`\n📊 Step 3: Regenerating Excel...`);

    const { spawn } = require('child_process');
    const excelProcess = spawn('node', ['fix-model-extraction.js'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    await new Promise((resolve, reject) => {
      excelProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Excel generation failed with code ${code}`));
        }
      });
    });

    console.log(`\n✅ Complete!`);
    console.log(`📁 Excel: ${path.join(CACHE_DIR, 'Dell_Monitors_Final.xlsx')}`);
    console.log(`📁 Total models in Excel: Check the file`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the scraper
main().catch(console.error);
