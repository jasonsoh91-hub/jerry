import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productImage, productInfo } = body;

    if (!productImage) {
      return NextResponse.json(
        { error: 'No product image provided' },
        { status: 400 }
      );
    }

    console.log('🎨 Generating AI lifestyle mockup...');

    // Try multiple image generation models
    const imageModelsToTry = [
      'gemini-2.5-flash-image',          // Nano Banana (latest)
      'nano-banana-pro-preview',         // Nano Banana Pro
      'gemini-3.1-flash-image-preview',  // Nano Banana 2
      'imagen-4.0-fast-generate-001'     // Imagen fallback
    ];

    let lastImageError: Error | null = null;

    for (const modelId of imageModelsToTry) {
      try {
        console.log(`🎨 Trying image model: ${modelId}...`);

        const model = genAI.getGenerativeModel({
          model: modelId,
          generationConfig: {
            responseModalities: ['Image', 'Text']
          }
        });

        // Build the prompt with detected product info
        let prompt = `Create a highly realistic lifestyle photograph of a `;

        if (productInfo) {
          prompt += `${productInfo.productType || 'product'} in everyday use. `;

          // Add details from product detection
          if (productInfo.features && productInfo.features.length > 0) {
            prompt += `Key features: ${productInfo.features.join(', ')}. `;
          }

          if (productInfo.style) {
            prompt += `Style: ${productInfo.style}. `;
          }

          if (productInfo.materials && productInfo.materials.length > 0) {
            prompt += `Materials: ${productInfo.materials.join(', ')}. `;
          }

          // Suggest surface based on product type
          const surface = productInfo.suggestedSurfaces?.[0] || 'clean minimalist desk';
          prompt += `The product is resting on a ${surface}. `;
        } else {
          prompt += `product in everyday use. The product is resting on a clean minimalist desk. `;
        }

        // Background elements
        prompt += `In the background, softly blurred out of focus (shallow depth of field/bokeh), there is a glowing desk lamp and a steaming cup of coffee, with a blurred window showing natural light. `;

        // Lighting and camera settings
        prompt += `Natural, soft daylight is streaming in from a window to the side, creating gentle shadows and highlighting the premium texture and materials of the product. Shot with a 50mm lens, 8k resolution, photorealistic, cinematic lighting, highly detailed, commercial lifestyle photography style.`;

        console.log('📝 Prompt:', prompt);

        // If product image is provided as base64, include it for reference
        let imagePart;
        if (productImage && productImage.startsWith('data:')) {
          // Extract base64 data from data URL
          const matches = productImage.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            imagePart = {
              inlineData: {
                data: base64Data,
                mimeType: `image/${mimeType}`,
              },
            };
          }
        }

        // Generate the image
        let result;
        if (imagePart) {
          result = await model.generateContent([prompt, imagePart]);
        } else {
          result = await model.generateContent(prompt);
        }

        const response = await result.response;

        console.log(`✅ Image generated with ${modelId}`);

        // Check if response contains an image
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
          throw new Error('No response from model');
        }

        const parts = candidates[0].content?.parts;
        if (!parts || parts.length === 0) {
          throw new Error('No content in response');
        }

        // Find the image part
        const imagePartResponse = parts.find((part: any) => part.inlineData);

        if (!imagePartResponse || !imagePartResponse.inlineData) {
          throw new Error('No image generated - response may contain only text');
        }

        const imageData = imagePartResponse.inlineData.data;
        const mimeType = imagePartResponse.inlineData.mimeType;

        console.log(`✅ Image generated: ${mimeType}, size: ${Math.round(imageData.length / 1024)}KB`);

        // Return the image as base64
        return NextResponse.json({
          success: true,
          image: `data:${mimeType};base64,${imageData}`,
          prompt: prompt,
          modelUsed: modelId
        });

      } catch (error: any) {
        console.log(`❌ ${modelId} failed:`, error.message);
        lastImageError = error;
        // Continue to next model
      }
    }

    // All models failed
    throw lastImageError || new Error('All image generation models failed');

    const response = await result.response;

    console.log('✅ AI mockup generated');

    // Check if response contains an image
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    const parts = candidates[0].content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error('No content in response');
    }

    // Find the image part
    const imagePartResponse = parts.find((part: any) => part.inlineData);

    if (!imagePartResponse || !imagePartResponse.inlineData) {
      throw new Error('No image generated - response may contain only text');
    }

    const imageData = imagePartResponse.inlineData.data;
    const mimeType = imagePartResponse.inlineData.mimeType;

    console.log(`✅ Image generated: ${mimeType}, size: ${Math.round(imageData.length / 1024)}KB`);

    // Return the image as base64
    return NextResponse.json({
      success: true,
      image: `data:${mimeType};base64,${imageData}`,
      prompt: prompt
    });

  } catch (error) {
    console.error('❌ AI mockup generation failed:', error);

    // Provide helpful error message
    let errorMessage = 'Failed to generate AI mockup';
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'Invalid Gemini API key - please check your configuration';
      } else if (error.message.includes('quota')) {
        errorMessage = 'API quota exceeded - please try again later';
      } else if (error.message.includes('model')) {
        errorMessage = 'Model not available - image generation may not be enabled for your API key';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
