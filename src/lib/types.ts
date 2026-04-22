// Core type definitions for Product Mockup Generator

export interface ProductImage {
  original: File;
  processed: HTMLImageElement; // Background removed
  bounds: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

export interface ProductInfo {
  model: string;
  brand: string;
  briefName: string;
  size: string;
  resolution: string;
  responseTime: string;
  refreshRate: string;
  ports: string;
  warranty: string;
}

export interface FrameAnalysis {
  width: number;
  height: number;
  safeZone: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  aspectRatio: number;
  manualScale?: number; // Manual scale multiplier from user settings
}

export interface VariationConfig {
  id: string;
  name: string;
  productView?: 'front' | 'rightSide' | 'leftSide' | 'rear'; // Which product view to use
  scale: number;
  position: { x: number; y: number };
  rotation: number;
  shadow?: {
    blur: number;
    opacity: number;
    offsetY: number;
  };
  lighting?: {
    brightness: number;
    contrast: number;
    vignette: boolean;
  };
  description: string;
  showProductInfo?: boolean; // Whether to show product info overlay
  productInfo?: ProductInfo | null; // Product information to display
}

export interface GeneratedMockup {
  id: string;
  canvas: HTMLCanvasElement;
  name: string;
  description: string;
  config: VariationConfig;
  // Store original images for dynamic recompositing (only for first mockup)
  originalFrame?: HTMLImageElement;
  originalProduct?: HTMLImageElement;
  productPosition?: { x: number; y: number }; // Current product position (0-1)
  productScale?: number; // Current product scale multiplier
}

export interface ProcessingProgress {
  stage: string;
  percentage: number;
}

export interface UploadConfig {
  maxSizeMB: number;
  acceptedTypes: string[];
  maxFiles: number;
}

export interface ValidationError {
  code: string;
  message: string;
  details?: any;
}