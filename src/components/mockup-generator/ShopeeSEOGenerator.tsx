'use client';

import { useState } from 'react';
import { Loader2, Wand2, Download, Copy, Check } from 'lucide-react';
import type { ProductImages } from './ProductUploader';

interface ShopeeSEOGeneratorProps {
  selectedImages?: ProductImages;
}

interface SEOContent {
  keywordResearch: {
    highIntentKeywords: string[];
    longTailKeywords: string[];
    hashtags: string[];
  };
  productTitle: string;
  productDescription: string;
  productDescriptionTable: string;
  imageTextSuggestions: string[];
  searchTags: string;
  conversionBoosters: {
    promotionalAngle: string;
    bundleIdeas: string[];
    voucherStrategy: string;
    reviewStrategy: string;
  };
}

export default function ShopeeSEOGenerator({ selectedImages }: ShopeeSEOGeneratorProps) {
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [keyFeatures, setKeyFeatures] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [uniqueSellingPoint, setUniqueSellingPoint] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<SEOContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [descriptionTab, setDescriptionTab] = useState<'text' | 'table'>('text');

  const handleGenerate = async () => {
    if (!productName.trim()) {
      setError('Please enter a product name');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const payload = {
        productName,
        brand,
        category,
        keyFeatures: keyFeatures.split('\n').filter(f => f.trim()),
        targetAudience,
        priceRange,
        uniqueSellingPoint
      };

      console.log('📤 Sending request to API...');
      const response = await fetch('/api/generate-shopee-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to generate SEO content');
      }

      console.log('✅ Response received, parsing JSON...');
      const data = await response.json();
      console.log('✅ API Response:', data);

      if (data.success && data.content) {
        setGeneratedContent(data.content);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('SEO generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate SEO content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, section: string) => {
    let textToCopy = text;

    // If copying description and table format is selected, copy the table HTML
    if (section === 'description' && descriptionTab === 'table' && generatedContent) {
      textToCopy = generatedContent.productDescriptionTable;
    }

    navigator.clipboard.writeText(textToCopy);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyAll = () => {
    if (!generatedContent) return;

    const fullContent = `
# SHOPEE SEO LISTING

## KEYWORD RESEARCH
### High-Intent Keywords:
${generatedContent.keywordResearch.highIntentKeywords.map(k => `- ${k}`).join('\n')}

### Long-Tail Keywords:
${generatedContent.keywordResearch.longTailKeywords.map(k => `- ${k}`).join('\n')}

### Hashtags:
${generatedContent.keywordResearch.hashtags.map(h => `#${h}`).join(' ')}

## PRODUCT TITLE
${generatedContent.productTitle}

## PRODUCT DESCRIPTION (TEXT FORMAT)
${generatedContent.productDescription}

## PRODUCT DESCRIPTION (TABLE FORMAT)
${generatedContent.productDescriptionTable.replace(/<[^>]*>/g, '')}

## IMAGE TEXT SUGGESTIONS
${generatedContent.imageTextSuggestions.map((img, i) => `Image ${i + 1}: ${img}`).join('\n')}

## SEARCH TAGS
${generatedContent.searchTags}

## CONVERSION BOOSTERS
Promotional Angle: ${generatedContent.conversionBoosters.promotionalAngle}

Bundle Ideas:
${generatedContent.conversionBoosters.bundleIdeas.map(idea => `- ${idea}`).join('\n')}

Voucher Strategy: ${generatedContent.conversionBoosters.voucherStrategy}

Review Strategy: ${generatedContent.conversionBoosters.reviewStrategy}
    `;

    navigator.clipboard.writeText(fullContent.trim());
    setCopiedSection('all');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🛒</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Shopee SEO Generator</h2>
            <p className="text-orange-100 mt-1">Create high-converting Shopee listings with AI-powered SEO optimization</p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Product Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Dell 24-inch Monitor SE2225HM"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g., Dell"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Computer & Accessories / Monitors"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
            <input
              type="text"
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              placeholder="e.g., RM 300-500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Key Features (one per line)</label>
          <textarea
            value={keyFeatures}
            onChange={(e) => setKeyFeatures(e.target.value)}
            placeholder="24-inch Full HD display&#10;75Hz refresh rate&#10;AMD FreeSync support&#10;Eye care technology"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g., Home office users, students, budget-conscious buyers"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Unique Selling Point</label>
          <textarea
            value={uniqueSellingPoint}
            onChange={(e) => setUniqueSellingPoint(e.target.value)}
            placeholder="e.g., Best value monitor in its class with premium features at budget price"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
          />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!productName.trim() || isGenerating}
          className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
            !productName.trim() || isGenerating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600 shadow-md hover:shadow-lg'
          } flex items-center justify-center gap-2`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating SEO Content...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Shopee SEO Listing
            </>
          )}
        </button>
      </div>

      {/* Generated Content */}
      {generatedContent && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">🎯 Generated Shopee SEO Content</h3>
              <p className="text-xs text-orange-100 mt-1">Optimized for high ranking and conversion</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyAll}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
              >
                {copiedSection === 'all' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy All
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setGeneratedContent(null);
                  setCopiedSection(null);
                }}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* 1. Keyword Research */}
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">1. 🔍 Keyword Research</h4>
                <button
                  onClick={() => handleCopy(
                    `High-Intent Keywords:\n${generatedContent.keywordResearch.highIntentKeywords.join('\n')}\n\nLong-Tail Keywords:\n${generatedContent.keywordResearch.longTailKeywords.join('\n')}\n\nHashtags:\n${generatedContent.keywordResearch.hashtags.join(' ')}`,
                    'keywords'
                  )}
                  className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1"
                >
                  {copiedSection === 'keywords' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSection === 'keywords' ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">High-Intent Keywords</h5>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {generatedContent.keywordResearch.highIntentKeywords.map((keyword, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">•</span>
                        <span>{keyword}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">Long-Tail Keywords</h5>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {generatedContent.keywordResearch.longTailKeywords.map((keyword, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">•</span>
                        <span>{keyword}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">Hashtags</h5>
                  <div className="flex flex-wrap gap-2">
                    {generatedContent.keywordResearch.hashtags.map((tag, i) => (
                      <span key={i} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Product Title */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">2. 📝 SEO Optimized Product Title</h4>
                <button
                  onClick={() => handleCopy(generatedContent.productTitle, 'title')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  {copiedSection === 'title' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSection === 'title' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-300">
                <p className="text-gray-900 font-medium">{generatedContent.productTitle}</p>
                <p className="text-xs text-gray-500 mt-2">{generatedContent.productTitle.length} characters</p>
              </div>
            </div>

            {/* 3. Product Description */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">3. 📄 Product Description</h4>
                <button
                  onClick={() => handleCopy(descriptionTab === 'text' ? generatedContent.productDescription : generatedContent.productDescriptionTable, 'description')}
                  className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1"
                >
                  {copiedSection === 'description' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSection === 'description' ? 'Copied!' : `Copy ${descriptionTab === 'text' ? 'Text' : 'Table'}`}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border border-green-300 rounded-lg mb-3 overflow-hidden">
                <button
                  onClick={() => setDescriptionTab('text')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    descriptionTab === 'text'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Text Format
                </button>
                <button
                  onClick={() => setDescriptionTab('table')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    descriptionTab === 'table'
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Table Format
                </button>
              </div>

              <div className="bg-white rounded-lg p-4 border border-green-300">
                {descriptionTab === 'text' ? (
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
                    {generatedContent.productDescription}
                  </div>
                ) : (
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: generatedContent.productDescriptionTable }}
                  />
                )}
              </div>
            </div>

            {/* 4. Image Text Suggestions */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">4. 🖼️ Image Text Suggestions</h4>
                <button
                  onClick={() => handleCopy(generatedContent.imageTextSuggestions.join('\n\n'), 'images')}
                  className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                >
                  {copiedSection === 'images' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSection === 'images' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="space-y-2">
                {generatedContent.imageTextSuggestions.map((suggestion, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border border-purple-300">
                    <p className="text-sm text-gray-700"><span className="font-semibold">Image {i + 1}:</span> {suggestion}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Search Tags */}
            <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">5. 🏷️ Search Tags</h4>
                <button
                  onClick={() => handleCopy(generatedContent.searchTags, 'tags')}
                  className="text-pink-600 hover:text-pink-700 text-sm font-medium flex items-center gap-1"
                >
                  {copiedSection === 'tags' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSection === 'tags' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 border border-pink-300">
                <p className="text-sm text-gray-700">{generatedContent.searchTags}</p>
              </div>
            </div>

            {/* 6. Conversion Boosters */}
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">6. 🚀 Conversion Boosters</h4>
                <button
                  onClick={() => handleCopy(
                    `Promotional Angle: ${generatedContent.conversionBoosters.promotionalAngle}\n\nBundle Ideas:\n${generatedContent.conversionBoosters.bundleIdeas.join('\n')}\n\nVoucher Strategy: ${generatedContent.conversionBoosters.voucherStrategy}\n\nReview Strategy: ${generatedContent.conversionBoosters.reviewStrategy}`,
                    'boosters'
                  )}
                  className="text-yellow-600 hover:text-yellow-700 text-sm font-medium flex items-center gap-1"
                >
                  {copiedSection === 'boosters' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSection === 'boosters' ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 border border-yellow-300">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">💰 Promotional Angle</h5>
                  <p className="text-sm text-gray-700">{generatedContent.conversionBoosters.promotionalAngle}</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-yellow-300">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">🎁 Bundle Ideas</h5>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {generatedContent.conversionBoosters.bundleIdeas.map((idea, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-3 border border-yellow-300">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">🎫 Voucher Strategy</h5>
                  <p className="text-sm text-gray-700">{generatedContent.conversionBoosters.voucherStrategy}</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-yellow-300">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">⭐ Review Strategy</h5>
                  <p className="text-sm text-gray-700">{generatedContent.conversionBoosters.reviewStrategy}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}