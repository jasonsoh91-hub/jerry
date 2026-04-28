// Mockup generation orchestrator and variation algorithms

import type { VariationConfig, GeneratedMockup, ProcessingProgress, ProductInfo } from './types';
import { processProductImage, analyzeFrame, compositeProductIntoFrame, drawProductInfoOverlay } from './imageProcessing';

export type ProductImages = {
  front: File | null;
};

/**
 * Default text overlay settings for initial mockup generation
 * These positions match the user's preferred coordinates from MockupCard
 * Exported so UI components can use the same defaults
 */
export const DEFAULT_TEXT_OVERLAY_SETTINGS = {
  model: { xMin: 720, xMax: 1292, yMin: 178, yMax: 302, align: 'center' }, // LOCKED
  brand: { x: 300, y: 300, fontSize: 70, maxWidth: 600, maxHeight: 80, align: 'left' },
  briefName: { xMin: 40, xMax: 640, yMin: 200, yMax: 330, align: 'left' }, // Auto font & spacing - LOCKED
  size: { x: 15, y: 377, fontSize: 65, maxWidth: 600, maxHeight: 120, lineHeight: 50, align: 'center' },
  resolution: { x: 15, y: 497, fontSize: 65, maxWidth: 600, maxHeight: 120, lineHeight: 50, align: 'center' },
  responseTime: { x: 15, y: 615, fontSize: 65, maxWidth: 600, maxHeight: 120, lineHeight: 50, align: 'center' },
  refreshRate: { x: 15, y: 738, fontSize: 65, maxWidth: 600, maxHeight: 120, lineHeight: 50, align: 'center' }
};

/**
 * Configuration for the single mockup variation
 */
export const VARIATION_CONFIGS: VariationConfig[] = [
  {
    id: 'mockup',
    name: 'Product Mockup',
    productView: 'front',
    scale: 0.8,
    position: { x: 618, y: 789 },
    rotation: 0,
    shadow: { blur: 30, opacity: 0.25, offsetY: 12 },
    description: 'Professional product mockup with soft shadow'
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
    // 1. Process product image (background removal)
    onProgress?.({ stage: 'Processing product image...', percentage: 10 });

    const processedProducts: Record<string, any> = {};

    // Process front view (required)
    if (productImages.front) {
      console.log('Processing front view...');
      processedProducts.front = await processProductImage(productImages.front);
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

          // Enable model overlay from product info with correct text overlay settings
          const configWithProductInfo = {
            ...config,
            showProductInfo: true, // Enable text overlays from the start
            productInfo: productInfo, // Pass product info to display model
            textOverlaySettings: DEFAULT_TEXT_OVERLAY_SETTINGS // Use correct positions from the start
          };

          console.log('🎯 Config for compositeProductIntoFrame:', {
            showProductInfo: configWithProductInfo.showProductInfo,
            hasProductInfo: !!configWithProductInfo.productInfo,
            model: configWithProductInfo.productInfo?.model,
            brand: configWithProductInfo.productInfo?.brand,
            briefName: configWithProductInfo.productInfo?.briefName
          });

          const canvas = await compositeProductIntoFrame(
            product.processed,
            frame.img,
            frame.analysis,
            configWithProductInfo
          );

          console.log(`✅ Successfully generated variation: ${config.name}`);

          // For the first mockup, save original frame and product for dynamic recompositing
          const mockupData: any = {
            id: `mockup-${mockups.length + 1}`,
            canvas,
            name: config.name,
            description: config.description,
            config: configWithProductInfo // Save config WITH productInfo
          };

          if (config.id === 'mockup') {
            mockupData.originalFrame = frame.img;
            mockupData.originalProduct = product.processed;
            mockupData.productPosition = { x: 0.5, y: 0.5 }; // Default center position
            mockupData.productScale = 1.0; // Default scale
          }

          mockups.push(mockupData);
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

/**
 * Recomposite product into frame with new position/scale
 * Used for dynamic product dragging/scaling in the UI
 */
export async function recompositeProduct(
  originalFrame: HTMLImageElement,
  originalProduct: HTMLImageElement,
  frameAnalysis: any,
  newPosition: { x: number; y: number },
  newScale: number,
  productInfo?: ProductInfo | null,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<HTMLCanvasElement> {
  try {
    // Create canvas at frame size
    const canvas = document.createElement('canvas');
    canvas.width = originalFrame.width;
    canvas.height = originalFrame.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    console.log('🖼️  Recompositing with custom position:', {
      canvasSize: `${canvas.width}x${canvas.height}`,
      productSize: `${originalProduct.width}x${originalProduct.height}`,
      position: newPosition,
      scale: newScale
    });

    // Draw frame
    ctx.drawImage(originalFrame, 0, 0);
    console.log('✅ Frame drawn');

    // Calculate product placement
    const safeZone = frameAnalysis.safeZone;
    const productAreaWidth = safeZone.width;
    const productAreaHeight = safeZone.height;

    // Calculate scale to fit product in area
    const padding = 0.95;
    const scaleX = (productAreaWidth * padding) / originalProduct.width;
    const scaleY = (productAreaHeight * padding) / originalProduct.height;
    const baseScale = Math.min(scaleX, scaleY);

    // Apply custom scale multiplier
    const finalScale = baseScale * newScale;

    // Calculate product dimensions after scaling
    const productWidth = originalProduct.width * finalScale;
    const productHeight = originalProduct.height * finalScale;

    // Position: Use normalized position (0-1) to position in safe zone
    // newPosition is center position in canvas coordinates (0-1)
    // Convert to pixel position
    const productPixelX = newPosition.x * originalFrame.width;
    const productPixelY = newPosition.y * originalFrame.height;

    // Center product in safe zone, then apply position offset
    const centerX = safeZone.x + (safeZone.width - productWidth) / 2;
    const centerY = safeZone.y + (safeZone.height - productHeight) / 2;

    // Allow product to move anywhere from its center position
    // Calculate offset from center based on normalized position
    const offsetX = (productPixelX - (originalFrame.width / 2)) * 2; // -1 to +1 range
    const offsetY = (productPixelY - (originalFrame.height / 2)) * 2;

    const x = centerX + offsetX;
    const y = centerY + offsetY;

    console.log('📍 Calculated position:', {
      normalizedPos: newPosition,
      pixelPos: { x: productPixelX, y: productPixelY },
      centerPos: { x: centerX, y: centerY },
      offset: { x: offsetX, y: offsetY },
      finalPos: { x: Math.round(x), y: Math.round(y) }
    });

    // Draw product
    ctx.drawImage(originalProduct, x, y, productWidth, productHeight);

    console.log('✅ Product drawn successfully');

    // NO text overlays here - they are applied separately in the UI
    // This prevents duplicate text when dragging the product

    return canvas;
  } catch (error) {
    console.error('❌ Recomposition failed:', error);
    throw error;
  }
}