'use client';

import { useState } from 'react';
import { Search, Loader2, Check, Edit2 } from 'lucide-react';

interface ProductInfo {
  model: string;
  briefName: string;
  size: string;
  resolution: string;
  refreshRate: string;
  ports: string;
  warranty: string;
}

export default function ProductInfoExtractor({ onInfoExtracted }: { onInfoExtracted: (info: ProductInfo) => void }) {
  const [productName, setProductName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productInfo, setProductInfo] = useState<ProductInfo>({
    model: '',
    briefName: '',
    size: '',
    resolution: '',
    refreshRate: '',
    ports: '',
    warranty: ''
  });

  // Extract model from product name (alphanumeric code)
  const extractModel = (name: string): string => {
    // Look for alphanumeric patterns that look like model numbers
    const modelPattern = /([A-Z0-9]{4,})/i;
    const match = name.match(modelPattern);
    return match ? match[1] : '';
  };

  const handleSearch = async () => {
    console.log('🔴 Search button clicked! Product name:', productName);

    if (!productName.trim()) {
      setError('Please enter a product name');
      return;
    }

    console.log('🟢 Starting search process...');
    setIsSearching(true);
    setError(null);
    setSearchComplete(false);

    try {
      // Extract model from product name
      const extractedModel = extractModel(productName);
      console.log('🔍 Starting web search for:', productName, 'Model:', extractedModel);
      console.log('📡 Calling API: /api/search-product-info');

      // Call the product search API (web crawling)
      const response = await fetch('/api/search-product-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: productName,
          model: extractedModel
        })
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();

      console.log('📦 API Response:', data);
      console.log('📦 Has productInfo?', !!data.productInfo);

      if (data.success && data.productInfo) {
        const info = data.productInfo;

        console.log('✅ Processing productInfo:', info);

        // Update product info with crawled data
        const updatedInfo: ProductInfo = {
          model: info.model || extractedModel || '',
          briefName: info.briefName || generateBriefName(productName, extractedModel),
          size: info.size || '',
          resolution: info.resolution || '',
          refreshRate: info.refreshRate || '',
          ports: info.ports || '',
          warranty: info.warranty || ''
        };

        console.log('✅ Final product info:', updatedInfo);
        setProductInfo(updatedInfo);
        setSearchComplete(true);
        onInfoExtracted(updatedInfo);
      } else {
        // Fallback to basic extraction if search doesn't return results
        const fallbackInfo: ProductInfo = {
          model: extractedModel || '',
          briefName: generateBriefName(productName, extractedModel),
          size: '',
          resolution: '',
          refreshRate: '',
          ports: '',
          warranty: ''
        };

        setProductInfo(fallbackInfo);
        setSearchComplete(true);
        onInfoExtracted(fallbackInfo);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to search for product information. Please try again.');

      // Still provide basic extraction on error
      const extractedModel = extractModel(productName);
      const fallbackInfo: ProductInfo = {
        model: extractedModel,
        briefName: generateBriefName(productName, extractedModel),
        size: '',
        resolution: '',
        refreshRate: '',
        ports: '',
        warranty: ''
      };

      setProductInfo(fallbackInfo);
      setSearchComplete(true);
      onInfoExtracted(fallbackInfo);
    } finally {
      setIsSearching(false);
    }
  };

  const generateBriefName = (name: string, model: string): string => {
    // Generate a brief name from product name
    const words = name.replace(model, '').trim().split(/\s+/);
    const brand = words[0] || '';
    const type = words.slice(1).join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();

    return `${brand} ${type} ${model}`.trim();
  };

  const updateField = (field: keyof ProductInfo, value: string) => {
    const updated = { ...productInfo, [field]: value };
    setProductInfo(updated);
    onInfoExtracted(updated);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Information</h2>
        <p className="text-sm text-gray-600">
          Enter product name to automatically fetch specifications from the web
        </p>
      </div>

      {/* Product Name Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product Name *
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g., DELL Monitor - SE2225HM"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !productName.trim()}
            className={`px-6 py-2 rounded-lg font-medium text-white transition-all flex items-center gap-2 ${
              isSearching || !productName.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : searchComplete ? (
              <>
                <Check className="w-4 h-4" />
                Searched
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Product Information Fields */}
      {searchComplete && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            <Edit2 className="w-4 h-4" />
            <span>All fields are editable - modify as needed</span>
          </div>

          {/* 1. Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              1. Model <span className="text-xs text-gray-500">(extracted from product name)</span>
            </label>
            <input
              type="text"
              value={productInfo.model}
              onChange={(e) => updateField('model', e.target.value)}
              placeholder="e.g., SE2225HM"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* 2. Brief Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              2. Brief Naming <span className="text-xs text-gray-500">(short product description)</span>
            </label>
            <input
              type="text"
              value={productInfo.briefName}
              onChange={(e) => updateField('briefName', e.target.value)}
              placeholder="e.g., DELL SE SERIES LED MONITOR"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* 3. Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              3. Size <span className="text-xs text-gray-500">(screen size)</span>
            </label>
            <input
              type="text"
              value={productInfo.size}
              onChange={(e) => updateField('size', e.target.value)}
              placeholder="e.g., 23.8 Inch"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* 4. Resolution */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              4. Resolution <span className="text-xs text-gray-500">(display resolution)</span>
            </label>
            <input
              type="text"
              value={productInfo.resolution}
              onChange={(e) => updateField('resolution', e.target.value)}
              placeholder="e.g., 1920 x 1080 (Full HD)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* 5. Refresh Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              5. Refresh Rate <span className="text-xs text-gray-500">(Hz)</span>
            </label>
            <input
              type="text"
              value={productInfo.refreshRate}
              onChange={(e) => updateField('refreshRate', e.target.value)}
              placeholder="e.g., 75Hz"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* 6. Compatible Ports */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              6. Compatible Ports <span className="text-xs text-gray-500">(connection types)</span>
            </label>
            <input
              type="text"
              value={productInfo.ports}
              onChange={(e) => updateField('ports', e.target.value)}
              placeholder="e.g., HDMI, DisplayPort, VGA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* 7. Warranty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              7. Warranty <span className="text-xs text-gray-500">(warranty period)</span>
            </label>
            <input
              type="text"
              value={productInfo.warranty}
              onChange={(e) => updateField('warranty', e.target.value)}
              placeholder="e.g., 3 Years"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>
      )}

      {!searchComplete && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> Enter a product name (like "DELL Monitor - SE2225HM") and click Search to automatically fetch product specifications from the web.
          </p>
        </div>
      )}
    </div>
  );
}
