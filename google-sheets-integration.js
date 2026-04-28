#!/usr/bin/env node
/**
 * Google Sheets Integration for Dell Monitor Scraping
 *
 * SETUP:
 * 1. Create Google Cloud Project: https://console.cloud.google.com
 * 2. Enable Google Sheets API
 * 3. Create Service Account credentials
 * 4. Download JSON key file
 * 5. Save as: google-credentials.json in this directory
 * 6. Share your Google Sheet with the service account email
 *
 * INSTALL:
 * npm install googleapis
 */

const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const CACHE_DIR = path.join(process.cwd(), 'product-cache');

// Your Google Sheet URL or ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || ''; // e.g., '1BxiMVs0XRA5nFMdKbBdB_3Cksq...'
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');

/**
 * Load credentials from JSON file
 */
function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found: ${CREDENTIALS_PATH}\n` +
      `Please create a Google Service Account and save the JSON key file.`);
  }
  return require(CREDENTIALS_PATH);
}

/**
 * Read all data from Google Sheet
 */
async function readGoogleSheet() {
  const creds = loadCredentials();
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);

  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();

  console.log(`📊 Reading from: ${doc.title}`);

  const sheet = doc.sheetsByIndex[0]; // First sheet
  const rows = await sheet.getRows();

  const products = rows.map(row => ({
    model: row.get('Model') || '',
    briefName: row.get('Brief Name') || '',
    size: row.get('Size') || '',
    resolution: row.get('Resolution') || '',
    refreshRate: row.get('Refresh Rate') || '',
    responseTime: row.get('Response Time') || '',
    ports: row.get('Ports') || '',
    warranty: row.get('Warranty') || '',
    productUrl: row.get('Product URL') || '',
    row: row // Keep reference to update later
  }));

  console.log(`✅ Read ${products.length} rows from Google Sheet`);
  return products;
}

/**
 * Identify rows with missing information
 */
function findMissingInformation(products) {
  const incomplete = [];

  products.forEach(product => {
    const missingFields = [];

    if (!product.size) missingFields.push('Size');
    if (!product.resolution) missingFields.push('Resolution');
    if (!product.refreshRate) missingFields.push('Refresh Rate');
    if (!product.responseTime) missingFields.push('Response Time');
    if (!product.ports) missingFields.push('Ports');
    if (!product.warranty) missingFields.push('Warranty');

    if (missingFields.length > 0) {
      incomplete.push({
        ...product,
        missingFields
      });
    }
  });

  console.log(`\n📋 Found ${incomplete.length} products with missing information`);
  return incomplete;
}

/**
 * Use webReader to fetch product page details
 */
async function fetchProductDetails(productUrl) {
  const https = require('https');

  return new Promise((resolve, reject) => {
    https.get(productUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Parse key details from HTML
        const details = {
          size: extractSize(data),
          resolution: extractResolution(data),
          refreshRate: extractRefreshRate(data),
          responseTime: extractResponseTime(data),
          ports: extractPorts(data),
          warranty: '3 Years Limited Hardware and Advanced Exchange Service' // Malaysian default
        };
        resolve(details);
      });
    }).on('error', reject);
  });
}

function extractSize(html) {
  const match = html.match(/Diagonal Size[^0-9]*([\d.]+)/i);
  return match ? `${match[1]} Inch` : '';
}

function extractResolution(html) {
  const match = html.match(/(\d{3,4})\s*x\s*(\d{3,4})/i);
  return match ? `${match[1]} x ${match[2]}` : '';
}

function extractRefreshRate(html) {
  const match = html.match(/(\d+)\s*Hz/i);
  return match ? `${match[1]}Hz` : '';
}

function extractResponseTime(html) {
  const match = html.match(/(\d+(?:\.\d+)?)\s*ms/i);
  return match ? `${match[1]}ms` : '';
}

function extractPorts(html) {
  const ports = [];
  if (html.includes('HDMI')) ports.push('HDMI');
  if (html.includes('DisplayPort')) ports.push('DisplayPort');
  if (html.includes('USB-C')) ports.push('USB-C');
  if (html.includes('VGA')) ports.push('VGA');
  return ports.join(', ');
}

/**
 * Fill missing information from Dell product pages
 */
async function fillMissingInformation(incompleteProducts) {
  console.log('\n🔍 Fetching missing information...');

  let filled = 0;

  for (let i = 0; i < incompleteProducts.length; i++) {
    const product = incompleteProducts[i];

    if (!product.productUrl) {
      console.log(`  ⚠️  [${i+1}/${incompleteProducts.length}] ${product.model}: No URL provided`);
      continue;
    }

    console.log(`  📄 [${i+1}/${incompleteProducts.length}] ${product.model}`);
    console.log(`     Missing: ${product.missingFields.join(', ')}`);

    try {
      const details = await fetchProductDetails(product.productUrl);

      // Update product with fetched details
      let updated = 0;

      if (details.size && !product.size) {
        product.size = details.size;
        updated++;
      }
      if (details.resolution && !product.resolution) {
        product.resolution = details.resolution;
        updated++;
      }
      if (details.refreshRate && !product.refreshRate) {
        product.refreshRate = details.refreshRate;
        updated++;
      }
      if (details.responseTime && !product.responseTime) {
        product.responseTime = details.responseTime;
        updated++;
      }
      if (details.ports && !product.ports) {
        product.ports = details.ports;
        updated++;
      }
      if (details.warranty && !product.warranty) {
        product.warranty = details.warranty;
        updated++;
      }

      if (updated > 0) {
        console.log(`     ✅ Filled ${updated} fields`);
        filled++;
      } else {
        console.log(`     ⚠️  No information found`);
      }

    } catch (error) {
      console.error(`     ❌ Error: ${error.message}`);
    }

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Successfully filled information for ${filled} products`);
  return incompleteProducts;
}

/**
 * Write updated data back to Google Sheet
 */
async function updateGoogleSheet(products) {
  const creds = loadCredentials();
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);

  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];

  console.log('\n💾 Updating Google Sheet...');

  let updated = 0;

  for (const product of products) {
    try {
      // Update the row
      product.row.set('Size', product.size);
      product.row.set('Resolution', product.resolution);
      product.row.set('Refresh Rate', product.refreshRate);
      product.row.set('Response Time', product.responseTime);
      product.row.set('Ports', product.ports);
      product.row.set('Warranty', product.warranty);

      await product.row.save();
      updated++;

    } catch (error) {
      console.error(`  ❌ Error updating ${product.model}: ${error.message}`);
    }
  }

  console.log(`✅ Updated ${updated} rows in Google Sheet`);
}

/**
 * Create new Google Sheet with sample structure
 */
async function createGoogleSheet(title = 'Dell Monitors Scraping') {
  const creds = loadCredentials();
  const doc = new GoogleSpreadsheet();

  await doc.useServiceAccountAuth(creds);
  await doc.createNewSpreadsheet({ title });

  const sheet = doc.sheetsByIndex[0];
  await sheet.updateProperties({ title: 'Products' });

  // Set header row
  await sheet.setHeaderRow([
    'Model',
    'Brief Name',
    'Size',
    'Resolution',
    'Refresh Rate',
    'Response Time',
    'Ports',
    'Warranty',
    'Product URL'
  ]);

  // Load existing cached products
  const cacheDir = path.join(CACHE_DIR, 'monitor', 'dell');
  const cacheFiles = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
    : [];

  if (cacheFiles.length > 0) {
    console.log(`\n📊 Loading ${cacheFiles.length} cached products...`);

    for (const file of cacheFiles) {
      const cachePath = path.join(cacheDir, file);
      const product = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

      await sheet.addRow({
        Model: product.model,
        Brief Name: product.briefName,
        Size: product.size,
        Resolution: product.resolution,
        Refresh Rate: product.refreshRate,
        Response Time: product.responseTime,
        Ports: product.ports,
        Warranty: product.warranty,
        'Product URL': product.productUrl || ''
      });
    }

    console.log(`✅ Added ${cacheFiles.length} products to Google Sheet`);
  }

  console.log(`\n📊 Google Sheet created:`);
  console.log(`   URL: ${doc.url}`);
  console.log(`   ID: ${doc.spreadsheetId}`);

  return doc;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Google Sheets Integration for Dell Monitor Scraping');
  console.log('='.repeat(80));

  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  try {
    switch (command) {
      case 'create':
        const doc = await createGoogleSheet(args[1]);
        console.log(`\n✅ Done! Share this sheet with your service account email to allow edits.`);
        break;

      case 'read':
        const products = await readGoogleSheet();
        console.log('\n📊 Products:');
        products.slice(0, 5).forEach(p => {
          console.log(`  ${p.model}: ${p.briefName}`);
        });
        break;

      case 'fill':
        const allProducts = await readGoogleSheet();
        const incomplete = findMissingInformation(allProducts);

        if (incomplete.length > 0) {
          const filled = await fillMissingInformation(incomplete);
          await updateGoogleSheet(filled);
        } else {
          console.log('\n✅ All products are complete!');
        }
        break;

      default:
        console.log(`
Usage:
  node google-sheets-integration.js <command>

Commands:
  create [title]    Create a new Google Sheet with cached data
  read              Read all data from Google Sheet
  fill              Fill missing information and update sheet

Setup:
  1. Create Google Cloud Project: https://console.cloud.google.com
  2. Enable Google Sheets API
  3. Create Service Account
  4. Download JSON key file
  5. Save as: google-credentials.json
  6. Set environment variable: export GOOGLE_SHEET_ID='your-sheet-id'
  7. Share sheet with service account email

Example:
  node google-sheets-integration.js create "My Dell Monitors"
  node google-sheets-integration.js read
  node google-sheets-integration.js fill
        `);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes('credentials')) {
      console.log('\n💡 Tip: Make sure google-credentials.json exists');
    }
  }
}

// Run
main().catch(console.error);
