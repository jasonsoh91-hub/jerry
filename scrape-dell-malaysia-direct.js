#!/usr/bin/env node
/**
 * Direct Dell Malaysia Scraper
 * Fetches from Dell Malaysia and enriches missing data
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
 * Get all cached Dell monitors that need enrichment
 */
function getCachedDellMonitorsNeedingEnrichment() {
  const products = [];
  const cacheDirs = [
    path.join(CACHE_DIR, 'monitor', 'dell'),
    path.join(CACHE_DIR, 'monitor', 'generic')
  ];

  cacheDirs.forEach(cacheDir => {
    if (!fs.existsSync(cacheDir)) return;

    const files = fs.readdirSync(cacheDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(cacheDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // Only include Dell monitors
          const briefName = (data.briefName || '').toLowerCase();
          if (!briefName.includes('dell')) return;

          // Extract model code
          let modelCode = data.model || '';
          const modelMatch = (data.briefName || '').match(/([A-Z]+\d{4}[A-Z]?)/i);
          if (modelMatch) {
            modelCode = modelMatch[1].toUpperCase();
          }

          if (!modelCode) return;

          // Check if missing critical fields
          const missingFields = [];
          if (!data.responseTime || data.responseTime.trim() === '') missingFields.push('responseTime');
          if (!data.warranty || data.warranty.trim() === '') missingFields.push('warranty');

          if (missingFields.length > 0) {
            products.push({
              model: modelCode,
              briefName: data.briefName || modelCode,
              existingData: data,
              missingFields: missingFields
            });
          }
        } catch (error) {
          // Skip invalid files
        }
      }
    });
  });

  return products;
}

/**
 * Enrich product data from Malaysian Dell website
 */
async function enrichFromMalaysianSite(product) {
  console.log(`  🔍 Enriching ${product.model}...`);

  try {
    // Search for Malaysian product page
    const searchQuery = `site:dell.com/en-my "${product.model}" monitor warranty response time`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=10`;

    const searchData = await httpsGet(searchUrl);

    const enrichedData = {
      responseTime: product.existingData.responseTime || '',
      warranty: product.existingData.warranty || '',
      ports: product.existingData.ports || '',
      productUrl: product.existingData.productUrl || ''
    };

    // Look for Malaysian Dell product page
    if (searchData.organic_results) {
      for (const result of searchData.organic_results) {
        const link = result.link || '';
        const snippet = result.snippet || '';

        // Found Malaysian Dell page
        if (link.includes('dell.com/en-my') &&
            link.toLowerCase().includes(product.model.toLowerCase())) {

          enrichedData.productUrl = link;

          console.log(`    ✓ Found Malaysian page`);

          // Extract warranty
          if (!enrichedData.warranty) {
            if (snippet.includes('3 year') || snippet.includes('3 Years') || snippet.includes('3-Year')) {
              enrichedData.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
            } else if (snippet.includes('1 year') || snippet.includes('1 Year') || snippet.includes('1-Year')) {
              enrichedData.warranty = '1 Year Limited Hardware and Advanced Exchange Service';
            }
          }

          // Extract response time
          if (!enrichedData.responseTime) {
            const responseTimeMatch = snippet.match(/(\d+)\s*ms/i);
            if (responseTimeMatch) {
              enrichedData.responseTime = `${responseTimeMatch[1]}ms`;
            }
          }

          // Extract ports
          if (!enrichedData.ports || enrichedData.ports.trim() === '') {
            const ports = [];
            if (snippet.includes('HDMI')) ports.push('HDMI');
            if (snippet.includes('DisplayPort')) ports.push('DisplayPort');
            if (snippet.includes('USB-C')) ports.push('USB-C');
            if (snippet.includes('VGA')) ports.push('VGA');
            if (ports.length > 0) {
              enrichedData.ports = ports.join(', ');
            }
          }

          // Try knowledge graph for more details
          if (searchData.knowledge_graph) {
            const kg = searchData.knowledge_graph;
            const description = kg.description || '';

            if (!enrichedData.warranty) {
              if (description.includes('3 year') || description.includes('3 Years') || description.includes('3-Year')) {
                enrichedData.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
              } else if (description.includes('1 year') || description.includes('1 Year') || description.includes('1-Year')) {
                enrichedData.warranty = '1 Year Limited Hardware and Advanced Exchange Service';
              }
            }

            if (!enrichedData.responseTime) {
              const responseTimeMatch = description.match(/(\d+)\s*ms/i);
              if (responseTimeMatch) {
                enrichedData.responseTime = `${responseTimeMatch[1]}ms`;
              }
            }
          }

          break;
        }
      }
    }

    return enrichedData;

  } catch (error) {
    console.error(`    ❌ Error enriching: ${error.message}`);
    return {
      responseTime: product.existingData.responseTime || '',
      warranty: product.existingData.warranty || '',
      ports: product.existingData.ports || '',
      productUrl: product.existingData.productUrl || ''
    };
  }
}

/**
 * Update cache with enriched data
 */
function updateCache(model, enrichedData) {
  try {
    // Find the cache file
    const cachePaths = [
      path.join(CACHE_DIR, 'monitor', 'dell', `${model.toLowerCase()}.json`),
      path.join(CACHE_DIR, 'monitor', 'generic', `${model.toLowerCase()}.json`)
    ];

    let cachePath = '';
    let existingData = {};

    for (const path of cachePaths) {
      if (fs.existsSync(path)) {
        cachePath = path;
        existingData = JSON.parse(fs.readFileSync(path, 'utf-8'));
        break;
      }
    }

    if (!cachePath) {
      console.log(`    ⚠️  No cache file found for ${model}`);
      return false;
    }

    // Update with enriched data
    const updatedData = {
      ...existingData,
      model: model,
      responseTime: enrichedData.responseTime || existingData.responseTime,
      warranty: enrichedData.warranty || existingData.warranty,
      ports: enrichedData.ports || existingData.ports,
      productUrl: enrichedData.productUrl || existingData.productUrl,
      cachedAt: new Date().toISOString()
    };

    // Write back to cache
    fs.writeFileSync(cachePath, JSON.stringify(updatedData, null, 2));
    console.log(`    ✅ Updated cache: ${model}`);

    // Show what was updated
    const updates = [];
    if (enrichedData.responseTime && !existingData.responseTime) updates.push('responseTime');
    if (enrichedData.warranty && !existingData.warranty) updates.push('warranty');
    if (enrichedData.ports && !existingData.ports) updates.push('ports');

    if (updates.length > 0) {
      console.log(`    ✓ Added: ${updates.join(', ')}`);
    }

    return true;

  } catch (error) {
    console.error(`    ❌ Error updating cache: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Dell Malaysia Data Enrichment');
  console.log('='.repeat(80));

  try {
    // Get products needing enrichment
    console.log('📂 Finding cached products needing enrichment...');
    const products = getCachedDellMonitorsNeedingEnrichment();

    if (products.length === 0) {
      console.log('✅ All products are complete!');
      return;
    }

    console.log(`    Found ${products.length} products needing enrichment`);
    console.log('');

    let enrichedCount = 0;
    let updatedCount = 0;

    // Enrich each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`[${i+1}/${products.length}] ${product.model}`);

      // Enrich from Malaysian site
      const enrichedData = await enrichFromMalaysianSite(product);

      // Update cache
      if (updateCache(product.model, enrichedData)) {
        updatedCount++;
      }

      // Check if we added missing data
      if ((enrichedData.responseTime && product.missingFields.includes('responseTime')) ||
          (enrichedData.warranty && product.missingFields.includes('warranty'))) {
        enrichedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 ENRICHMENT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Products Processed: ${products.length}`);
    console.log(`Successfully Enriched: ${enrichedCount}`);
    console.log(`Cache Files Updated: ${updatedCount}`);

    // Regenerate Excel
    console.log(`\n📊 Regenerating Excel with enriched data...`);

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
    console.log('='.repeat(80));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the enrichment
main().catch(console.error);
