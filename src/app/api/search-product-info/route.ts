import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Searching for product info:', query);

    // Step 1: Search for the product using SerpAPI
    const searchQuery = `${query} official site specifications features`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`;

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`Search API failed with status: ${searchResponse.status}`);
    }

    // Check if response is JSON (not HTML error page)
    const contentType = searchResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Search API returned non-JSON response');
    }

    let searchData;
    try {
      searchData = await searchResponse.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse search results as JSON:', jsonError);
      throw new Error('Search results are not in valid JSON format');
    }

    if (!searchData || typeof searchData !== 'object') {
      throw new Error('Search results are not a valid object');
    }

    console.log('✅ Search results received');

    // Step 2: Find official website/product page
    const organicResults = searchData.organic_results || [];
    let productUrl = null;
    let productName = query;

    // Look for official product pages
    for (const result of organicResults) {
      const url = result.link || '';
      const title = result.title || '';

      // Check if this looks like an official product page
      if (url.includes('dell.com') || url.includes('hp.com') || url.includes('samsung.com') ||
          url.includes('lg.com') || url.includes('apple.com') || url.includes('microsoft.com') ||
          url.includes('sony.com') || url.includes('asus.com') || url.includes('acer.com') ||
          title.toLowerCase().includes('official') || title.toLowerCase().includes('specifications')) {
        productUrl = url;
        productName = title.split('|')[0].trim();
        break;
      }
    }

    // If no official page found, use first result
    if (!productUrl && organicResults.length > 0) {
      productUrl = organicResults[0].link;
      productName = organicResults[0].title;
    }

    console.log('📍 Product URL:', productUrl);

    // Step 3: Fetch the product page and extract information
    if (productUrl) {
      try {
        const pageResponse = await fetch(productUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!pageResponse.ok) {
          console.log('⚠️  Could not fetch product page, using fallback');
          const fallbackInfo = generateFallbackInfo(searchData, query, productName);
          return NextResponse.json({
            success: true,
            productUrl,
            ...fallbackInfo
          });
        }

        const pageHtml = await pageResponse.text();
        console.log('✅ Product page fetched, length:', pageHtml.length);

        // Check if we got HTML (not JSON error page)
        if (!pageHtml || !pageHtml.includes('<')) {
          console.log('⚠️  Product page is not HTML, using fallback');
          const fallbackInfo = generateFallbackInfo(searchData, query, productName);
          return NextResponse.json({
            success: true,
            productUrl,
            ...fallbackInfo
          });
        }

        // Extract product information using improved patterns
        let productInfo;
        try {
          productInfo = extractProductInfo(pageHtml, productName, query);
        } catch (extractError) {
          console.log('⚠️  Could not extract structured info, using fallback:', extractError);
          productInfo = generateFallbackInfo(searchData, query, productName);
        }

        return NextResponse.json({
          success: true,
          productUrl,
          ...productInfo
        });

      } catch (error: any) {
        console.log('⚠️  Could not fetch/parse product page:', error.message);
        const fallbackInfo = generateFallbackInfo(searchData, query, productName);
        return NextResponse.json({
          success: true,
          productUrl,
          ...fallbackInfo
        });
      }
    }

    // Fallback: Generate product info from search results
    const fallbackInfo = generateFallbackInfo(searchData, query, productName);

    return NextResponse.json({
      success: true,
      productUrl,
      ...fallbackInfo
    });

  } catch (error) {
    console.error('❌ Product info search failed:', error);

    return NextResponse.json(
      {
        error: 'Failed to search product information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function extractProductInfo(html: string, productName: string, query: string) {
  // Extract product title
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : productName;

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
  const metaDescription = descMatch ? cleanText(descMatch[1]) : '';

  // Extract long description from page content
  const longDescMatch = html.match(/<div[^>]*class=["'].*?description.*?["'][^>]*>([\s\S]{100,})<\/div>/i);
  const longDescription = longDescMatch ? cleanText(longDescMatch[1]) : metaDescription;

  // Extract specifications from multiple sources
  let specifications: string[] = [];

  // Try to find specs table
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
  if (tableMatch) {
    tableMatch.forEach(table => {
      const rows = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      rows.forEach(row => {
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        if (cells.length >= 2) {
          const label = cleanText(cells[0]);
          const value = cleanText(cells[1]);
          if (label && value && label.length > 2 && value.length > 2) {
            specifications.push(`${label}: ${value}`);
          }
        }
      });
    });
  }

  // Look for specification lists
  const specListMatch = html.match(/<ul[^>]*specification[^>]*>([\s\S]*?)<\/ul>/gi);
  if (specListMatch) {
    specListMatch.forEach(list => {
      const items = list.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
      items.forEach(item => {
        const cleaned = cleanText(item);
        if (cleaned && cleaned.length > 5) {
          specifications.push(cleaned);
        }
      });
    });
  }

  // Extract detailed features
  let features: string[] = [];

  // First, clean the HTML
  let cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');

  // Look for features section
  const featuresSections = cleanedHtml.match(/<div[^>]*class=["'].*?feature.*?["'][^>]*>([\s\S]{100,})<\/div>/gi);
  if (featuresSections) {
    featuresSections.forEach(section => {
      const items = section.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
      items.forEach(item => {
        const cleaned = cleanText(item);
        // Filter out HTML artifacts and too short/long items
        if (cleaned && cleaned.length > 15 && cleaned.length < 300 &&
            !cleaned.includes('{') && !cleaned.includes('function') &&
            !cleaned.includes('style:') && !cleaned.includes('background:') &&
            !cleaned.includes('data-') && !cleaned.includes('aria-') &&
            !cleaned.includes('/*') && !cleaned.includes('*/')) {
          features.push(cleaned);
        }
      });
    });
  }

  // Look for bullet points in content
  const bulletPoints = cleanedHtml.match(/<li[^>]*>([\s\S]{20,150})<\/li>/gi) || [];
  bulletPoints.forEach(point => {
    const cleaned = cleanText(point);
    if (cleaned && cleaned.length > 20 && cleaned.length < 250 &&
        !features.includes(cleaned) &&
        !cleaned.includes('{') && !cleaned.includes('function')) {
      features.push(cleaned);
    }
  });

  // Extract what's in the box
  const inBoxMatch = html.match(/<div[^>]*class=["'].*?box.*?["'][^>]*>([\s\S]*?)<\/div>/i);
  let inTheBox: string[] = [];
  if (inBoxMatch) {
    const items = inBoxMatch[1].match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    inTheBox = items.map(item => cleanText(item)).filter(Boolean).slice(0, 10);
  }

  // Extract technical specifications more thoroughly
  const techSpecs = extractTechnicalSpecs(html);

  // Combine all specifications
  const allSpecs = [...new Set([...specifications, ...techSpecs])];

  // Extract dimensions and weight
  const dimensions = extractDimensions(html);
  const weight = extractWeight(html);

  return {
    productName: cleanText(title),
    description: cleanText(longDescription || metaDescription || `Professional ${query} with premium quality and advanced features for modern users.`),
    features: features.length > 0 ? [...new Set(features)].slice(0, 12).map(f => cleanText(f)) : generateDefaultFeatures(query),
    specifications: allSpecs.length > 0 ? allSpecs.slice(0, 20) : generateDefaultSpecs(query),
    technicalSpecs: techSpecs.length > 0 ? techSpecs : generateDefaultSpecs(query),
    inTheBox: inTheBox.length > 0 ? inTheBox.map(item => cleanText(item)) : undefined,
    dimensions: dimensions ? cleanText(dimensions) : null,
    weight: weight ? cleanText(weight) : null,
    brand: extractBrand(query, productName),
    category: extractCategory(query, productName),
    modelNumber: extractModelNumber(html, query),
    warranty: extractWarranty(html) ? cleanText(extractWarranty(html)) : null,
    priceRange: extractPriceRange(html)
  };
}

function extractTechnicalSpecs(html: string): string[] {
  const specs: string[] = [];

  // First, remove all script tags, style tags, and SVG content
  let cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // 1. Look for specification tables with better extraction
  const tableMatch = cleanedHtml.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
  if (tableMatch) {
    tableMatch.forEach(table => {
      const rows = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      rows.forEach(row => {
        // Remove all attributes from cells, keep only text
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        if (cells.length >= 2) {
          // Extract just text content, no HTML
          const label = cleanText(cells[0])
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const value = cleanText(cells[1])
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Additional validation to avoid HTML artifacts
          const isCleanLabel = !label.match(/[<>{}[\]()]/) && !label.includes('data-');
          const isCleanValue = !value.match(/[<>{}[\]()]/) && !value.includes('data-');
          const isReasonableLength = label.length > 2 && label.length < 100 && value.length > 2 && value.length < 200;

          if (label && value && isCleanLabel && isCleanValue && isReasonableLength) {
            specs.push(`${label}: ${value}`);
          }
        }
      });
    });
  }

  // 2. Look for specification lists with cleaner extraction (more flexible class matching)
  const specListPatterns = [
    /<ul[^>]*specification[^>]*>([\s\S]*?)<\/ul>/gi,
    /<ul[^>]*spec[^>]*>([\s\S]*?)<\/ul>/gi,
    /<div[^>]*specification[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*specs[^>]*>([\s\S]*?)<\/div>/gi
  ];

  specListPatterns.forEach(pattern => {
    const specListMatch = cleanedHtml.match(pattern);
    if (specListMatch) {
      specListMatch.forEach(list => {
        const items = list.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
        items.forEach(item => {
          const cleaned = cleanText(item)
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleaned && cleaned.length > 5 && cleaned.length < 300) {
            specs.push(cleaned);
          }
        });
      });
    }
  });

  // 3. Extract text from dl/dt/dd definition lists (common for specs)
  const dlMatch = cleanedHtml.match(/<dl[^>]*>([\s\S]*?)<\/dl>/gi);
  if (dlMatch) {
    dlMatch.forEach(dl => {
      const terms = dl.match(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi) || [];
      terms.forEach(term => {
        const label = cleanText(term[1])
          .replace(/<[^>]+>/g, '')
          .trim();
        const value = cleanText(term[2])
          .replace(/<[^>]+>/g, '')
          .trim();

        // Validate the extracted text
        const isCleanLabel = !label.match(/[<>{}[\]()]/) && label.length > 2 && label.length < 100;
        const isCleanValue = !value.match(/[<>{}[\]()]/) && value.length > 2 && value.length < 200;

        if (label && value && isCleanLabel && isCleanValue) {
          specs.push(`${label}: ${value}`);
        }
      });
    });
  }

  // 4. Look for key-value pairs in div/span structures (common in modern sites)
  const keyValuePatterns = [
    /<div[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*value[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<span[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
  ];

  keyValuePatterns.forEach(pattern => {
    const matches = cleanedHtml.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const parts = match.match(/>([^<]+)</g);
        if (parts && parts.length >= 2) {
          const label = cleanText(parts[0]).trim();
          const value = cleanText(parts[1]).trim();
          if (label && value && label.length > 2 && value.length > 2) {
            specs.push(`${label}: ${value}`);
          }
        }
      });
    }
  });

  // 5. Look for JSON-LD structured data
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    jsonLdMatch.forEach(jsonLd => {
      try {
        const jsonData = JSON.parse(jsonLd.replace(/<script[^>]*>|<\/script>/gi, ''));
        if (jsonData.additionalProperty || jsonData.specs) {
          const properties = jsonData.additionalProperty || jsonData.specs;
          if (Array.isArray(properties)) {
            properties.forEach((prop: any) => {
              if (prop.name && prop.value) {
                specs.push(`${prop.name}: ${prop.value}`);
              }
            });
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });
  }

  // Clean up the specs array
  return [...new Set(specs)]
    .filter(spec => {
      // Remove specs with HTML artifacts and coding
      const hasHtmlTags = /<[^>]+>/.test(spec);
      const hasHtmlEntities = /&nbsp;|&amp;|&quot;|&lt;|&gt;/.test(spec);
      const hasDataAttrs = /data-[a-z0-9-]+|aria-[a-z]+/.test(spec);
      const hasCssProps = /[a-z-]+:\s*["']?[^"']*["']?;/.test(spec);
      const hasBraces = /\{|\}/.test(spec);
      const hasBrackets = /\[|\]|\(|\)/.test(spec);
      const hasFunctions = /function|var|let|const|return/.test(spec);
      const hasUrls = /url\(|http|https|src=/.test(spec);
      const hasHexCodes = /[a-f0-9]{20,}/.test(spec);
      const hasWeirdChars = /\\n|\\t|\\r/.test(spec);
      const tooShort = spec.length < 5;
      const tooLong = spec.length > 200;
      const looksLikeCode = /=>|=|===|{|}|function/.test(spec);

      return !hasHtmlTags && !hasHtmlEntities && !hasDataAttrs && !hasCssProps &&
             !hasBraces && !hasBrackets && !hasFunctions && !hasUrls &&
             !hasHexCodes && !hasWeirdChars && !tooShort && !tooLong &&
             !looksLikeCode;
    })
    .slice(0, 30);
}

function extractDimensions(html: string): string | null {
  const dimMatch = html.match(/(?:dimensions|size)[:\s]*([^<\n]{10,100}?)(?:<|\.|\n)/i);
  return dimMatch ? cleanText(dimMatch[1]) : null;
}

function extractWeight(html: string): string | null {
  const weightMatch = html.match(/(?:weight|net weight)[:\s]*([^<\n]{10,100}?)(?:<|\.|\n)/i);
  return weightMatch ? cleanText(weightMatch[1]) : null;
}

function extractModelNumber(html: string, query: string): string | null {
  // Try to find model number in the query or page
  const modelMatch = query.match(/([A-Z0-9]{3,10})/);
  if (modelMatch) return modelMatch[1];

  const pageModelMatch = html.match(/(?:model|model number|sku)[:\s]*([^<\n]{5,30}?)(?:<|\.|\n)/i);
  return pageModelMatch ? cleanText(pageModelMatch[1]) : null;
}

function extractWarranty(html: string): string | null {
  const warrantyMatch = html.match(/(?:warranty|guarantee)[:\s]*([^<\n]{10,100}?)(?:<|\.|\n)/i);
  return warrantyMatch ? cleanText(warrantyMatch[1]) : null;
}

function extractPriceRange(html: string): string | null {
  const priceMatches = html.match(/\$[\d,]+\.?\d{0,2}/g) || [];
  if (priceMatches.length >= 1) {
    const prices = priceMatches.map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  }
  return null;
}

function generateDefaultSpecs(query: string): string[] {
  const category = extractCategory(query, query);
  const specs: { [key: string]: string[] } = {
    'Computer Monitor': [
      'Panel Type: IPS/LED',
      'Screen Size: 21.5 to 27 inches',
      'Resolution: 1920 x 1080 (Full HD)',
      'Refresh Rate: 60Hz - 75Hz',
      'Response Time: 5ms - 8ms',
      'Brightness: 250 - 300 cd/m²',
      'Contrast Ratio: 1000:1',
      'Viewing Angle: 178° (H/V)',
      'Connectivity: HDMI, VGA, DisplayPort',
      'Stand Adjustments: Tilt',
      'VESA Mount: 100 x 100mm',
      'Built-in Speakers: Yes (2W x 2)',
      'Power Consumption: 20W - 30W'
    ],
    'Laptop Computer': [
      'Processor: Intel Core i5/i7 or AMD Ryzen 5/7',
      'RAM: 8GB - 16GB DDR4',
      'Storage: 256GB - 512GB SSD',
      'Display: 14" - 15.6" Full HD',
      'Graphics: Integrated Intel/AMD',
      'Battery Life: 6 - 10 hours',
      'Wi-Fi: Wi-Fi 5 or Wi-Fi 6',
      'Bluetooth: Bluetooth 5.0',
      'Ports: USB-A, USB-C, HDMI',
      'Webcam: 720p HD',
      'Operating System: Windows 11 Home',
      'Weight: 1.5 - 2.5 kg'
    ],
    'Keyboard': [
      'Type: Mechanical or Membrane',
      'Switch Type: Red/Brown/Blue',
      'Connectivity: USB Wired or Wireless',
      'Layout: QWERTY',
      'Backlight: RGB or Single Color',
      'Key Rollover: N-Key or 6-Key',
      'Polling Rate: 1000Hz',
      'Cable Length: 1.8m',
      'Weight: 0.8 - 1.2kg'
    ],
    'Mouse': [
      'Sensor: Optical or Laser',
      'DPI: 1600 - 16000 adjustable',
      'Buttons: 6 - 12 programmable',
      'Connectivity: USB Wired or Wireless',
      'Polling Rate: 1000Hz',
      'Weight: 80 - 120g',
      'Battery Life: 20 - 70 hours (wireless)'
    ],
    'default': [
      'Build Quality: Premium materials',
      'Dimensions: Standard for category',
      'Weight: Optimized for portability',
      'Warranty: 1-2 years standard',
      'Compatibility: Universal',
      'Power: Energy efficient'
    ]
  };

  return specs[category] || specs['default'];
}

function generateDefaultFeatures(query: string): string[] {
  const category = extractCategory(query, query);
  const features: { [key: string]: string[] } = {
    'Computer Monitor': [
      'Full HD or higher resolution for crystal-clear visuals',
      'Energy-efficient LED backlight technology',
      'Multiple connectivity options (HDMI, DisplayPort, VGA)',
      'Adjustable stand for optimal viewing comfort',
      'Ultra-slim bezel design for immersive viewing',
      'Flicker-free technology for reduced eye strain',
      'Wide viewing angles for consistent colors',
      'VESA mount compatible for flexible setup'
    ],
    'Laptop Computer': [
      'High-performance processor for smooth multitasking',
      'Ample RAM and storage for all your files',
      'Long-lasting battery life for all-day productivity',
      'Sleek, lightweight design for portability',
      'High-resolution display for stunning visuals',
      'Fast connectivity with Wi-Fi 6 and Bluetooth',
      'Advanced cooling system for quiet operation',
      'Multiple ports for all your peripherals'
    ],
    'default': [
      'Premium build quality with durable materials',
      'Modern, sleek design that looks great anywhere',
      'Energy-efficient performance',
      'Easy to set up and use right out of the box',
      'Reliable performance backed by warranty',
      'Professional-grade quality',
      'User-friendly interface',
      'Low maintenance requirements'
    ]
  };

  return features[category] || features['default'];
}

function generateFallbackInfo(searchData: any, query: string, productName: string) {
  // Generate product info from search results and knowledge graph
  const knowledgeGraph = searchData.knowledge_graph || {};
  const organicResults = searchData.organic_results || [];

  // Extract info from snippets
  let description = knowledgeGraph.description || '';
  let features: string[] = [];

  organicResults.forEach((result: any) => {
    if (result.snippet) {
      const snippet = result.snippet;
      if (snippet.length > 50 && !description) {
        description = snippet;
      }
      // Extract potential features from snippets
      const sentences = snippet.split('. ');
      features.push(...sentences.filter(s => s.length > 10));
    }
  });

  return {
    productName: knowledgeGraph.title || productName,
    description: description || `Professional ${query} with premium quality and advanced features for modern users.`,
    features: [...new Set(features)].slice(0, 12),
    specifications: generateDefaultSpecs(query),
    technicalSpecs: generateDefaultSpecs(query),
    brand: extractBrand(query, productName),
    category: extractCategory(query, productName),
    modelNumber: extractModelNumber('', query),
    warranty: '1 year standard warranty',
    dimensions: null,
    weight: null,
    inTheBox: undefined,
    priceRange: null
  };
}

function cleanText(text: string): string {
  if (!text) return '';

  console.log('🧹 Cleaning text:', text.substring(0, 100) + '...');

  let cleaned = text
    // Remove all HTML tags completely
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Remove ALL CSS and JavaScript code more aggressively
    .replace(/\{[^}]*\}/g, '')
    .replace(/;[^}]*\}/g, '')
    .replace(/\([^\)]*\)/g, '')
    // Remove all CSS property patterns (more comprehensive)
    .replace(/[\w-]+:\s*["'][^"']*["'][^}]*;?/gi, '')
    .replace(/[\w-]+:\s*url\([^)]*\)[^}]*;?/gi, '')
    // Remove ALL attributes (data, aria, class, id, style, etc)
    .replace(/\s[\w-]+=\s*["'][^"']*["']/gi, '')
    // Remove inline styles and SVG
    .replace(/style=["'][^"']*["'][^>]*>.*?<\/style>/gi, '')
    .replace(/<svg[^>]*>.*?<\/svg>/gi, '')
    // Remove ALL brackets, braces, and parentheses that might be code
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^\)]*\)/g, '')
    // Remove function calls and code patterns
    .replace(/function\s*\([^)]*\)\s*\{[^}]*\}/gi, '')
    .replace(/var\s+\w+\s*=\s*[^;]+;/gi, '')
    .replace(/const\s+\w+\s*=\s*[^;]+;/gi, '')
    .replace(/let\s+\w+\s*=\s*[^;]+;/gi, '')
    // Remove hex codes and random strings
    .replace(/[a-f0-9]{20,}/gi, '')
    .replace(/\\u[0-9a-f]{4}/gi, '')
    .replace(/\\x[0-9a-f]{2}/gi, '')
    // Remove common HTML artifacts
    .replace(/<\!\[CDATA\[.*?\]\]>/gi, '')
    .replace(/<!--.*?-->/gi, '')
    // Remove weird encoding artifacts
    .replace(/\\[nrt]/g, ' ')
    .replace(/\\'/g, "'")
    // Remove special characters that might be code
    .replace(/[|\\/^$*+?[\]]/g, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim();

  console.log('✅ Cleaned text:', cleaned.substring(0, 100) + '...');

  return cleaned;
}

function extractBrand(query: string, title: string): string {
  const text = `${query} ${title}`.toLowerCase();

  const brands = ['dell', 'hp', 'lenovo', 'samsung', 'lg', 'asus', 'acer', 'microsoft',
                 'apple', 'sony', 'philips', 'benq', 'viewsonic', 'msi'];

  for (const brand of brands) {
    if (text.includes(brand)) {
      return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
  }

  return 'Generic';
}

function extractCategory(query: string, title: string): string {
  const text = `${query} ${title}`.toLowerCase();

  if (text.includes('monitor')) return 'Computer Monitor';
  if (text.includes('laptop')) return 'Laptop Computer';
  if (text.includes('keyboard')) return 'Keyboard';
  if (text.includes('mouse')) return 'Mouse';
  if (text.includes('headphone') || text.includes('earbuds')) return 'Audio Equipment';
  if (text.includes('camera')) return 'Camera';
  if (text.includes('printer')) return 'Printer';
  if (text.includes('tablet')) return 'Tablet';

  return 'Electronics';
}
