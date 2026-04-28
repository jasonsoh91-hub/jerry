'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';

export interface ProductImages {
  front: File | null;
}

interface ProductUploaderProps {
  onImagesSelect: (images: ProductImages) => void;
  selectedImages: ProductImages;
}

export default function ProductUploader({ onImagesSelect, selectedImages }: ProductUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles, rejectedFiles) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        setError('Some files were rejected. Please upload valid image files.');
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        console.log('Front view uploaded:', {
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
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        onImagesSelect({ front: file });
      }
    }
  });

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onImagesSelect({ front: null });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Product Image</h2>
        <p className="text-sm text-gray-600">
          Upload your product front view to generate mockups
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Product preview"
            className="w-full h-64 object-cover rounded-lg border border-gray-200"
          />
          <button
            onClick={handleRemove}
            className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-base font-medium text-gray-700 mb-2">Drag & drop or click to upload</p>
          <p className="text-sm text-gray-500">JPG, PNG, WebP (max 10MB)</p>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Upload a high-quality front view of your product for best results.
        </p>
      </div>
    </div>
  );
}
