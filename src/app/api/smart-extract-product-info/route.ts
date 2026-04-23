import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Smart Product Information Extraction
 * Automatically searches for official product websites and extracts accurate specifications
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Search for official product website using SerpAPI
 */
async function searchOfficialWebsite(productName: string): Promise<string | null> {
  if (!SERPAPI_KEY) {
    console.error('❌ SERPAPI_KEY not found in environment variables');
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
    console.log('✅ SerpAPI search successful, found', data.organic_results?.length || 0, 'results');

    // Find the most relevant official website
    const organicResults = data.organic_results || [];

    // Prioritize results from official domains
    const officialDomains = ['dell.com', 'hp.com', 'lenovo.com', 'asus.com', 'acer.com', 'samsung.com', 'lg.com', 'msi.com'];

    for (const result of organicResults) {
      const link = result.link;

      // Check if this is an official manufacturer website
      for (const domain of officialDomains) {
        if (link.includes(domain)) {
          console.log('✅ Found official website:', link);
          return link;
        }
      }
    }

    // Fallback: return the first result
    if (organicResults.length > 0) {
      console.log('⚠️ No official domain found, using first result:', organicResults[0].link);
      return organicResults[0].link;
    }

    console.log('❌ No search results found');
    return null;

  } catch (error) {
    console.error('❌ SerpAPI search failed:', error);
    return null;
  }
}

/**
 * Fetch and extract text content from a URL with improved scraping
 */
async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    console.log('🌐 Fetching content from:', url);

    // Try multiple CORS proxy services for better reliability
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    let html = '';
    let success = false;

    for (const proxyUrl of proxies) {
      try {
        const response = await fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          html = await response.text();
          success = true;
          console.log('✅ Website content fetched via proxy, length:', html.length);
          break;
        }
      } catch (proxyError) {
        console.log('⚠️ Proxy failed, trying next...');
        continue;
      }
    }

    if (!success) {
      throw new Error('All proxy attempts failed');
    }

    // Extract text content from HTML - improved extraction
    let text = html
      // Remove scripts, styles, and other non-content elements
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<nav[^>]*>.*?<\/nav>/gs, '')
      .replace(/<footer[^>]*>.*?<\/footer>/gs, '')
      .replace(/<header[^>]*>.*?<\/header>/gs, '')
      // Focus on product specs sections
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Look for keywords that indicate specifications sections
    const specKeywords = [
      'specification', 'specs', 'technical', 'features',
      'resolution', 'refresh rate', 'response time', 'hertz',
      'display', 'panel', 'screen', 'warranty', 'ports', 'connectivity'
    ];

    // Extract sections around these keywords
    let relevantText = '';
    for (const keyword of specKeywords) {
      const keywordIndex = text.toLowerCase().indexOf(keyword);
      if (keywordIndex !== -1) {
        // Extract 500 characters around the keyword
        const start = Math.max(0, keywordIndex - 100);
        const end = Math.min(text.length, keywordIndex + 400);
        relevantText += text.substring(start, end) + ' ';
      }
    }

    // If we found relevant sections, use those; otherwise use full text
    const finalText = relevantText.trim() || text;

    // Limit content length
    const maxLength = 15000; // Increased limit for better extraction
    if (finalText.length > maxLength) {
      const truncated = finalText.substring(0, maxLength);
      console.log('⚠️ Content truncated to', maxLength, 'characters');
      return truncated;
    }

    console.log('✅ Extracted text content, length:', finalText.length);
    return finalText;

  } catch (error) {
    console.error('❌ Website fetch failed:', error);
    return '';
  }
}

/**
 * Extract product information using AI
 */
async function extractProductInfo(productName: string, pageContent: string): Promise<any> {
  try {
    console.log('🤖 Using AI to extract product info');

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    let prompt = `You are a product specification expert. Extract the following information from this product name: "${productName}"`;

    if (pageContent && pageContent.length > 100) {
      prompt += `\n\nHere is the official product webpage content to help you extract accurate specifications:\n${pageContent}`;
    }

    prompt += `\n\nReturn ONLY a JSON object (no markdown, no code blocks) with these fields:
{
  "model": "extract the model number (e.g., SE2225HM)",
  "briefName": "create a short product name like "DELL SE SERIES LED MONITOR"",
  "size": "extract screen size in inches (e.g., "22 Inch", "23.8 Inch") - look for numbers followed by 'inch' or 'inches' or quotes. NEVER put resolution numbers here.",
  "resolution": "extract display resolution format like '1920 x 1080' - look for patterns like '1920x1080'. If you find 'Full HD' or 'FHD' in the content, add 'FHD' at the end like '1920 x 1080 FHD'. NEVER put inch measurements here.",
  "refreshRate": "extract refresh rate in Hz (e.g., "100Hz", "75Hz", "120Hz") - look for numbers followed by 'Hz' or 'hertz'. Be careful to find the CORRECT refresh rate, not just any Hz value.",
  "responseTime": "extract response time in milliseconds (e.g., "1ms", "4ms", "5ms") - look for 'ms' or 'millisecond' or 'response time'",
  "ports": "extract connection ports like 'HDMI port and VGA port' or 'DisplayPort' - look for 'HDMI', 'VGA', 'DisplayPort', 'DVI' connections",
  "warranty": "extract warranty period like '3 Years' or '1 Year' - look for warranty information with years"
}

CRITICAL FIELD DISTINCTIONS:
- Size = inch measurements (22, 23.8, 27, etc.)
- Resolution = pixel format (1920 x 1080, 2560 x 1440, etc.) - add "FHD" if Full HD mentioned
- Refresh Rate = Hz values (60Hz, 75Hz, 100Hz, 120Hz, etc.) - find the DISPLAY refresh rate specifically
- Response Time = ms values (1ms, 4ms, 5ms, etc.)

IMPORTANT: Return empty string "", NOT "empty", if information is not found.`;

    console.log('🤖 Calling Gemini AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ AI Response received');

    // Clean and parse JSON
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    let productInfo: any;
    try {
      productInfo = JSON.parse(cleanedText);

      // Clean up any "empty" strings
      Object.keys(productInfo).forEach(key => {
        if (productInfo[key] === 'empty' || productInfo[key] === 'Empty') {
          productInfo[key] = '';
        }
      });

      // Fix common AI mistakes
      if (productInfo.resolution && productInfo.resolution.includes('inch')) {
        const temp = productInfo.size;
        productInfo.size = productInfo.resolution;
        productInfo.resolution = temp || '';
      }

      console.log('✅ Parsed product info:', productInfo);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);

      // Fallback to basic extraction
      const modelMatch = productName.match(/([A-Z0-9]{4,})/i);
      productInfo = {
        model: modelMatch ? modelMatch[1] : '',
        briefName: productName.split('-')[0].trim(),
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

    // Fallback to basic extraction
    const modelMatch = productName.match(/([A-Z0-9]{4,})/i);
    return {
      model: modelMatch ? modelMatch[1] : '',
      briefName: productName.split('-')[0].trim(),
      size: '',
      resolution: '',
      refreshRate: '',
      responseTime: '',
      ports: '',
      warranty: ''
    };
  }
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

    console.log('🚀 Starting smart product extraction for:', productName);

    // Step 1: Search for official website
    const officialUrl = await searchOfficialWebsite(productName);

    let pageContent = '';
    let source = 'basic extraction';

    if (officialUrl) {
      // Step 2: Fetch website content
      pageContent = await fetchWebsiteContent(officialUrl);
      source = `official website: ${officialUrl}`;
    }

    // Step 3: Extract product info using AI
    const productInfo = await extractProductInfo(productName, pageContent);

    return NextResponse.json({
      success: true,
      source: source,
      officialUrl: officialUrl,
      productInfo
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
