// Mockup generation orchestrator and variation algorithms

import type { VariationConfig, GeneratedMockup, ProcessingProgress } from './types';
import { processProductImage, analyzeFrame, compositeProductIntoFrame } from './imageProcessing';

/**
 * Configuration for the 5 automatic variations
 * Scales are relative to filling the product area (1.0 = fills area)
 */
export const VARIATION_CONFIGS: VariationConfig[] = [
  {
    id: 'standard',
    name: 'Standard Fit',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    description: 'Fills the product area completely'
  },
  {
    id: 'closeup',
    name: 'Large Close-up',
    scale: 1.15,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    shadow: { blur: 20, opacity: 0.3, offsetY: 10 },
    description: 'Slightly larger, emphasized view'
  },
  {
    id: 'offset',
    name: 'Offset Position',
    scale: 0.95,
    position: { x: 0.45, y: 0.5 },
    rotation: 0,
    shadow: { blur: 15, opacity: 0.2, offsetY: 8 },
    description: 'Slightly off-center placement'
  },
  {
    id: 'tilted',
    name: 'Angled View',
    scale: 0.9,
    position: { x: 0.5, y: 0.5 },
    rotation: 5,
    shadow: { blur: 25, opacity: 0.4, offsetY: 15 },
    description: 'Subtle angle for depth'
  },
  {
    id: 'enhanced',
    name: 'Enhanced Style',
    scale: 1.0,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    shadow: { blur: 20, opacity: 0.3, offsetY: 10 },
    lighting: { brightness: 1.05, contrast: 1.1, vignette: true },
    description: 'Polished with lighting effects'
  }
];

/**
 * Generate mockups from product image and frame templates
 */
export async function generateMockups(
  productFile: File,
  frameFiles: File[],
  onProgress?: (progress: ProcessingProgress) => void
): Promise<GeneratedMockup[]> {
  const mockups: GeneratedMockup[] = [];

  try {
    // 1. Process product image (background removal)
    onProgress?.({ stage: 'Processing product image...', percentage: 10 });
    const product = await processProductImage(productFile);

    // 2. Load and analyze frames
    onProgress?.({ stage: 'Analyzing frame templates...', percentage: 20 });

    const frames = await Promise.all(
      frameFiles.map(async (file) => {
        const img = await loadImage(file);
        const analysis = await analyzeFrame(img);
        return { file, img, analysis };
      })
    );

    // 3. Generate variations for each frame
    const totalVariations = frames.length * VARIATION_CONFIGS.length;
    let currentVariation = 0;

    for (const frame of frames) {
      for (const config of VARIATION_CONFIGS) {
        onProgress?.({
          stage: `Generating ${config.name}...`,
          percentage: 20 + (currentVariation / totalVariations) * 80
        });

        const canvas = compositeProductIntoFrame(
          product.processed,
          frame.img,
          frame.analysis,
          config
        );

        mockups.push({
          id: `mockup-${mockups.length + 1}`,
          canvas,
          name: config.name,
          description: config.description,
          config
        });

        currentVariation++;

        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    onProgress?.({ stage: 'Complete!', percentage: 100 });

    return mockups;
  } catch (error) {
    console.error('Mockup generation failed:', error);
    throw error;
  }
}

/**
 * Load an image from a File object
 */
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
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