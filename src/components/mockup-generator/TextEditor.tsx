'use client';

import { useState, useRef, useEffect } from 'react';
import { Type, Plus, Trash2, Bold, Italic, Underline, Move } from 'lucide-react';

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: string;
}

interface TextEditorProps {
  canvas: HTMLCanvasElement;
  onTextUpdate: (texts: TextElement[]) => void;
  initialTexts?: TextElement[];
  selectedTextId?: string | null;
  onTextSelect?: (id: string | null) => void;
}

export default function TextEditor({ canvas, onTextUpdate, initialTexts = [], selectedTextId: externalSelectedId, onTextSelect }: TextEditorProps) {
  const [texts, setTexts] = useState<TextElement[]>(initialTexts);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Use external selected ID if provided, otherwise use internal state
  const selectedTextId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const setSelectedTextId = (id: string | null) => {
    if (onTextSelect) {
      onTextSelect(id);
    } else {
      setInternalSelectedId(id);
    }
  };

  // Sync with external text updates (from canvas dragging)
  useEffect(() => {
    setTexts([...initialTexts]);
  }, [initialTexts]);

  const fonts = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Impact',
    'Comic Sans MS'
  ];

  const colors = [
    '#000000', // Black
    '#1F2937', // Dark gray
    '#374151', // Medium gray
    '#6B7280', // Light gray
    '#DC2626', // Red
    '#059669', // Green
    '#2563EB', // Blue
    '#D97706', // Orange
    '#7C3AED', // Purple
    '#FFFFFF'  // White
  ];

  const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 60];

  const selectedText = texts.find(t => t.id === selectedTextId);

  // Add new text element
  const addText = () => {
    const newText: TextElement = {
      id: `text-${Date.now()}`,
      text: 'New Text',
      x: canvas.width / 2,
      y: canvas.height / 2,
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#1F2937', // Dark gray color (better visibility)
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'center'
    };

    const newTexts = [...texts, newText];
    setTexts(newTexts);
    setSelectedTextId(newText.id);
    onTextUpdate(newTexts);
  };

  // Update text element
  const updateText = (id: string, updates: Partial<TextElement>) => {
    const newTexts = texts.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    setTexts(newTexts);
    onTextUpdate(newTexts);
  };

  // Delete text element
  const deleteText = (id: string) => {
    const newTexts = texts.filter(t => t.id !== id);
    setTexts(newTexts);
    if (selectedTextId === id) {
      setSelectedTextId(null);
    }
    onTextUpdate(newTexts);
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent, text: TextElement) => {
    e.preventDefault();
    setSelectedTextId(text.id);
    setIsDragging(true);

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - text.x,
        y: e.clientY - rect.top - text.y
      });
    }
  };

  // Handle drag move
  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging || !selectedTextId || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      updateText(selectedTextId, { x, y });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, selectedTextId, dragOffset]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Text Editor</h2>
        <p className="text-sm text-gray-600">
          Add and customize text on your image
        </p>
      </div>

      {/* Add Text Button */}
      <button
        onClick={addText}
        className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Add Text
      </button>

      {/* Text List */}
      {texts.length > 0 && (
        <div className="space-y-3 mb-4">
          <h3 className="font-medium text-gray-900">Text Elements</h3>
          {texts.map((text) => (
            <div
              key={text.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedTextId === text.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => setSelectedTextId(text.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Type className="w-4 h-4 text-gray-700 flex-shrink-0" />
                  <span className="truncate text-sm text-gray-900 font-medium">{text.text}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteText(text.id);
                  }}
                  className="text-red-600 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Text Properties */}
      {selectedText && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900">Text Properties</h3>

          {/* Text Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Text Content
            </label>
            <input
              type="text"
              value={selectedText.text}
              onChange={(e) => updateText(selectedText.id, { text: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
            />
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Font Family
            </label>
            <select
              value={selectedText.fontFamily}
              onChange={(e) => updateText(selectedText.id, { fontFamily: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 bg-white"
            >
              {fonts.map(font => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Font Size: {selectedText.fontSize}px
            </label>
            <div className="flex flex-wrap gap-2">
              {fontSizes.map(size => (
                <button
                  key={size}
                  onClick={() => updateText(selectedText.id, { fontSize: size })}
                  className={`px-3 py-1 rounded border transition-colors ${
                    selectedText.fontSize === size
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => updateText(selectedText.id, { color })}
                  className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center text-xs font-medium ${
                    selectedText.color === color
                      ? 'border-blue-600 scale-110'
                      : 'border-gray-400 hover:border-gray-600'
                  }`}
                  style={{
                    backgroundColor: color === '#FFFFFF' ? '#f9fafb' : color,
                    color: color === '#FFFFFF' || color === '#FFFF00' || color === '#00FFFF' ? '#000000' : '#FFFFFF'
                  }}
                  title={color}
                >
                  {selectedText.color === color ? '✓' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Text Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Style
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateText(selectedText.id, {
                  fontWeight: selectedText.fontWeight === 'bold' ? 'normal' : 'bold'
                })}
                className={`px-3 py-2 rounded border transition-colors ${
                  selectedText.fontWeight === 'bold'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'
                }`}
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateText(selectedText.id, {
                  fontStyle: selectedText.fontStyle === 'italic' ? 'normal' : 'italic'
                })}
                className={`px-3 py-2 rounded border transition-colors ${
                  selectedText.fontStyle === 'italic'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'
                }`}
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateText(selectedText.id, {
                  textDecoration: selectedText.textDecoration === 'underline' ? 'none' : 'underline'
                })}
                className={`px-3 py-2 rounded border transition-colors ${
                  selectedText.textDecoration === 'underline'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'
                }`}
              >
                <Underline className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Position Info */}
          <div className="text-sm text-gray-900 bg-white p-3 rounded border border-gray-200">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-gray-700" />
              <span className="font-medium">
                Position: X: {Math.round(selectedText.x)}, Y: {Math.round(selectedText.y)}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Drag text on the preview to reposition
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Click "Add Text" to create text elements.
          Click anywhere on the image to add text directly.
          Double-click existing text to edit it inline.
          Drag text to reposition. Select text to customize font, size, color, and style.
        </p>
      </div>
    </div>
  );
}
