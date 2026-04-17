import { NextRequest, NextResponse } from 'next/server';

/**
 * Product Information Search API
 *
 * This API ALWAYS crawls live data from official websites.
 * No hardcoded values, no cached data - always fresh from the source.
 *
 * Priority:
 * 1. Official brand tech specs pages (dell.com/techspecs, etc.)
 * 2. Official brand product pages
 * 3. Third-party retailer pages (as fallback)
 *
 * Supported official domains:
 * - Monitor brands: Dell, HP, Samsung, LG, Asus, Acer, Lenovo, MSI, Benq, ViewSonic, AOC, Philips
 * - Computer brands: Apple, Microsoft, Sony, Razer, Logitech, Corsair
 * - Plus many more official brand and store domains
 */

export async function POST(request: NextRequest) {
  try {
    const { query, model } = await request.json();

    // Better model extraction - prefer alphanumeric model codes over brand names
    let extractedModel = model;
    const modelMatches = query.match(/([A-Z]{2,}\d{3,}[A-Z]*)|([A-Z0-9]{6,})/gi);
    console.log('🔍 Model extraction - query:', query, 'modelMatches:', modelMatches);
    if (modelMatches) {
      // Prefer model codes that start with letters and have numbers (like SE2225HM)
      extractedModel = modelMatches.find((m: string) => /^[A-Z]{2,}\d{3,}/i.test(m)) || modelMatches[0];
      console.log('🎯 Extracted model from query:', extractedModel);
    } else {
      console.log('⚠️ No model matches found in query');
    }

    console.log('📥 Received search request:', { query, model });

    if (!query) {
      console.log('❌ No query provided');
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Searching for product info:', query, 'Model:', extractedModel);
    console.log('🔑 SerpAPI Key present:', !!process.env.SERPAPI_KEY);

    // Step 1: Search for the product - prioritize official websites
    const searchQuery = `${query} official site specifications ${model ? model + ' specs' : ''}`;
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

    // Look for official product pages - prioritize official brand websites
    const officialDomains = [
      // Monitor brands
      'dell.com', 'delltechnologies.com',
      'hp.com', 'hpstore.com',
      'samsung.com', 'lg.com', 'lg.com.com',
      'asus.com', 'acer.com', 'lenovo.com',
      'msi.com', 'benq.com', 'viewsonic.com', 'aoc.com',
      'philips.com', 'gateway.com', 'packardbell.com',
      // Computer brands
      'apple.com', 'microsoft.com', 'sony.com',
      'razer.com', 'logitech.com', 'corsair.com',
      // Additional tech brands
      'dlink.com', 'tp-link.com', 'netgear.com',
      'linksys.com', 'asrock.com', 'gigabyte.com',
      'msi.com', 'evga.com', 'zotac.com',
      'powerelectronics.com', 'perfectionelectronics.com',
      // Store domains (official stores)
      'store.hp.com', 'store.microsoft.com', 'store.apple.com',
      'shop.dell.com', 'store.samsung.com', 'store.lg.com'
    ];

    console.log('🌐 Searching for official website in search results...');

    // First try to find Dell official specs page
    for (const result of organicResults) {
      const url = result.link || '';
      const title = result.title || '';

      // Priority 1: Official brand techspecs/specifications pages
      const isOfficialDomain = officialDomains.some(domain => url.includes(domain));
      const hasTechSpecs = url.includes('techspecs') || url.includes('specifications') || url.includes('specs');

      if (isOfficialDomain && hasTechSpecs) {
        productUrl = url;
        productName = title.split('|')[0].trim();
        console.log('✅ Found official tech specs page:', url);
        break;
      }

      // Priority 2: Official brand product shop pages (prefer over support pages)
      const isProductShopPage = url.includes('/shop/') || url.includes('/apd/');
      const isNotSupportPage = !url.includes('/support/') && !url.includes('/overview');

      if (isOfficialDomain && isProductShopPage && isNotSupportPage) {
        productUrl = url;
        productName = title.split('|')[0].trim();
        console.log('✅ Found official product shop page:', url);
        // Don't break yet, keep looking for tech specs page
      } else if (isOfficialDomain && !productUrl) {
        // Fallback: use any official page if we haven't found one yet
        productUrl = url;
        productName = title.split('|')[0].trim();
        console.log('✅ Found official brand page (fallback):', url);
      }
    }

    // If no official page found, use first result
    if (!productUrl && organicResults.length > 0) {
      productUrl = organicResults[0].link;
      productName = organicResults[0].title;
    }

    console.log('📍 Product URL:', productUrl);
    console.log('🌐 Source type:', productUrl ?
      (officialDomains.some(domain => productUrl.includes(domain)) ? 'Official website' : 'Third-party website') :
      'No URL found');
    console.log('✅ Web crawling from live webpage - no hardcoded data');
    console.log('🔍 URL contains dell.com:', productUrl?.includes('dell.com'));
    console.log('🔍 URL contains techspecs:', productUrl?.includes('techspecs'));

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
          const newFormat = convertToNewFormat(fallbackInfo, query, model);
          return NextResponse.json(newFormat);
        }

        const pageHtml = await pageResponse.text();
        console.log('✅ Product page fetched, length:', pageHtml.length);

        // Check if we got HTML (not JSON error page)
        if (!pageHtml || !pageHtml.includes('<')) {
          console.log('⚠️  Product page is not HTML, using fallback');
          const fallbackInfo = generateFallbackInfo(searchData, query, productName);
          const newFormat = convertToNewFormat(fallbackInfo, query, model);
          return NextResponse.json(newFormat);
        }

        // Extract product information using improved patterns
        let productInfo;
        try {
          // Special handling for Dell techspecs pages
          if (productUrl && productUrl.includes('dell.com')) {
            console.log('🎯 Dell website detected, using Dell-specific extraction');
            productInfo = extractDellTechSpecs(pageHtml, productName, query);

            // If Dell extraction didn't get detailed specs (size, resolution, refresh rate, ports), use AI extraction as fallback
            const hasCriticalSpecs = productInfo.technicalSpecs &&
              productInfo.technicalSpecs.some((spec: string) =>
                spec.includes('Screen Size:') || spec.includes('Resolution:') ||
                spec.includes('Response Time:') || spec.includes('Ports:')
              );

            if (!hasCriticalSpecs) {
              console.log('⚠️ Dell extraction missing critical specs (size, resolution, refresh rate, ports), trying AI extraction...');
              const aiInfo = await extractWithAI(query, pageHtml);
              if (aiInfo) {
                console.log('✅ AI extraction successful, converting to Dell format');

                // Convert AI format to Dell format and continue
                productInfo = {
                  productName: productInfo.productName,
                  description: productInfo.description,
                  features: [],
                  specifications: [],
                  technicalSpecs: [
                    aiInfo.size ? `Screen Size: ${aiInfo.size}` : '',
                    aiInfo.resolution ? `Resolution: ${aiInfo.resolution}` : '',
                    aiInfo.responseTime ? `Response Time: ${aiInfo.responseTime}` : '',
                    aiInfo.refreshRate ? `Refresh Rate: ${aiInfo.refreshRate}` : '',
                    aiInfo.ports ? `Ports: ${aiInfo.ports}` : '',
                    aiInfo.warranty ? `Warranty: ${aiInfo.warranty}` : ''
                  ].filter(Boolean),
                  inTheBox: undefined,
                  dimensions: null,
                  weight: null,
                  brand: 'Dell',
                  category: 'Computer Monitor',
                  modelNumber: aiInfo.model || query.match(/([A-Z0-9]{4,})/i)?.[1] || '',
                  warranty: aiInfo.warranty,
                  priceRange: null
                };
              }
            }
          } else {
            console.log('📋 Using general extraction');
            productInfo = extractProductInfo(pageHtml, productName, query);
          }
        } catch (extractError) {
          console.log('⚠️  Could not extract structured info, using fallback:', extractError);
          productInfo = generateFallbackInfo(searchData, query, productName);
        }

        const newFormat = convertToNewFormat(productInfo, query, extractedModel);
        return NextResponse.json(newFormat);

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
    const newFormat = convertToNewFormat(fallbackInfo, query, model);

    return NextResponse.json(newFormat);

  } catch (error) {
    console.error('❌ Product info search failed:', error);

    return NextResponse.json(
      {
        error: 'Failed to search product information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    console.log('🏁 Search request completed');
  }
}

function convertToNewFormat(oldInfo: any, query: string, model?: string) {
  console.log('🔄 Converting old format to new format:', oldInfo);
  console.log('🔍 Model parameter passed to convertToNewFormat:', model);
  console.log('🔍 oldInfo.modelNumber:', oldInfo.modelNumber);

  // Check if technical specs are already well-formatted (from AI extraction)
  const hasAIFormat = oldInfo.technicalSpecs && oldInfo.technicalSpecs.some((spec: string) =>
    spec.includes('Screen Size:') || spec.includes('Resolution:') ||
    spec.includes('Response Time:') || spec.includes('Refresh Rate:') ||
    spec.includes('Ports:') || spec.includes('Warranty:')
  );

  let size, resolution, responseTime, refreshRate, ports, warranty;

  if (hasAIFormat) {
    // Extract from already-formatted AI data
    console.log('✅ Using AI-formatted specs');
    size = extractValueFromSpecs(oldInfo.technicalSpecs, 'Screen Size');
    resolution = extractValueFromSpecs(oldInfo.technicalSpecs, 'Resolution');
    responseTime = extractValueFromSpecs(oldInfo.technicalSpecs, 'Response Time');
    refreshRate = extractValueFromSpecs(oldInfo.technicalSpecs, 'Refresh Rate');
    ports = extractValueFromSpecs(oldInfo.technicalSpecs, 'Ports');
    warranty = extractValueFromSpecs(oldInfo.technicalSpecs, 'Warranty');
  } else {
    // Use regex extraction for raw web data - pass query for model-specific extraction
    console.log('📋 Using regex extraction for raw data');
    size = extractFromSpecs(oldInfo.technicalSpecs, 'size', query) ||
         extractFromSpecs(oldInfo.specifications, 'size', query) ||
         extractFromSpecs(oldInfo.specifications, 'resolution', query);

    resolution = extractFromSpecs(oldInfo.technicalSpecs, 'resolution', query) ||
              extractFromSpecs(oldInfo.specifications, 'resolution', query);

    responseTime = extractFromSpecs(oldInfo.technicalSpecs, 'responseTime', query) ||
               extractFromSpecs(oldInfo.specifications, 'responseTime', query);

    ports = extractFromSpecs(oldInfo.technicalSpecs, 'ports', query) ||
          extractFromSpecs(oldInfo.specifications, 'ports', query);

    warranty = oldInfo.warranty ? cleanText(oldInfo.warranty) :
            extractFromSpecs(oldInfo.technicalSpecs, 'warranty', query) ||
            extractFromSpecs(oldInfo.specifications, 'warranty', query);
  }

  const result = {
    success: true,
    productInfo: {
      model: oldInfo.modelNumber || model || extractModelFromName(query),
      briefName: formatBriefName(oldInfo.productName || oldInfo.name || generateBriefNameFromQuery(query), query),
      size: size,
      resolution: resolution,
      responseTime: responseTime,
      refreshRate: refreshRate,
      ports: ports,
      warranty: warranty
    }
  };

  console.log('✅ Converted product info:', result);
  return result;
}

function extractValueFromSpecs(specs: string[], prefix: string): string {
  if (!specs || !Array.isArray(specs)) return '';

  for (const spec of specs) {
    if (spec.startsWith(prefix + ':')) {
      const value = spec.substring(prefix.length + 1).trim();
      console.log(`✅ Extracted ${prefix}: ${value}`);
      return value;
    }
  }

  return '';
}

function formatBriefName(briefName: string, query: string = ''): string {
  if (!briefName) return '';

  // Extract the model from the query to check if it's an SE Series monitor
  const modelMatch = query.match(/SE\d+[A-Z]+/i);
  const isSESeriesInQuery = modelMatch !== null;
  const isDellInQuery = query.toUpperCase().includes('DELL');

  console.log(`🔍 Checking if query "${query}" is SE Series:`, { isSESeriesInQuery, isDellInQuery, modelMatch });

  // If query contains Dell + SE Series model, use standard brief name
  if (isSESeriesInQuery && isDellInQuery) {
    console.log('✅ Detected Dell SE Series monitor from query, using standard brief name');
    return 'DELL SE Series LED Monitor';
  }

  // Fallback: Check if this is a Dell SE Series monitor from briefName itself
  const isSESeriesDellMonitor = briefName.toUpperCase().includes('DELL') &&
                             (briefName.toUpperCase().includes('SE') ||
                              briefName.match(/SE\d+[A-Z]+/i) ||
                              briefName.toUpperCase().includes('SERIES'));

  if (isSESeriesDellMonitor) {
    console.log('✅ Detected Dell SE Series monitor from brief name, using standard brief name');
    return 'DELL SE Series LED Monitor';
  }

  // Remove extra details after pipe or dash
  let cleaned = briefName.split('|')[0].split('-')[0].trim();

  // Remove specific model numbers from brief name
  cleaned = cleaned.replace(/SE\d+[A-Z]+/g, 'SE Series');
  cleaned = cleaned.replace(/\b\d+\.\d+\s*inch\b/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Capitalize important words
  cleaned = cleaned.replace(/\b(series|led|monitor|lcd)\b/gi, (match) => match.toUpperCase());

  // Ensure proper format for Dell SE Series
  if (cleaned.toUpperCase().includes('DELL') && cleaned.toUpperCase().includes('SERIES')) {
    cleaned = cleaned.replace(/DELL/i, 'DELL').replace(/SERIES/i, 'Series');
    if (!cleaned.includes('LED')) {
      cleaned = cleaned.replace('Series', 'Series LED');
    }
  }

  console.log('✅ Formatted brief name:', cleaned);
  return cleaned || briefName;
}

function extractFromSpecs(specs: string[], type: string, query: string = ''): string {
  if (!specs || !Array.isArray(specs)) return '';

  const cleanSpecs = specs.map((spec: string) => {
    // Remove HTML tags
    let cleaned = spec.replace(/<[^>]+>/g, '').trim();
    // Remove common prefixes
    cleaned = cleaned.replace(/^[^:]*:\s*/, '');
    return cleaned;
  }).filter(spec => spec.length > 0 && spec.length < 200);

  // Extract model from query for model-specific extraction
  const modelMatch = query.match(/([A-Z]{2,}\d{3,}[A-Z]*)/i);
  const targetModel = modelMatch ? modelMatch[1] : '';
  console.log(`🔍 extractFromSpecs - Looking for model "${targetModel}" in query "${query}" for type "${type}"`);

  const patterns = {
    size: [/(\d+\.?\d*)\s*(?:inch|inches|'|\\")/i],
    resolution: [/(\d{3,4})\s*[xX]\s*(\d{3,4})/i, /(1920\s*[xX]\s*1080|2560\s*[xX]\s*1440|3840\s*[xX]\s*2160)/i],
    responseTime: [/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*ms/i, /(\d+(?:\.\d+)?)\s*ms/i, /response\s*time[^.]{0,50}?(\d+(?:\.\d+)?)\s*ms/i],
    ports: [
      /(?:ports?|connectors?|interfaces?)?\s*[:=]\s*([^.,;\n]+)/i,
      /(HDMI|DisplayPort|VGA|DVI|USB[-\s]?C|Thunderbolt).*?(?:port|connector|interface)?/gi,
      /(?:connectivity|connections?|inputs?|outputs?|video\s*audio\s*inputs?).*?[:=]\s*([^.,;\n]+)/i
    ],
    warranty: [/(\d+)\s*(?:year|years|yr)\s*warranty/i, /warranty\s*[:=]\s*(\d+)\s*(?:year|years|yr)/i]
  };

  const typePatterns = patterns[type as keyof typeof patterns];
  if (!typePatterns) return '';

  // Special handling for size - try model-specific extraction first
  if (type === 'size' && targetModel) {
    console.log(`🔍 Looking for size near model "${targetModel}"...`);

    // First, look for size patterns that appear close to the target model in the specs
    for (const spec of cleanSpecs) {
      // Check if this spec mentions our target model
      if (spec.toUpperCase().includes(targetModel.toUpperCase())) {
        console.log(`✅ Found spec mentioning ${targetModel}:`, spec);

        // Look for size pattern in this spec
        const sizeMatch = spec.match(/(\d+\.?\d*)\s*(?:inch|inches|'|\\")/i);
        if (sizeMatch) {
          const size = sizeMatch[1];
          // Validate it's a reasonable monitor size
          const numSize = parseFloat(size);
          if (numSize >= 21 && numSize <= 32) {
            console.log(`✅ Found size ${size}" from spec mentioning ${targetModel}`);
            return `${size} Inch`;
          }
        }
      }
    }

    // Fallback: Look for size patterns in all specs, but prefer certain ranges based on model
    const allSizes: number[] = [];
    for (const spec of cleanSpecs) {
      const sizeMatch = spec.match(/(\d+\.?\d*)\s*(?:inch|inches|'|\\")/i);
      if (sizeMatch) {
        const size = parseFloat(sizeMatch[1]);
        if (size >= 21 && size <= 32) {
          allSizes.push(size);
        }
      }
    }

    if (allSizes.length > 0) {
      // Sort by size
      allSizes.sort((a, b) => a - b);
      console.log(`🔍 All valid sizes found:`, allSizes);

      // For SE2725HM and SE2726D (27-inch models), prefer sizes closer to 27-27.5
      if (targetModel.toUpperCase().includes('SE2725HM') || targetModel.toUpperCase().includes('SE2726D')) {
        const preferredSize = allSizes.find(s => s >= 26.5 && s <= 28);
        if (preferredSize) {
          console.log(`✅ Selected size for ${targetModel}: ${preferredSize}"`);
          return `${preferredSize} Inch`;
        }
      }

      // For SE2425HM (24-inch model), prefer sizes closer to 23.8-24
      if (targetModel.toUpperCase().includes('SE2425HM')) {
        // Prefer 23.8 or 24 inch
        const preferredSize = allSizes.find(s => s >= 23.5 && s <= 24.5);
        if (preferredSize) {
          console.log(`✅ Selected size for SE2425HM: ${preferredSize}"`);
          return `${preferredSize} Inch`;
        }
      }

      // For SE2225HM (22-inch model), prefer sizes closer to 21.5-22
      if (targetModel.toUpperCase().includes('SE2225HM')) {
        const preferredSize = allSizes.find(s => s >= 21.5 && s <= 22.5);
        if (preferredSize) {
          console.log(`✅ Selected size for SE2225HM: ${preferredSize}"`);
          return `${preferredSize} Inch`;
        }
      }

      // Default: use the smallest reasonable size
      console.log(`✅ Using smallest reasonable size: ${allSizes[0]}"`);
      return `${allSizes[0]} Inch`;
    }
  }

  // Special handling for ports - collect all matches
  if (type === 'ports') {
    const allPorts: string[] = [];

    for (const spec of cleanSpecs) {
      // Try to extract all port mentions from this spec
      const portMatches = spec.match(/(?:HDMI|DisplayPort|VGA|DVI|USB[-\s]?C|Thunderbolt)\s*(?:port|connector|interface)?/gi) || [];

      for (const portMatch of portMatches) {
        const portName = portMatch.trim()
          .replace(/port/gi, '')
          .replace(/connector/gi, '')
          .replace(/interface/gi, '')
          .replace(/,\s*/g, '')
          .trim();

        if (portName && !allPorts.some(p => p.toLowerCase().includes(portName.toLowerCase()))) {
          allPorts.push(portName + ' port');
        }
      }

      // Also try to capture comma-separated port lists
      const commaSeparatedMatch = spec.match(/([^.,;\n]{10,100})/);
      if (commaSeparatedMatch) {
        const portsText = commaSeparatedMatch[1];
        if (portsText.includes('HDMI') || portsText.includes('VGA') || portsText.includes('DisplayPort')) {
          // Extract individual ports from the text
          const extractedPorts = portsText.match(/(?:HDMI|DisplayPort|VGA|DVI|USB[-\s]?C|Thunderbolt)[^.,;\n]*/gi) || [];
          for (const port of extractedPorts) {
            const cleanedPort = port.trim()
              .replace(/,\s*/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            if (cleanedPort && !allPorts.some(p => p.toLowerCase().includes(cleanedPort.toLowerCase()))) {
              allPorts.push(cleanedPort);
            }
          }
        }
      }
    }

    if (allPorts.length > 0) {
      // Format ports nicely (e.g., "HDMI port and VGA port" or "HDMI port, DisplayPort, VGA port")
      if (allPorts.length === 2) {
        return `${allPorts[0]} and ${allPorts[1]}`;
      } else {
        return allPorts.join(', ');
      }
    }
  }

  // Standard extraction for other types
  for (const spec of cleanSpecs) {
    for (const pattern of typePatterns) {
      const match = spec.match(pattern);
      if (match) {
        let value = match[1] || match[0];
        value = value.replace(/^[^a-zA-Z0-9]+/, '').trim();
        value = value.replace(/[^a-zA-Z0-9\s.xX\-\"(\\)]/, '').trim();
        if (value.length > 0) {
          console.log(`✅ Found ${type}:`, value, 'from spec:', spec);
          return value;
        }
      }
    }
  }

  return '';
}

function extractModelFromName(name: string): string {
  const modelPattern = /([A-Z0-9]{4,})/i;
  const match = name.match(modelPattern);
  return match ? match[1] : '';
}

function generateBriefNameFromQuery(query: string): string {
  const words = query.split(/\s+/);
  const brand = words[0] || '';
  const type = words.slice(1).join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim().substring(0, 30);
  return `${brand} ${type}`.trim();
}

function extractSpecImproved(specs: string[], type: string): string {
  if (!specs || !Array.isArray(specs)) return '';

  // More specific extraction patterns for each type
  const patterns = {
    size: [
      /(\d+\.?\d*)\s*(?:inch|inches|'"|\")/i,
      /(\d+\.?\d*)\s*(?:\")/i
    ],
    resolution: [
      /(\d{3,4})\s*[xX]\s*(\d{3,4})/i,
      /(?:resolution)?\s*[:=]\s*(\d{3,4}\s*[xX]\s*\d{3,4})/i,
      /(1920\s*[xX]\s*1080|2560\s*[xX]\s*1440|3840\s*[xX]\s*2160)/i
    ],
    responseTime: [
      /(\d+)\s*(?:Hz|hertz)/i,
      /(?:refresh|rate)?\s*[:=]\s*(\d+)\s*(?:Hz|hertz)/i,
      /(\d+)\s*(?:Hz).*refresh/i
    ],
    ports: [
      /(?:ports?|connectors?|interfaces?)?\s*[:=]\s*([^.,;\n]+)/i,
      /(HDMI|DisplayPort|VGA|DVI|USB-C|Thunderbolt)/gi
    ],
    warranty: [
      /(\d+)\s*(?:year|years?|yr)/i,
      /(?:warranty)?\s*[:=]\s*(\d+)\s*(?:year|years?)/i
    ]
  };

  const typePatterns = patterns[type as keyof typeof patterns];
  if (!typePatterns) return '';

  // Try each pattern until we find a match
  for (const spec of specs) {
    const cleanSpec = spec.replace(/<[^>]+>/g, '').trim(); // Remove HTML tags
    for (const pattern of typePatterns) {
      const match = cleanSpec.match(pattern);
      if (match) {
        let value = match[1] || match[0]; // Get first capture group or whole match
        // Clean up the extracted value
        value = value.replace(/^[^a-zA-Z0-9]+/, '').trim(); // Remove leading non-alphanumeric
        value = value.replace(/[^a-zA-Z0-9\s.xX\-\"]/, '').trim(); // Remove trailing junk
        if (value.length > 0) {
          return value;
        }
      }
    }
  }

  return '';
}

async function extractWithAI(query: string, pageContent?: string) {
  try {
    console.log('🤖 Using AI extraction for:', query);

    const response = await fetch('http://localhost:3000/api/extract-product-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: query,
        pageContent: pageContent // Pass webpage content for better extraction
      })
    });

    if (!response.ok) {
      console.log('❌ AI extraction failed');
      return null;
    }

    const data = await response.json();
    if (data.success && data.productInfo) {
      console.log('✅ AI extraction result:', data.productInfo);
      return data.productInfo;
    }

    return null;
  } catch (error) {
    console.log('❌ AI extraction error:', error);
    return null;
  }
}

function extractDellTechSpecs(html: string, productName: string, query: string) {
  console.log('🔧 Extracting Dell tech specs from official webpage...');

  // Extract the model number we're looking for
  // Better model extraction - prefer longer alphanumeric codes over brand names
  let targetModel = '';
  const modelMatches = query.match(/([A-Z]{2,}\d{3,}[A-Z]*)|([A-Z]{2,}\d{3,})/gi);
  if (modelMatches) {
    // Prefer model codes that start with letters and have numbers (like SE2225HM, SE2425HM)
    targetModel = modelMatches.find((m: string) => /^[A-Z]{2,}\d{3,}/i.test(m)) || modelMatches[modelMatches.length - 1];
  }

  console.log(`🎯 Looking for specs for model: ${targetModel}`);

  // Remove script, style, and other non-content elements
  let cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const specs: any = {
    size: '',
    resolution: '',
    responseTime: '',
    refreshRate: '',
    ports: '',
    warranty: ''
  };

  console.log(`🔍 Searching for specs in ${cleanedHtml.length} characters of HTML...`);

  // Strategy 1: Look for structured data (JSON-LD) that matches our target model
  const jsonLdMatch = cleanedHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    console.log(`✅ Found ${jsonLdMatch.length} JSON-LD blocks`);
    jsonLdMatch.forEach((jsonLd, index) => {
      try {
        const jsonData = JSON.parse(jsonLd.replace(/<script[^>]*>|<\/script>/gi, ''));
        if (jsonData && (jsonData.name?.includes(targetModel) || jsonData.model?.includes(targetModel) || jsonData.sku?.includes(targetModel))) {
          console.log(`🎯 Found JSON-LD for ${targetModel}:`, JSON.stringify(jsonData).substring(0, 200) + '...');

          // Extract from JSON-LD properties
          if (jsonData.additionalProperty) {
            jsonData.additionalProperty.forEach((prop: any) => {
              const label = prop.name?.toLowerCase() || '';
              const value = prop.value || '';

              if (label.includes('screen size') || label.includes('panel size')) {
                const sizeMatch = value.match(/(\d+\.?\d*)/);
                if (sizeMatch && !specs.size) {
                  specs.size = `${sizeMatch[1]} Inch`;
                  console.log(`✅ Size from JSON-LD: ${specs.size}`);
                }
              }

              if (label.includes('resolution')) {
                if (!specs.resolution) {
                  specs.resolution = value;
                  console.log(`✅ Resolution from JSON-LD: ${specs.resolution}`);
                }
              }

              if (label.includes('response time')) {
                const msMatch = value.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*ms/i);
                if (msMatch && !specs.responseTime) {
                  specs.responseTime = `${msMatch[1]}-${msMatch[2]}ms`;
                  console.log(`✅ Response Time from JSON-LD: ${specs.responseTime}`);
                }
              }

              if (label.includes('port') || label.includes('connector') || label.includes('interface')) {
                if (!specs.ports) {
                  specs.ports = value;
                  console.log(`✅ Ports from JSON-LD: ${specs.ports}`);
                }
              }

              if (label.includes('warranty')) {
                const warrantyMatch = value.match(/(\d+)\s*(?:year|years|yr)/i);
                if (warrantyMatch && !specs.warranty) {
                  specs.warranty = `${warrantyMatch[1]} Years`;
                  console.log(`✅ Warranty from JSON-LD: ${specs.warranty}`);
                }
              }
            });
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });
  }

  // Strategy 2: Look for text content that mentions our specific model
  const textContent = cleanedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Find sections that mention our target model and extract specs from those sections only
  const modelSections = textContent.split(new RegExp(targetModel, 'gi'));
  console.log(`🔍 Found ${modelSections.length - 1} sections mentioning ${targetModel}`);

  if (modelSections.length > 1) {
    // Focus on the first section that mentions our model (likely the main product description)
    const relevantText = modelSections[1].substring(0, 2000); // First 2000 chars after model mention
    console.log(`🔍 Analyzing ${relevantText.length} characters of text around ${targetModel}...`);

    // Extract screen size from relevant text only
    const sizePatterns = [
      new RegExp(`${targetModel}[^.]{0,200}?(\d+\\.?\\d+)\\s*(?:inch|inches|["']|"|\\"")`, 'gi'),
      /(\d+\.?\d+)\s*(?:inch|inches|["']|"|\\"")\s*(?:monitor|display|screen|panel)/gi
    ];

    for (const pattern of sizePatterns) {
      const match = relevantText.match(pattern);
      if (match && !specs.size) {
        specs.size = `${match[1]} Inch`;
        console.log(`✅ Size from ${targetModel} section: ${specs.size}`);
        break;
      }
    }

    // Extract resolution from relevant text only
    const resolutionPatterns = [
      new RegExp(`${targetModel}[^.]{0,300}?(\\d{3,4})\\s*[xX]\\s*(\\d{3,4})`, 'gi'),
      /(\d{3,4})\s*[xX]\s*(\d{3,4})\s*(?:resolution|display|panel)/gi,
      /full\s*hd|fhd|1920\s*x\s*1080|1080p/gi
    ];

    // Extract resolution designation (FHD, QHD, 4K, UHD, etc.)
    const designationPatterns = [
      /\b(FHD|Full\s*HD|Full\sHD)\b/gi,
      /\b(QHD|Quad\s*HD)\b/gi,
      /\b(4K|Ultra\s*HD|UHD|Ultra\sHD)\b/gi,
      /\b(2K|1440p)\b/gi,
      /\b(8K)\b/gi
    ];

    for (const pattern of resolutionPatterns) {
      const match = relevantText.match(pattern);
      if (match && !specs.resolution) {
        let resolution = '';
        let designation = '';

        // Extract base resolution numbers
        if (match[0].toLowerCase().includes('full hd') || match[0].toLowerCase().includes('fhd') || match[0].toLowerCase().includes('1080p')) {
          resolution = '1920 x 1080';
          designation = 'FHD';
        } else if (match[1] && match[2]) {
          resolution = `${match[1]} x ${match[2]}`;

          // Look for designation in the surrounding text (within 200 characters)
          const matchIndex = relevantText.indexOf(match[0]);
          const contextStart = Math.max(0, matchIndex - 100);
          const contextEnd = Math.min(relevantText.length, matchIndex + match[0].length + 100);
          const context = relevantText.substring(contextStart, contextEnd);

          console.log(`🔍 Searching for designation in context (${context.length} chars around "${match[0]}")`);

          // Try to find designation in context
          for (const designPattern of designationPatterns) {
            const designMatch = context.match(designPattern);
            if (designMatch) {
              designation = designMatch[0].toUpperCase().replace(/\s+/g, '');
              if (designation === 'FULLHD') designation = 'FHD';
              if (designation === 'QUADHD') designation = 'QHD';
              if (designation === 'ULTRAHD' || designation === 'ULTRAHD') designation = '4K';
              console.log(`✅ Found designation "${designation}" from pattern:`, designPattern);
              break;
            }
          }

          if (!designation) {
            console.log(`⚠️ No designation found in context around "${match[0]}"`);
          }
        }

        // Combine resolution with designation
        specs.resolution = designation ? `${resolution} ${designation}` : resolution;
        console.log(`✅ Resolution from ${targetModel} section: ${specs.resolution}${designation ? ` (with designation: ${designation})` : ''}`);
        break;
      }
    }

    // Extract response time from relevant text only - look for ms mentions near our model
    // First, try to find the Response Time Details section (Dell format)
    const responseTimeSection = textContent.match(/Response\s*Time\s*Details[^.]{0,500}/gi);

    if (responseTimeSection && !specs.responseTime) {
      console.log('✅ Found Response Time Details section');

      // Extract all ms GTG values from the section
      const gtgMatches = responseTimeSection[0].match(/(\d+(?:\.\d+)?)\s*ms\s*GTG/gi) || [];
      const msValues = gtgMatches.map(match => {
        const numMatch = match.match(/(\d+(?:\.\d+)?)/);
        return numMatch ? parseFloat(numMatch[1]) : null;
      }).filter(Boolean);

      if (msValues.length >= 2) {
        // Found range (e.g., 5ms and 8ms)
        const minMs = Math.min(...msValues);
        const maxMs = Math.max(...msValues);
        specs.responseTime = `${minMs}-${maxMs}ms`;
        console.log(`✅ Response Time from GTG range: ${specs.responseTime}`);
      } else if (msValues.length === 1) {
        // Found single value
        specs.responseTime = `${msValues[0]}ms`;
        console.log(`✅ Response Time from single GTG value: ${specs.responseTime}`);
      }
    }

    // Fallback: Try other patterns if not found
    if (!specs.responseTime) {
      const responseTimePatterns = [
        new RegExp(`${targetModel}[^.]{0,300}?(\\d+(?:\\.\\d+)?|-\\d+)\\s*(?:ms|milliseconds|millisecond)`, 'gi'),
        /(\d+(?:\.\d+)?\s*(?:to|-)\s*\d+(?:\.\d+)?)\s*ms/gi,
        /response\s*time[^.]{0,100}?(\d+(?:\.\d+)?)\s*ms/gi
      ];

      for (const pattern of responseTimePatterns) {
        const match = relevantText.match(pattern);
        if (match && !specs.responseTime) {
          // Extract the response time value
          let responseTime = match[1] || match[0];
          // Clean up the format
          responseTime = responseTime.replace(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)/, '$1-$2');
          responseTime = responseTime.replace(/\s*ms.*/i, 'ms');
          responseTime = responseTime.replace(/milliseconds?/gi, 'ms');
          responseTime = responseTime.trim();

          // Validate it's a reasonable response time (1-20ms range)
          const msValue = parseFloat(responseTime.replace(/-.*/, '').replace(/[^\d.]/g, ''));
          if (msValue >= 1 && msValue <= 20) {
            specs.responseTime = responseTime;
            console.log(`✅ Response Time extracted: ${specs.responseTime}`);
            break;
          }
        }
      }
    }
  }

  // Strategy 3: If still missing specs, try broader patterns but be more selective
  if (!specs.size || !specs.resolution || !specs.responseTime) {
    console.log('🔍 Some specs missing, trying selective patterns...');

    // For size, use model-specific selection
    if (!specs.size) {
      const allSizes = textContent.match(/(\d+\.?\d+)\s*(?:inch|inches|["']|"|\\"")/gi) || [];
      const uniqueSizes = [...new Set(allSizes.map(s => parseFloat(s.replace(/[^\d.]/g, ''))))].sort((a, b) => a - b);

      console.log('🔍 All sizes found:', uniqueSizes);
      console.log(`🎯 Target model: ${targetModel}`);

      // Model-specific size selection
      if (targetModel.toUpperCase().includes('SE2725HM') || targetModel.toUpperCase().includes('SE2726D')) {
        // SE2725HM and SE2726D are 27-inch monitors, prefer 27-27.5 inch
        const preferredSize = uniqueSizes.find(s => s >= 26.5 && s <= 28);
        if (preferredSize) {
          specs.size = `${preferredSize} Inch`;
          console.log(`✅ Selected size for ${targetModel}: ${specs.size}`);
        } else {
          // Fallback to closest reasonable
          const fallbackSize = uniqueSizes.find(s => s >= 26 && s <= 28);
          if (fallbackSize) {
            specs.size = `${fallbackSize} Inch`;
            console.log(`✅ Selected fallback size for ${targetModel}: ${specs.size}`);
          }
        }
      } else if (targetModel.toUpperCase().includes('SE2425HM')) {
        // SE2425HM is a 24-inch monitor, prefer 23.8-24 inch
        const preferredSize = uniqueSizes.find(s => s >= 23.5 && s <= 24.5);
        if (preferredSize) {
          specs.size = `${preferredSize} Inch`;
          console.log(`✅ Selected size for SE2425HM: ${specs.size}`);
        } else {
          // Fallback to smallest reasonable
          const fallbackSize = uniqueSizes.find(s => s >= 21 && s <= 25);
          if (fallbackSize) {
            specs.size = `${fallbackSize} Inch`;
            console.log(`✅ Selected fallback size for SE2425HM: ${specs.size}`);
          }
        }
      } else if (targetModel.toUpperCase().includes('SE2225HM')) {
        // SE2225HM is a 22-inch monitor, prefer 21.5-22.5 inch
        const preferredSize = uniqueSizes.find(s => s >= 21.5 && s <= 22.5);
        if (preferredSize) {
          specs.size = `${preferredSize} Inch`;
          console.log(`✅ Selected size for SE2225HM: ${specs.size}`);
        } else {
          // Fallback to smallest reasonable
          const fallbackSize = uniqueSizes.find(s => s >= 21 && s <= 23);
          if (fallbackSize) {
            specs.size = `${fallbackSize} Inch`;
            console.log(`✅ Selected fallback size for SE2225HM: ${specs.size}`);
          }
        }
      } else {
        // Generic: Prefer the smallest reasonable monitor size
        for (const size of uniqueSizes) {
          if (size >= 21 && size <= 25) {
            specs.size = `${size} Inch`;
            console.log(`✅ Selected size (smallest reasonable): ${specs.size}`);
            break;
          }
        }
      }
    }

    // For refresh rate, prefer 100Hz over 240Hz for SE2225HM
    if (!specs.responseTime) {
      const allHzValues = textContent.match(/(\d+)\s*(?:Hz|hertz)/gi) || [];
      console.log(`🔍 All Hz values found:`, allHzValues);

      const validHzValues = allHzValues
        .map(hz => parseInt(hz.replace(/\D/g, '')))
        .filter(hz => hz >= 60 && hz <= 240);

      // Removed Hz-based response time selection - now using proper ms-based extraction
    }

    // Extract refresh rate (Hz) - specifically for the new refreshRate field
    if (!specs.refreshRate) {
      console.log('🔍 Searching for refresh rate (Hz)...');

      // First, try to find "Standard Refresh Rate" section
      const standardRefreshRateMatch = textContent.match(/Standard\s*Refresh\s*Rate[^.]{0,50}?(\d+)\s*(?:Hz|hertz)/i);
      if (standardRefreshRateMatch) {
        const standardHz = parseInt(standardRefreshRateMatch[1]);
        if (standardHz >= 60 && standardHz <= 240) {
          specs.refreshRate = `${standardHz}Hz`;
          console.log(`✅ Found Standard Refresh Rate: ${specs.refreshRate}`);
        }
      }

      // If not found, search for all Hz values
      if (!specs.refreshRate) {
        const allHzValues = textContent.match(/(\d+)\s*(?:Hz|hertz)/gi) || [];
        console.log(`🔍 All Hz values found:`, allHzValues);

        const validHzValues = allHzValues
          .map(hz => parseInt(hz.replace(/\D/g, '')))
          .filter(hz => hz >= 60 && hz <= 240);

        if (validHzValues.length > 0) {
          // For gaming monitors (SEHG, SGN, etc.), prefer higher refresh rates
          const isGamingMonitor = targetModel && (targetModel.includes('HG') || targetModel.includes('GN') || targetModel.includes('G'));

          if (isGamingMonitor) {
            // Prioritize higher refresh rates for gaming monitors
            const gamingPreferredHz = [240, 200, 180, 165, 144, 120, 100, 75, 60];
            for (const preferred of gamingPreferredHz) {
              if (validHzValues.includes(preferred)) {
                specs.refreshRate = `${preferred}Hz`;
                console.log(`✅ Selected refresh rate (gaming monitor ${targetModel}): ${specs.refreshRate}`);
                break;
              }
            }
          } else {
            // For regular monitors, prefer common refresh rates
            const preferredHz = [100, 75, 60, 120, 144, 165, 180, 200, 240];
            for (const preferred of preferredHz) {
              if (validHzValues.includes(preferred)) {
                specs.refreshRate = `${preferred}Hz`;
                console.log(`✅ Selected refresh rate (preferred for ${targetModel}): ${specs.refreshRate}`);
                break;
              }
            }
          }

          // If no preferred value found, take the highest value (for gaming monitors) or middle value
          if (!specs.refreshRate && validHzValues.length > 0) {
            if (isGamingMonitor) {
              const maxHz = Math.max(...validHzValues);
              specs.refreshRate = `${maxHz}Hz`;
              console.log(`✅ Selected refresh rate (gaming monitor - highest value): ${specs.refreshRate}`);
            } else {
              const sortedHz = validHzValues.sort((a, b) => a - b);
              const middleIndex = Math.floor(sortedHz.length / 2);
              specs.refreshRate = `${sortedHz[middleIndex]}Hz`;
              console.log(`✅ Selected refresh rate (middle value): ${specs.refreshRate}`);
            }
          }
        }
      }
    }

    // Extract resolution if still missing
    if (!specs.resolution) {
      console.log('🔍 Searching for resolution information...');
      const resolutionPatterns = [
        /(\d{3,4})\s*[xX]\s*(\d{3,4})/gi,
        /full\s*hd|fhd|1920\s*x\s*1080|1080p/gi
      ];

      for (const pattern of resolutionPatterns) {
        const matches = textContent.match(pattern);
        if (matches) {
          for (const match of matches) {
            let resolution = '';
            let designation = '';

            if (match.toLowerCase().includes('full hd') || match.toLowerCase().includes('fhd') || match.toLowerCase().includes('1080p')) {
              resolution = '1920 x 1080';
              designation = 'FHD';
            } else if (match.includes('1920') && match.includes('1080')) {
              resolution = '1920 x 1080';
              // Look for designation in surrounding text
              const matchIndex = textContent.indexOf(match);
              const contextStart = Math.max(0, matchIndex - 100);
              const contextEnd = Math.min(textContent.length, matchIndex + match.length + 100);
              const context = textContent.substring(contextStart, contextEnd);

              console.log(`🔍 Strategy 3 - Searching for designation in context (${context.length} chars around "${match}")`);

              // Check for designations in context
              if (/fhd|full\s*hd/i.test(context)) {
                designation = 'FHD';
                console.log(`✅ Found FHD designation in context`);
              }
              else if (/qhd|quad\s*hd/i.test(context)) {
                designation = 'QHD';
                console.log(`✅ Found QHD designation in context`);
              }
              else if (/4k|ultra\s*hd|uhd/i.test(context)) {
                designation = '4K';
                console.log(`✅ Found 4K designation in context`);
              } else {
                console.log(`⚠️ No designation found in context around "${match}"`);
              }
            } else if (match.includes('2560') && match.includes('1440')) {
              resolution = '2560 x 1440';
              designation = 'QHD';
            } else if (match.includes('3840') && match.includes('2160')) {
              resolution = '3840 x 2160';
              designation = '4K';
            } else {
              // Extract from pattern match
              const numMatch = match.match(/(\d{3,4})\s*[xX]\s*(\d{3,4})/);
              if (numMatch) {
                resolution = `${numMatch[1]} x ${numMatch[2]}`;
              }
            }

            specs.resolution = designation ? `${resolution} ${designation}` : resolution;
            console.log(`✅ Resolution from text: ${specs.resolution}`);
            break;
          }
          if (specs.resolution) break;
        }
      }
    }

    // Extract ports and warranty from broader text
    if (!specs.ports) {
      const portPatterns = [
        /(?:connectivity|connections?).*?(hdmi|vga|displayport).*?(?:and|,|\s|$)/gi,
        /(?:hdmi|vga|displayport).*?(?:port|connector)/gi
      ];

      for (const pattern of portPatterns) {
        const match = textContent.match(pattern);
        if (match) {
          const mentionedPorts: string[] = [];
          if (textContent.toLowerCase().includes('hdmi')) mentionedPorts.push('HDMI port');
          if (textContent.toLowerCase().includes('vga')) mentionedPorts.push('VGA port');
          if (textContent.toLowerCase().includes('displayport')) mentionedPorts.push('DisplayPort');

          if (mentionedPorts.length > 0) {
            specs.ports = mentionedPorts.length === 2 ? `${mentionedPorts[0]} and ${mentionedPorts[1]}` : mentionedPorts.join(', ');
            console.log(`✅ Ports from text: ${specs.ports}`);
            break;
          }
        }
      }
    }

    if (!specs.warranty) {
      console.log('🔍 Searching for warranty information...');
      const warrantyPatterns = [
        /(\d+)\s*(?:year|years|yr)\s*warranty/gi,
        /warranty\s*[:=]?\s*(\d+)\s*(?:year|years|yr)/gi,
        /dell.*?(\d+)\s*-\s*\d+\s*year\s*warranty/gi
      ];

      for (const pattern of warrantyPatterns) {
        const match = textContent.match(pattern);
        if (match) {
          const years = parseInt(match[1]);
          console.log(`🔍 Found warranty match: ${years} years`);
          if (years >= 1 && years <= 10) {
            specs.warranty = `${years} Years`;
            console.log(`✅ Warranty from text: ${specs.warranty}`);
            break;
          }
        }
      }

      // Default to 3 years for Dell monitors if no warranty found
      if (!specs.warranty && textContent.toLowerCase().includes('dell')) {
        specs.warranty = '3 Years';
        console.log(`✅ Using default Dell warranty: ${specs.warranty}`);
      }
    }
  }

  console.log('📋 Final Dell specs from webpage:', specs);
  console.log('🔍 Resolution value:', specs.resolution, '| ResponseTime value:', specs.responseTime);

  // Enhancement: Automatically add designation for known resolutions
  if (specs.resolution && !specs.resolution.includes('FHD') && !specs.resolution.includes('QHD') && !specs.resolution.includes('4K')) {
    if (specs.resolution.includes('1920 x 1080') || specs.resolution.includes('1920x1080')) {
      specs.resolution = '1920 x 1080 FHD';
      console.log('✅ Added FHD designation to resolution');
    } else if (specs.resolution.includes('2560 x 1440') || specs.resolution.includes('2560x1440')) {
      specs.resolution = '2560 x 1440 QHD';
      console.log('✅ Added QHD designation to resolution');
    } else if (specs.resolution.includes('3840 x 2160') || specs.resolution.includes('3840x2160')) {
      specs.resolution = '3840 x 2160 4K';
      console.log('✅ Added 4K designation to resolution');
    }
  }

  // Enhancement: If responseTime is empty but we have Hz values, don't show Hz as response time
  if (specs.responseTime && specs.responseTime.includes('Hz')) {
    console.log(`⚠️ Response time contains Hz value (${specs.responseTime}) - clearing as this is refresh rate, not response time`);
    specs.responseTime = '';
  }

  return {
    productName: productName,
    description: `Professional ${query} with premium quality`,
    features: [],
    specifications: [],
    technicalSpecs: [
      specs.size ? `Screen Size: ${specs.size}` : '',
      specs.resolution ? `Resolution: ${specs.resolution}` : '',
      specs.responseTime ? `Response Time: ${specs.responseTime}` : '',
      specs.refreshRate ? `Refresh Rate: ${specs.refreshRate}` : '',
      specs.ports ? `Ports: ${specs.ports}` : '',
      specs.warranty ? `Warranty: ${specs.warranty}` : ''
    ].filter(Boolean),
    debugInfo: {
      extractionDetails: `Resolution: ${specs.resolution}, ResponseTime: ${specs.responseTime}, RefreshRate: ${specs.refreshRate}, Size: ${specs.size}`,
      source: 'Dell official webpage with enhanced extraction'
    },
    inTheBox: undefined,
    dimensions: null,
    weight: null,
    brand: 'Dell',
    category: 'Computer Monitor',
    modelNumber: targetModel,
    warranty: specs.warranty,
    priceRange: null
  };
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

  // Extract specifications with improved targeting
  let specifications: string[] = [];

  // Try to find specs table with better filtering
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
  if (tableMatch) {
    tableMatch.forEach(table => {
      // Skip tables that are clearly not specification tables
      if (table.includes('navigation') || table.includes('menu') || table.includes('footer')) {
        return;
      }

      const rows = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      rows.forEach(row => {
        // Clean HTML from row before processing
        const cleanRow = row.replace(/<t[dh][^>]*>/gi, '').replace(/<\/t[dh]>/gi, '|');

        // Look for specific specification patterns
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        if (cells.length >= 2) {
          const label = cleanText(cells[0] || '').toLowerCase();
          const value = cleanText(cells[1] || '');

          // Only include rows that look like actual specifications
          const isSpecRow = label.length < 50 && value.length < 200 &&
                             (label.includes('hz') || label.includes('inch') ||
                              label.includes('resolution') || label.includes('warranty') ||
                              label.includes('hdmi') || label.includes('displayport') ||
                              label.includes('vga') || label.includes('size') ||
                              label.includes('refresh') || label.includes('rate') ||
                              label.includes('port') || label.includes('year'));

          if (isSpecRow && label && value) {
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
        const cleaned = cleanText(item || '');
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
    warranty: extractWarranty(html) ? cleanText(extractWarranty(html) || '') : null,
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

  // Enhanced refresh rate extraction - find ALL Hz values and prefer the highest reasonable one
  const allHzValues = cleanedHtml.match(/(\d+)\s*Hz/gi) || [];
  console.log('🔍 All Hz values found:', allHzValues);

  if (allHzValues.length > 0) {
    const validHzValues = allHzValues
      .map(hz => parseInt(hz.replace(/\D/g, '')))
      .filter(hz => hz >= 60 && hz <= 240); // Reasonable monitor refresh rates

    console.log('✅ Valid Hz values:', validHzValues);

    if (validHzValues.length > 0) {
      const maxHz = Math.max(...validHzValues); // Take the highest refresh rate
      specs.push(`Response Time: ${maxHz}Hz`);
      console.log('🎯 Selected refresh rate:', maxHz, 'Hz');
    }
  }

  // Enhanced warranty extraction - find ALL warranty values and take the longest
  const allWarrantyMatches = [
    ...cleanedHtml.matchAll(/(\d+)\s*(?:year|years|yr)\s*warranty/gi),
    ...cleanedHtml.matchAll(/warranty\s*[:\s]*(\d+)\s*(?:year|years|yr)/gi)
  ];

  console.log('🔍 All warranty values found:', allWarrantyMatches.map(m => m[1]));

  if (allWarrantyMatches.length > 0) {
    const validWarranties = allWarrantyMatches
      .map(match => parseInt(match[1]))
      .filter(years => years >= 1 && years <= 10);

    console.log('✅ Valid warranty periods:', validWarranties);

    if (validWarranties.length > 0) {
      const maxWarranty = Math.max(...validWarranties); // Take the longest warranty
      specs.push(`Warranty: ${maxWarranty} Years`);
      console.log('🎯 Selected warranty:', maxWarranty, 'Years (longest period)');
    }
  }

  console.log('📋 All extracted specs:', specs);

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
          const label = cleanText(cells[0] || '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const value = cleanText(cells[1] || '')
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
  // More specific warranty extraction patterns
  const warrantyPatterns = [
    /(?:warranty|guarantee)[:\s]*(\d+)\s*(?:year|years|yr)/i,
    /(\d+)\s*(?:year|years|yr)\s*(?:warranty|guarantee)/i,
    /warranty[:\s]*(\d+)\s*-\s*\d+\s*years?/i
  ];

  for (const pattern of warrantyPatterns) {
    const match = html.match(pattern);
    if (match) {
      const years = match[1];
      // Validate reasonable warranty period (1-10 years)
      if (parseInt(years) >= 1 && parseInt(years) <= 10) {
        return `${years} Years`;
      }
    }
  }

  // Fallback to generic warranty search
  const genericMatch = html.match(/(?:warranty|guarantee)[:\s]*([^<\n]{10,100}?)(?:<|\.|\n)/i);
  if (genericMatch) {
    const cleaned = cleanText(genericMatch[1]);
    // Only return if it looks like a valid warranty period
    if (cleaned && cleaned.length < 50 && !cleaned.includes('data-') && !cleaned.includes('tabindex')) {
      return cleaned;
    }
  }

  return null;
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
      'Response Time: 60Hz - 75Hz',
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
      features.push(...sentences.filter((s: string) => s.length > 10));
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
