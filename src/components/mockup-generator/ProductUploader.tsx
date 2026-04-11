'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

export type ProductView = 'front' | 'rightSide' | 'leftSide' | 'rear';

export interface ProductImages {
  front: File | null;
  rightSide: File | null;
  leftSide: File | null;
  rear: File | null;
}

interface ProductUploaderProps {
  onImagesSelect: (images: ProductImages) => void;
  selectedImages: ProductImages;
}

export default function ProductUploader({ onImagesSelect, selectedImages }: ProductUploaderProps) {
  const [previews, setPreviews] = useState<Record<ProductView, string | null>>({
    front: null,
    rightSide: null,
    leftSide: null,
    rear: null
  });
  const [error, setError] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [productSearchResult, setProductSearchResult] = useState<any>(null);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);

  const handleDrop = useCallback(
    (view: ProductView) => (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        setError('Please upload a valid image file (JPG, PNG, WebP)');
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        console.log(`${view} view uploaded:`, {
          name: file.name,
          type: file.type,
          size: file.size
        });

        if (file.size > 10 * 1024 * 1024) {
          setError('File size must be less than 10MB');
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews(prev => ({ ...prev, [view]: e.target?.result as string }));
        };
        reader.readAsDataURL(file);

        onImagesSelect({ ...selectedImages, [view]: file });
      }
    },
    [selectedImages, onImagesSelect]
  );

  const handleRemove = (view: ProductView) => {
    setPreviews(prev => ({ ...prev, [view]: null }));
    setError(null);
    onImagesSelect({ ...selectedImages, [view]: null });
  };

  const handleSearchProductInfo = async () => {
    if (!productQuery.trim()) {
      setProductSearchError('Please enter a product description');
      return;
    }

    setIsSearchingProduct(true);
    setProductSearchError(null);
    setProductSearchResult(null);

    try {
      console.log('🔍 Searching for product:', productQuery);

      const searchResponse = await fetch('/api/search-product-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: productQuery })
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('❌ API error response:', errorText);
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      // Check if response is JSON
      const contentType = searchResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server');
      }

      let searchData;
      try {
        searchData = await searchResponse.json();
      } catch (jsonError) {
        console.error('❌ JSON parse error:', jsonError);
        throw new Error('Invalid response format from server');
      }

      console.log('✅ Product info found:', searchData);

      setProductSearchResult(searchData);

    } catch (error) {
      console.error('❌ Product search failed:', error);
      setProductSearchError(error instanceof Error ? error.message : 'Failed to search product info');
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const SingleViewUploader = ({ view, label, recommended }: { view: ProductView, label: string, recommended: string }) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: handleDrop(view),
      accept: {
        'image/*': ['.jpeg', '.jpg', '.png', '.webp']
      },
      maxFiles: 1,
      multiple: false
    });

    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">{label}</h3>
          {selectedImages[view] && (
            <button
              onClick={() => handleRemove(view)}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>

        {!previews[view] ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-xs text-gray-700 mb-1">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-gray-500">
              JPG, PNG, WebP (max 10MB)
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative aspect-square bg-white rounded-lg overflow-hidden border border-gray-200">
              <img
                src={previews[view]!}
                alt={`${view} view`}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <ImageIcon className="w-3 h-3" />
              <span className="truncate">{selectedImages[view]?.name}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Images</h2>
        <p className="text-sm text-gray-600">
          Upload your product from different angles to generate product images
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SingleViewUploader
          view="front"
          label="Front View"
          recommended="Required • Main photo"
        />
        <SingleViewUploader
          view="rightSide"
          label="Right Side"
          recommended="Optional • Facing right"
        />
        <SingleViewUploader
          view="leftSide"
          label="Left Side"
          recommended="Optional • Facing left"
        />
        <SingleViewUploader
          view="rear"
          label="Rear View"
          recommended="Optional • Back angle"
        />
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Upload the front view (required). Add optional right/left side and rear views for complete product angles.
        </p>
      </div>

      {/* Product Information Section */}
      <div className="mt-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">Product Description</h3>
          <p className="text-xs text-gray-600 mb-3">Enter product name to fetch and crawl product information</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="e.g., DELL Monitor - SE2225HM"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearchProductInfo();
              }
            }}
          />
          <button
            onClick={handleSearchProductInfo}
            disabled={!productQuery.trim() || isSearchingProduct}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              !productQuery.trim() || isSearchingProduct
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSearchingProduct ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Searching...
              </>
            ) : (
              'Search & Crawl'
            )}
          </button>
        </div>

        {productSearchError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{productSearchError}</p>
          </div>
        )}

        {productSearchResult && (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-white text-lg">{productSearchResult.productName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-blue-100 font-medium">{productSearchResult.brand}</span>
                    <span className="text-xs text-blue-200">•</span>
                    <span className="text-xs text-blue-100">{productSearchResult.category}</span>
                    {productSearchResult.modelNumber && (
                      <>
                        <span className="text-xs text-blue-200">•</span>
                        <span className="text-xs text-blue-100 font-mono">{productSearchResult.modelNumber}</span>
                      </>
                    )}
                  </div>
                  {productSearchResult.priceRange && (
                    <div className="mt-2">
                      <span className="text-sm font-bold text-green-300">{productSearchResult.priceRange}</span>
                    </div>
                  )}
                </div>
                {productSearchResult.productUrl && (
                  <a
                    href={productSearchResult.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white hover:text-blue-200 font-medium flex items-center gap-1"
                  >
                    View Source
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-6">
              {/* Product Overview */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-200">
                <h5 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-blue-600">📋</span>
                  Product Overview
                </h5>
                {productSearchResult.description && (
                  <p className="text-sm text-gray-700 leading-relaxed">{productSearchResult.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-3">
                  {productSearchResult.dimensions && (
                    <div className="text-xs bg-white px-3 py-1 rounded border border-gray-200 text-gray-700">
                      📐 {productSearchResult.dimensions}
                    </div>
                  )}
                  {productSearchResult.weight && (
                    <div className="text-xs bg-white px-3 py-1 rounded border border-gray-200 text-gray-700">
                      ⚖️ {productSearchResult.weight}
                    </div>
                  )}
                  {productSearchResult.warranty && (
                    <div className="text-xs bg-white px-3 py-1 rounded border border-gray-200 text-gray-700">
                      🛡️ {productSearchResult.warranty}
                    </div>
                  )}
                </div>
              </div>

              {/* Key Features */}
              {productSearchResult.features && productSearchResult.features.length > 0 && (
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-green-600">⭐</span>
                    Key Features
                    <span className="text-xs font-normal text-gray-500">({productSearchResult.features.length} features)</span>
                  </h5>
                  <div className="grid grid-cols-1 gap-2">
                    {productSearchResult.features.slice(0, 8).map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 p-2 bg-white rounded border border-gray-100">
                        <span className="text-green-600 mt-0.5 flex-shrink-0">✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Specifications Table */}
              {(productSearchResult.technicalSpecs || productSearchResult.specifications) && (
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">⚙️</span>
                    Technical Specifications
                  </h5>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                            Specification
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(productSearchResult.technicalSpecs || productSearchResult.specifications).map((spec: string, idx: number) => {
                          // Parse "Label: Value" format
                          const parts = spec.split(':');
                          const label = parts[0]?.trim() || 'Specification';
                          const value = parts.slice(1).join(':').trim() || spec;

                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900 font-medium border-b border-gray-200">
                                {label}
                              </td>
                              <td className="px-4 py-3 text-gray-700 border-b border-gray-200">
                                {value}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* What's in the Box */}
              {productSearchResult.inTheBox && productSearchResult.inTheBox.length > 0 && (
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-orange-600">📦</span>
                    What's in the Box
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {productSearchResult.inTheBox.map((item: string, idx: number) => (
                      <div key={idx} className="text-xs bg-orange-50 px-3 py-2 rounded border border-orange-200 text-orange-900">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}