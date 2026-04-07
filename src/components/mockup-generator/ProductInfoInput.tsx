'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Check, X } from 'lucide-react';

export interface ProductInfo {
  name: string;
  brand: string;
  model: string;
  description: string;
  specifications: string[];
  keyFeatures: string[];
}

interface ProductInfoInputProps {
  onProductInfoUpdate: (info: ProductInfo | null) => void;
}

export default function ProductInfoInput({ onProductInfoUpdate }: ProductInfoInputProps) {
  const [productQuery, setProductQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const searchProduct = async (query: string) => {
    if (!query.trim()) {
      setProductInfo(null);
      onProductInfoUpdate(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Use WebSearch to find product information
      const searchQuery = `${query} specifications official site product details`;
      console.log('🔍 Searching for:', searchQuery);

      // This will trigger the WebSearch tool
      const response = await fetch('/api/search-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      // Parse search results into ProductInfo
      const info: ProductInfo = {
        name: data.name || query,
        brand: data.brand || 'Unknown Brand',
        model: data.model || '',
        description: data.description || '',
        specifications: data.specifications || [],
        keyFeatures: data.keyFeatures || []
      };

      setProductInfo(info);
      onProductInfoUpdate(info);
      console.log('✅ Product info found:', info);

    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchError('Failed to fetch product information. Please try again.');
      setProductInfo(null);
      onProductInfoUpdate(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProductQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    if (value.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchProduct(value);
      }, 800); // 800ms debounce
    } else if (value.length === 0) {
      setProductInfo(null);
      onProductInfoUpdate(null);
    }
  };

  // Clear search
  const handleClear = () => {
    setProductQuery('');
    setProductInfo(null);
    onProductInfoUpdate(null);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Information</h2>
        <p className="text-sm text-gray-600">
          Enter product name to auto-fetch specifications and descriptions
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={productQuery}
            onChange={handleInputChange}
            placeholder="e.g., Dell UltraSharp 24 Monitor U2424H"
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {productQuery && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Searching indicator */}
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 -translate-y-8">
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {searchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{searchError}</p>
        </div>
      )}

      {/* Product Info Preview */}
      {productInfo && !isSearching && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-900 mb-1">
                Product information found!
              </p>
              <p className="text-sm text-green-700 truncate">
                {productInfo.name}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Brand: {productInfo.brand}
                {productInfo.model && ` • Model: ${productInfo.model}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Enter the product name and model (e.g., "Dell UltraSharp 24 Monitor U2424H").
          The system will search for official product information and automatically add it to your mockups.
        </p>
      </div>
    </div>
  );
}
