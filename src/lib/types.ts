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
}

export interface VariationConfig {
  id: string;
  name: string;
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
}

export interface GeneratedMockup {
  id: string;
  canvas: HTMLCanvasElement;
  name: string;
  description: string;
  config: VariationConfig;
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