'use client';

import { Wand2 } from 'lucide-react';

interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  isGenerating: boolean;
  progress: number;
}

export default function GenerateButton({
  onClick,
  disabled,
  isGenerating,
  progress
}: GenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden px-8 py-4 rounded-xl font-semibold text-white transition-all ${
        disabled
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
      }`}
    >
      {isGenerating && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="relative flex items-center gap-3">
        <Wand2 className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
        <span>
          {isGenerating ? `Generating... ${Math.round(progress)}%` : 'Generate 5 Product Images'}
        </span>
      </div>
    </button>
  );
}