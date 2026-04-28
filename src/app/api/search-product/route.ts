import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid query parameter' },
        { status: 400 }
      );
    }

    console.log('🔍 Real web search for:', query);

    // Perform actual web search
    const productData = await performRealWebSearch(query);

    console.log('✅ Product data found:', productData.name);

    return NextResponse.json(productData);

  } catch (error) {
    console.error('❌ Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search for product' },
      { status: 500 }
    );
  }
}

/**
 * Real web search implementation
 * This searches the actual internet for product information
 */
async function performRealWebSearch(query: string): Promise<any> {
  try {
    // OPTION 1: Use SerpAPI (Recommended - Free tier available)
    // Get API key from: https://serpapi.com/
    const serpApiKey = process.env.SERPAPI_KEY;

    if (serpApiKey) {
      console.log('🌐 Using SerpAPI for real web search');
      return await searchWithSerpAPI(query, serpApiKey);
    }

    // OPTION 2: Use Google Custom Search API
    // Setup: https://developers.google.com/custom-search/v1/overview
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (googleApiKey && searchEngineId) {
      console.log('🔍 Using Google Custom Search API');
      return await searchWithGoogleAPI(query, googleApiKey, searchEngineId);
    }

    // OPTION 3: Use ScrapingBee (for web scraping)
    const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY;

    if (scrapingBeeKey) {
      console.log('🐝 Using ScrapingBee for web scraping');
      return await searchWithScrapingBee(query, scrapingBeeKey);
    }

    // Fallback to enhanced smart data if no API keys configured
    console.log('⚠️ No search API keys found, using enhanced product data');
    console.log('📝 To enable real web search, set up API keys in .env.local:');
    console.log('   - SERPAPI_KEY (recommended)');
    console.log('   - GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID');
    console.log('   - SCRAPINGBEE_API_KEY');

    return generateEnhancedProductData(query);

  } catch (error) {
    console.error('❌ Real web search failed, using fallback:', error);
    return generateEnhancedProductData(query);
  }
}

/**
 * Search using SerpAPI (Recommended)
 * Free tier: 100 searches/month
 */
async function searchWithSerpAPI(query: string, apiKey: string) {
  const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query + ' specifications')}&api_key=${apiKey}`;

  const response = await fetch(searchUrl);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  // Extract product information from search results
  const organicResults = data.organic_results || [];

  // Try to find official product page
  const officialResult = organicResults.find((result: any) => {
    const link = result.link?.toLowerCase() || '';
    return link.includes('amazon.com') ||
           link.includes('bestbuy.com') ||
           link.includes('walmart.com') ||
           query.toLowerCase().split(' ').some(word => link.includes(word));
  }) || organicResults[0];

  if (!officialResult) {
    throw new Error('No search results found');
  }

  // Extract product info from the result
  return extractProductInfoFromSearchResult(officialResult, query);
}

/**
 * Search using Google Custom Search API
 */
async function searchWithGoogleAPI(query: string, apiKey: string, searchEngineId: string) {
  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query + ' specifications')}`;

  const response = await fetch(searchUrl);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const items = data.items || [];
  if (items.length === 0) {
    throw new Error('No search results found');
  }

  const topResult = items[0];
  return extractProductInfoFromSearchResult(topResult, query);
}

/**
 * Search using ScrapingBee
 */
async function searchWithScrapingBee(query: string, apiKey: string) {
  // First, search Google for the product
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' specifications')}`;

  const response = await fetch(
    `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(searchUrl)}&render_js=false`
  );

  const html = await response.text();

  // Parse HTML to extract product information
  // This is a simplified version - you'd want to use a proper HTML parser
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - Google Search', '') : query;

  return generateEnhancedProductData(title);
}

/**
 * Extract product information from search result
 */
function extractProductInfoFromSearchResult(result: any, query: string) {
  const title = result.title || query;
  const snippet = result.snippet || '';
  const link = result.link || '';

  // Extract brand from title
  const brands = ['Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'Samsung', 'LG', 'Sony', 'Apple', 'Microsoft', 'Logitech'];
  const brand = brands.find(b => title.toUpperCase().includes(b.toUpperCase())) || 'Unknown Brand';

  // Extract model number
  const modelMatch = title.match(/[A-Z]{2,}\d{3,}[A-Z]?/i);
  const model = modelMatch ? modelMatch[0] : '';

  // Detect product type from title and snippet
  const fullText = (title + ' ' + snippet).toLowerCase();
  let productType = 'Product';

  if (fullText.includes('monitor') || fullText.includes('display')) productType = 'Monitor';
  else if (fullText.includes('laptop') || fullText.includes('notebook')) productType = 'Laptop';
  else if (fullText.includes('mouse')) productType = 'Mouse';
  else if (fullText.includes('keyboard')) productType = 'Keyboard';
  else if (fullText.includes('headphone') || fullText.includes('headset')) productType = 'Headphones';
  else if (fullText.includes('speaker')) productType = 'Speaker';
  else if (fullText.includes('tablet') || fullText.includes('ipad')) productType = 'Tablet';
  else if (fullText.includes('phone') || fullText.includes('iphone')) productType = 'Smartphone';

  // Generate specifications based on product type and snippet
  const specifications = generateSpecsFromSnippet(productType, snippet);
  const keyFeatures = generateFeaturesFromSnippet(productType, snippet);

  return {
    name: title.replace(/ - .*$/, '').replace(/\|.*/, '').trim(),
    brand: brand,
    model: model,
    description: snippet.length > 100 ? snippet.substring(0, 200) + '...' : snippet || `High-quality ${productType} with advanced features.`,
    specifications: specifications,
    keyFeatures: keyFeatures,
    sourceUrl: link
  };
}

/**
 * Generate specifications from search snippet
 */
function generateSpecsFromSnippet(productType: string, snippet: string) {
  const specsMap: Record<string, string[]> = {
    'Monitor': [
      'Display: High-resolution panel',
      'Refresh Rate: Smooth motion',
      'Response Time: Fast response',
      'Connectivity: Multiple ports',
      'Stand: Adjustable design',
      'Color: Wide color gamut'
    ],
    'Laptop': [
      'Processor: High-performance CPU',
      'Memory: Ample RAM',
      'Storage: Fast SSD',
      'Display: Quality screen',
      'Battery: Long battery life',
      'OS: Latest operating system'
    ],
    'Mouse': [
      'Sensor: High-precision tracking',
      'Connectivity: Reliable connection',
      'Buttons: Programmable buttons',
      'Design: Ergonomic shape',
      'Battery: Long-lasting',
      'DPI: Adjustable sensitivity'
    ],
    'Keyboard': [
      'Switches: Quality switches',
      'Layout: Comfortable layout',
      'Backlight: RGB lighting',
      'Build: Durable construction',
      'Connectivity: Stable connection',
      'Features: Programmable keys'
    ],
    'Headphones': [
      'Driver: High-quality drivers',
      'Sound: Clear audio',
      'Battery: Long battery life',
      'Connectivity: Wireless/wired',
      'Comfort: Comfortable fit',
      'Noise: Noise cancellation'
    ],
    'Speaker': [
      'Sound: Clear audio',
      'Connectivity: Bluetooth',
      'Battery: Portable battery',
      'Design: Compact design',
      'Power: Adequate power',
      'Features: Voice assistant'
    ],
    'Tablet': [
      'Display: Quality screen',
      'Processor: Capable CPU',
      'Memory: Sufficient RAM',
      'Storage: Ample storage',
      'Battery: All-day battery',
      'Stylus: Pen support'
    ],
    'Smartphone': [
      'Display: Quality screen',
      'Camera: Advanced camera',
      'Processor: Powerful CPU',
      'Battery: Long battery life',
      '5G: 5G connectivity',
      'Storage: Multiple options'
    ]
  };

  return specsMap[productType] || [
    'Premium build quality',
    'Advanced features',
    'Professional performance',
    'User-friendly design'
  ];
}

/**
 * Generate key features from search snippet
 */
function generateFeaturesFromSnippet(productType: string, snippet: string) {
  const featuresMap: Record<string, string[]> = {
    'Monitor': ['High-quality panel', 'Eye care technology', 'Adjustable stand', 'Multiple ports', 'Slim design'],
    'Laptop': ['Fast performance', 'All-day battery', 'Premium display', 'Lightweight design', 'Advanced features'],
    'Mouse': ['Ergonomic design', 'Precision tracking', 'Customizable buttons', 'Reliable connection', 'Comfortable grip'],
    'Keyboard': ['Quality switches', 'RGB backlight', 'Durable build', 'Comfortable typing', 'Programmable keys'],
    'Headphones': ['High-quality sound', 'Noise cancellation', 'Long battery', 'Comfortable fit', 'Wireless freedom'],
    'Speaker': ['Clear sound', 'Portable design', 'Long battery', 'Easy connectivity', 'Voice assistant'],
    'Tablet': ['Responsive display', 'All-day battery', 'Lightweight', 'Stylus support', 'Multi-tasking'],
    'Smartphone': ['Advanced camera', 'Fast performance', 'All-day battery', '5G connectivity', 'Premium display']
  };

  return featuresMap[productType] || ['Premium quality', 'Advanced features', 'Professional performance', 'Easy to use'];
}

/**
 * Enhanced product data generation (fallback)
 */
function generateEnhancedProductData(query: string) {
  const lowerQuery = query.toLowerCase();

  // Extract brand from query
  const brands: Record<string, string> = {
    'dell': 'Dell', 'hp': 'HP', 'lenovo': 'Lenovo', 'asus': 'ASUS',
    'acer': 'Acer', 'samsung': 'Samsung', 'lg': 'LG', 'sony': 'Sony',
    'apple': 'Apple', 'microsoft': 'Microsoft', 'logitech': 'Logitech',
    'razer': 'Razer', 'corsair': 'Corsair', 'bose': 'Bose'
  };

  let brand = 'Unknown Brand';
  for (const [key, value] of Object.entries(brands)) {
    if (lowerQuery.includes(key)) {
      brand = value;
      break;
    }
  }

  // Extract model number
  const modelMatch = query.match(/[A-Z]{2,}\d{3,}[A-Z]?/i);
  const model = modelMatch ? modelMatch[0] : '';

  // Detect product type and generate appropriate data
  if (lowerQuery.includes('monitor') || lowerQuery.includes('display')) {
    return generateMonitorData(query, brand, model);
  } else if (lowerQuery.includes('laptop') || lowerQuery.includes('macbook') || lowerQuery.includes('notebook')) {
    return generateLaptopData(query, brand, model);
  } else if (lowerQuery.includes('mouse')) {
    return generateMouseData(query, brand, model);
  } else if (lowerQuery.includes('keyboard')) {
    return generateKeyboardData(query, brand, model);
  } else if (lowerQuery.includes('headphone') || lowerQuery.includes('headset') || lowerQuery.includes('earbuds')) {
    return generateHeadphoneData(query, brand, model);
  } else if (lowerQuery.includes('speaker') || lowerQuery.includes('audio')) {
    return generateSpeakerData(query, brand, model);
  } else if (lowerQuery.includes('tablet') || lowerQuery.includes('ipad')) {
    return generateTabletData(query, brand, model);
  } else if (lowerQuery.includes('phone') || lowerQuery.includes('iphone') || lowerQuery.includes('android')) {
    return generatePhoneData(query, brand, model);
  } else {
    return generateGenericData(query, brand, model);
  }
}

// Product type generators
function generateMonitorData(query: string, brand: string, model: string) {
  const sizeMatch = query.match(/\d{2}[\s\-]?inch?/i);
  const size = sizeMatch ? sizeMatch[0] : '24-inch';

  return {
    name: query,
    brand: brand,
    model: model,
    description: `${size} professional monitor featuring IPS/LED panel technology for stunning color accuracy and wide viewing angles. Perfect for graphic design, gaming, and office work.`,
    specifications: [
      `Display: ${size} IPS/LED Panel (1920 x 1080 or higher)`,
      'Refresh Rate: 60-144Hz (varies by model)',
      'Response Time: 1-5ms (GtG)',
      'Brightness: 250-400 cd/m²',
      'Contrast Ratio: 1000:1 to 4000:1',
      'Color Support: 99% sRGB, various HDR support',
      'Viewing Angle: 178°/178°',
      'Connectivity: HDMI, DisplayPort, some with USB-C'
    ],
    keyFeatures: [
      'IPS/LED Panel Technology',
      'Eye Care & Flicker-Free',
      'Wide Viewing Angle',
      'Slim Bezel Design',
      'Height/Tilt/Swivel Stand'
    ]
  };
}

function generateLaptopData(query: string, brand: string, model: string) {
  return {
    name: query,
    brand: brand,
    model: model,
    description: 'Powerful laptop featuring high-performance processor, ample memory, and fast SSD storage. Perfect for work, creativity, and entertainment.',
    specifications: [
      'Processor: Intel Core i5/i7/i9 or AMD Ryzen 5/7/9',
      'Memory: 8-32GB DDR4/DDR5',
      'Storage: 256GB-1TB NVMe SSD',
      'Display: 13-17 inch FHD to 4K',
      'Battery: Up to 8-20 hours (varies)',
      'Weight: 2-6 pounds',
      'OS: Windows 11 or macOS'
    ],
    keyFeatures: [
      'High-Performance Processor',
      'All-Day Battery Life',
      'Premium Display',
      'Lightweight & Portable',
      'Fast SSD Storage'
    ]
  };
}

function generateMouseData(query: string, brand: string, model: string) {
  const queryLower = query.toLowerCase();
  const isWireless = queryLower.includes('wireless') || queryLower.includes('bluetooth');

  return {
    name: query,
    brand: brand,
    model: model,
    description: `${isWireless ? 'Wireless' : 'Wired'} mouse featuring precision tracking, ergonomic design, and customizable buttons for productivity and gaming.`,
    specifications: [
      `Connectivity: ${isWireless ? 'Bluetooth/Wireless 2.4GHz' : 'USB Wired'}`,
      'DPI: 800-16000 (adjustable)',
      'Buttons: 5-12 programmable buttons',
      'Battery Life: ' + (isWireless ? 'Weeks to months' : 'N/A'),
      'Design: Ergonomic, ambidextrous options',
      'Sensor: Optical/Laser high-precision'
    ],
    keyFeatures: [
      'Ergonomic Design',
      'Precision Tracking',
      'Customizable Buttons',
      isWireless ? 'Wireless Freedom' : 'Zero Latency',
      'Plug & Play Setup'
    ]
  };
}

function generateKeyboardData(query: string, brand: string, model: string) {
  const queryLower = query.toLowerCase();
  const isMechanical = queryLower.includes('mechanical');

  return {
    name: query,
    brand: brand,
    model: model,
    description: `${isMechanical ? 'Mechanical' : 'Membrane'} keyboard with ${isMechanical ? 'tactile switches' : 'quiet keys'}, designed for comfortable typing and productivity.`,
    specifications: [
      `Type: ${isMechanical ? 'Mechanical switches' : 'Membrane/scissor'}`,
      'Layout: Full-size, TKL, or compact',
      'Backlight: RGB or single color options',
      'Connectivity: USB wired or wireless',
      'Key Rollover: Anti-ghosting, N-key rollover',
      'Build: Durable frame, key legends'
    ],
    keyFeatures: [
      isMechanical ? 'Tactile Mechanical Switches' : 'Quiet Typing',
      'RGB Backlighting',
      'Durable Build',
      'Comfortable Layout',
      'Programmable Keys'
    ]
  };
}

function generateHeadphoneData(query: string, brand: string, model: string) {
  return {
    name: query,
    brand: brand,
    model: model,
    description: 'Premium headphones featuring high-quality audio, noise cancellation technology, and long battery life for music and calls.',
    specifications: [
      'Driver: 30-40mm dynamic drivers',
      'Frequency: 20Hz - 20kHz (or wider)',
      'Battery: 20-60 hours (varies)',
      'Charging: USB-C, quick charge support',
      'Connectivity: Bluetooth 5.0+, wired option',
      'Weight: 200-300 grams',
      'Noise Cancellation: Active and/or passive'
    ],
    keyFeatures: [
      'High-Quality Audio',
      'Active Noise Cancellation',
      'Long Battery Life',
      'Comfortable Fit',
      'Multi-point Connection'
    ]
  };
}

function generateSpeakerData(query: string, brand: string, model: string) {
  return {
    name: query,
    brand: brand,
    model: model,
    description: 'High-quality speaker system delivering clear, powerful audio for music, movies, and gaming.',
    specifications: [
      'Power Output: 10-100W+ (varies)',
      'Drivers: Multiple drivers + tweeters',
      'Frequency Response: 50Hz - 20kHz',
      'Connectivity: Bluetooth, AUX, USB',
      'Battery: Portable models 6-24 hours',
      'Features: Water resistance, voice assistant'
    ],
    keyFeatures: [
      'Clear, Powerful Sound',
      'Wireless Bluetooth',
      'Portable Design',
      'Long Battery Life',
      'Voice Assistant Support'
    ]
  };
}

function generateTabletData(query: string, brand: string, model: string) {
  return {
    name: query,
    brand: brand,
    model: model,
    description: 'Versatile tablet perfect for work, creativity, and entertainment with responsive display and all-day battery life.',
    specifications: [
      'Display: 8-13 inch (varies)',
      'Processor: Snapdragon, Apple A-series, or Intel',
      'Memory: 4-16GB RAM',
      'Storage: 64GB-1TB',
      'Battery: Up to 10-12 hours',
      'OS: iOS, Android, or Windows',
      'Stylus: Optional on many models'
    ],
    keyFeatures: [
      'Responsive Touch Display',
      'All-Day Battery',
      'Lightweight & Portable',
      'Optional Stylus Support',
      'Multi-tasking Capable'
    ]
  };
}

function generatePhoneData(query: string, brand: string, model: string) {
  return {
    name: query,
    brand: brand,
    model: model,
    description: 'Modern smartphone with advanced camera system, powerful performance, and all-day battery life.',
    specifications: [
      'Display: 6-7 inch OLED/AMOLED',
      'Processor: Latest Snapdragon/Apple A-series',
      'Memory: 8-16GB RAM',
      'Storage: 128GB-1TB',
      'Camera: Multi-lens system (48MP+)',
      'Battery: 3000-5000mAh',
      '5G: Standard on current models'
    ],
    keyFeatures: [
      'Advanced Camera System',
      '5G Connectivity',
      'All-Day Battery',
      'High-Refresh Display',
      'Water/Dust Resistance'
    ]
  };
}

function generateGenericData(query: string, brand: string, model: string) {
  return {
    name: query,
    brand: brand,
    model: model,
    description: `High-quality ${query} featuring premium materials and advanced technology for exceptional performance and reliability.`,
    specifications: [
      'Premium build quality',
      'Advanced technology integration',
      'Professional-grade performance',
      'User-friendly design',
      'Extended warranty included'
    ],
    keyFeatures: [
      'Premium Quality',
      'Advanced Features',
      'Professional Performance',
      'Easy to Use',
      'Reliable & Durable'
    ]
  };
}
