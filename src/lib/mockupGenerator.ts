// Mockup generation orchestrator and variation algorithms

import type { VariationConfig, GeneratedMockup, ProcessingProgress, ProductInfo } from './types';
import { processProductImage, analyzeFrame, compositeProductIntoFrame } from './imageProcessing';

export type ProductImages = {
  front: File | null;
  rightSide: File | null;
  leftSide: File | null;
  rear: File | null;
};

/**
 * Configuration for the 5 automatic variations
 * Each variation uses a different product view
 */
export const VARIATION_CONFIGS: VariationConfig[] = [
  {
    id: 'mockup',
    name: 'Product Mockup',
    productView: 'front',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    shadow: { blur: 30, opacity: 0.25, offsetY: 12 },
    description: 'Professional product mockup with soft shadow'
  },
  {
    id: 'original',
    name: 'Original Product',
    productView: 'front',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    description: 'Original product photo with background removed'
  },
  {
    id: 'side-right',
    name: 'Side View - Right',
    productView: 'rightSide',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    description: 'Side view facing right'
  },
  {
    id: 'side-left',
    name: 'Side View - Left',
    productView: 'leftSide',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    description: 'Side view facing left'
  },
  {
    id: 'rear-view',
    name: 'Rear View',
    productView: 'rear',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    description: 'Rear view product photo'
  }
];

/**
 * Generate mockups from product images and frame templates
 */
export async function generateMockups(
  productImages: ProductImages,
  frameFiles: File[],
  onProgress?: (progress: ProcessingProgress) => void,
  productAreaConfig?: { x: number; y: number; width: number; height: number; scale: number } | null,
  productInfo?: ProductInfo | null
): Promise<GeneratedMockup[]> {
  const mockups: GeneratedMockup[] = [];

  try {
    // 1. Process all available product images (background removal)
    onProgress?.({ stage: 'Processing product images...', percentage: 10 });

    const processedProducts: Record<string, any> = {};

    // Process front view (required)
    if (productImages.front) {
      console.log('Processing front view...');
      processedProducts.front = await processProductImage(productImages.front);
    }

    // Process right side view (optional)
    if (productImages.rightSide) {
      console.log('Processing right side view...');
      processedProducts.rightSide = await processProductImage(productImages.rightSide);
    } else if (productImages.front) {
      console.log('Right side view not provided, using front view as fallback');
      processedProducts.rightSide = processedProducts.front;
    }

    // Process left side view (optional)
    if (productImages.leftSide) {
      console.log('Processing left side view...');
      processedProducts.leftSide = await processProductImage(productImages.leftSide);
    } else if (productImages.front) {
      console.log('Left side view not provided, using front view as fallback');
      processedProducts.leftSide = processedProducts.front;
    }

    // Process rear view (optional)
    if (productImages.rear) {
      console.log('Processing rear view...');
      processedProducts.rear = await processProductImage(productImages.rear);
    } else if (productImages.front) {
      console.log('Rear view not provided, using front view as fallback');
      processedProducts.rear = processedProducts.front;
    }

    // 2. Load and analyze frames
    onProgress?.({ stage: 'Analyzing frame templates...', percentage: 20 });

    const frames = await Promise.all(
      frameFiles.map(async (file) => {
        const img = await loadImage(file);
        const analysis = await analyzeFrame(img, productAreaConfig);
        return { file, img, analysis };
      })
    );

    console.log(`✅ Loaded ${frames.length} frame(s) successfully`);

    // 3. Generate variations for each frame
    const totalVariations = frames.length * VARIATION_CONFIGS.length;
    let currentVariation = 0;

    for (const frame of frames) {
      for (const config of VARIATION_CONFIGS) {
        onProgress?.({
          stage: `Generating ${config.name}...`,
          percentage: 20 + (currentVariation / totalVariations) * 80
        });

        console.log(`\n🎨 Generating variation ${currentVariation + 1}/${totalVariations}: ${config.name}`);

        try {
          // Get the appropriate product image based on the variation config
          const productView = config.productView || 'front';
          const product = processedProducts[productView];

          if (!product) {
            console.warn(`⚠️  No ${productView} view available, skipping ${config.name}`);
            currentVariation++;
            continue;
          }

          console.log(`📸 Using ${productView} view for ${config.name}`);

          // Note: Product info overlay disabled - using text editor instead
          const configWithProductInfo = {
            ...config,
            showProductInfo: false, // Disabled - using drag-and-drop text editor
            productInfo: null
          };

          const canvas = await compositeProductIntoFrame(
            product.processed,
            frame.img,
            frame.analysis,
            configWithProductInfo
          );

          console.log(`✅ Successfully generated variation: ${config.name}`);

          mockups.push({
            id: `mockup-${mockups.length + 1}`,
            canvas,
            name: config.name,
            description: config.description,
            config
          });
        } catch (error) {
          console.error(`❌ Failed to generate variation ${config.name}:`, error);
          throw error; // Re-throw to stop generation
        }

        currentVariation++;

        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    onProgress?.({ stage: 'Complete!', percentage: 100 });

    console.log(`✅ Generated ${mockups.length} mockup(s) successfully`);
    return mockups;
  } catch (error) {
    console.error('Mockup generation failed:', error);
    throw error;
  }
}

/**
 * Load an image from a File object
 * Note: Does NOT revoke the URL to keep image in memory for all variations
 */
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // DON'T revoke URL here - keep image loaded for all variations
      console.log(`✅ Image loaded: ${file.name} (${img.width}x${img.height})`);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Get variation configuration by ID
 */
export function getVariationConfig(id: string): VariationConfig | undefined {
  return VARIATION_CONFIGS.find(config => config.id === id);
}

/**
 * Get all variation configurations
 */
export function getAllVariationConfigs(): VariationConfig[] {
  return [...VARIATION_CONFIGS];
}