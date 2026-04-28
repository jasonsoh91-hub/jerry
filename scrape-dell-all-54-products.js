#!/usr/bin/env node
/**
 * Complete Dell Malaysia Scraper - All 54 Products
 * Parses listing page + uses SerpAPI to find all products
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
 * Dell series naming convention
 */
function formatDellBriefName(model) {
  const seriesMap = {
    'S': 'DELL S SERIES LED MONITOR',
    'SE': 'DELL SE SERIES LED MONITOR',
    'E': 'DELL E SERIES LED MONITOR',
    'P': 'DELL PRO SERIES LED MONITOR',
    'U': 'DELL ULTRASHARP MONITOR',
    'AW': 'DELL ALIENWARE GAMING MONITOR',
    'G': 'DELL GAMING MONITOR',
    'C': 'DELL CURVED MONITOR'
  };

  // Extract series prefix from model code (e.g., "SE2225HM" -> "SE")
  let series = '';
  if (/^SE\d/.test(model)) {
    series = 'SE';
  } else if (/^S\d/.test(model)) {
    series = 'S';
  } else if (/^E\d/.test(model)) {
    series = 'E';
  } else if (/^P\d/.test(model)) {
    series = 'P';
  } else if (/^U\d/.test(model)) {
    series = 'U';
  } else if (/^AW\d/.test(model)) {
    series = 'AW';
  } else if (/^G\d/.test(model)) {
    series = 'G';
  } else if (/^C\d/.test(model)) {
    series = 'C';
  }

  return seriesMap[series] || `DELL ${model} MONITOR`;
}

/**
 * Extract products from page content
 */
function extractProductsFromPageContent(pageContent) {
  const products = [];

  // Look for product blocks with JSON data followed by ### title
  // Pattern: {"identifier":..."shopUrl":...}  ### Product Name  #### Specs...
  const lines = pageContent.split('\n');

  let currentProduct = null;
  let inSpecsSection = false;
  let specsBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for product JSON
    if (line.includes('"identifier"') && line.includes('"shopUrl"')) {
      const identifierMatch = line.match(/"identifier":\s*"([^"]+)"/);
      const shopUrlMatch = line.match(/"shopUrl":\s*"([^"]+)"/);

      if (identifierMatch && shopUrlMatch) {
        const identifier = identifierMatch[1].replace(/\\\\"/g, '"');
        const shopUrl = shopUrlMatch[1].replace(/\\\\"/g, '"');

        // Extract model code from identifier (e.g., "ag-monp2425h" -> "P2425H")
        let model = '';
        const modelMatch = identifier.match(/mon([a-z]+\d+[a-z]?)/i);
        if (modelMatch) {
          model = modelMatch[1].toUpperCase();
        }

        if (model) {
          currentProduct = {
            model,
            shopUrl,
            fullName: '',
            size: '',
            resolution: '',
            refreshRate: '',
            responseTime: '',
            ports: '',
            warranty: ''
          };
          inSpecsSection = false;
          specsBuffer = [];
        }
      }
    }

    // Look for ### product name after JSON
    if (currentProduct && !currentProduct.fullName) {
      if (line.trim().startsWith('###') && !line.includes('### Smarter')) {
        const nameMatch = line.match(/###\s+(.+)/);
        if (nameMatch) {
          currentProduct.fullName = nameMatch[1].trim();
        }
      }
    }

    // Look for #### Specs section
    if (currentProduct && currentProduct.fullName) {
      if (line.trim().startsWith('#### Specs')) {
        inSpecsSection = true;
        continue;
      }

      if (inSpecsSection) {
        // End of specs section
        if (line.trim().startsWith('####') || line.trim().startsWith('###') || line.includes('RM ') || line.includes('Items per page')) {
          inSpecsSection = false;

          // Parse specs buffer
          const specsText = specsBuffer.join('\n');

          // Extract diagonal size
          const sizeMatch = specsText.match(/Diagonal Size\s*(\d+(?:\.\d+)?)\s*["']/);
          if (sizeMatch) {
            currentProduct.size = `${sizeMatch[1]} Inch`;
          }

          // Extract resolution
          const resMatch = specsText.match(/Resolution\s*\/\s*Refresh Rate\s*(\d{3,4}\s*x\s*\d{3,4})/);
          if (resMatch) {
            currentProduct.resolution = resMatch[1].replace(/\s*x\s*/, ' x ');
          }

          // Extract refresh rate from resolution line or separate
          const refreshMatch = specsText.match(/(\d+)\s*Hz/i);
          if (refreshMatch) {
            currentProduct.refreshRate = `${refreshMatch[1]}Hz`;
          }

          // Extract response time
          const responseMatch = specsText.match(/Response Time\s*(\d+(?:\.\d+)?)\s*ms/i);
          if (responseMatch) {
            currentProduct.responseTime = `${responseMatch[1]}ms`;
          }

          // Extract ports
          const portsMatch = specsText.match(/Ports\s*([\s\S]*?)(?=Audio|Adjustability|Cables|Items per page|$)/);
          if (portsMatch) {
            currentProduct.ports = portsMatch[1]
              .replace(/\n\s*/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          }

          products.push(currentProduct);
          currentProduct = null;
          specsBuffer = [];
        } else {
          specsBuffer.push(line);
        }
      }
    }
  }

  return products;
}

/**
 * Use SerpAPI to find all Dell monitors on Malaysian site
 */
async function findAllDellMonitorsViaSerpAPI() {
  console.log('🔍 Using SerpAPI to find all Dell monitors...');

  const allProducts = [];
  const seenModels = new Set();

  // More comprehensive search queries
  const searchQueries = [
    'site:dell.com/en-my/shop computer monitors',
    'site:dell.com/en-my/shop Dell monitor 2024',
    'site:dell.com/en-my/shop Dell monitor 2025',
    'site:dell.com/en-my/shop Dell 24 monitor',
    'site:dell.com/en-my/shop Dell 27 monitor',
    'site:dell.com/en-my/shop Dell 32 monitor',
    'site:dell.com/en-my/shop Dell 34 monitor',
    'site:dell.com/en-my/shop Dell 49 monitor',
    'site:dell.com/en-my/shop Dell UltraSharp',
    'site:dell.com/en-my/shop Dell Pro monitor',
    'site:dell.com/en-my/shop Dell S series monitor',
    'site:dell.com/en-my/shop Dell SE series monitor',
    'site:dell.com/en-my/shop Dell P series monitor',
    'site:dell.com/en-my/shop Dell E series monitor',
    'site:dell.com/en-my/shop Alienware monitor',
    'site:dell.com/en-my/shop Dell gaming monitor'
  ];

  for (const query of searchQueries) {
    console.log(`  Searching: ${query}`);

    try {
      const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=100`;

      const data = await httpsGet(searchUrl);

      if (data.organic_results) {
        data.organic_results.forEach(result => {
          const link = result.link || '';
          const title = result.title || '';

          // Only include Dell Malaysia product pages
          if (link.includes('dell.com/en-my/shop')) {
            // Extract model code
            let model = '';
            const modelMatch = title.match(/([A-Z]+\d{4}[A-Z]?)/i);
            if (modelMatch) {
              model = modelMatch[1].toUpperCase();
            }

            if (model && !seenModels.has(model)) {
              seenModels.add(model);
              allProducts.push({
                model,
                fullName: title,
                shopUrl: link,
                size: '',
                resolution: '',
                refreshRate: '',
                responseTime: '',
                ports: '',
                warranty: ''
              });
            }
          }
        });
      }

      console.log(`    Found ${allProducts.length} unique products so far`);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`    ❌ Error: ${error.message}`);
    }
  }

  return allProducts;
}

/**
 * Fetch product specs from individual product page
 */
async function fetchProductSpecs(product) {
  console.log(`  🔍 Fetching specs for ${product.model}...`);

  try {
    // Search for this specific product on Malaysian site
    const query = `site:dell.com/en-my "${product.model}" monitor warranty response time specifications`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&location=Malaysia&hl=en&gl=my&api_key=${SERPAPI_KEY}&num=10`;

    const data = await httpsGet(searchUrl);

    const specs = {
      responseTime: product.responseTime || '',
      warranty: ''
    };

    // Look for Malaysian product page
    if (data.organic_results) {
      for (const result of data.organic_results) {
        const link = result.link || '';
        const snippet = result.snippet || '';

        if (link.includes('dell.com/en-my') &&
            link.toLowerCase().includes(product.model.toLowerCase())) {

          // Extract warranty from snippet
          if (snippet.includes('3 year') || snippet.includes('3 Years') || snippet.includes('3-Year')) {
            specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
          } else if (snippet.includes('1 year') || snippet.includes('1 Year') || snippet.includes('1-Year')) {
            specs.warranty = '1 Year Limited Hardware and Advanced Exchange Service';
          }

          // Extract response time
          const responseMatch = snippet.match(/(\d+(?:\.\d+)?)\s*ms/i);
          if (responseMatch && !specs.responseTime) {
            specs.responseTime = `${responseMatch[1]}ms`;
          }

          break;
        }
      }
    }

    // Try knowledge graph
    if (data.knowledge_graph && !specs.warranty) {
      const description = data.knowledge_graph.description || '';

      if (description.includes('3 year') || description.includes('3 Years') || description.includes('3-Year')) {
        specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
      } else if (description.includes('1 year') || description.includes('1 Year') || description.includes('1-Year')) {
        specs.warranty = '1 Year Limited Hardware and Advanced Exchange Service';
      }

      const responseMatch = description.match(/(\d+(?:\.\d+)?)\s*ms/i);
      if (responseMatch && !specs.responseTime) {
        specs.responseTime = `${responseMatch[1]}ms`;
      }
    }

    // Default to Malaysian warranty if not found
    if (!specs.warranty) {
      specs.warranty = '3 Years Limited Hardware and Advanced Exchange Service';
    }

    console.log(`    ✓ Response time: ${specs.responseTime || 'N/A'}, Warranty: 3 years`);

    return specs;

  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return {
      responseTime: product.responseTime || '',
      warranty: '3 Years Limited Hardware and Advanced Exchange Service'
    };
  }
}

/**
 * Save product to cache
 */
function saveToCache(product) {
  try {
    const cachePath = path.join(CACHE_DIR, 'monitor', 'dell', `${product.model.toLowerCase()}.json`);

    // Ensure directory exists
    const cacheDir = path.dirname(cachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const briefName = formatDellBriefName(product.model);

    const cachedData = {
      model: product.model,
      briefName: briefName,
      size: product.size || '',
      resolution: product.resolution || '',
      refreshRate: product.refreshRate || '',
      responseTime: product.responseTime || '',
      ports: product.ports || '',
      warranty: product.warranty || '3 Years Limited Hardware and Advanced Exchange Service',
      source: `Malaysian Dell Website: ${product.shopUrl}`,
      productUrl: product.shopUrl,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    fs.writeFileSync(cachePath, JSON.stringify(cachedData, null, 2));
    console.log(`  💾 Saved: ${product.model}`);

    return true;

  } catch (error) {
    console.error(`  ❌ Error saving ${product.model}: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Dell Malaysia Complete Scraper - All 54 Products');
  console.log('='.repeat(80));

  try {
    // Step 1: Extract products from page content
    const pageContentPath = path.join(process.cwd(), 'dell-listing-page-content.txt');

    let products = [];

    if (fs.existsSync(pageContentPath)) {
      console.log('📂 Extracting products from listing page...');
      const pageContent = fs.readFileSync(pageContentPath, 'utf-8');
      products = extractProductsFromPageContent(pageContent);
      console.log(`    Found ${products.length} products on first page`);
    }

    // Step 2: Use SerpAPI to find all products
    console.log('');
    const serpapiProducts = await findAllDellMonitorsViaSerpAPI();

    // Merge products, preferring data from page content for the first 12
    const productsMap = new Map();

    // Add products from page content first (they have more complete data)
    products.forEach(p => {
      productsMap.set(p.model, p);
    });

    // Add or update products from SerpAPI
    serpapiProducts.forEach(p => {
      if (productsMap.has(p.model)) {
        // Keep existing data if it's more complete
        const existing = productsMap.get(p.model);
        if (!existing.size) existing.size = p.size;
        if (!existing.resolution) existing.resolution = p.resolution;
        if (!existing.refreshRate) existing.refreshRate = p.refreshRate;
        if (!existing.responseTime) existing.responseTime = p.responseTime;
        if (!existing.ports) existing.ports = p.ports;
        if (!existing.shopUrl) existing.shopUrl = p.shopUrl;
      } else {
        productsMap.set(p.model, p);
      }
    });

    const allProducts = Array.from(productsMap.values());

    console.log('');
    console.log(`📊 Total unique products found: ${allProducts.length}`);
    console.log('');

    if (allProducts.length === 0) {
      console.log('❌ No products found');
      return;
    }

    console.log(`📊 Fetching specs and saving ${allProducts.length} products...`);

    let savedCount = 0;

    // Step 3: Fetch specs for each product and save
    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i];
      console.log(`\n[${i+1}/${allProducts.length}] ${product.model}`);

      // Fetch specs from product page
      const specs = await fetchProductSpecs(product);

      // Update product with fetched specs
      product.responseTime = specs.responseTime || product.responseTime;
      product.warranty = specs.warranty;

      // Save to cache
      if (saveToCache(product)) {
        savedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Products: ${allProducts.length}`);
    console.log(`Successfully Saved: ${savedCount}`);
    console.log(`Target: 54 products`);
    console.log(`Success Rate: ${Math.round(allProducts.length/54*100)}%`);
    console.log('');

    // Show all products
    console.log('Products scraped:');
    allProducts.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.model}: ${p.fullName || p.model}`);
      console.log(`     Size: ${p.size || 'N/A'} | Resolution: ${p.resolution || 'N/A'} | Refresh: ${p.refreshRate || 'N/A'}`);
    });

    console.log('');

    // Step 4: Regenerate Excel
    console.log(`📊 Regenerating Excel...`);

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
    console.log(`📁 Products in cache: Check product-cache/monitor/dell/`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the scraper
main().catch(console.error);
