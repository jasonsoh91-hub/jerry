import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');

    console.log('🔍 Analyzing product image with Gemini Vision...');
    console.log('📸 Image:', imageFile.name, imageFile.type, `${(imageFile.size / 1024).toFixed(1)}KB`);
    console.log('🔑 API Key present:', !!process.env.GEMINI_API_KEY);

    const prompt = `Analyze this product image and provide a detailed description for generating lifestyle mockup photography.

Please identify:
1. Product type and category (e.g., wireless headphones, smartwatch, laptop)
2. Key features (color, material, design style, main components)
3. Usage context (how/where people typically use this product)
4. Target audience/brand positioning (premium, budget, professional, casual)

Format your response as a JSON object:
{
  "productType": "string",
  "category": "string",
  "features": ["string"],
  "colors": ["string"],
  "materials": ["string"],
  "style": "string",
  "usageContext": "string",
  "brandPositioning": "string",
  "suggestedBackgrounds": ["string"],
  "suggestedSurfaces": ["string"]
}

Be specific and detailed. For example, instead of "headphones", say "premium over-ear wireless noise-canceling headphones".`;

    // Try multiple models - Gemma 4 first!
    const modelsToTry = [
      'gemma-4-31b-it',      // Try Gemma 4 first (latest model)
      'gemma-4-26b-a4b-it',  // Gemma 4 alternative
      'gemini-2.0-flash',    // Fallback to Gemini
      'gemini-flash-latest',
      'gemini-2.0-flash-lite'
    ];

    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🧪 Trying model: ${modelName}...`);

        const model = genAI.getGenerativeModel({ model: modelName });
        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: imageFile.type,
          },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        console.log(`✅ Product detected with ${modelName}`);

        // Parse the response
        let jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ||
                       text.match(/```\n([\s\S]*?)\n```/) ||
                       text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          throw new Error('Could not extract JSON from Gemini response');
        }

        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const productInfo = JSON.parse(jsonStr);

        console.log('✅ Product detected:', productInfo.productType);

        return NextResponse.json({
          success: true,
          productInfo,
          rawResponse: text,
          modelUsed: modelName
        });

      } catch (error: any) {
        console.log(`❌ ${modelName} failed:`, error.message);
        lastError = error;
        // Continue to next model
      }
    }

    // All models failed
    throw lastError || new Error('All models failed');

  } catch (error) {
    console.error('❌ Product detection failed:', error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Failed to detect product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
