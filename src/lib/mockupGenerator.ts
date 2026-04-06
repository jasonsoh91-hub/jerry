// Mockup generation orchestrator and variation algorithms

import type { VariationConfig, GeneratedMockup, ProcessingProgress } from './types';
import { processProductImage, analyzeFrame, compositeProductIntoFrame } from './imageProcessing';

/**
 * Configuration for mockup generation
 * Scale is relative to filling the product area (1.0 = fills area)
 */
export const VARIATION_CONFIGS: VariationConfig[] = [
  {
    id: 'mockup',
    name: 'Product Mockup',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    shadow: { blur: 30, opacity: 0.25, offsetY: 12 },
    description: 'Professional product mockup with soft shadow'
  },
  {
    id: 'original',
    name: 'Original Product',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    description: 'Original product photo with background removed'
  },
  {
    id: 'side-view',
    name: 'Side View (Right)',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: -30,
    description: 'Side view without frame - rotated product only'
  }
];

/**
 * Generate mockups from product image and frame templates
 */
export async function generateMockups(
  productFile: File,
  frameFiles: File[],
  onProgress?: (progress: ProcessingProgress) => void,
  productAreaConfig?: { x: number; y: number; width: number; height: number } | null
): Promise<GeneratedMockup[]> {
  const mockups: GeneratedMockup[] = [];
  const frameUrls: string[] = []; // Keep track of URLs to clean up later

  try {
    // 1. Process product image (background removal)
    onProgress?.({ stage: 'Processing product image...', percentage: 10 });
    const product = await processProductImage(productFile);

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
          const canvas = compositeProductIntoFrame(
            product.processed,
            frame.img,
            frame.analysis,
            config
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