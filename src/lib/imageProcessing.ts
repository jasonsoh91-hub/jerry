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
 * @param frameImg - The frame image to analyze
 * @param manualConfig - Optional manual product area configuration (percentages)
 */
export async function analyzeFrame(
  frameImg: HTMLImageElement,
  manualConfig?: { x: number; y: number; width: number; height: number; scale: number } | null
): Promise<FrameAnalysis> {
  const width = frameImg.width;
  const height = frameImg.height;

  // If manual configuration is provided, use it directly
  if (manualConfig) {
    const safeZone = {
      x: (manualConfig.x / 100) * width,
      y: (manualConfig.y / 100) * height,
      width: (manualConfig.width / 100) * width,
      height: (manualConfig.height / 100) * height
    };

    console.log('✅ Using MANUAL product area configuration:', manualConfig);
    console.log('📐 Frame size:', width, 'x', height);
    console.log('🎯 Calculated safe zone in pixels:', {
      x: Math.round(safeZone.x),
      y: Math.round(safeZone.y),
      width: Math.round(safeZone.width),
      height: Math.round(safeZone.height)
    });

    return {
      width,
      height,
      safeZone,
      aspectRatio: width / height,
      manualScale: manualConfig.scale // Include manual scale
    };
  }

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

  // Enhanced approach: divide image into finer grid for better precision
  const regions = 8; // 8x8 grid for better precision
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

  // Expand the best region by merging adjacent white/transparent regions
  let expandedRegion = { ...bestRegion };

  // Try to expand horizontally and vertically to include adjacent white regions
  const expansionThreshold = 0.7; // 70% white/transparent

  // Expand to the right
  for (let x = bestRegion.x + bestRegion.width; x < width; x += regionWidth) {
    const regionX = Math.floor(x / regionWidth);
    if (regionX >= regions) break;

    let regionTransparency = 0;
    for (let gridY = 0; gridY < regions; gridY++) {
      const startX = Math.floor(regionX * regionWidth);
      const startY = Math.floor(gridY * regionHeight);
      const endX = Math.min(Math.floor((regionX + 1) * regionWidth), width);
      const endY = Math.min(Math.floor((gridY + 1) * regionHeight), height);

      let transparentPixels = 0;
      let totalPixels = 0;

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const i = (py * width + px) * 4;
          const alpha = data[i + 3];
          if (alpha < 128 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240)) {
            transparentPixels++;
          }
          totalPixels++;
        }
      }

      if (transparentPixels / totalPixels > expansionThreshold) {
        regionTransparency++;
      }
    }

    if (regionTransparency > regions * 0.5) {
      expandedRegion.width += regionWidth;
    } else {
      break;
    }
  }

  // Expand downward
  for (let y = bestRegion.y + bestRegion.height; y < height; y += regionHeight) {
    const regionY = Math.floor(y / regionHeight);
    if (regionY >= regions) break;

    let regionTransparency = 0;
    for (let gridX = 0; gridX < regions; gridX++) {
      const startX = Math.floor(gridX * regionWidth);
      const startY = Math.floor(regionY * regionHeight);
      const endX = Math.min(Math.floor((gridX + 1) * regionWidth), width);
      const endY = Math.min(Math.floor((regionY + 1) * regionHeight), height);

      let transparentPixels = 0;
      let totalPixels = 0;

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const i = (py * width + px) * 4;
          const alpha = data[i + 3];
          if (alpha < 128 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240)) {
            transparentPixels++;
          }
          totalPixels++;
        }
      }

      if (transparentPixels / totalPixels > expansionThreshold) {
        regionTransparency++;
      }
    }

    if (regionTransparency > regions * 0.5) {
      expandedRegion.height += regionHeight;
    } else {
      break;
    }
  }

  // Ensure expanded region doesn't exceed frame bounds
  expandedRegion.width = Math.min(expandedRegion.width, width - expandedRegion.x);
  expandedRegion.height = Math.min(expandedRegion.height, height - expandedRegion.y);

  // Apply small margin for cleaner edge
  const margin = Math.min(regionWidth, regionHeight) * 0.1; // 10% margin
  const safeZone = {
    x: expandedRegion.x + margin,
    y: expandedRegion.y + margin,
    width: expandedRegion.width - margin * 2,
    height: expandedRegion.height - margin * 2
  };

  console.log('✅ Auto-detected product area with enhanced detection:');
  console.log('📐 Frame size:', width, 'x', height);
  console.log('🎯 Best region:', {
    x: Math.round(bestRegion.x),
    y: Math.round(bestRegion.y),
    width: Math.round(bestRegion.width),
    height: Math.round(bestRegion.height)
  });
  console.log('📏 Expanded region:', {
    x: Math.round(expandedRegion.x),
    y: Math.round(expandedRegion.y),
    width: Math.round(expandedRegion.width),
    height: Math.round(expandedRegion.height)
  });
  console.log('🎯 Final safe zone with margins:', {
    x: Math.round(safeZone.x),
    y: Math.round(safeZone.y),
    width: Math.round(safeZone.width),
    height: Math.round(safeZone.height),
    margin: Math.round(margin)
  });

  return {
    width,
    height,
    safeZone,
    aspectRatio: width / height,
    manualScale: 1.0 // Default scale for automatic detection
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
 * Draw product information overlay on the canvas
 * Creates styled boxes with product details, specs, and features
 */
export function drawProductInfoOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  productInfo: any,
  config: any
): void {
  console.log('🔍 drawProductInfoOverlay called with:', {
    hasProductInfo: !!productInfo,
    showProductInfo: config?.showProductInfo,
    model: productInfo?.model,
    canvasSize: `${canvas.width}x${canvas.height}`
  });

  if (!productInfo || !config.showProductInfo) {
    console.log('⚠️ Skipping product info overlay - missing productInfo or showProductInfo is false');
    return;
  }

  console.log('📝 Drawing product info overlay:', productInfo.model || productInfo.name);

  // Draw model number at specified position
  if (productInfo.model) {
    ctx.save();

    // Model text configuration
    const modelText = productInfo.model;
    const modelX = 260; // Fixed X position (moved another 15px right)
    const modelY = 75;  // Fixed Y position (moved 5px up)
    const modelFontSize = 32;

    console.log(`✏️ Drawing model text "${modelText}" at X:${modelX}, Y:${modelY}`);

    // Use Orbitron font (Google Font), fallback to sci-fi and system fonts
    const modelFont = `${modelFontSize}px "Orbitron", "Sci-Fi", "Squared Techno", "Techno Square", "Arial Black", sans-serif`;
    ctx.font = modelFont;

    // Draw both black and white for maximum visibility on any background
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // White outline (thick)
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 8;
    ctx.strokeText(modelText, modelX, modelY);

    // Black text
    ctx.fillStyle = '#000000';
    ctx.fillText(modelText, modelX, modelY);

    ctx.restore();
    console.log(`✅ Model text "${modelText}" drawn at X:${modelX}, Y:${modelY} with font "Orbitron" size ${modelFontSize} - Color: Black`);
  } else {
    console.log('⚠️ No model found in productInfo:', productInfo);
  }

  console.log('✅ Model text overlay complete');
}

/**
 * Composite product into frame with specified configuration
 * Scales product to fill the product area in the frame
 * For 'original' config, just returns the product on transparent background
 */
export async function compositeProductIntoFrame(
  product: HTMLImageElement,
  frame: HTMLImageElement,
  frameAnalysis: FrameAnalysis,
  config: any
): Promise<HTMLCanvasElement> {
  // Special case for original product image - no frame, just product
  if (config.id === 'original') {
    console.log('🖼️  Generating original product image (no frame)');

    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = product.width;
    originalCanvas.height = product.height;
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true })!;

    // Draw product on transparent background
    originalCtx.drawImage(product, 0, 0);

    console.log(`✅ Original product image complete: ${originalCanvas.width}x${originalCanvas.height}\n`);
    return originalCanvas;
  }

  // Special case for side/rear views - no frame, just product
  if (config.id === 'side-right' || config.id === 'side-left' || config.id === 'rear-view') {
    console.log(`🔄 Generating ${config.name} (no frame) - using uploaded photo`);

    // Create canvas same size as product
    const viewCanvas = document.createElement('canvas');
    viewCanvas.width = product.width;
    viewCanvas.height = product.height;
    const viewCtx = viewCanvas.getContext('2d', { willReadFrequently: true })!;

    // Draw product on transparent background
    viewCtx.drawImage(product, 0, 0);

    console.log(`✅ ${config.name} complete: ${viewCanvas.width}x${viewCanvas.height}\n`);
    return viewCanvas;
  }

  // Normal mockup generation with frame
  // 1. Create canvas at frame size
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  console.log(`🖼️  Compositing for variation: ${config.name || 'unknown'}`);
  console.log(`📐 Canvas size: ${canvas.width}x${canvas.height}`);
  console.log(`🖼️  Frame size: ${frame.width}x${frame.height}`);
  console.log(`📦 Product size: ${product.width}x${product.height}`);

  // Verify frame image is still valid
  if (!frame.complete || frame.naturalWidth === 0) {
    throw new Error('Frame image is not loaded or is invalid');
  }

  // 2. Draw frame
  try {
    // Reset canvas state
    ctx.resetTransform();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw frame
    ctx.drawImage(frame, 0, 0);
    console.log('✅ Frame drawn successfully');

    // Verify frame was drawn (check if pixel data exists)
    const testPixel = ctx.getImageData(0, 0, 1, 1).data;
    if (testPixel[3] === 0) {
      console.warn('⚠️  Frame appears to be transparent at (0,0)');
    }
  } catch (error) {
    console.error('❌ Failed to draw frame:', error);
    throw error;
  }

  // 3. Use fixed position and scale as requested
  const fixedPosition = {
    x: 230,  // Fixed X position
    y: 290   // Fixed Y position
  };

  const fixedScale = 3.0; // 300% scale

  console.log('🎯 Using FIXED position and scale (as requested):');
  console.log(`📍 Fixed Position: X=${fixedPosition.x}px, Y=${fixedPosition.y}px`);
  console.log(`📏 Fixed Scale: ${fixedScale * 100}% (${fixedScale}x)`);
  console.log(`📦 Original Product Size: ${product.width}x${product.height}`);
  console.log(`📐 Scaled Product Size: ${Math.round(product.width * fixedScale)}x${Math.round(product.height * fixedScale)}`);

  // Log configuration details
  console.log('🎨 Variation config:', {
    name: config.name,
    shadow: config.shadow ? `blur:${config.shadow.blur} opacity:${config.shadow.opacity} offsetY:${config.shadow.offsetY}` : 'none',
    lighting: config.lighting ? `brightness:${config.lighting.brightness} contrast:${config.lighting.contrast} vignette:${config.lighting.vignette}` : 'none'
  });

  // 4. Calculate product dimensions and use fixed position
  const productWidth = product.width * fixedScale;
  const productHeight = product.height * fixedScale;

  // Use fixed position as requested
  const x = fixedPosition.x;
  const y = fixedPosition.y;

  // 5. Draw the product with shadow if configured
  console.log('✏️  About to draw product with FIXED values:');
  console.log(`📍 Drawing at: X=${x}px, Y=${y}px`);
  console.log(`📏 Product size: ${Math.round(productWidth)}x${Math.round(productHeight)}px`);
  console.log(`🖼️  Canvas size: ${canvas.width}x${canvas.height}`);
  console.log(`📐 Scale: ${fixedScale}x (${fixedScale * 100}%)`);
  console.log(`🔍 Frame dimensions: ${frame.width}x${frame.height}`);

  if (config.shadow) {
    // Save context state before applying shadow
    ctx.save();

    // Apply shadow to the product
    ctx.shadowColor = `rgba(0, 0, 0, ${config.shadow.opacity})`;
    ctx.shadowBlur = config.shadow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = config.shadow.offsetY;

    console.log('🌑 Applying shadow:', config.shadow);

    // Draw product with shadow
    if (config.rotation !== 0) {
      ctx.translate(x + productWidth / 2, y + productHeight / 2);
      ctx.rotate((config.rotation * Math.PI) / 180);
      ctx.drawImage(product, -productWidth / 2, -productHeight / 2, productWidth, productHeight);
      ctx.rotate(-(config.rotation * Math.PI) / 180);
      ctx.translate(-(x + productWidth / 2), -(y + productHeight / 2));
    } else {
      ctx.drawImage(product, x, y, productWidth, productHeight);
    }

    // Restore context to remove shadow for subsequent operations
    ctx.restore();
    console.log('✅ Product successfully DRAWN with shadow at fixed position');
  } else {
    // No shadow, just draw product
    if (config.rotation !== 0) {
      ctx.save();
      ctx.translate(x + productWidth / 2, y + productHeight / 2);
      ctx.rotate((config.rotation * Math.PI) / 180);
      ctx.drawImage(product, -productWidth / 2, -productHeight / 2, productWidth, productHeight);
      ctx.restore();
    } else {
      ctx.drawImage(product, x, y, productWidth, productHeight);
    }
    console.log('✅ Product drawn without shadow');
  }

  // 6. Verify final canvas has content
  const finalPixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  console.log('🔍 Final canvas check - pixel at product position:', {
    r: finalPixel[0],
    g: finalPixel[1],
    b: finalPixel[2],
    a: finalPixel[3]
  });

  // 6. Draw product info overlay if configured
  if (config.showProductInfo && config.productInfo) {
    console.log('📝 Adding product info overlay...');
    drawProductInfoOverlay(ctx, canvas, config.productInfo, config);
    console.log('✅ Product info overlay applied');
  }

  // 7. Apply lighting effects if configured
  if (config.lighting) {
    console.log('💡 Applying lighting effects...');
    applyLightingEffects(ctx, canvas, config.lighting);
    console.log('✅ Lighting effects applied');
  }

  console.log(`🎉 Composite complete for variation: ${config.name}\n`);

  return canvas;
}