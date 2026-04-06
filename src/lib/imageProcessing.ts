// Core image processing functions for mockup generation

import { removeBackground } from '@imgly/background-removal';
import type { ProductImage, FrameAnalysis } from './types';

/**
 * Load an image from a File object
 */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Validate image dimensions
      if (!img.width || !img.height || img.width <= 0 || img.height <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error('Image has invalid dimensions'));
        return;
      }
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
 * Load an image from a Blob object
 */
export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from blob'));
    };

    img.src = url;
  });
}

/**
 * Detect product bounds by finding non-transparent pixels
 */
export function detectProductBounds(img: HTMLImageElement): {
  width: number;
  height: number;
  x: number;
  y: number;
} {
  // Validate image dimensions
  if (!img.width || !img.height || img.width <= 0 || img.height <= 0) {
    throw new Error('Invalid image dimensions');
  }

  // Create a temporary canvas to analyze pixels
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let foundPixel = false;

  // Scan for non-transparent pixels
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];

      if (alpha > 10) { // Threshold for "visible" pixel
        foundPixel = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!foundPixel) {
    // If no pixels found, return full image bounds
    return { width: img.width, height: img.height, x: 0, y: 0 };
  }

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    x: minX,
    y: minY
  };
}

/**
 * Center product in a new canvas with padding
 */
export function centerProduct(
  img: HTMLImageElement,
  bounds: { width: number; height: number; x: number; y: number },
  paddingRatio: number = 0.2
): HTMLImageElement {
  const padding = Math.max(bounds.width, bounds.height) * paddingRatio;
  const newWidth = bounds.width + padding * 2;
  const newHeight = bounds.height + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;

  // Calculate centered position
  const x = padding - bounds.x + (newWidth - bounds.width - padding * 2) / 2;
  const y = padding - bounds.y + (newHeight - bounds.height - padding * 2) / 2;

  ctx.drawImage(img, x, y);

  // Convert canvas back to image
  const newImg = new Image();
  newImg.src = canvas.toDataURL('image/png');

  return newImg;
}

/**
 * Simple background removal using color detection (fallback)
 * Removes white or similar colored backgrounds
 */
export async function simpleBackgroundRemoval(img: HTMLImageElement): Promise<HTMLImageElement> {
  // Validate input image
  if (!img.width || !img.height || img.width <= 0 || img.height <= 0) {
    throw new Error('Invalid image dimensions for background removal');
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0);

  // Validate canvas was created properly
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error('Canvas has invalid dimensions');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Simple white background removal
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // If pixel is very light/white, make it transparent
    if (r > 240 && g > 240 && b > 240) {
      data[i + 3] = 0; // Set alpha to 0 (transparent)
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Create and wait for image to load
  return new Promise((resolve, reject) => {
    const newImg = new Image();
    newImg.onload = () => {
      // Validate the new image has valid dimensions
      if (!newImg.width || !newImg.height || newImg.width <= 0 || newImg.height <= 0) {
        reject(new Error('Processed image has invalid dimensions'));
      } else {
        resolve(newImg);
      }
    };
    newImg.onerror = () => reject(new Error('Failed to create processed image'));
    newImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * Process product image: remove background and center product
 */
export async function processProductImage(file: File): Promise<ProductImage> {
  console.log('Processing product image:', file.name, file.size, file.type);

  // 1. Load image from file
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
    console.log('✓ Image loaded successfully:', img.width, 'x', img.height);
  } catch (error) {
    console.error('✗ Failed to load image:', error);
    throw new Error('Failed to load product image. Please try a different file.');
  }

  // Validate image dimensions
  if (!img.width || !img.height || img.width <= 0 || img.height <= 0) {
    throw new Error('Invalid image: image has no dimensions');
  }

  // 2. Remove background - try multiple approaches
  let processedImg: HTMLImageElement;
  try {
    console.log('Attempting background removal...');
    processedImg = await simpleBackgroundRemoval(img);
    console.log('✓ Background removal successful');
  } catch (error) {
    console.warn('✗ Background removal failed, using original:', error);
    processedImg = img;
  }

  // 3. Detect product bounds (find actual content)
  let bounds: { width: number; height: number; x: number; y: number };
  try {
    bounds = detectProductBounds(processedImg);
    console.log('✓ Product bounds detected:', bounds);
  } catch (error) {
    console.warn('✗ Could not detect bounds, using full image:', error);
    bounds = {
      width: processedImg.width,
      height: processedImg.height,
      x: 0,
      y: 0
    };
  }

  console.log('✓ Image processing complete');

  return {
    original: file,
    processed: processedImg,
    bounds
  };
}

/**
 * Analyze frame image to find the product placement area
 * Detects the largest transparent or empty region in the frame
 */
export async function analyzeFrame(frameImg: HTMLImageElement): Promise<FrameAnalysis> {
  const width = frameImg.width;
  const height = frameImg.height;

  // Create canvas to analyze the frame
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(frameImg, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Find the largest empty/transparent region
  let largestEmptyRegion = {
    x: 0,
    y: 0,
    width: width,
    height: height
  };

  // Simple approach: divide image into regions and find the most transparent one
  const regions = 4; // 4x4 grid
  const regionWidth = width / regions;
  const regionHeight = height / regions;

  let maxTransparency = 0;
  let bestRegion = { x: 0, y: 0, width: regionWidth, height: regionHeight };

  for (let gridY = 0; gridY < regions; gridY++) {
    for (let gridX = 0; gridX < regions; gridX++) {
      let transparentPixels = 0;
      let totalPixels = 0;

      const startX = Math.floor(gridX * regionWidth);
      const startY = Math.floor(gridY * regionHeight);
      const endX = Math.floor((gridX + 1) * regionWidth);
      const endY = Math.floor((gridY + 1) * regionHeight);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * width + x) * 4;
          const alpha = data[i + 3];

          // Count transparent or very light pixels
          if (alpha < 128 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240)) {
            transparentPixels++;
          }
          totalPixels++;
        }
      }

      const transparency = transparentPixels / totalPixels;
      if (transparency > maxTransparency) {
        maxTransparency = transparency;
        bestRegion = {
          x: startX,
          y: startY,
          width: endX - startX,
          height: endY - startY
        };
      }
    }
  }

  // Expand the best region slightly for better fit
  const safeZone = {
    x: bestRegion.x,
    y: bestRegion.y,
    width: bestRegion.width,
    height: bestRegion.height
  };

  console.log('Frame analysis - Product area:', safeZone);

  return {
    width,
    height,
    safeZone,
    aspectRatio: width / height
  };
}

/**
 * Apply lighting effects to a canvas
 */
export function applyLightingEffects(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lighting: {
    brightness: number;
    contrast: number;
    vignette: boolean;
  }
): void {
  const { brightness, contrast, vignette } = lighting;

  // Apply brightness and contrast using filter
  ctx.filter = `brightness(${brightness}) contrast(${contrast})`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  // Apply vignette effect
  if (vignette) {
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.3,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.7
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Composite product into frame with specified configuration
 * Scales product to fill the product area in the frame
 */
export function compositeProductIntoFrame(
  product: HTMLImageElement,
  frame: HTMLImageElement,
  frameAnalysis: FrameAnalysis,
  config: any
): HTMLCanvasElement {
  // 1. Create canvas at frame size
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d')!;

  // 2. Draw frame
  ctx.drawImage(frame, 0, 0);

  // 3. Calculate scale to fill the product area (safe zone)
  const safeZone = frameAnalysis.safeZone;
  const productAreaWidth = safeZone.width;
  const productAreaHeight = safeZone.height;

  // Scale product to fill the product area (with some padding)
  const padding = 0.9; // Use 90% of the area
  const scaleX = (productAreaWidth * padding) / product.width;
  const scaleY = (productAreaHeight * padding) / product.height;

  // Use the smaller scale to ensure product fits entirely
  let scale = Math.min(scaleX, scaleY);

  // Apply variation-specific scale modifier
  scale = scale * config.scale;

  // 4. Calculate position to center product in the product area
  const productWidth = product.width * scale;
  const productHeight = product.height * scale;

  // Center in the product area, then apply position offset
  const centerX = safeZone.x + (safeZone.width - productWidth) / 2;
  const centerY = safeZone.y + (safeZone.height - productHeight) / 2;

  const x = centerX + (safeZone.width - productWidth) * (config.position.x - 0.5);
  const y = centerY + (safeZone.height - productHeight) * (config.position.y - 0.5);

  // 5. Apply shadow if configured
  if (config.shadow) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${config.shadow.opacity})`;
    ctx.shadowBlur = config.shadow.blur;
    ctx.shadowOffsetY = config.shadow.offsetY;
  }

  // 6. Apply rotation if configured
  if (config.rotation !== 0) {
    ctx.save();
    ctx.translate(x + productWidth / 2, y + productHeight / 2);
    ctx.rotate((config.rotation * Math.PI) / 180);
    ctx.drawImage(product, -productWidth / 2, -productHeight / 2, productWidth, productHeight);
    ctx.restore();
  } else {
    ctx.drawImage(product, x, y, productWidth, productHeight);
  }

  if (config.shadow) {
    ctx.restore();
  }

  // 7. Apply lighting effects if configured
  if (config.lighting) {
    applyLightingEffects(ctx, canvas, config.lighting);
  }

  return canvas;
}