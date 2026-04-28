import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import puppeteer from 'puppeteer';
import { getCachedProduct, saveToCache, getCacheStats } from '@/lib/productCache';
import * as fs from 'fs';
import path from 'path';
import { existsSync } from 'fs';

/**
 * Smart Product Information Extraction with JavaScript Rendering
 * Uses Puppeteer to handle JavaScript-rendered content
 * with intelligent caching to avoid repeated API calls
 *
 * NEW: 3-Tier Fallback System
 * 1. JSON Database (primary) - converted from Excel for better reliability
 * 2. Cached JSON Files (fallback)
 * 3. Puppeteer Web Scraping (last resort)
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

// JSON database path (converted from Excel)
const JSON_DB_PATH = path.join(process.cwd(), 'public/dell_monitors.json');

interface ProductInfo {
  model: string;
  briefName: string;
  size: string;
  resolution: string;
  refreshRate: string;
  responseTime: string;
  ports: string;
  warranty: string;
}

/**
 * TIER 1: Load product info from JSON database (converted from Excel)
 */
async function getFromExcel(modelCode: string): Promise<ProductInfo | null> {
  try {
    if (!existsSync(JSON_DB_PATH)) {
      console.log('⚠️ JSON database file not found:', JSON_DB_PATH);
      return null;
    }

    console.log('📊 TIER 1: Checking JSON database for model:', modelCode);

    const fileContent = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    const data = JSON.parse(fileContent);

    console.log('📊 JSON database loaded, total rows:', data.length);

    // Find matching product by model code
    for (const row of data as any) {
      const rowModel = String(row['Model'] || '').toUpperCase().trim();
      const searchModel = modelCode.toUpperCase().trim();

      // CRITICAL: Don't search if modelCode is empty to prevent false matches
      if (!searchModel) {
        console.log('⚠️ Empty model code - skipping database search');
        continue;
      }

      // CRITICAL: Use strict matching to prevent false positives
      // Only match if:
      // 1. Exact match: "E2225HM" === "E2225HM"
      // 2. Search STARTS WITH database entry (searchModel startsWith rowModel)
      //    e.g., searching "U2424HE" can match "U2424H" (starts with U2424H)
      //    BUT searching "SE2425HM" must NOT match "E2425HM" (doesn't start with)
      const isExactMatch = rowModel === searchModel;
      const isSearchMoreSpecific = searchModel.startsWith(rowModel) && searchModel.length > rowModel.length;

      if (isExactMatch || isSearchMoreSpecific) {
        console.log('✅ Found in JSON database:', rowModel);

        // Map JSON columns to ProductInfo
        let sizeValue = String(row['Size'] || '').replace(/"/g, '') || '';
        // Add " Inch" suffix if not already present
        if (sizeValue && !sizeValue.includes('Inch')) {
          sizeValue = `${sizeValue} Inch`;
        }

        const info: ProductInfo = {
          model: String(row['Model'] || ''),
          briefName: String(row['Brief Naming'] || ''),
          size: sizeValue,
          resolution: String(row['Resolution'] || '') || '',
          refreshRate: String(row['Refresh Rate'] || '') || '',
          responseTime: String(row['Response Time'] || '') || '',
          ports: String(row['Compatible Ports'] || '') || '',
          warranty: String(row['Warranty'] || '') || ''
        };

        // Clean up "N/A" values
        Object.keys(info).forEach(key => {
          if (info[key] === 'N/A' || info[key] === 'N/A"' || info[key] === '"N/A"') {
            info[key] = '';
          }
        });

        return info;
      }
    }

    console.log('❌ Not found in JSON database');
    return null;

  } catch (error) {
    console.error('❌ Error reading JSON database:', error);
    return null;
  }
}

/**
 * Add new product to database (self-learning feature)
 */
async function addToDatabase(productInfo: ProductInfo, productName: string): Promise<void> {
  try {
    console.log('💾 Adding new product to database:', productInfo.model);

    // Read current database
    let data = [];
    if (existsSync(JSON_DB_PATH)) {
      const fileContent = fs.readFileSync(JSON_DB_PATH, 'utf-8');
      data = JSON.parse(fileContent);
    }

    // Check if product already exists
    const existingIndex = data.findIndex((row: any) => {
      const model = String(row['Model'] || '').toUpperCase().trim();
      return model === productInfo.model.toUpperCase();
    });

    // Create database row
    const newRow: any = {
      'Full Product Name': productName,
      'Model': productInfo.model,
      'Brand': 'DELL',
      'Brief Naming': productInfo.briefName,
      'Size': productInfo.size.includes('"') ? productInfo.size : `"${productInfo.size}"`,
      'Resolution': productInfo.resolution,
      'Response Time': productInfo.responseTime,
      'Refresh Rate': productInfo.refreshRate,
      'Compatible Ports': productInfo.ports,
      'Warranty': productInfo.warranty
    };

    if (existingIndex >= 0) {
      // Update existing
      data[existingIndex] = newRow;
      console.log('🔄 Updated existing product in database');
    } else {
      // Add new
      data.push(newRow);
      console.log('➕ Added new product to database');
    }

    // Save to database
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Database updated: ${data.length} products total`);

  } catch (error) {
    console.error('❌ Error adding to database:', error);
  }
}

/**
 * TIER 2: Load product info from cached JSON files
 */
async function getFromCachedFiles(modelCode: string): Promise<ProductInfo | null> {
  try {
    const cacheDir = path.join(process.cwd(), 'product-cache/monitor/dell');

    if (!existsSync(cacheDir)) {
      console.log('⚠️ Cache directory not found');
      return null;
    }

    console.log('📁 TIER 2: Checking cached files for model:', modelCode);

    // CRITICAL: Don't search if modelCode is empty
    if (!modelCode || !modelCode.trim()) {
      console.log('⚠️ Empty model code - skipping cache file search');
      return null;
    }

    // Try to find a matching cache file
    const modelLower = modelCode.toLowerCase();

    // List all JSON files in cache
    const fs = require('fs');
    const files = fs.readdirSync(cacheDir).filter((f: string) => f.endsWith('.json'));

    for (const file of files) {
      const fileModel = file.replace('.json', '').toLowerCase();

      // CRITICAL: Use same strict matching as database
      // Only exact match or search starts with database entry
      const isExactMatch = fileModel === modelLower;
      const isSearchMoreSpecific = modelLower.startsWith(fileModel) && modelLower.length > fileModel.length;

      if (isExactMatch || isSearchMoreSpecific) {
        const filePath = path.join(cacheDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        console.log('✅ Found in cache:', file);

        // Extract relevant info from cached data
        let sizeValue = content.size || content.screenSize || '';
        // Add " Inch" suffix if not already present
        if (sizeValue && !sizeValue.includes('Inch')) {
          sizeValue = `${sizeValue} Inch`;
        }

        const info: ProductInfo = {
          model: modelCode,
          briefName: content.briefName || content.productName || '',
          size: sizeValue,
          resolution: content.resolution || '',
          refreshRate: content.refreshRate || content.refresh_rate || '',
          responseTime: content.responseTime || content.response_time || '',
          ports: content.ports || content.connectivity || '',
          warranty: content.warranty || '3 Years'
        };

        return info;
      }
    }

    console.log('❌ Not found in cached files');
    return null;

  } catch (error) {
    console.error('❌ Error reading cache:', error);
    return null;
  }
}

/**
 * Search for official product website using SerpAPI
 */
async function searchOfficialWebsite(productName: string): Promise<string | null> {
  if (!SERPAPI_KEY) {
    console.error('❌ SERPAPI_KEY not found');
    return null;
  }

  try {
    console.log('🔍 Searching for official website:', productName);

    const searchQuery = `${productName} official site specifications`;
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&api_key=${SERPAPI_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ SerpAPI search successful');

    const organicResults = data.organic_results || [];
    const officialDomains = ['dell.com', 'hp.com', 'lenovo.com', 'asus.com', 'acer.com', 'samsung.com', 'lg.com', 'msi.com'];

    for (const result of organicResults) {
      const link = result.link;
      for (const domain of officialDomains) {
        if (link.includes(domain)) {
          console.log('✅ Found official website:', link);
          return link;
        }
      }
    }

    if (organicResults.length > 0) {
      console.log('⚠️ No official domain found, using first result:', organicResults[0].link);
      return organicResults[0].link;
    }

    return null;

  } catch (error) {
    console.error('❌ SerpAPI search failed:', error);
    return null;
  }
}

/**
 * Fetch website content using Puppeteer (handles JavaScript)
 */
async function fetchWebsiteContentWithPuppeteer(url: string): Promise<string> {
  let browser = null;

  try {
    console.log('🚀 Launching Puppeteer to scrape:', url);

    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set user agent to look like a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Navigate to the URL and wait for JavaScript to execute
    console.log('⏳ Navigating to page and waiting for content...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000 // 30 seconds timeout
    });

    // Wait a bit more for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract both text content and structured spec table data
    const scrapedData = await page.evaluate(() => {
      // Extract text content
      const clone = document.body.cloneNode(true);
      const unwanted = clone.querySelectorAll('script, style, nav, footer, header, iframe, noscript');
      unwanted.forEach(el => el.remove());

      let text = clone.textContent || '';
      text = text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();

      // Extract specifications from various structures
      const specData: string[] = [];

      // Look for key-value pairs in divs (Dell uses this format)
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(div => {
        const divText = div.textContent || '';
        if (divText.includes(':') && divText.length < 300 && divText.length > 20) {
          const parts = divText.split(':');
          if (parts.length === 2) {
            const label = parts[0].trim().toLowerCase();
            const value = parts[1].trim();

            // Check if this looks like a spec
            if (label.includes('size') || label.includes('resolution') ||
                label.includes('refresh') || label.includes('response') ||
                label.includes('hdmi') || label.includes('displayport') ||
                label.includes('panel') || label.includes('warranty') ||
                label.includes('ports')) {
              specData.push(divText);
            }
          }
        }
      });

      // Look for table data (some Dell pages use tables)
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const label = cells[0].textContent?.trim() || '';
            const value = cells[1].textContent?.trim() || '';

            if (label && value && label.length < 100 && value.length < 200) {
              specData.push(`${label}: ${value}`);
            }
          }
        });
      });

      // Look for definition lists (dl/dt/dd)
      const dls = document.querySelectorAll('dl');
      dls.forEach(dl => {
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');

        for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
          const label = dts[i].textContent?.trim() || '';
          const value = dds[i].textContent?.trim() || '';

          if (label && value && label.length < 100 && value.length < 200) {
            specData.push(`${label}: ${value}`);
          }
        }
      });

      return {
        text: text,
        specData: specData.join(' | ')
      };
    });

    // Combine all scraped content
    const combinedContent = [
      scrapedData.text,
      scrapedData.specData
    ].filter(Boolean).join(' | ');

    console.log('✅ Puppeteer scraping successful, text length:', scrapedData.text.length);
    console.log('📊 Spec data found:', scrapedData.specData.length > 0 ? 'YES (' + scrapedData.specData.length + ' chars)' : 'NO');

    // Look for spec-related keywords to validate content quality
    const specKeywords = ['inch', 'hz', 'resolution', 'hdmi', 'displayport', 'response time', 'warranty'];
    const foundKeywords = specKeywords.filter(keyword => combinedContent.toLowerCase().includes(keyword));
    console.log('🔍 Found spec keywords in scraped content:', foundKeywords);

    // Limit content length
    const maxLength = 15000;
    const finalText = combinedContent.length > maxLength
      ? combinedContent.substring(0, maxLength)
      : combinedContent;

    return finalText;

  } catch (error) {
    console.error('❌ Puppeteer scraping failed:', error);
    return '';
  } finally {
    if (browser) {
      await browser.close();
      console.log('✅ Browser closed');
    }
  }
}

/**
 * Extract product information using AI
 */
async function extractProductInfo(productName: string, pageContent: string): Promise<any> {
  try {
    console.log('🤖 Using AI to extract product info');

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // Pre-process content to extract spec-relevant sections - works for any product
    let processedContent = pageContent;
    if (pageContent && pageContent.length > 100) {
      // Universal spec keywords that work across all product types
      const universalSpecKeywords = [
        'specification', 'specs', 'technical', 'details', 'features',
        'dimension', 'size', 'warranty', 'connectivity', 'interface',
        'resolution', 'refresh', 'response', 'hz', 'inch', 'mm',
        'hdmi', 'usb', 'displayport', 'vga', 'ethernet', 'audio',
        'color', 'weight', 'material', 'capacity', 'power', 'battery'
      ];

      const relevantSections: string[] = [];

      // Extract sections around spec keywords with larger context
      for (const keyword of universalSpecKeywords) {
        const keywordIndex = pageContent.toLowerCase().indexOf(keyword);
        if (keywordIndex !== -1) {
          // Extract larger context around keywords (1000 chars for better context)
          const start = Math.max(0, keywordIndex - 300);
          const end = Math.min(pageContent.length, keywordIndex + 700);
          const section = pageContent.substring(start, end).trim();
          if (!relevantSections.includes(section) && section.length > 50) {
            relevantSections.push(section);
          }
        }
      }

      // Extract complete specification sections using common patterns
      const sectionPatterns = [
        /technical\s+specifications[^]{200,3000}/gi,
        /specification[^]{200,3000}/gi,
        /technical\s+details[^]{200,3000}/gi,
        /product\s+specs[^]{200,3000}/gi,
        /key\s+features[^]{200,3000}/gi,
        /what['’]s\s+in\s+the\s+box[^]{200,2000}/gi,
        /product\s+information[^]{200,3000}/gi
      ];

      for (const pattern of sectionPatterns) {
        const matches = pageContent.match(pattern);
        if (matches) {
          for (const match of matches) {
            if (!relevantSections.includes(match) && match.length > 100) {
              relevantSections.push(match);
            }
          }
        }
      }

      // Also include product title/description section for context
      const titlePatterns = [
        /<h1[^>]*>.*?<\/h1>/gi,
        /<title[^>]*>.*?<\/title>/gi,
        /product\s+name[^.]{0,200}/gi
      ];

      for (const pattern of titlePatterns) {
        const matches = pageContent.match(pattern);
        if (matches) {
          for (const match of matches) {
            const cleanMatch = match.replace(/<[^>]+>/g, '').trim();
            if (cleanMatch.length > 10 && cleanMatch.length < 200) {
              relevantSections.unshift(`PRODUCT TITLE: ${cleanMatch}`);
              break;
            }
          }
        }
      }

      // Use relevant sections if found, otherwise use full content
      if (relevantSections.length > 0) {
        processedContent = relevantSections.join('\n\n---\n\n');
        console.log('✅ Extracted', relevantSections.length, 'spec-relevant sections, total length:', processedContent.length);
      } else {
        console.log('⚠️ No spec sections found, using full content');
        processedContent = pageContent;
      }
    }

    let prompt = `You are an expert e-commerce product information extractor. Your job is to extract detailed product specifications from product name and webpage content.

PRODUCT: "${productName}"

WEB CONTENT FROM OFFICIAL WEBSITE:
${processedContent}

Extract the following information and return ONLY a valid JSON object (no markdown, no code blocks):

{
  "model": "extract the exact model number/part number from the product name or content",
  "briefName": "create a short descriptive product name (2-6 words) that describes what this product is. CRITICAL: For Dell monitors, follow these naming rules:
    - If model starts with 'SE' (e.g., SE2425HM, SE2726D): use 'DELL SE Series LED Monitor'
    - If model starts with 'E' (e.g., E2225HM, E2425HM): use 'DELL E Series LED Monitor'
    - If model starts with 'P' (e.g., P2424HT, P1425): use 'DELL Pro Series LED Monitor'
    - If model starts with 'U' (e.g., U2424H, U2725H): use 'Dell UltraSharp Series LED Monitor'
    - If model starts with 'S' (not SE, e.g., S2725H): use 'DELL S Series LED Monitor'
    - If model starts with 'AW': use 'Alienware Monitor'
    - If unsure, use 'DELL LED Monitor'",
  "size": "for monitors/displays: extract the ACTUAL screen size in inches from official specifications, not the rounded marketing name. Look for phrases like 'screen size', 'panel size', 'viewable area', 'display area'. Extract the precise measurement in inches (e.g., '19.5 Inch', '23.8 Inch', '27 Inch'). Look for DECIMAL measurements like 19.5, 23.8, 27.0 which indicate actual dimensions, not rounded numbers like 20, 24, 27. The official specs often show different size than the product name (e.g., 'E2020H' marketed as '20 inch' but has 19.5 inch actual). Search specification tables carefully for exact measurements. For other products: extract relevant dimensions. If not applicable, return empty string.",
  "resolution": "for displays/monitors: extract resolution like '1920 x 1080 FHD' or '2560 x 1440 QHD'. CRITICAL: Always use abbreviations: 'FHD' not 'Full HD', 'QHD' not 'Quad HD', 'UHD' not 'Ultra HD'. Look for '1920x1080', '4K', 'UHD', 'QHD', 'FHD' patterns. If not applicable, return empty string.",
  "refreshRate": "for displays/monitors: extract refresh rate in Hz (e.g., '60Hz', '120Hz', '144Hz'). Look for numbers followed by 'Hz', 'hertz', 'refresh rate'. If not applicable, return empty string.",
  "responseTime": "for displays/monitors: extract ONLY the lowest response time value in milliseconds, formatted as just 'Xms' (e.g., '5ms', '1ms'). If multiple values are mentioned like '5ms (Normal) to 8ms (Fast)', extract ONLY the lowest: '5ms'. Do NOT include 'GTG', 'Fast', 'Normal', or any other text. Just the number and 'ms'. If not applicable, return empty string.",
  "ports": "extract connection ports/interfaces available on this product. Look for 'HDMI', 'USB', 'DisplayPort', 'VGA', 'Ethernet', 'Audio jack', 'USB-C', 'Thunderbolt', etc. Format as comma-separated list or 'X port and Y port'.",
  "warranty": "extract warranty information like '3 Years', '1 Year', '2 Year warranty'. Look for 'warranty', 'guarantee', 'years of coverage'."
}

IMPORTANT EXTRACTION RULES:
1. Be thorough - search through ALL the content, not just the first part
2. If information is mentioned multiple times, use the most detailed/specification-focused mention
3. For empty fields, use empty string "", NOT "null", NOT "undefined", NOT "N/A"
4. If a field doesn't apply to this product type, use empty string ""
5. Look for specification tables, technical details sections, features lists
6. Common spec indicators: "Specifications", "Technical Details", "Features", "What's in the Box", "Product Info"

SEARCH STRATEGY:
- Scan entire content for specification sections
- Look for bullet points, tables, lists of features
- Find technical terminology specific to the product type
- Extract model numbers from titles, product codes, SKUs
- Identify size/resolution/refresh rate from specifications or feature descriptions

Return ONLY the JSON object, nothing else.`;

    console.log('🤖 Calling Gemini AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ AI Response received, raw text:', text.substring(0, 500));

    // Clean and parse JSON
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    console.log('🔍 Cleaned text for parsing:', cleanedText.substring(0, 500));
    console.log('🔍 Full cleaned text:', cleanedText);

    let productInfo: any;
    try {
      productInfo = JSON.parse(cleanedText);

      // Clean up any "empty" strings
      Object.keys(productInfo).forEach(key => {
        if (productInfo[key] === 'empty' || productInfo[key] === 'Empty') {
          productInfo[key] = '';
        }
      });

      console.log('✅ Parsed product info:', productInfo);

      // Check extraction completeness
      const hasEmptyFields = !productInfo.size || !productInfo.resolution || !productInfo.refreshRate;
      console.log('🔍 Checking for empty fields - size:', productInfo.size, 'resolution:', productInfo.resolution, 'refreshRate:', productInfo.refreshRate, 'hasEmpty:', hasEmptyFields);

      if (hasEmptyFields) {
        console.log('⚠️ AI extraction incomplete for some fields - returning as extracted from website');
      } else {
        console.log('✅ AI extraction complete - all fields filled from website!');
      }
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('❌ Raw AI response that failed to parse:', text.substring(0, 1000));

      // Universal model extraction - works for any brand/product
      let extractedModel = '';

      // Try to extract model/part number from product name
      // Common patterns: Brand Product - Model, Brand Product Model, etc.
      const modelPatterns = [
        /([A-Z]{1,4}\d{3,}[A-Z]*)/i,  // Dell-style: U2425H, SE2425HM
        /([A-Z]{2,}-\d{3,}[A-Z]*)/i,  // HP-style: PP-1234A
        /(\w{2,}\d{4,}\w*)/i,        // Generic alphanumeric model
      ];

      for (const pattern of modelPatterns) {
        const match = productName.match(pattern);
        if (match) {
          extractedModel = match[1].toUpperCase();
          console.log('✅ Extracted model using pattern:', pattern, '->', extractedModel);
          break;
        }
      }

      // Fallback: extract after separators (dash, colon, etc.)
      if (!extractedModel) {
        const afterSeparator = productName.split(/[-:–—]/).slice(1).join(' ');
        if (afterSeparator) {
          const codeMatch = afterSeparator.match(/([A-Z0-9]{3,})/i);
          if (codeMatch) {
            extractedModel = codeMatch[1];
            console.log('✅ Extracted model after separator:', extractedModel);
          }
        }
      }

      // Basic fallback - only extract model, leave other fields empty for AI to fill
      console.log('⚠️ Using basic fallback extraction');

      // Determine correct series naming for Dell monitors
      let briefName = productName.split('-')[0].trim();
      if (extractedModel) {
        const modelUpper = extractedModel.toUpperCase();
        if (modelUpper.startsWith('SE')) {
          briefName = 'DELL SE Series LED Monitor';
        } else if (modelUpper.startsWith('E')) {
          briefName = 'DELL E Series LED Monitor';
        } else if (modelUpper.startsWith('P')) {
          briefName = 'DELL Pro Series LED Monitor';
        } else if (modelUpper.startsWith('U')) {
          briefName = 'Dell UltraSharp Series LED Monitor';
        } else if (modelUpper.startsWith('AW')) {
          briefName = 'Alienware Monitor';
        } else if (modelUpper.startsWith('S') && !modelUpper.startsWith('SE')) {
          briefName = 'DELL S Series LED Monitor';
        }
      }

      productInfo = {
        model: extractedModel,
        briefName: briefName,
        size: '',
        resolution: '',
        refreshRate: '',
        responseTime: '',
        ports: '',
        warranty: ''
      };
    }

    return productInfo;

  } catch (error) {
    console.error('❌ AI extraction failed:', error);

    // Extract model number
    let extractedModel = '';
    const dellModelMatch = productName.match(/([A-Z]{1,4}\d{4,}[A-Z]*)/i);
    if (dellModelMatch) {
      extractedModel = dellModelMatch[1].toUpperCase();
    }

    if (!extractedModel) {
      const modelMatch = productName.match(/([A-Z]{2,}\d{3,}[A-Z]*)|([A-Z0-9]{6,})/i);
      if (modelMatch) {
        extractedModel = modelMatch[1] || modelMatch[0];
      }
    }

    console.log('🔧 AI unavailable, using HTML parsing fallback');

    // Determine correct series naming for Dell monitors
    const modelUpper = extractedModel.toUpperCase();
    let briefName = productName.split('-')[0].trim();
    if (extractedModel) {
      if (modelUpper.startsWith('SE')) {
        briefName = 'DELL SE Series LED Monitor';
      } else if (modelUpper.startsWith('E')) {
        briefName = 'DELL E Series LED Monitor';
      } else if (modelUpper.startsWith('P')) {
        briefName = 'DELL Pro Series LED Monitor';
      } else if (modelUpper.startsWith('U')) {
        briefName = 'Dell UltraSharp Series LED Monitor';
      } else if (modelUpper.startsWith('AW')) {
        briefName = 'Alienware Monitor';
      } else if (modelUpper.startsWith('S') && !modelUpper.startsWith('SE')) {
        briefName = 'DELL S Series LED Monitor';
      }
    }

    // Parse specs directly from scraped HTML content (when pageContent is available)
    if (pageContent && pageContent.length > 1000) {
      console.log('📋 Parsing specs from scraped website content...');

      const specs = parseDellSpecsFromHTML(pageContent, productName);
      console.log('✅ Parsed specs from HTML:', specs);

      return {
        model: extractedModel || specs.model,
        briefName: briefName,
        ...specs
      };
    }

    // Final fallback if no content available
    return {
      model: extractedModel,
      briefName: briefName,
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
 * Parse specifications directly from Dell website HTML content
 * Used as fallback when AI extraction fails
 */
function parseDellSpecsFromHTML(html: string, productName: string): Partial<{
  size: string;
  resolution: string;
  refreshRate: string;
  responseTime: string;
  ports: string;
  warranty: string;
}> {
  const specs: any = {};

  // Extract model from product name to look for specific model sections
  const modelMatch = productName.match(/([A-Za-z]{2,}\d{3,}[A-Za-z]*)/);
  const targetModel = modelMatch ? modelMatch[1].toUpperCase() : '';
  console.log('🎯 HTML parsing - looking for specs for model:', targetModel, 'from productName:', productName);

  // Find sections that mention our target model
  let relevantText = html;
  if (targetModel) {
    const modelSections = html.split(new RegExp(targetModel, 'gi'));
    if (modelSections.length > 1) {
      // Use the first 3000 characters after the model mention
      relevantText = modelSections[1].substring(0, 3000);
      console.log('✅ Found section mentioning', targetModel, '- using focused text extraction');
    }
  }

  // Extract screen size (prefer decimal measurements like 19.5, 23.8, 27.0)
  const sizePatterns = [
    /(\d{2}\.\d+)\s*(?:inch|inches|["']|"|\\"")/gi,  // 19.5, 23.8, 27.0
    /screen\s*size[^.]{0,100}?(\d{2}\.\d+)/gi,
    /panel\s*size[^.]{0,100}?(\d{2}\.\d+)/gi,
    /(\d{2})\s*(?:inch|inches|["']|"|\\"")/gi  // fallback to integers
  ];

  for (const pattern of sizePatterns) {
    const matches = relevantText.matchAll(pattern);
    for (const match of matches) {
      const size = parseFloat(match[1]);
      if (size >= 19 && size <= 32) {
        specs.size = `${size} Inch`;
        console.log('✅ Found size:', specs.size, 'from pattern:', pattern);
        break;
      }
    }
    if (specs.size) break;
  }

  // Extract resolution - only from specific sections
  // Look for resolution in the context of the target model
  const resolutionText = relevantText.length > 1000 ? relevantText : html;

  // Try to find resolution in specification table format
  const resolutionPatterns = [
    /resolution\s*[:=]\s*(\d{3,4})\s*[xX]\s*(\d{3,4})/gi,
    /(\d{3,4})\s*[xX]\s*(\d{3,4})\s*(?:FHD|Full\s*HD|QHD|Quad\s*HD|4K|UHD|Ultra\s*HD)?/gi
  ];

  let resolutionFound = false;
  for (const pattern of resolutionPatterns) {
    const match = resolutionText.match(pattern);
    if (match) {
      const res1 = match[1];
      const res2 = match[2];

      // Only accept common monitor resolutions
      const commonResolutions = [
        '1920x1080', '2560x1440', '3840x2160',
        '1920X1080', '2560X1440', '3840X2160'
      ];
      const resolutionKey = `${res1}x${res2}`.toUpperCase();

      if (commonResolutions.includes(resolutionKey) ||
          commonResolutions.includes(resolutionKey.replace('X', 'x'))) {
        let designation = '';
        const resolution = `${res1} x ${res2}`;

        // Auto-detect designation - always use abbreviations
        if (res1 === '1920' && res2 === '1080') {
          // Always use FHD (not Full HD)
          designation = 'FHD';
        } else if (res1 === '2560' && res2 === '1440') {
          if (resolutionText.toLowerCase().includes('qhd') ||
              resolutionText.toLowerCase().includes('quad hd')) {
            designation = 'QHD';
          }
        } else if (res1 === '3840' && res2 === '2160') {
          if (resolutionText.toLowerCase().includes('4k') ||
              resolutionText.toLowerCase().includes('uhd')) {
            designation = '4K';
          }
        }

        specs.resolution = designation ? `${resolution} ${designation}` : resolution;
        console.log('✅ Found resolution:', specs.resolution);
        resolutionFound = true;
        break;
      }
    }
    if (resolutionFound) break;
  }

  // Extract refresh rate - look for specific keywords
  const refreshRatePatterns = [
    /standard\s*refresh\s*rate[^.]{0,50}?(\d+)\s*(?:Hz|hertz)/gi,
    /refresh\s*rate[^.]{0,50}?(\d+)\s*(?:Hz|hertz)/gi
  ];

  for (const pattern of refreshRatePatterns) {
    const match = relevantText.match(pattern);
    if (match) {
      const hz = parseInt(match[1]);
      if (hz >= 60 && hz <= 240) {
        specs.refreshRate = `${hz}Hz`;
        console.log('✅ Found refresh rate:', specs.refreshRate);
        break;
      }
    }
  }

  // Extract response time - only the lowest value, no extra text
  const responseTimePatterns = [
    /response\s*time[^.]{0,100}?(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*ms/gi,
    /(\d+(?:\.\d+)?)\s*ms\s*(?:GTG|gray\s*to\s*gray)/gi,
    /(\d+(?:\.\d+)?)\s*ms/gi  // Generic pattern
  ];

  for (const pattern of responseTimePatterns) {
    const match = relevantText.match(pattern);
    if (match) {
      if (match[2]) {
        // Range found - use ONLY the lowest value
        const msValue1 = parseFloat(match[1]);
        const msValue2 = parseFloat(match[2]);
        const lowestMs = Math.min(msValue1, msValue2);
        if (lowestMs >= 1 && lowestMs <= 20) {
          specs.responseTime = `${lowestMs}ms`;
        }
      } else {
        // Single value
        const msValue = parseFloat(match[1]);
        if (msValue >= 1 && msValue <= 20) {
          specs.responseTime = `${match[1]}ms`;
        }
      }
      if (specs.responseTime) {
        console.log('✅ Found response time:', specs.responseTime);
        break;
      }
    }
  }

  // Extract ports - more specific detection
  const foundPorts: string[] = [];

  // Look for port mentions in connectivity sections
  if (html.includes('HDMI port')) foundPorts.push('HDMI port');
  else if (html.includes('HDMI')) foundPorts.push('HDMI');

  if (html.includes('DisplayPort')) foundPorts.push('DisplayPort');
  if (html.includes('VGA port')) foundPorts.push('VGA port');
  else if (html.includes('VGA')) foundPorts.push('VGA');

  if (html.includes('USB-C') || html.includes('USB C')) foundPorts.push('USB-C');
  if (html.includes('RJ-45')) foundPorts.push('RJ-45');

  // Format ports nicely
  if (foundPorts.length > 0) {
    const uniquePorts = [...new Set(foundPorts)];
    if (uniquePorts.length === 2) {
      specs.ports = `${uniquePorts[0]} and ${uniquePorts[1]}`;
    } else {
      specs.ports = uniquePorts.join(', ');
    }
    console.log('✅ Found ports:', specs.ports);
  }

  // Extract warranty
  const warrantyPatterns = [
    /(\d+)\s*(?:year|years|yr)\s*warranty/gi,
    /warranty[^.]{0,50}?(\d+)\s*(?:year|years|yr)/gi,
    /(\d+)\s*-\s*\d+\s*year\s*warranty/gi
  ];

  for (const pattern of warrantyPatterns) {
    const match = html.match(pattern);
    if (match) {
      const years = parseInt(match[1]);
      if (years >= 1 && years <= 10) {
        specs.warranty = `${years} Years`;
        console.log('✅ Found warranty:', specs.warranty);
        break;
      }
    }
  }

  console.log('🔍 Final HTML parsing results:', specs);
  return specs;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productName = body.productName;

    if (!productName) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    console.log('🚀 Starting SMART product extraction with Puppeteer for:', productName);

    // Extract model code from product name (handles U2424H, E2225HM, P1425, AW2725D, etc.)
    // Try multiple patterns to ensure we capture the model correctly
    let modelCode = '';

    // Pattern 1: Standard Dell models (U2424H, E2225HM, SE2225HM)
    const modelMatch1 = productName.match(/([A-Za-z]{1,2}\d{3,5}[A-Za-z]{0,2})\b/);
    if (modelMatch1) {
      modelCode = modelMatch1[1].toUpperCase();
    }

    // Pattern 2: Models with more letters (AW2725DF, SE2425HR)
    if (!modelCode) {
      const modelMatch2 = productName.match(/([A-Za-z]{2,4}\d{3,5}[A-Za-z]{0,2})\b/);
      if (modelMatch2) {
        modelCode = modelMatch2[1].toUpperCase();
      }
    }

    // Pattern 3: Any alphanumeric code that looks like a model (fallback)
    if (!modelCode) {
      const modelMatch3 = productName.match(/\b([A-Za-z]{1,4}\d{3,}[A-Za-z]{0,3})\b/);
      if (modelMatch3) {
        modelCode = modelMatch3[1].toUpperCase();
      }
    }

    console.log(`🔍 Extracted model code: "${modelCode}" from "${productName}"`);

    // === NEW: 3-Tier Fallback System ===

    // TIER 1: Try Excel database first
    const tier1Info = await getFromExcel(modelCode);
    if (tier1Info) {
      console.log('✅ TIER 1: Found in Excel database');
      return NextResponse.json({
        success: true,
        source: 'Excel Database (75 Dell monitors)',
        productInfo: tier1Info
      });
    }

    // TIER 2: Try cached JSON files
    const tier2Info = await getFromCachedFiles(modelCode);
    if (tier2Info) {
      console.log('✅ TIER 2: Found in cached JSON files');
      return NextResponse.json({
        success: true,
        source: 'Cached JSON files',
        productInfo: tier2Info
      });
    }

    // TIER 3: Check in-memory cache (existing cache system)
    console.log('🔍 TIER 3: Checking in-memory cache for:', modelCode || productName);
    const cachedData = getCachedProduct(modelCode, productName);

    if (cachedData) {
      console.log('✅ TIER 3: Found in in-memory cache');

      // Format size with " Inch" suffix if not already present
      let sizeValue = cachedData.size || '';
      if (sizeValue && !sizeValue.includes('Inch')) {
        sizeValue = `${sizeValue} Inch`;
      }

      return NextResponse.json({
        success: true,
        source: 'in-memory cache',
        cached: true,
        cachedAt: cachedData.cachedAt,
        productUrl: cachedData.productUrl,
        productInfo: {
          model: cachedData.model,
          briefName: cachedData.briefName,
          size: sizeValue,
          resolution: cachedData.resolution,
          refreshRate: cachedData.refreshRate,
          responseTime: cachedData.responseTime,
          ports: cachedData.ports,
          warranty: cachedData.warranty
        }
      });
    }

    console.log('⏭️ All caches miss - using TIER 4: Live scraping from Malaysia Dell store');

    // Step 1: Search for official website (Malaysia store)
    const officialUrl = await searchOfficialWebsite(productName + ' site:dell.com/en-my');

    if (!officialUrl) {
      return NextResponse.json({
        success: false,
        error: 'Could not find official website'
      }, { status: 404 });
    }

    // Step 2: Fetch website content using Puppeteer
    const pageContent = await fetchWebsiteContentWithPuppeteer(officialUrl);

    if (!pageContent) {
      return NextResponse.json({
        success: false,
        error: 'Failed to scrape website content',
        officialUrl: officialUrl
      }, { status: 500 });
    }

    // Step 3: Extract product info using AI
    const scrapedInfo = await extractProductInfo(productName, pageContent);

    // Step 4: Add to database for future requests (SELF-LEARNING!)
    await addToDatabase(scrapedInfo, productName);

    // Step 5: Save to in-memory cache for immediate reuse
    saveToCache(
      modelCode,
      productName,
      scrapedInfo,
      `Live scraped from: ${officialUrl}`,
      officialUrl
    );

    return NextResponse.json({
      success: true,
      source: `Live scraped from Malaysia store (added to database)`,
      cached: false,
      officialUrl: officialUrl,
      scrapedContentLength: pageContent.length,
      productInfo: scrapedInfo
    });

  } catch (error) {
    console.error('❌ Smart extraction failed:', error);

    return NextResponse.json(
      {
        error: 'Smart extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
