'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Frame } from 'lucide-react';

interface ProductAreaConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number; // Product scale multiplier (1.0 = 100%)
}

interface FrameUploaderProps {
  onImagesSelect: (files: File[]) => void;
  selectedImages: File[];
  onProductAreaChange?: (config: ProductAreaConfig | null) => void;
}

function ProductAreaOverlay({ config, width, height }: { config: ProductAreaConfig, width: number, height: number }) {
  const areaX = (config.x / 100) * width;
  const areaY = (config.y / 100) * height;
  const areaWidth = (config.width / 100) * width;
  const areaHeight = (config.height / 100) * height;

  return (
    <div
      className="absolute border-2 border-blue-500 bg-blue-400 bg-opacity-20 pointer-events-none"
      style={{
        left: `${areaX}px`,
        top: `${areaY}px`,
        width: `${areaWidth}px`,
        height: `${areaHeight}px`,
      }}
    >
      <div className="absolute -top-5 left-0 bg-blue-500 text-white text-xs px-1 rounded">
        Product Area
      </div>
    </div>
  );
}

export default function FrameUploader({ onImagesSelect, selectedImages, onProductAreaChange }: FrameUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCustomSettings, setShowCustomSettings] = useState(false);
  const [useManualSettings, setUseManualSettings] = useState(true); // Default to manual for better control
  const [productArea, setProductArea] = useState({
    x: 10,
    y: 15,
    width: 35,
    height: 70,
    scale: 1.0 // Default scale: 100%
  }); // Better default for left-side placement

  // Notify parent when product area changes
  useEffect(() => {
    if (onProductAreaChange) {
      onProductAreaChange(useManualSettings ? productArea : null);
    }
  }, [productArea, useManualSettings, onProductAreaChange]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        setError('Please upload valid image files (JPG, PNG, WebP)');
        return;
      }

      if (acceptedFiles.length > 0) {
        // Validate file sizes (max 10MB each)
        const oversizedFiles = acceptedFiles.filter(file => file.size > 10 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
          setError('All files must be less than 10MB');
          return;
        }

        // Create previews for all files
        const newPreviews: string[] = [];
        acceptedFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
            newPreviews.push(e.target?.result as string);
            if (newPreviews.length === acceptedFiles.length) {
              setPreviews(prev => [...prev, ...newPreviews]);
            }
          };
          reader.readAsDataURL(file);
        });

        onImagesSelect([...selectedImages, ...acceptedFiles]);
      }
    },
    [selectedImages, onImagesSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true
  });

  const handleRemove = (index: number) => {
    setPreviews(prev => prev.filter((_, i) => i !== index));
    onImagesSelect(selectedImages.filter((_, i) => i !== index));
  };

  const handleRemoveAll = () => {
    setPreviews([]);
    setError(null);
    onImagesSelect([]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Frame Templates</h2>
        <div className="flex items-center gap-3">
          {selectedImages.length > 0 && (
            <>
              <button
                onClick={() => {
                  setUseManualSettings(!useManualSettings);
                  setShowCustomSettings(!useManualSettings ? true : showCustomSettings);
                }}
                className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                  useManualSettings
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {useManualSettings ? '✓ Manual' : 'Auto'} Detect
              </button>
              {useManualSettings && (
                <button
                  onClick={() => setShowCustomSettings(!showCustomSettings)}
                  className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  {showCustomSettings ? 'Hide' : 'Show'} Settings
                </button>
              )}
              <button
                onClick={handleRemoveAll}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Remove All
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Custom Product Area Settings */}
      {useManualSettings && showCustomSettings && selectedImages.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3">📐 Product Area Settings</h3>
          <p className="text-sm text-blue-700 mb-4">
            Define where the product should be placed in your frames (in percentages)
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                X Position ({productArea.x}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={productArea.x}
                onChange={(e) => setProductArea({ ...productArea, x: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Y Position ({productArea.y}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={productArea.y}
                onChange={(e) => setProductArea({ ...productArea, y: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Width ({productArea.width}%)
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={productArea.width}
                onChange={(e) => setProductArea({ ...productArea, width: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Height ({productArea.height}%)
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={productArea.height}
                onChange={(e) => setProductArea({ ...productArea, height: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Product Scale ({Math.round(productArea.scale * 100)}%)
              </label>
              <input
                type="range"
                min="50"
                max="200"
                value={productArea.scale * 100}
                onChange={(e) => setProductArea({ ...productArea, scale: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-3 p-3 bg-blue-100 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Preview:</strong> Product will be placed at X:{productArea.x}%, Y:{productArea.y}%
              with size {productArea.width}% × {productArea.height}% of the frame
              and scaled to {Math.round(productArea.scale * 100)}%
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setProductArea({ x: 10, y: 15, width: 35, height: 70, scale: 1.0 })}
              className="text-xs px-2 py-1 bg-white text-blue-700 rounded hover:bg-blue-50"
            >
              Left Side
            </button>
            <button
              onClick={() => setProductArea({ x: 30, y: 20, width: 40, height: 60, scale: 1.0 })}
              className="text-xs px-2 py-1 bg-white text-blue-700 rounded hover:bg-blue-50"
            >
              Center
            </button>
            <button
              onClick={() => setProductArea({ x: 55, y: 15, width: 35, height: 70, scale: 1.0 })}
              className="text-xs px-2 py-1 bg-white text-blue-700 rounded hover:bg-blue-50"
            >
              Right Side
            </button>
            <button
              onClick={() => setProductArea({ x: 5, y: 10, width: 45, height: 80, scale: 1.0 })}
              className="text-xs px-2 py-1 bg-white text-blue-700 rounded hover:bg-blue-50"
            >
              Full Left
            </button>
          </div>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Frame className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        {isDragActive ? (
          <p className="text-gray-700">Drop your frame templates here...</p>
        ) : (
          <div>
            <p className="text-gray-700 mb-1">
              Drag & drop frame templates here
            </p>
            <p className="text-sm text-gray-500">
              Supports JPG, PNG, WebP (max 10MB each, multiple files)
            </p>
          </div>
        )}
      </div>

      {/* Detection Mode Indicator */}
      {selectedImages.length > 0 && !useManualSettings && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700">
            🤖 <strong>Automatic Detection:</strong> System will automatically detect the best product placement area in your frames.
            <button
              onClick={() => setUseManualSettings(true)}
              className="ml-2 text-blue-600 hover:text-blue-700 underline"
            >
              Switch to Manual
            </button>
          </p>
        </div>
      )}

      {previews.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                <img
                  src={preview}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {useManualSettings && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-400 bg-opacity-20 pointer-events-none"
                    style={{
                      left: `${productArea.x}%`,
                      top: `${productArea.y}%`,
                      width: `${productArea.width}%`,
                      height: `${productArea.height}%`,
                    }}
                  >
                    <div className="absolute -top-5 left-0 bg-blue-500 text-white text-xs px-1 rounded whitespace-nowrap">
                      Product Area
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleRemove(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate z-10">
                {selectedImages[index]?.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}