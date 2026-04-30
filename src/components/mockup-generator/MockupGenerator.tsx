'use client';

import React, { useState, useEffect } from 'react';
import ProductUploader, { ProductImages } from './ProductUploader';
import ProductInfoExtractor from './ProductInfoExtractor';
import GenerateButton from './GenerateButton';
import MockupPreview from './MockupPreview';
import { generateMockups } from '@/lib/mockupGenerator';
import type { GeneratedMockup, ProcessingProgress, ProductInfo } from '@/lib/types';

export default function MockupGenerator() {
  const [productImages, setProductImages] = useState<ProductImages>({
    front: null
  });
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);

  // Debug: Log when productInfo changes
  React.useEffect(() => {
    console.log('🔄 ProductInfo state changed:', productInfo);
  }, [productInfo]);
  const [frameImages, setFrameImages] = useState<File[]>([]);
  const [productAreaConfig, setProductAreaConfig] = useState<{ x: number; y: number; width: number; height: number; scale: number } | null>(null);
  const [mockups, setMockups] = useState<GeneratedMockup[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: '',
    percentage: 0
  });
  const [error, setError] = useState<string | null>(null);

  // Load default frame on mount
  useEffect(() => {
    const loadDefaultFrame = async () => {
      try {
        const response = await fetch('/frame.png');
        const blob = await response.blob();
        const file = new File([blob], 'frame.png', { type: 'image/png' });
        setFrameImages([file]);
        console.log('✅ Default frame loaded successfully');
      } catch (err) {
        console.error('❌ Failed to load default frame:', err);
        setError('Failed to load default frame template');
      }
    };

    loadDefaultFrame();
  }, []);

  const handleGenerate = async () => {
    if (!productImages.front) {
      setError('Please upload a front view product image');
      return;
    }

    if (frameImages.length === 0) {
      setError('Default frame not loaded. Please refresh the page.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMockups([]);

    console.log('🚀 Starting mockup generation with productInfo:', productInfo);
    console.log('🛡️ CRITICAL WARRANTY CHECK:', {
      warranty: productInfo?.warranty,
      warrantyType: typeof productInfo?.warranty,
      warrantyLength: productInfo?.warranty?.length,
      exactValue: `"${productInfo?.warranty}"`
    });

    try {
      const generated = await generateMockups(
        productImages,
        frameImages,
        (p) => {
          setProgress(p);
          // Show detailed progress to user
          if (p.percentage < 25) {
            setProgress({ ...p, stage: '🎨 Removing background & detecting product...' });
          } else if (p.percentage < 50) {
            setProgress({ ...p, stage: '📐 Analyzing frame product areas...' });
          } else if (p.percentage < 75) {
            setProgress({ ...p, stage: '✨ Generating product mockup...' });
          } else {
            setProgress({ ...p, stage: '🎉 Finalizing...' });
          }
        },
        productAreaConfig,
        productInfo
      );
      setMockups(generated);
    } catch (err) {
      console.error('Generation failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(
        `Failed to generate mockups: ${errorMessage}\n\nTips:\n• Try smaller image files (under 5MB)\n• Use PNG or JPG format\n• Make sure images are clear and high-quality\n• Check that your images loaded correctly`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = productImages.front && frameImages.length > 0 && !isGenerating;

  return (
    <div className="space-y-8">
      {/* Product Information Extractor Section */}
      <ProductInfoExtractor onInfoExtracted={setProductInfo} />

      {/* Product Images Upload Section */}
      <ProductUploader
        onImagesSelect={setProductImages}
        selectedImages={productImages}
      />

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Progress Display */}
      {isGenerating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 font-medium">{progress.stage}</p>
          <div className="mt-2 bg-blue-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-blue-700 text-sm mt-2">
            {Math.round(progress.percentage)}% complete
          </p>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex justify-center">
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate}
          isGenerating={isGenerating}
          progress={progress.percentage}
        />
      </div>

      {/* Mockup Preview */}
      {mockups.length > 0 && <MockupPreview mockups={mockups} />}
    </div>
  );
}