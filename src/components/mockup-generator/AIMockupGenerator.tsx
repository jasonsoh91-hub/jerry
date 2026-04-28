'use client';

import { useState, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Wand2, Download, RefreshCw } from 'lucide-react';
import type { ProductImages } from './ProductUploader';

interface AIMockupGeneratorProps {
  selectedImages: ProductImages;
}

export default function AIMockupGenerator({ selectedImages }: AIMockupGeneratorProps) {
  // AI Lifestyle mockup states
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null);
  const [generationHistory, setGenerationHistory] = useState<Array<{ image: string, prompt: string }>>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  // Macro mockup states
  const [isGeneratingMacro, setIsGeneratingMacro] = useState(false);
  const [generatedMacroImage, setGeneratedMacroImage] = useState<string | null>(null);
  const [macroRefinementPrompt, setMacroRefinementPrompt] = useState('');
  const [macroGenerationError, setMacroGenerationError] = useState<string | null>(null);
  const [macroGenerationHistory, setMacroGenerationHistory] = useState<Array<{ image: string, prompt: string }>>([]);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [macroModalImage, setMacroModalImage] = useState<string | null>(null);

  // Flat lay mockup states
  const [isGeneratingFlatLay, setIsGeneratingFlatLay] = useState(false);
  const [generatedFlatLayImage, setGeneratedFlatLayImage] = useState<string | null>(null);
  const [flatLayRefinementPrompt, setFlatLayRefinementPrompt] = useState('');
  const [flatLayGenerationError, setFlatLayGenerationError] = useState<string | null>(null);
  const [flatLayGenerationHistory, setFlatLayGenerationHistory] = useState<Array<{ image: string, prompt: string }>>([]);
  const [isFlatLayModalOpen, setIsFlatLayModalOpen] = useState(false);
  const [flatLayModalImage, setFlatLayModalImage] = useState<string | null>(null);

  // Hero shot mockup states
  const [isGeneratingHero, setIsGeneratingHero] = useState(false);
  const [generatedHeroImage, setGeneratedHeroImage] = useState<string | null>(null);
  const [heroRefinementPrompt, setHeroRefinementPrompt] = useState('');
  const [heroGenerationError, setHeroGenerationError] = useState<string | null>(null);
  const [heroGenerationHistory, setHeroGenerationHistory] = useState<Array<{ image: string, prompt: string }>>([]);
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [heroModalImage, setHeroModalImage] = useState<string | null>(null);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) handleCloseModal();
        if (isMacroModalOpen) handleCloseMacroModal();
        if (isFlatLayModalOpen) handleCloseFlatLayModal();
        if (isHeroModalOpen) handleCloseHeroModal();
      }
    };

    if (isModalOpen || isMacroModalOpen || isFlatLayModalOpen || isHeroModalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, isMacroModalOpen, isFlatLayModalOpen, isHeroModalOpen]);

  const handleImageClick = (image: string) => {
    setModalImage(image);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalImage(null);
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `ai-lifestyle-mockup-${Date.now()}.png`;
    link.click();
  };

  const handleGenerateAIMockup = async (useRefinement: boolean = false) => {
    if (!selectedImages.front) {
      setAiGenerationError('Please upload a front product image first');
      return;
    }

    setIsGeneratingAI(true);
    setAiGenerationError(null);

    try {
      console.log('🎨 Generating AI lifestyle mockup...');

      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(selectedImages.front as File);
      });

      const payload: any = {
        productImage: imageBase64,
        productInfo: {
          productType: 'product',
          features: [],
          materials: [],
          style: 'modern and professional',
          suggestedSurfaces: ['clean minimalist desk', 'modern workspace']
        },
        productSize: 'small'
      };

      if (useRefinement && refinementPrompt.trim()) {
        payload.refinement = refinementPrompt.trim();
        console.log('🔄 Using refinement prompt:', refinementPrompt);
      }

      const response = await fetch('/api/generate-ai-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate AI mockup');
      }

      const data = await response.json();

      if (data.success && data.image) {
        console.log('✅ AI lifestyle mockup generated successfully');

        // Save to history before setting new image
        if (generatedImage) {
          setGenerationHistory(prev => [
            { image: generatedImage, prompt: refinementPrompt || 'Initial generation' },
            ...prev
          ].slice(0, 5)); // Keep last 5 generations
        }

        setGeneratedImage(data.image);
        setRefinementPrompt(''); // Clear refinement prompt after successful generation
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ AI lifestyle generation failed:', error);
      setAiGenerationError(error instanceof Error ? error.message : 'Failed to generate AI lifestyle mockup');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Similar functions for Macro, Flat Lay, and Hero shot would go here
  // For brevity, I'm including placeholder functions

  const handleGenerateMacroMockup = async (useRefinement: boolean = false) => {
    if (!selectedImages.front) {
      setMacroGenerationError('Please upload a front product image first');
      return;
    }

    setIsGeneratingMacro(true);
    setMacroGenerationError(null);

    try {
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(selectedImages.front as File);
      });

      const payload: any = {
        productImage: imageBase64,
        style: 'macro',
        productInfo: {
          productType: 'electronic product',
          features: [],
          productName: 'product',
          materials: []
        },
        productSize: 'small'
      };

      if (useRefinement && macroRefinementPrompt.trim()) {
        payload.refinement = macroRefinementPrompt.trim();
      }

      const response = await fetch('/api/generate-ai-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate macro mockup');
      }

      const data = await response.json();

      if (data.success && data.image) {
        if (generatedMacroImage) {
          setMacroGenerationHistory(prev => [
            { image: generatedMacroImage, prompt: macroRefinementPrompt || 'Initial' },
            ...prev
          ].slice(0, 5));
        }
        setGeneratedMacroImage(data.image);
        setMacroRefinementPrompt('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ Macro generation failed:', error);
      setMacroGenerationError(error instanceof Error ? error.message : 'Failed to generate macro mockup');
    } finally {
      setIsGeneratingMacro(false);
    }
  };

  const handleGenerateFlatLayMockup = async (useRefinement: boolean = false) => {
    if (!selectedImages.front) {
      setFlatLayGenerationError('Please upload a front product image first');
      return;
    }

    setIsGeneratingFlatLay(true);
    setFlatLayGenerationError(null);

    try {
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(selectedImages.front as File);
      });

      const payload: any = {
        productImage: imageBase64,
        style: 'flatlay',
        productInfo: {
          productType: 'product',
          features: [],
          productName: 'product',
          materials: []
        },
        productSize: 'small'
      };

      if (useRefinement && flatLayRefinementPrompt.trim()) {
        payload.refinement = flatLayRefinementPrompt.trim();
      }

      const response = await fetch('/api/generate-ai-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate flat lay mockup');
      }

      const data = await response.json();

      if (data.success && data.image) {
        if (generatedFlatLayImage) {
          setFlatLayGenerationHistory(prev => [
            { image: generatedFlatLayImage, prompt: flatLayRefinementPrompt || 'Initial' },
            ...prev
          ].slice(0, 5));
        }
        setGeneratedFlatLayImage(data.image);
        setFlatLayRefinementPrompt('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ Flat lay generation failed:', error);
      setFlatLayGenerationError(error instanceof Error ? error.message : 'Failed to generate flat lay mockup');
    } finally {
      setIsGeneratingFlatLay(false);
    }
  };

  const handleGenerateHeroMockup = async (useRefinement: boolean = false) => {
    if (!selectedImages.front) {
      setHeroGenerationError('Please upload a front product image first');
      return;
    }

    setIsGeneratingHero(true);
    setHeroGenerationError(null);

    try {
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(selectedImages.front as File);
      });

      const payload: any = {
        productImage: imageBase64,
        style: 'hero',
        productInfo: {
          productType: 'product',
          features: [],
          productName: 'product',
          materials: []
        },
        productSize: 'small'
      };

      if (useRefinement && heroRefinementPrompt.trim()) {
        payload.refinement = heroRefinementPrompt.trim();
      }

      const response = await fetch('/api/generate-ai-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate hand interaction mockup');
      }

      const data = await response.json();

      if (data.success && data.image) {
        if (generatedHeroImage) {
          setHeroGenerationHistory(prev => [
            { image: generatedHeroImage, prompt: heroRefinementPrompt || 'Initial' },
            ...prev
          ].slice(0, 5));
        }
        setGeneratedHeroImage(data.image);
        setHeroRefinementPrompt('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ Hand interaction generation failed:', error);
      setHeroGenerationError(error instanceof Error ? error.message : 'Failed to generate hand interaction mockup');
    } finally {
      setIsGeneratingHero(false);
    }
  };

  const handleCloseMacroModal = () => {
    setIsMacroModalOpen(false);
    setMacroModalImage(null);
  };

  const handleCloseFlatLayModal = () => {
    setIsFlatLayModalOpen(false);
    setFlatLayModalImage(null);
  };

  const handleCloseHeroModal = () => {
    setIsHeroModalOpen(false);
    setHeroModalImage(null);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">AI Mockup Generator</h2>
        <p className="text-gray-600">Generate professional AI-powered mockups of your product</p>
      </div>

      {/* AI Lifestyle Mockup Generation Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-1">AI Lifestyle Mockup</h3>
          <p className="text-sm text-gray-600">Generate realistic lifestyle photographs of your product</p>
        </div>

        {!generatedImage && (
          <button
            onClick={() => handleGenerateAIMockup(false)}
            disabled={!selectedImages.front || isGeneratingAI}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              !selectedImages.front || isGeneratingAI
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-md hover:shadow-lg'
            } flex items-center justify-center gap-2`}
          >
            {isGeneratingAI ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating AI Mockup...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate AI Lifestyle Mockup
              </>
            )}
          </button>
        )}

        {aiGenerationError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{aiGenerationError}</p>
          </div>
        )}

        {generatedImage && (
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-lg">AI Lifestyle Mockup</h4>
                <p className="text-xs text-purple-100">Realistic product photography</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadImage}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => {
                    setGeneratedImage(null);
                    setGenerationHistory([]);
                    setRefinementPrompt('');
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>

            <div className="p-4">
              <div
                onClick={() => handleImageClick(generatedImage)}
                className="relative bg-gray-50 rounded-lg overflow-hidden border border-gray-200 cursor-pointer group hover:border-purple-400 transition-colors"
              >
                <img
                  src={generatedImage}
                  alt="AI Generated Lifestyle Mockup"
                  className="w-full h-auto max-h-96 object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="bg-black/70 text-white px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Click to view full size</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="mb-3">
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  🎨 Refine the Image
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Describe how you want to improve the image
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  placeholder="e.g., Add warm sunset lighting, place on wooden desk..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && refinementPrompt.trim() && !isGeneratingAI) {
                      handleGenerateAIMockup(true);
                    }
                  }}
                  disabled={isGeneratingAI}
                />
                <button
                  onClick={() => handleGenerateAIMockup(true)}
                  disabled={!refinementPrompt.trim() || isGeneratingAI}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                    !refinementPrompt.trim() || isGeneratingAI
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Regenerate
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['Add warm indoor lighting', 'Place on marble surface', 'Add plants in background', 'Professional studio lighting'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setRefinementPrompt(suggestion)}
                    className="text-xs bg-white px-3 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional AI mockup sections would go here */}
      {/* For brevity, I'm showing placeholder sections for Macro, Flat Lay, and Hero */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-1">AI Product Close-Up</h3>
          <p className="text-sm text-gray-600">Generate professional product hero shots with optimal lighting</p>
        </div>

        {!generatedMacroImage && (
          <button
            onClick={() => handleGenerateMacroMockup(false)}
            disabled={!selectedImages.front || isGeneratingMacro}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              !selectedImages.front || isGeneratingMacro
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-md hover:shadow-lg'
            } flex items-center justify-center gap-2`}
          >
            {isGeneratingMacro ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Close-Up...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Product Close-Up
              </>
            )}
          </button>
        )}

        {macroGenerationError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{macroGenerationError}</p>
          </div>
        )}

        {generatedMacroImage && (
          <div className="mt-4">
            <img src={generatedMacroImage} alt="Product Close-Up" className="w-full rounded-lg" />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = generatedMacroImage;
                  link.download = `product-closeup-${Date.now()}.png`;
                  link.click();
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Download
              </button>
              <button
                onClick={() => {
                  setGeneratedMacroImage(null);
                  setMacroGenerationHistory([]);
                  setMacroRefinementPrompt('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-1">AI Top-Down Flat Lay</h3>
          <p className="text-sm text-gray-600">Generate sophisticated flat lay photography with workspace essentials</p>
        </div>

        {!generatedFlatLayImage && (
          <button
            onClick={() => handleGenerateFlatLayMockup(false)}
            disabled={!selectedImages.front || isGeneratingFlatLay}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              !selectedImages.front || isGeneratingFlatLay
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 shadow-md hover:shadow-lg'
            } flex items-center justify-center gap-2`}
          >
            {isGeneratingFlatLay ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Flat Lay...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Top-Down Flat Lay
              </>
            )}
          </button>
        )}

        {flatLayGenerationError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{flatLayGenerationError}</p>
          </div>
        )}

        {generatedFlatLayImage && (
          <div className="mt-4">
            <img src={generatedFlatLayImage} alt="Flat Lay Mockup" className="w-full rounded-lg" />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = generatedFlatLayImage;
                  link.download = `flat-lay-${Date.now()}.png`;
                  link.click();
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Download
              </button>
              <button
                onClick={() => {
                  setGeneratedFlatLayImage(null);
                  setFlatLayGenerationHistory([]);
                  setFlatLayRefinementPrompt('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-1">AI Hand Interaction Shot</h3>
          <p className="text-sm text-gray-600">Generate lifestyle photos showing hands naturally interacting with your product</p>
        </div>

        {!generatedHeroImage && (
          <button
            onClick={() => handleGenerateHeroMockup(false)}
            disabled={!selectedImages.front || isGeneratingHero}
            className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              !selectedImages.front || isGeneratingHero
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:from-pink-700 hover:to-purple-700 shadow-md hover:shadow-lg'
            } flex items-center justify-center gap-2`}
          >
            {isGeneratingHero ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Hand Interaction...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Hand Interaction
              </>
            )}
          </button>
        )}

        {heroGenerationError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{heroGenerationError}</p>
          </div>
        )}

        {generatedHeroImage && (
          <div className="mt-4">
            <img src={generatedHeroImage} alt="Hand Interaction Shot" className="w-full rounded-lg" />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = generatedHeroImage;
                  link.download = `hand-interaction-${Date.now()}.png`;
                  link.click();
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Download
              </button>
              <button
                onClick={() => {
                  setGeneratedHeroImage(null);
                  setHeroGenerationHistory([]);
                  setHeroRefinementPrompt('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full-size Modal */}
      {isModalOpen && modalImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-6xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full z-10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={modalImage}
              alt="Full size preview"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}