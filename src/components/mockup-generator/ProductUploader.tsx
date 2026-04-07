'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

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
    </div>
  );
}