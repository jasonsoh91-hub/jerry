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

  console.log(`Loaded image: ${img.width}x${img.height}`);

  // 2. Try to remove background, with fallbacks
  let processedImg: HTMLImageElement;
  try {
    console.log('Attempting AI background removal...');
    const blob = await removeBackground(img.src);
    processedImg = await loadImageFromBlob(blob);
    console.log('✓ AI background removal successful!');
  } catch (error) {
    console.warn('✗ AI background removal failed, trying simple fallback:', error);
    try {
      // Fallback to simple white background removal (now async)
      processedImg = await simpleBackgroundRemoval(img);
      console.log('✓ Simple background removal successful!');
    } catch (fallbackError) {
      console.warn('✗ Simple background removal failed, using original image:', fallbackError);
      // Final fallback: use original image
      processedImg = img;
      console.log('✓ Using original image');
    }
  }

  // Validate processed image has valid dimensions
  if (!processedImg.width || !processedImg.height || processedImg.width <= 0 || processedImg.height <= 0) {
    console.error('✗ Processed image has invalid dimensions');
    throw new Error('Processed image has invalid dimensions');
  }

  console.log(`Processed image: ${processedImg.width}x${processedImg.height}`);

  // 3. Detect product bounds
  let bounds: { width: number; height: number; x: number; y: number };
  try {
    bounds = detectProductBounds(processedImg);
    console.log('✓ Product bounds detected:', bounds);
  } catch (error) {
    console.error('✗ Failed to detect product bounds:', error);
    throw new Error('Failed to detect product bounds. Please try a clearer image.');
  }

  // 4. Center product with padding
  const centered = centerProduct(processedImg, bounds, 0.2);

  // Wait for the image to finish loading
  await new Promise((resolve) => {
    if (centered.complete) {
      resolve(centered);
    } else {
      centered.onload = () => resolve(centered);
    }
  });

  console.log('✓ Image processing complete');

  return {
    original: file,
    processed: centered,
    bounds
  };
}

/**
 * Analyze frame image to determine safe zone and dimensions
 */
export async function analyzeFrame(frameImg: HTMLImageElement): Promise<FrameAnalysis> {
  const width = frameImg.width;
  const height = frameImg.height;

  // Calculate safe zone (center 60% of frame)
  const safeZone = {
    x: width * 0.2,
    y: height * 0.2,
    width: width * 0.6,
    height: height * 0.6
  };

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

  // 3. Calculate product placement
  const scale = config.scale;
  const productWidth = product.width * scale;
  const productHeight = product.height * scale;
  const x = (frame.width - productWidth) * config.position.x;
  const y = (frame.height - productHeight) * config.position.y;

  // 4. Apply shadow if configured
  if (config.shadow) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${config.shadow.opacity})`;
    ctx.shadowBlur = config.shadow.blur;
    ctx.shadowOffsetY = config.shadow.offsetY;
  }

  // 5. Apply rotation if configured
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

  // 6. Apply lighting effects if configured
  if (config.lighting) {
    applyLightingEffects(ctx, canvas, config.lighting);
  }

  return canvas;
}