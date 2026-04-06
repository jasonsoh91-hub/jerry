'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import type { GeneratedMockup } from '@/lib/types';

interface MockupCardProps {
  mockup: GeneratedMockup;
}

export default function MockupCard({ mockup }: MockupCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        mockup.canvas.toBlob(resolve, 'image/png', 0.95);
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${mockup.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="relative aspect-[4/3] bg-gray-100">
        <img
          src={mockup.canvas.toDataURL()}
          alt={mockup.name}
          className="w-full h-full object-contain"
        />
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{mockup.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{mockup.description}</p>

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isDownloading
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Download className="w-4 h-4" />
          {isDownloading ? 'Downloading...' : 'Download PNG'}
        </button>
      </div>
    </div>
  );
}