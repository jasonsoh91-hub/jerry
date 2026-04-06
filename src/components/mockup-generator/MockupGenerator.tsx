'use client';

import { useState } from 'react';
import ProductUploader from './ProductUploader';
import FrameUploader from './FrameUploader';
import GenerateButton from './GenerateButton';
import MockupPreview from './MockupPreview';
import { generateMockups } from '@/lib/mockupGenerator';
import type { GeneratedMockup, ProcessingProgress } from '@/lib/types';

export default function MockupGenerator() {
  const [productImage, setProductImage] = useState<File | null>(null);
  const [frameImages, setFrameImages] = useState<File[]>([]);
  const [mockups, setMockups] = useState<GeneratedMockup[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: '',
    percentage: 0
  });
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!productImage || frameImages.length === 0) return;

    setIsGenerating(true);
    setError(null);
    setMockups([]);

    try {
      const generated = await generateMockups(
        productImage,
        frameImages,
        (p) => {
          setProgress(p);
          // Show detailed progress to user
          if (p.percentage < 20) {
            setProgress({ ...p, stage: '🎨 Removing background with AI...' });
          } else if (p.percentage < 40) {
            setProgress({ ...p, stage: '📐 Analyzing frame templates...' });
          } else if (p.percentage < 80) {
            setProgress({ ...p, stage: '✨ Generating mockup variations...' });
          } else {
            setProgress({ ...p, stage: '🎉 Finalizing mockups...' });
          }
        }
      );
      setMockups(generated);
    } catch (err) {
      console.error('Generation failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(
        `Failed to generate mockups: ${errorMessage}\n\nTips:\n• Use clear images with good lighting\n• Try PNG or JPG format instead of WebP\n• Use images with white/light backgrounds\n• Keep file sizes under 5MB`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = productImage && frameImages.length > 0 && !isGenerating;

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductUploader
          onImageSelect={setProductImage}
          selectedImage={productImage}
        />
        <FrameUploader
          onImagesSelect={setFrameImages}
          selectedImages={frameImages}
        />
      </div>

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