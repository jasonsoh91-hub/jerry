'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Loader2, Wand2, Download, RefreshCw } from 'lucide-react';

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

interface SingleViewUploaderProps {
  view: ProductView;
  label: string;
  recommended: string;
  onDrop: (view: ProductView) => (acceptedFiles: File[], rejectedFiles: any[]) => void;
  onRemove: (view: ProductView) => void;
  preview: string | null;
}

function SingleViewUploader({ view, label, recommended, onDrop, onRemove, preview }: SingleViewUploaderProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: onDrop(view)
  });

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{label}</h3>
        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">{recommended}</span>
      </div>

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt={`${label} preview`}
            className="w-full h-32 object-cover rounded-lg border border-gray-200"
          />
          <button
            onClick={() => onRemove(view)}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-xs text-gray-700 mb-1">Drag & drop or click to upload</p>
          <p className="text-xs text-gray-500">JPG, PNG, WebP (max 10MB)</p>
        </div>
      )}
    </div>
  );
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
        setError('Some files were rejected. Please upload valid image files.');
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
          onDrop={handleDrop}
          onRemove={handleRemove}
          preview={previews.front}
        />
        <SingleViewUploader
          view="rightSide"
          label="Right Side"
          recommended="Optional • Facing right"
          onDrop={handleDrop}
          onRemove={handleRemove}
          preview={previews.rightSide}
        />
        <SingleViewUploader
          view="leftSide"
          label="Left Side"
          recommended="Optional • Facing left"
          onDrop={handleDrop}
          onRemove={handleRemove}
          preview={previews.leftSide}
        />
        <SingleViewUploader
          view="rear"
          label="Rear View"
          recommended="Optional • Back angle"
          onDrop={handleDrop}
          onRemove={handleRemove}
          preview={previews.rear}
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
