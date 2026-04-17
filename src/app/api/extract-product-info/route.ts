import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  let productName = '';
  let pageContent = '';

  try {
    const body = await request.json();
    productName = body.productName;
    pageContent = body.pageContent || '';

    if (!productName) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Using AI to extract product info from:', productName);
    console.log('🔍 Checking if product name contains SE2225HM:', productName.toUpperCase().includes('SE2225HM'));

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    let prompt = `You are a product specification expert. Extract the following information from this product name: "${productName}"`;

    if (pageContent && pageContent.length > 100) {
      prompt += `\n\nHere is the product webpage content to help you extract accurate specifications:\n${pageContent.substring(0, 5000)}`;
    }

    prompt += `\n\nReturn ONLY a JSON object (no markdown, no code blocks) with these fields:
{
  "model": "extract the model number (e.g., SE2225HM)",
  "briefName": "create a short product name like "DELL SE SERIES LED MONITOR"",
  "size": "extract screen size in inches (e.g., "22 Inch", "23.8 Inch") - look for numbers followed by 'inch' or 'inches' or quotes. NEVER put resolution numbers here.",
  "resolution": "extract display resolution format like '1920 x 1080' or '2560 x 1440' - look for patterns like '1920x1080' or 'Full HD' or 'FHD'. NEVER put inch measurements here.",
  "refreshRate": "extract refresh rate in Hz (e.g., "100Hz", "75Hz") - look for numbers followed by 'Hz' or 'hertz'",
  "ports": "extract connection ports like 'HDMI port and VGA port' or 'DisplayPort' - look for 'HDMI', 'VGA', 'DisplayPort', 'DVI' connections",
  "warranty": "extract warranty period like '3 Years' or '1 Year' - look for warranty information with years"
}

CRITICAL FIELD DISTINCTIONS:
- Size = inch measurements (22, 23.8, 27, etc.)
- Resolution = pixel format (1920 x 1080, 2560 x 1440, etc.)
- Refresh Rate = Hz values (60Hz, 75Hz, 100Hz, etc.)

IMPORTANT: Return empty string "", NOT "empty", if information is not found.`;

    console.log('🤖 Calling Gemini API...');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ AI Response received:', text);

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
        // AI put size in resolution field, swap them
        const temp = productInfo.size;
        productInfo.size = productInfo.resolution;
        productInfo.resolution = temp || '';
      }

      console.log('✅ Parsed product info:', productInfo);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.log('Response text:', cleanedText.substring(0, 500));

      // Fallback to basic extraction
      const modelMatch = productName.match(/([A-Z0-9]{4,})/i);
      productInfo = {
        model: modelMatch ? modelMatch[1] : '',
        briefName: productName.split('-')[0].trim(),
        size: '',
        resolution: '',
        refreshRate: '',
        ports: '',
        warranty: ''
      };
    }

    return NextResponse.json({
      success: true,
      productInfo
    });

  } catch (error) {
    console.error('❌ AI extraction failed:', error);

    // Fallback to basic extraction
    const modelMatch = productName.match(/([A-Z0-9]{4,})/i);
    const productInfo = {
      model: modelMatch ? modelMatch[1] : '',
      briefName: productName.split('-')[0].trim(),
      size: '',
      resolution: '',
      refreshRate: '',
      ports: '',
      warranty: ''
    };

    return NextResponse.json({
      success: true,
      productInfo
    });
  }
}
