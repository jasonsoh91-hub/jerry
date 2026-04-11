'use client';

import { useState } from 'react';
import ProductUploader, { ProductImages, ProductView } from './ProductUploader';
import FrameUploader from './FrameUploader';
import GenerateButton from './GenerateButton';
import MockupPreview from './MockupPreview';
import { generateMockups } from '@/lib/mockupGenerator';
import type { GeneratedMockup, ProcessingProgress, ProductInfo } from '@/lib/types';

export default function MockupGenerator() {
  const [productImages, setProductImages] = useState<ProductImages>({
    front: null,
    rightSide: null,
    leftSide: null,
    rear: null
  });
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [frameImages, setFrameImages] = useState<File[]>([]);
  const [productAreaConfig, setProductAreaConfig] = useState<{ x: number; y: number; width: number; height: number; scale: number } | null>(null);
  const [mockups, setMockups] = useState<GeneratedMockup[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: '',
    percentage: 0
  });
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!productImages.front || frameImages.length === 0) {
      setError('Please upload at least a front view product image and frame template(s)');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMockups([]);

    try {
      const generated = await generateMockups(
        productImages,
        frameImages,
        (p) => {
          setProgress(p);
          // Show detailed progress to user
          if (p.percentage < 15) {
            setProgress({ ...p, stage: '🎨 Removing background & detecting product...' });
          } else if (p.percentage < 30) {
            setProgress({ ...p, stage: '📐 Analyzing frame product areas...' });
          } else if (p.percentage < 45) {
            setProgress({ ...p, stage: '✨ Generating product mockup...' });
          } else if (p.percentage < 60) {
            setProgress({ ...p, stage: '📸 Preparing original product photo...' });
          } else if (p.percentage < 75) {
            setProgress({ ...p, stage: '➡️  Creating side view (right)...' });
          } else if (p.percentage < 85) {
            setProgress({ ...p, stage: '⬅️  Creating side view (left)...' });
          } else if (p.percentage < 95) {
            setProgress({ ...p, stage: '🔙 Creating rear view...' });
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
      {/* Product Images Upload Section */}
      <ProductUploader
        onImagesSelect={setProductImages}
        selectedImages={productImages}
      />

      {/* Frame Upload Section */}
      <FrameUploader
        onImagesSelect={setFrameImages}
        selectedImages={frameImages}
        onProductAreaChange={setProductAreaConfig}
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