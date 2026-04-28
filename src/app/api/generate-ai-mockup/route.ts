import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productImage, productInfo, refinement, style, productSize = 'small' } = body;

    if (!productImage) {
      return NextResponse.json(
        { error: 'No product image provided' },
        { status: 400 }
      );
    }

    const isMacro = style === 'macro';
    const isFlatLay = style === 'flatlay';
    const isHero = style === 'hero';
    const styleName = isHero ? 'hand interaction shot' : (isFlatLay ? 'flat lay' : (isMacro ? 'product close-up' : 'lifestyle'));

    console.log(`🎨 Generating AI ${styleName} mockup...`);
    console.log(`📏 Product size: ${productSize}`);
    if (refinement) {
      console.log('🔄 User refinement:', refinement);
    }

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
          model: modelId
        });

        let prompt: string;

        if (isHero) {
          // HAND INTERACTION LIFESTYLE PROMPT
          prompt = `A close-up, over-the-shoulder lifestyle photograph. YOU MUST USE THE EXACT PRODUCT FROM THE REFERENCE IMAGE - do not generate a different product. Show a person's hand naturally interacting with the uploaded product. The focus is sharp on the point of contact where the hand touches the product. The hand is in motion, slightly blurred at the edges to suggest a candid moment. The background is a modern, sun-drenched home office with soft-focus indoor plants. The lighting is warm and inviting, highlighting the ergonomics and tactile feel of the materials. Shot with a 50mm lens at f/1.8, 8k resolution, authentic and organic lifestyle photography style.`;

        } else if (isFlatLay) {
          // FLAT LAY PHOTOGRAPHY PROMPT
          prompt = `A professional top-down flat lay photograph. YOU MUST USE THE EXACT PRODUCT FROM THE REFERENCE IMAGE - do not generate a different product. Center the uploaded product on a matte black desk. Surrounding the product are neatly organized workspace essentials: a sleek wireless mouse, a leather-bound notebook, and a minimalist pen arranged in an intentional composition. The lighting is soft and directional, casting long, elegant shadows that define the product's silhouette. The color palette is monochromatic and sophisticated with high-contrast blacks, grays, and whites. Shot from directly above (bird's eye view) with a 35mm lens for a wide perspective that captures the entire composition. 8k resolution, crisp details, high-end tech magazine style, premium flat lay photography.`;

        } else if (isMacro) {
          // CLOSE-UP PRODUCT PHOTOGRAPHY PROMPT (not extreme macro)
          prompt = `A professional close-up product photograph. YOU MUST USE THE EXACT PRODUCT FROM THE REFERENCE IMAGE - do not generate a different product. Position the uploaded product as the hero subject, showcased at an optimal angle that highlights its design features and build quality. The product is placed on a clean, professional surface (light wood, marble, or premium desk mat). Soft, diffused studio lighting from above and to the side creates gentle highlights and reveals premium textures and materials. Subtle shadows add depth without being harsh. The background is a clean, neutral color (light gray, soft white, or muted gradient) that keeps focus on the product. Shot with an 85mm lens at f/2.8 for beautiful subject separation while keeping the entire product in focus. 8k resolution, ultra-high detail, photorealistic quality, commercial product photography style, Apple-style product presentation.`;
        } else {
          // LIFESTYLE PHOTOGRAPHY PROMPT (original)
          prompt = `Create a highly realistic lifestyle photograph. YOU MUST USE THE EXACT PRODUCT FROM THE REFERENCE IMAGE - do not generate a different product. Show the uploaded product in everyday use, resting on a clean minimalist desk. In the background, softly blurred out of focus (shallow depth of field/bokeh), there is a glowing desk lamp and a steaming cup of coffee, with a blurred window showing natural light. Natural, soft daylight is streaming in from a window to the side, creating gentle shadows and highlighting the premium texture and materials of the product. Shot with a 50mm lens, 8k resolution, photorealistic, cinematic lighting, highly detailed, commercial lifestyle photography style.`;
        }

        // Add user refinement if provided
        if (refinement && refinement.trim()) {
          prompt += ` IMPORTANT: ${refinement.trim()}.`;
        }

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
