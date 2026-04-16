import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function generateTableFormat(description: string, productName: string, brand: string, category: string, keyFeatures: string[], targetAudience: string, priceRange: string): string {
  // Extract key information for the table
  const features = keyFeatures && keyFeatures.length > 0 ? keyFeatures : ['High quality', 'Durable', 'Easy to use'];

  return `
<table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Product</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${productName}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Brand</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${brand || 'Generic'}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Category</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${category || 'General'}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Price Range</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${priceRange || 'Affordable'}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Key Features</td>
    <td style="border: 1px solid #ddd; padding: 12px;">
      <ul style="margin: 0; padding-left: 20px;">
        ${features.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Target Audience</td>
    <td style="border: 1px solid #ddd; padding: 12px;">${targetAudience || 'General users'}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">What's Included</td>
    <td style="border: 1px solid #ddd; padding: 12px;">
      <ul style="margin: 0; padding-left: 20px;">
        <li>1x ${productName}</li>
        <li>User Manual</li>
        <li>Warranty Card</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Warranty</td>
    <td style="border: 1px solid #ddd; padding: 12px;">Available</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">Shipping</td>
    <td style="border: 1px solid #ddd; padding: 12px;">Ready Stock - Fast Shipping</td>
  </tr>
</table>
  `.trim();
}

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured');
      return NextResponse.json(
        {
          error: 'API configuration error',
          details: 'GEMINI_API_KEY is not set in environment variables. Please add it to your .env.local file.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      productImage,
      productName,
      brand,
      category,
      keyFeatures,
      targetAudience,
      priceRange,
      uniqueSellingPoint
    } = body;

    if (!productName) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    console.log('🛒 Generating Shopee SEO content for:', productName);
    console.log('📋 Request data:', { productName, brand, category, keyFeatures: keyFeatures?.length });

    console.log('📋 Initializing Gemini model...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('✅ Model initialized');

    const prompt = `Act as a Shopee marketplace SEO specialist and high-conversion e-commerce copywriter.

Your task is to create a Shopee product listing that ranks well in Shopee search results and converts visitors into buyers.

PRODUCT INFORMATION:
Product Name: ${productName}
Brand: ${brand || 'Not specified'}
Category: ${category || 'Not specified'}
Key Features:
${keyFeatures && keyFeatures.length > 0 ? keyFeatures.map((f: string, i: number) => `${i + 1}. ${f}`).join('\n') : 'Not specified'}

Target Audience: ${targetAudience || 'General shoppers'}
Price Range: ${priceRange || 'Not specified'}
Unique Selling Point: ${uniqueSellingPoint || 'Not specified'}

Generate the following sections in JSON format:

1. keywordResearch: {
   highIntentKeywords: [10 high-intent Shopee search keywords],
   longTailKeywords: [10 long-tail keywords buyers might type],
   hashtags: [5 hashtags relevant for Shopee search]
}

2. productTitle: A single string (max 120 characters) - Main keyword at beginning, include high-volume keywords, structured for readability

3. productDescription: A comprehensive description including:
   - Opening hook (short, catchy first line under 100 characters)
   - Key Benefits Section (plain text, no emojis, no asterisks)
   - Feature Breakdown (plain text, no emojis)
   - Use Cases (plain text, no emojis)
   - Why Customers Choose This Product (plain text, no emojis)
   - Specifications (plain text, no emojis)
   - What's Included (plain text, no emojis)

   IMPORTANT: NO emojis, NO asterisks. Clean plain text with simple bullets if needed.

4. productDescriptionTable: Same content but formatted as HTML table with these columns:
   - Feature/Section | Details
   - Include all sections from productDescription
   - Use HTML table format: <table>, <tr>, <th>, <td>
   - Clean formatting, no emojis

5. imageTextSuggestions: [5 Shopee product image captions designed to increase click-through rate]

6. searchTags: Comma-separated search tags for Shopee

7. conversionBoosters: {
   promotionalAngle: "Compelling promotional angle",
   bundleIdeas: [3-5 bundle product ideas],
   voucherStrategy: "Strategy for vouchers and discounts",
   reviewStrategy: "Strategy for generating reviews"
}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations, no code blocks. Just the raw JSON object.`;

    console.log('📝 Prompt created, length:', prompt.length);
    console.log('🤖 Calling Gemini API...');

    let result;
    try {
      console.log('⏳ Starting API call...');

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API request timeout after 60 seconds')), 60000)
      );

      result = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise
      ]) as any;

      console.log('✅ API call completed');
    } catch (apiError) {
      console.error('❌ Gemini API call failed:', apiError);
      throw new Error(`Gemini API error: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`);
    }
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini API response received, length:', text.length);

    // Clean the response to extract JSON
    let cleanedText = text.trim();

    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Parse the JSON
    let seoContent;
    try {
      seoContent = JSON.parse(cleanedText);
      console.log('✅ SEO content parsed successfully');

      // Clean up asterisks and emojis in product description
      if (seoContent.productDescription) {
        // Remove emojis
        seoContent.productDescription = seoContent.productDescription
          .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // Remove emoticons
          .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')  // Remove symbols & pictographs
          .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // Remove transport & map symbols
          .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // Remove flags
          .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Remove misc symbols
          .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Remove dingbats
          .replace(/[^\x00-\x7F]/gu, '')          // Remove all non-ASCII characters (emojis, special chars)
          // Clean up asterisks and extra whitespace
          .replace(/^\*\s+/gm, '')  // Remove "* " at start of lines
          .replace(/\n\*\s+/g, '\n')  // Remove newline + "* "
          .replace(/^\s*\*\s*/gm, '')  // Remove remaining asterisks
          .replace(/\n\s*\*\s*/g, '\n')  // Remove newline asterisks
          // Clean up multiple spaces
          .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
          .trim();

        console.log('🧹 Cleaned emojis and asterisks from product description');
      }

      // Generate table format if not provided
      if (!seoContent.productDescriptionTable && seoContent.productDescription) {
        try {
          seoContent.productDescriptionTable = generateTableFormat(seoContent.productDescription, productName, brand, category, keyFeatures, targetAudience, priceRange);
          console.log('📊 Generated table format description');
        } catch (tableError) {
          console.error('❌ Table format generation failed:', tableError);
          // Fallback to simple table if generation fails
          seoContent.productDescriptionTable = `<table style="border-collapse: collapse; width: 100%;"><tr><td style="border: 1px solid #ddd; padding: 12px;"><strong>Product:</strong></td><td style="border: 1px solid #ddd; padding: 12px;">${productName}</td></tr></table>`;
        }
      }
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.log('Response text (first 500 chars):', cleanedText.substring(0, 500));

      // Fallback: Create basic content if parsing fails
      seoContent = {
        keywordResearch: {
          highIntentKeywords: [
            productName,
            `${productName} ${brand || ''}`.trim(),
            `${category || ''} ${productName}`.trim(),
            `buy ${productName}`,
            `${productName} online`,
            `cheap ${productName}`,
            `best ${productName}`,
            `${productName} sale`,
            `${productName} ${priceRange || ''}`.trim(),
            `original ${productName}`
          ],
          longTailKeywords: [
            `where to buy ${productName} online`,
            `${productName} for ${targetAudience || 'home'}`,
            `best price ${productName} in Malaysia`,
            `${productName} free shipping`,
            `${productName} review and rating`,
            `how to choose ${productName}`,
            `${productName} vs competitors`,
            `${productName} warranty info`,
            `${productName} installation guide`,
            `${productName} promotion today`
          ],
          hashtags: [
            productName.toLowerCase().replace(/\s+/g, ''),
            brand?.toLowerCase().replace(/\s+/g, '') || 'shopee',
            category?.toLowerCase().replace(/\s+/g, '').replace(/[\/,]/g, '') || 'online',
            'malaysiadeal',
            'shopeesale'
          ]
        },
        productTitle: `${brand ? brand + ' ' : ''}${productName} - ${category || 'Premium Quality'} ${priceRange ? '| ' + priceRange : ''} | Ready Stock | Fast Shipping`,
        productDescription: `${productName} - Premium Quality at Best Price!

WHY CHOOSE THIS PRODUCT?

${uniqueSellingPoint || `This ${productName} offers exceptional quality and value for money.`}

KEY FEATURES:
${keyFeatures && keyFeatures.length > 0 ? keyFeatures.map((f: string, i: number) => `${i + 1}. ${f}`).join('\n') : '- High quality materials\n- Durable and long-lasting\n- Easy to use\n- Great value for money'}

PERFECT FOR:
${targetAudience || 'Home users, office workers, and anyone looking for quality products'}

SPECIFICATIONS:
- Brand: ${brand || 'Trusted Brand'}
- Category: ${category || 'General'}
- ${priceRange ? `Price: ${priceRange}` : 'Affordable Pricing'}
- Warranty: Available

WHAT'S INCLUDED:
- 1x ${productName}
- User Manual
- Warranty Card

BENEFITS:
- 100% Original & Authentic
- Ready Stock - Fast Shipping
- Quality Guaranteed
- Excellent Customer Service

ORDER NOW WHILE STOCKS LAST!`,
        productDescriptionTable: generateTableFormat(
          `${productName} - Premium Quality at Best Price!\n\n${uniqueSellingPoint || `This ${productName} offers exceptional quality and value for money.`}`,
          productName,
          brand,
          category,
          keyFeatures,
          targetAudience,
          priceRange
        ),
        imageTextSuggestions: [
          `${productName} - Main Product with Premium Quality`,
          `Key Feature: ${keyFeatures?.[0] || 'High Quality Design'}`,
          `Perfect for ${targetAudience || 'Everyday Use'}`,
          `Why Choose Us: ${uniqueSellingPoint || 'Best Value Guarantee'}`,
          `100% Authentic - Ready Stock | Fast Shipping`
        ],
        searchTags: [
          productName,
          brand,
          category,
          ...(keyFeatures?.slice(0, 3) || [])
        ].filter(Boolean).join(', '),
        conversionBoosters: {
          promotionalAngle: `Limited Time Offer - Get ${priceRange || 'Best Deal'} on ${productName} with Free Shipping!`,
          bundleIdeas: [
            `Bundle with screen protector for extra savings`,
            `Buy 2 units and save 10%`,
            `Free installation kit with purchase`
          ],
          voucherStrategy: `Offer RM10 off for first-time buyers, RM5 cashback for reviews, and free shipping vouchers for orders above ${priceRange || 'RM100'}`,
          reviewStrategy: `Include a free gift in exchange for honest 5-star reviews. Follow up with customers after delivery and offer incentives for photo reviews.`
        }
      };
    }

    console.log('✅ Shopee SEO content generated successfully');

    return NextResponse.json({
      success: true,
      content: seoContent
    });

  } catch (error) {
    console.error('❌ Shopee SEO generation failed:', error);

    // Determine error type
    let errorMessage = 'Failed to generate Shopee SEO content';
    let errorDetails = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        errorMessage = 'API Key Error';
        errorDetails = 'Google Gemini API key is invalid or not configured. Please check your .env.local file.';
      } else if (error.message.includes('quota') || error.message.includes('429')) {
        errorMessage = 'API Quota Exceeded';
        errorDetails = 'Google Gemini API quota has been exceeded. Please try again later.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network Error';
        errorDetails = 'Failed to connect to Google Gemini API. Please check your internet connection.';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}