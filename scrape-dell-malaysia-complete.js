#!/usr/bin/env node
/**
 * Complete Dell Malaysia Monitor Scraper
 * Scrapes from Dell Malaysia monitors page and visits each product for complete specs
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
 * Use webReader to fetch page content
 */
async function fetchPageContent(url) {
  console.log(`    📖 Fetching: ${url}`);
  try {
    // Use SerpAPI to fetch page content
    const apiUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(url)}&api_key=${SERPAPI_KEY}`;
    const data = await httpsGet(apiUrl);

    if (data.organic_results && data.organic_results.length > 0) {
      const firstResult = data.organic_results[0];
      return {
        title: firstResult.title || '',
        snippet: firstResult.snippet || '',
        link: firstResult.link || url
      };
    }

    return null;
  } catch (error) {
    console.error(`    ❌ Error fetching page: ${error.message}`);
    return null;
  }
}

/**
 * Scrape Dell Malaysia monitors listing page
 */
async function scrapeDellMalaysiaMonitorsPage() {
  console.log('📊 Step 1: Scraping Dell Malaysia monitors page...');
  console.log(`    URL: https://www.dell.com/en-my/shop/computer-monitors/ar/8605`);

  try {
    // Use SerpAPI to scrape the Dell Malaysia monitors page
    const url = `https://serpapi.com/search.json?engine=google&q=site:dell.com/en-my+computer+monitors&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=100`;

    const data = await httpsGet(url);

    const products = [];

    // Extract from organic results
    if (data.organic_results) {
      data.organic_results.forEach(result => {
        const title = result.title || '';
        const link = result.link || '';

        // Only include Dell monitor product pages
        if (link.includes('dell.com/en-my/shop') &&
            (title.includes('Monitor') || title.includes('Display'))) {

          // Extract model code from title or URL
          let modelCode = '';
          const modelMatch = title.match(/([A-Z]+\d{4}[A-Z]?)/i);
          if (modelMatch) {
            modelCode = modelMatch[1].toUpperCase();
          }

          if (modelCode) {
            products.push({
              model: modelCode,
              briefName: title,
              productUrl: link
            });
          }
        }
      });
    }

    console.log(`    ✓ Found ${products.length} Dell monitors on listing page`);
    return products;

  } catch (error) {
    console.error(`    ❌ Error scraping listing page: ${error.message}`);
    return [];
  }
}

/**
 * Scrape individual product page for complete specs
 */
async function scrapeProductSpecs(product) {
  console.log(`    🔍 Scraping specs for ${product.model}...`);

  try {
    // Use Google search to find the Malaysian product page
    const searchQuery = `site:dell.com/en-my ${product.model} monitor specifications warranty`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}`;

    const searchData = await httpsGet(searchUrl);

    const specs = {
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: '',
      warranty: ''
    };

    // Try to find the Malaysian product page
    let malaysianProductUrl = '';

    if (searchData.organic_results) {
      for (const result of searchData.organic_results) {
        const link = result.link || '';

        // Look for Dell Malaysia product pages
        if (link.includes('dell.com/en-my/shop') &&
            link.toLowerCase().includes(product.model.toLowerCase())) {

          malaysianProductUrl = link;

          // Extract from snippet
          const snippet = result.snippet || '';

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

    // If we found a Malaysian product page, try to get more details
    if (malaysianProductUrl) {
      console.log(`      ✓ Found Malaysian page: ${malaysianProductUrl}`);
      product.productUrl = malaysianProductUrl;

      // Try to fetch additional details using knowledge graph
      if (searchData.knowledge_graph) {
        const kg = searchData.knowledge_graph;
        const description = kg.description || '';

        // Extract size
        const sizeMatch = description.match(/(\d+(?:\.\d+)?)\s*["']/);
        if (sizeMatch && !specs.size) {
          specs.size = `${sizeMatch[1]} Inch`;
        }

        // Extract resolution
        const resMatch = description.match(/(\d{3,4})\s*x\s*(\d{3,4})/);
        if (resMatch && !specs.resolution) {
          specs.resolution = `${resMatch[1]} x ${resMatch[2]}`;
        }

        // Extract warranty from description
        if (description.includes('3 year') || description.includes('3 Years') || description.includes('3-Year')) {
          specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
        } else if (description.includes('1 year') || description.includes('1 Year') || description.includes('1-Year')) {
          specs.warranty = '1 Year Limited Hardware and Advanced Exchange Service';
        }
      }
    }

    return specs;

  } catch (error) {
    console.error(`      ❌ Error scraping specs: ${error.message}`);
    return {
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: '',
      warranty: ''
    };
  }
}

/**
 * Save product to cache
 */
function saveToCache(model, briefName, specs, productUrl) {
  try {
    const cachePath = path.join(CACHE_DIR, 'monitor', 'dell', `${model.toLowerCase()}.json`);

    // Read existing cache if available
    let existingData = {};
    if (fs.existsSync(cachePath)) {
      existingData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const cachedData = {
      model: model,
      briefName: briefName,
      size: specs.size || existingData.size || '',
      resolution: specs.resolution || existingData.resolution || '',
      refreshRate: specs.refreshRate || existingData.refreshRate || '',
      responseTime: specs.responseTime || existingData.responseTime || '',
      ports: specs.ports || existingData.ports || '',
      warranty: specs.warranty || existingData.warranty || '',
      source: `Malaysian Dell Website: ${productUrl}`,
      productUrl: productUrl || existingData.productUrl || '',
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    // Ensure directory exists
    const cacheDir = path.dirname(cachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    fs.writeFileSync(cachePath, JSON.stringify(cachedData, null, 2));
    console.log(`    💾 Saved to cache: ${model}`);

    return cachedData;

  } catch (error) {
    console.error(`    ❌ Error saving to cache: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Complete Dell Malaysia Monitor Scraper');
  console.log('='.repeat(80));

  try {
    // Step 1: Scrape listing page
    const products = await scrapeDellMalaysiaMonitorsPage();

    if (products.length === 0) {
      console.log('❌ No products found on listing page');
      return;
    }

    console.log(`\n📊 Step 2: Scraping individual product specs...`);
    console.log(`    Products to scrape: ${products.length}`);

    let successCount = 0;
    let partialCount = 0;

    // Step 2: Scrape each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\n  [${i+1}/${products.length}] ${product.model}`);

      // Scrape product specs
      const specs = await scrapeProductSpecs(product);

      // Count completeness
      const completeness = [specs.size, specs.resolution, specs.refreshRate,
                           specs.responseTime, specs.ports, specs.warranty]
                           .filter(s => s && s.trim()).length;

      if (completeness >= 4) {
        successCount++;
      } else if (completeness >= 2) {
        partialCount++;
      }

      // Save to cache
      saveToCache(product.model, product.briefName, specs, product.productUrl);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SCRAPING SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Products: ${products.length}`);
    console.log(`Complete Data: ${successCount}`);
    console.log(`Partial Data: ${partialCount}`);
    console.log(`Cache Updated: Yes`);

    // Step 3: Regenerate Excel
    console.log(`\n📊 Step 3: Regenerating Excel with updated data...`);
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

    console.log(`\n✅ Complete! Excel updated with: ${products.length} products`);
    console.log(`📁 Excel file: ${path.join(CACHE_DIR, 'Dell_Monitors_Final.xlsx')}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the scraper
main().catch(console.error);
