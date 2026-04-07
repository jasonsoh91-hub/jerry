'use client';

import type { GeneratedMockup } from '@/lib/types';
import MockupCard from './MockupCard';

interface MockupPreviewProps {
  mockups: GeneratedMockup[];
}

export default function MockupPreview({ mockups }: MockupPreviewProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Product Images</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockups.map((mockup) => (
          <MockupCard key={mockup.id} mockup={mockup} />
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Success!</strong> Generated {mockups.length} product variations.
          Choose your preferred export format (1:1 or 3:4) and click download to save each image.
        </p>
      </div>
    </div>
  );
}