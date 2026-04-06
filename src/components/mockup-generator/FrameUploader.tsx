'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Frame } from 'lucide-react';

interface FrameUploaderProps {
  onImagesSelect: (files: File[]) => void;
  selectedImages: File[];
}

export default function FrameUploader({ onImagesSelect, selectedImages }: FrameUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        {selectedImages.length > 0 && (
          <button
            onClick={handleRemoveAll}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Remove All
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
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

      {previews.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={preview}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => handleRemove(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                {selectedImages[index]?.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}