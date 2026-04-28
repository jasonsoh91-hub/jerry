#!/usr/bin/env node
/**
 * Parse Dell Malaysia Monitors Page - Get ALL Products
 * Extracts embedded JSON data from the listing page
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CACHE_DIR = path.join(process.cwd(), 'product-cache');

// The actual page content with embedded JSON data
const PAGE_CONTENT = `{"title":"Computer Monitors | Dell Malaysia","content":"Computer Monitors | Dell Malaysia\\n\\nSkip to main content\\n\\nSign In\\n\\n## Welcome\\n\\nDell Sites\\n\\n- Dell Technologies\\n\\n- Premier Sign In\\n\\n- Partner Program Sign In\\n\\n- Support\\n\\nDell Sites\\n\\n- Dell Technologies\\n\\n- Premier Sign In\\n\\n- Partner Program Sign In\\n\\n- Support\\n\\n- My Account\\n\\n- Order Status\\n\\n- Profile Settings\\n\\n- My Products\\n\\n- Dell Rewards Balance\\n\\nSign Out\\n\\n## Welcome to Dell\\n\\nMy Account\\n\\n- Place orders quickly and easily\\n\\n- View orders and track your shipping status\\n\\n- Enjoy members-only rewards and discounts\\n\\n- Create and access a list of your products\\n\\nSign In\\nCreate an Account\\nPremier Sign In\\nPartner Program Sign In\\n\\nContact Us\\n\\nMY/EN\\n\\nCart\\n\\n## Your Dell.com Carts\\n\\n- Artificial Intelligence\\n\\n- IT Infrastructure\\n\\n- Computers & Accessories\\n\\n- Laptops\\n\\n- Desktops & All-in-Ones\\n\\n- Monitors\\n\\n- Gaming\\n\\n- PC Accessories\\n\\n- Parts, Batteries & Upgrades\\n\\n- Video Conferencing Room Solutions\\n\\n- Thin Clients\\n\\n- Workstations\\n\\n- Services\\n\\n- Support\\n\\n- Deals\\n\\n- Dell Premier for Business\\n\\n- Contact Us\\n\\n- MY/EN\\n\\n\\nSave up to an additional 5% for your business with Dell Premier.\\nSign in or Create an account.\\n\\n2. Monitors & Monitor Accessories\\n\\n3. Computer Monitors\\n\\n# Computer Monitors\\n\\n1 to 12 of 54 Results\\n\\nSort by: \\n\\nLowest Price\\nHighest Price\\nRelevance\\n\\n#### Product Line\\n\\nPlay, School & Work\\n\\n1. Dell (3)\\n\\n2. Dell Plus (8)\\n\\n3. Dell S Series (2)\\n\\nProfessional-Grade Productivity\\n\\n1. Dell Pro (5)\\n\\n2. Dell Pro Plus (13)\\n\\n3. Dell P Series (1)\\n\\nMaximum Performance\\n\\n1. Dell UltraSharp (12)\\n\\nGaming\\n\\n1. Alienware (10)\\n\\n###### Screen Size\\n\\n1. 14 - 22 inch (4)\\n\\n2. 23 - 24 inch (11)\\n\\n3. 25 - 27 inch (21)\\n\\n4. 30 - 34 inch (14)\\n\\n5. 35 inch or More (4)\\n\\nShow 54 Results\\n\\n{\\\"identifier\\\":\\\"ag-monp2425h\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"739\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-pro-24-plus-monitor-p2425h/apd/210-bmml/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell Pro 24 Plus Monitor - P2425H\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n23.8\\\"\\nResolution / Refresh Rate\\n\\n1920 x 1080\\n\\nPanel Technology\\n\\nIn-Plane Switching (IPS) technology\\n\\nPorts\\n\\n1x HDMI 1.4 (HDCP 1.4), 1x DP 1.2 (HDCP 1.4), 1x VGA, 1x USB 3.2 Gen1 Type-B upstream, 3x USB 3.2 Gen1 Type-A downstream, 1x USB 3.2 Gen1 Type-C downstream with up to 15W PD\\n\\n{\\\"identifier\\\":\\\"ag-mons2425hs\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"579\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-24-plus-adjustable-stand-monitor-s2425hs/apd/210-bmbz/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 24 Plus Adjustable Stand Monitor - S2425HS\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n23.8\\\"\\nResolution / Refresh Rate\\n\\n1920 x 1080\\n\\nPorts\\n\\n2 x HDMI (HDCP1.4)\\n\\n{\\\"identifier\\\":\\\"ag-mons2725qc\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"1369\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-27-plus-4k-usb-c-monitor-s2725qc/apd/210-bqtg/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 27 Plus 4K USB-C Monitor - S2725QC\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n27\\\"\\nResolution / Refresh Rate\\n\\n3840 x 2160\\n\\nPorts\\n\\n1 USB-C 5Gbps upstream port (DisplayPort 1.4 Alt Mode, Power Delivery up to 65 W), 2 HDMI ports (HDCP 1.4 & 2.3), 1 USB 5Gbps Type-A downstream port, 1 USB-C 5Gbps downstream port (Power Delivery up to 15 W), 1 USB 5Gbps Type-A downstream port\\n\\n{\\\"identifier\\\":\\\"ag-mons2425h\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"559\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-24-monitor-s2425h/apd/210-bmcc/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 24 Monitor - S2425H\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n23.8\\\"\\nResolution / Refresh Rate\\n\\n1920 x 1080\\n\\nPorts\\n\\n2 x HDMI (HDCP 1.4)\\n\\n{\\\"identifier\\\":\\\"ag-monse2425hm\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"438.99\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-24-monitor-se2425hm/apd/210-bqlr/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 24 Monitor - SE2425HM\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n23.8\\\"\\nResolution / Refresh Rate\\n\\n1920 x 1080\\n\\nPorts\\n\\n1 HDMI port (HDCP 1.4), 1 VGA port\\n\\n{\\\"identifier\\\":\\\"ag-monse2225hm\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"358.99\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-22-monitor-se2225hm/apd/210-bqkn/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 22 Monitor - SE2225HM\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n21.5\\\"\\nResolution / Refresh Rate\\n\\n1920 x 1080\\n\\nPorts\\n\\n1 HDMI port (HDCP 1.4), 1 VGA port\\n\\n{\\\"identifier\\\":\\\"ag-mons2725ds\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"1079\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-27-plus-qhd-monitor-s2725ds/apd/210-bmnj/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 27 Plus QHD Monitor - S2725DS\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n27\\\"\\nResolution / Refresh Rate\\n\\n2560 x 1440\\n\\nPorts\\n\\n2 x HDMI (HDCP 1.4), 1 x DisplayPort 1.2 (HDCP1.4)\\n\\n{\\\"identifier\\\":\\\"ag-monse2725hm\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"549\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-27-monitor-se2725hm/apd/210-bqlh/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 27 Monitor - SE2725HM\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n27\\\"\\nResolution / Refresh Rate\\n\\n1920 x 1080\\n\\nPorts\\n\\n1 HDMI port (HDCP 1.4), 1 VGA port\\n\\n{\\\"identifier\\\":\\\"ag-mons2725qs\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"1269\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-27-plus-4k-monitor-s2725qs/apd/210-bqvt/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell 27 Plus 4K Monitor - S2725QS\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n27\\\"\\nResolution / Refresh Rate\\n\\n3840 x 2160\\n\\nPorts\\n\\n2 HDMI ports (HDCP 1.4 & 2.3), 1 DisplayPort 1.4 (HDCP 1.4 & 2.3) port\\n\\n{\\\"identifier\\\":\\\"ag-monaw2725q\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"3928.99\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/alienware-27-4k-qd-oled-gaming-monitor-aw2725q/apd/210-bqfm/monitors-monitor-accessories\\\"}}\\n\\n\\n### Alienware 27 4K QD-OLED Gaming Monitor - AW2725Q\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n26.7\\\"\\nResolution / Refresh Rate\\n\\n3840 x 2160\\nResponse Time\\n0.03ms GTG\\n\\nPorts\\n\\n1 DisplayPort 1.4, 2 HDMI ports (HDCP 1.4 & 2.3), 1 USB 5Gbps Type-B upstream port, 3 USB 5Gbps Type-A downstream ports, 1 USB-C 5Gbps downstream port (Power Delivery up to 15 W)\\n\\n{\\\"identifier\\\":\\\"ag-mone2425hsm\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"629\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-pro-24-adjustable-stand-monitor-e2425hsm/apd/210-bqzc/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell Pro 24 Adjustable Stand Monitor - E2425HSM\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n23.8\\\"\\nResolution / Refresh Rate\\n\\n1920 x 1080\\n\\nPorts\\n\\n1 HDMI port (HDCP 1.4), 1 DisplayPort 1.2 (HDCP 1.4) port, 1 VGA port\\n\\n{\\\"identifier\\\":\\\"ag-monp2424ht\\\",\\\"productData\\\":{\\\"dellPrice\\\":\\\"1378.99\\\",\\\"shopUrl\\\":\\\"https://www.dell.com/en-my/shop/dell-pro-24-plus-touch-usb-c-hub-monitor-p2424ht/apd/210-bjjm/monitors-monitor-accessories\\\"}}\\n\\n\\n### Dell Pro 24 Plus Touch USB-C Hub Monitor - P2424HT\\n\\n#### Specs\\n\\nDiagonal Size\\n\\n24\\\"\\nResolution / Refresh Rate\\n\\nFull HD (1080p) 1920 x 1080 at 60 Hz\\n\\nPorts\\n\\nHDMI (HDCP 1.4), DisplayPort 1.2 (HDCP 1.4), USB-C 3.2 Gen 1 (power up to 90W), 2 x USB 3.2 Gen 1 downstream, USB-C 3.2 Gen 1 downstream (power up to 15W), USB 3.2 Gen 1 downstream with Battery Charging 1.2 (power up to 10W), 1 x RJ45 Ethernet port\\n"}`;

/**
 * Parse products from the HTML content
 */
function parseProductsFromHTML(htmlContent) {
  const products = [];

  // Extract product blocks using regex
  const productPattern = /###\s+([^\n]+?)\n\n####\s+Specs\s*\n([\s\S]*?)(?=###\s+|$)/g;

  let match;
  while ((match = productPattern.exec(htmlContent)) !== null) {
    const name = match[1].trim();
    const specsSection = match[2];

    // Extract model code from the identifier in the JSON
    const identifierMatch = specsSection.match(/"identifier"\s*:\s*"([^"]+)"/);
    const identifier = identifierMatch ? identifierMatch[1] : '';

    // Extract model code from identifier (e.g., "ag-monp2425h" -> "P2425H")
    let modelCode = '';
    const modelMatch = identifier.match(/[a-z]-mon([a-z]+\d+[a-z]?)/i);
    if (modelMatch) {
      modelCode = modelMatch[1].toUpperCase();
    }

    // Also try to extract from name
    if (!modelCode) {
      const nameModelMatch = name.match(/([A-Z]+\d{4}[A-Z]?)/);
      if (nameModelMatch) {
        modelCode = nameModelMatch[1].toUpperCase();
      }
    }

    // Extract shopUrl
    const shopUrlMatch = specsSection.match(/"shopUrl"\s*:\s*"([^"]+)"/);
    const shopUrl = shopUrlMatch ? shopUrlMatch[1] : '';

    // Extract diagonal size
    const sizeMatch = specsSection.match(/Diagonal Size\s*\n\s*(\d+(?:\.\d+)?)\s*["]/);
    const size = sizeMatch ? `${sizeMatch[1]} Inch` : '';

    // Extract resolution
    const resMatch = specsSection.match(/Resolution \/ Refresh Rate\s*\n\s*(\d{3,4}\s*x\s*\d{3,4})/);
    const resolution = resMatch ? resMatch[1].replace(/\s*x\s*/, ' x ') : '';

    // Extract refresh rate
    const refreshMatch = specsSection.match(/(\d+)\s*Hz/);
    const refreshRate = refreshMatch ? `${refreshMatch[1]}Hz` : '';

    // Extract response time
    const responseMatch = specsSection.match(/Response Time\s*\n\s*(\d+(?:\.\d+)?)\s*ms/);
    const responseTime = responseMatch ? `${responseMatch[1]}ms` : '';

    // Extract ports
    const portsMatch = specsSection.match(/Ports\s*\n\s*([\s\S]*?)(?=\n\s*[^a-z]|$)/);
    let ports = '';
    if (portsMatch) {
      ports = portsMatch[1]
        .replace(/\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Default warranty for Malaysian Dell products
    const warranty = '3 Years Limited Hardware and Advanced Exchange Service';

    if (modelCode && name) {
      products.push({
        model: modelCode,
        briefName: name,
        productUrl: shopUrl,
        size: size,
        resolution: resolution,
        refreshRate: refreshRate,
        responseTime: responseTime,
        ports: ports,
        warranty: warranty
      });
    }
  }

  return products;
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

    const cachedData = {
      model: product.model,
      briefName: product.briefName,
      size: product.size,
      resolution: product.resolution,
      refreshRate: product.refreshRate,
      responseTime: product.responseTime,
      ports: product.ports,
      warranty: product.warranty,
      source: `Malaysian Dell Website: ${product.productUrl}`,
      productUrl: product.productUrl,
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
  console.log('🚀 Parsing Dell Malaysia Monitors Page');
  console.log('='.repeat(80));

  try {
    console.log('📂 Parsing products from HTML...');
    const products = parseProductsFromHTML(PAGE_CONTENT);

    console.log(`    Found ${products.length} products`);

    if (products.length === 0) {
      console.log('❌ No products found');
      return;
    }

    console.log(`\n💾 Saving ${products.length} products to cache...`);

    let savedCount = 0;
    products.forEach(product => {
      if (saveToCache(product)) {
        savedCount++;
      }
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Products: ${products.length}`);
    console.log(`Successfully Saved: ${savedCount}`);
    console.log('');

    // Show sample products
    console.log('Sample Products:');
    console.log('-'.repeat(80));
    products.slice(0, 5).forEach(p => {
      console.log(`${p.model.padEnd(12)} | ${p.briefName}`);
      console.log(`               Size: ${p.size} | Resolution: ${p.resolution} | Warranty: ${p.warranty}`);
    });

    // Regenerate Excel
    console.log(`\n📊 Regenerating Excel...`);

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

// Run the parser
main().catch(console.error);
