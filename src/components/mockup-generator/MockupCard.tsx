'use client';

import { Download, ChevronDown, Type } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { GeneratedMockup } from '@/lib/types';
import TextEditor, { TextElement } from './TextEditor';
import { recompositeProduct, generateMockups } from '@/lib/mockupGenerator';
import { analyzeFrame } from '@/lib/imageProcessing';
import type { FrameAnalysis } from '@/lib/types';

type ExportFormat = '1:1' | '3:4';

interface MockupCardProps {
  mockup: GeneratedMockup;
}

export default function MockupCard({ mockup }: MockupCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('1:1');
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState('');
  const [inlineEditPosition, setInlineEditPosition] = useState<{x: number, y: number} | null>(null);

  // Product controls for first mockup
  // Default position: X: 229px, Y: 310px (will be converted to normalized based on frame size)
  // Default scale: 400% (4.0x)
  const [productPosition, setProductPosition] = useState<{x: number, y: number} | null>(null);
  const [productScale, setProductScale] = useState<number>(4.0);
  const [showProductControls, setShowProductControls] = useState(false);
  const [isDraggingProduct, setIsDraggingProduct] = useState(false);
  const [isRecompositing, setIsRecompositing] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{clientX: number, clientY: number, textX: number, textY: number} | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const productDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    productX: number;
    productY: number;
    canvasWidth: number;
    canvasHeight: number;
  } | null>(null);
  const frameAnalysisRef = useRef<FrameAnalysis | null>(null);

  // Check if this is the first mockup (with frame) - only this one has product controls
  const isFirstMockup = mockup.id === 'mockup-1';

  // Extract frame analysis for recompositing and set initial product position
  useEffect(() => {
    if (isFirstMockup && mockup.originalFrame && mockup.originalProduct) {
      // Analyze frame to get safe zone info
      analyzeFrame(mockup.originalFrame, null).then(analysis => {
        frameAnalysisRef.current = analysis;

        // Set initial product position to requested defaults: X: 229px, Y: 310px
        // Convert pixel values to normalized coordinates (0-1)
        if (mockup.originalFrame) {
          const initialX = 229 / mockup.originalFrame.width;
          const initialY = 310 / mockup.originalFrame.height;

          // Only set if not already set by user
          if (productPosition === null) {
            setProductPosition({ x: initialX, y: initialY });
            console.log('🎯 Set initial product position:', {
              pixels: { x: 229, y: 310 },
              normalized: { x: initialX.toFixed(4), y: initialY.toFixed(4) },
              frameSize: { width: mockup.originalFrame.width, height: mockup.originalFrame.height }
            });
          }
        }
      });

      // Initialize model text as an editable text element if product info exists
      // Only add if we haven't added it yet (check by id)
      // DISABLED: Using fixed overlay instead of editable text
      // if (mockup.config?.productInfo?.model && !textElements.find(t => t.id === 'model-text')) {
      //   const modelText: TextElement = {
      //     id: 'model-text',
      //     text: mockup.config.productInfo.model,
      //     x: 120, // Initial X position
      //     y: 80,  // Initial Y position
      //     fontSize: 32,
      //     fontFamily: 'Orbitron',
      //     fontWeight: '900',
      //     fontStyle: 'normal',
      //     color: '#000000',
      //     textAlign: 'left'
      //   };
      //   setTextElements(prev => [...prev, modelText]);
      //   console.log('✅ Initialized model text as editable element:', modelText);
      // }
    }
  }, [isFirstMockup, mockup, textElements]);

  // Update preview when format, text, or product controls change
  useEffect(() => {
    const updatePreview = async () => {
      let processed = await processAndExport(selectedFormat);

      // Apply product position/scale changes for first mockup
      if (isFirstMockup && (productPosition || productScale !== 1.0 || mockup.originalFrame)) {
        processed = await applyProductTransformations();
      }

      // Render text elements on the canvas
      const withText = renderTextElements(processed, textElements);
      setPreviewCanvas(withText);
    };
    updatePreview();
  }, [selectedFormat, textElements, productPosition, productScale, isFirstMockup, mockup.originalFrame]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFormatDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Find the content bounds in the canvas (excluding transparent edges)
   */
  const findContentBounds = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let foundContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const alpha = data[index + 3];

        if (alpha > 0) {
          foundContent = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!foundContent) {
      return { x: 0, y: 0, width, height };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  };

  /**
   * Process and export image with specified aspect ratio
   * Uses smart cropping and centering to maintain product visibility
   */
  const processAndExport = useCallback(async (format: ExportFormat) => {
    const originalCanvas = mockup.canvas;
    const bounds = findContentBounds(originalCanvas);

    console.log('🔍 Content bounds:', bounds);

    // Calculate target dimensions based on aspect ratio
    const contentAspectRatio = bounds.width / bounds.height;
    let targetWidth: number, targetHeight: number;

    if (format === '1:1') {
      // For square output, use the larger dimension
      const size = Math.max(bounds.width, bounds.height);
      targetWidth = size;
      targetHeight = size;
    } else {
      // For 3:4 output
      if (contentAspectRatio > 0.75) {
        // Content is wider than 3:4, base on width
        targetWidth = bounds.width;
        targetHeight = bounds.width / 0.75;
      } else {
        // Content is taller than 3:4, base on height
        targetHeight = bounds.height;
        targetWidth = bounds.height * 0.75;
      }
    }

    // Add padding (10% on all sides)
    const padding = Math.max(targetWidth, targetHeight) * 0.1;
    targetWidth += padding * 2;
    targetHeight += padding * 2;

    // Create new canvas with target dimensions
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetWidth;
    exportCanvas.height = targetHeight;
    const ctx = exportCanvas.getContext('2d')!;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Calculate position to center content in target canvas
    const contentCenterX = bounds.x + bounds.width / 2;
    const contentCenterY = bounds.y + bounds.height / 2;

    const sourceX = contentCenterX - bounds.width / 2;
    const sourceY = contentCenterY - bounds.height / 2;

    const destX = (targetWidth - bounds.width) / 2;
    const destY = (targetHeight - bounds.height) / 2;

    // Draw content centered
    ctx.drawImage(
      originalCanvas,
      sourceX, sourceY, bounds.width, bounds.height,
      destX, destY, bounds.width, bounds.height
    );

    console.log(`📦 Export ${format}:`, {
      originalSize: `${originalCanvas.width}x${originalCanvas.height}`,
      contentBounds: bounds,
      targetSize: `${Math.round(targetWidth)}x${Math.round(targetHeight)}`,
      position: `(${Math.round(destX)}, ${Math.round(destY)})`
    });

    return exportCanvas;
  }, [mockup.canvas]);

  /**
   * Render text elements on canvas
   */
  const renderTextElements = (canvas: HTMLCanvasElement, texts: TextElement[]): HTMLCanvasElement => {
    if (texts.length === 0) return canvas;

    // Create a new canvas to avoid modifying the original
    const textCanvas = document.createElement('canvas');
    textCanvas.width = canvas.width;
    textCanvas.height = canvas.height;
    const ctx = textCanvas.getContext('2d')!;

    // Draw the original canvas
    ctx.drawImage(canvas, 0, 0);

    // Draw each text element
    texts.forEach(text => {
      ctx.save();

      // Clear any existing shadow settings
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Set font properties
      const font = `${text.fontStyle} ${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
      ctx.font = font;
      ctx.fillStyle = text.color;
      ctx.textAlign = text.textAlign as CanvasTextAlign;
      ctx.textBaseline = 'middle';

      // Add thin white outline for visibility on dark backgrounds
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeText(text.text, text.x, text.y);

      // Draw text
      ctx.fillText(text.text, text.x, text.y);

      ctx.restore();
    });

    return textCanvas;
  };

  /**
   * Handle text elements update from TextEditor
   */
  const handleTextUpdate = (texts: TextElement[]) => {
    setTextElements(texts);
    // Update canvas with new text immediately
    const updatedCanvas = renderTextElements(mockup.canvas, texts);
    setPreviewCanvas(updatedCanvas);
  };

  /**
   * Handle click on canvas to add inline text
   */
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Don't add text if we're in product control mode for first mockup
    if (isFirstMockup && showProductControls) {
      return;
    }

    // Only add text if not clicking on existing text elements
    if ((e.target as HTMLElement).closest('.text-element-overlay')) {
      return;
    }

    const containerRef = previewContainerRef.current;
    const canvas = previewCanvas;
    if (!containerRef || !canvas) return;

    const rect = containerRef.getBoundingClientRect();
    const scaleRatio = rect.width / canvas.width;

    // Calculate position in canvas coordinates
    const x = (e.clientX - rect.left) / scaleRatio;
    const y = (e.clientY - rect.top) / scaleRatio;

    // Start inline editing at this position
    setInlineEditingId('new');
    setInlineEditText('');
    setInlineEditPosition({ x, y });

    // Focus the input after it's rendered
    setTimeout(() => {
      inlineInputRef.current?.focus();
    }, 100);
  };

  /**
   * Handle inline text input key events
   */
  const handleInlineInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishInlineEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineEditing();
    }
  };

  /**
   * Finish inline editing and save the text
   */
  const finishInlineEditing = () => {
    if (!inlineEditPosition || !inlineEditText.trim()) {
      cancelInlineEditing();
      return;
    }

    const newText: TextElement = {
      id: `text-${Date.now()}`,
      text: inlineEditText.trim(),
      x: inlineEditPosition.x,
      y: inlineEditPosition.y,
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#1F2937',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'center'
    };

    const newTexts = [...textElements, newText];
    setTextElements(newTexts);
    setSelectedTextId(newText.id);

    // Update canvas
    const updatedCanvas = renderTextElements(mockup.canvas, newTexts);
    setPreviewCanvas(updatedCanvas);

    // Reset inline editing state
    setInlineEditingId(null);
    setInlineEditText('');
    setInlineEditPosition(null);
  };

  /**
   * Cancel inline editing
   */
  const cancelInlineEditing = () => {
    setInlineEditingId(null);
    setInlineEditText('');
    setInlineEditPosition(null);
  };

  /**
   * Handle double-click on existing text to edit inline
   */
  const handleTextDoubleClick = (e: React.MouseEvent, text: TextElement) => {
    e.stopPropagation();

    setInlineEditingId(text.id);
    setInlineEditText(text.text);
    setInlineEditPosition({ x: text.x, y: text.y });
    setSelectedTextId(text.id);

    setTimeout(() => {
      inlineInputRef.current?.focus();
      inlineInputRef.current?.select();
    }, 100);
  };

  /**
   * Update existing text from inline editing
   */
  const updateExistingTextInline = () => {
    if (!inlineEditingId || inlineEditingId === 'new' || !inlineEditText.trim()) {
      cancelInlineEditing();
      return;
    }

    const newTexts = textElements.map(t =>
      t.id === inlineEditingId
        ? { ...t, text: inlineEditText.trim() }
        : t
    );

    setTextElements(newTexts);
    setSelectedTextId(inlineEditingId);

    // Update canvas
    const updatedCanvas = renderTextElements(mockup.canvas, newTexts);
    setPreviewCanvas(updatedCanvas);

    // Reset inline editing state
    setInlineEditingId(null);
    setInlineEditText('');
    setInlineEditPosition(null);
  };

  /**
   * Apply product transformations (position and scale) to the mockup
   * This re-composites the product with the frame using new position/scale
   */
  const applyProductTransformations = async (): Promise<HTMLCanvasElement> => {
    if (!isFirstMockup || !mockup.originalFrame || !mockup.originalProduct || !frameAnalysisRef.current) {
      return previewCanvas!;
    }

    setIsRecompositing(true);

    try {
      const currentPosition = productPosition || { x: 0.5, y: 0.5 };
      const currentScale = productScale;

      console.log('🔄 Recompositing product:', {
        position: currentPosition,
        scale: currentScale
      });

      // Recomposite with new position and scale
      const newCanvas = await recompositeProduct(
        mockup.originalFrame,
        mockup.originalProduct,
        frameAnalysisRef.current,
        currentPosition,
        currentScale,
        mockup.config?.productInfo || null, // Pass productInfo for model overlay
        undefined // No progress callback needed
      );

      return newCanvas;
    } catch (error) {
      console.error('❌ Recomposition failed:', error);
      return previewCanvas!;
    } finally {
      setIsRecompositing(false);
    }
  };

  /**
   * Handle product drag start
   */
  const handleProductMouseDown = (e: React.MouseEvent) => {
    if (!isFirstMockup) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDraggingProduct(true);
    const rect = previewContainerRef.current?.getBoundingClientRect();
    if (rect && mockup.originalFrame) {
      // Convert current position from normalized (0-1) to pixels
      const canvasWidth = rect.width; // Use displayed width
      const canvasHeight = rect.height * (mockup.originalFrame.height / mockup.originalFrame.width);

      const currentPixelX = (productPosition?.x || 0.5) * mockup.originalFrame.width;
      const currentPixelY = (productPosition?.y || 0.5) * mockup.originalFrame.height;

      productDragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        productX: currentPixelX,
        productY: currentPixelY,
        canvasWidth: mockup.originalFrame.width,
        canvasHeight: mockup.originalFrame.height
      };
    }
  };

  /**
   * Handle product scale change
   */
  const handleProductScaleChange = (newScale: number) => {
    if (!isFirstMockup) return;
    setProductScale(newScale);
  };

  /**
   * Handle product drag move
   */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingProduct || !productDragStartRef.current || !isFirstMockup) return;

      const rect = previewContainerRef.current?.getBoundingClientRect();
      if (!rect || !mockup.originalFrame) return;

      // Calculate pixel-based movement (same direction as mouse)
      const deltaX = e.clientX - productDragStartRef.current.clientX;
      const deltaY = e.clientY - productDragStartRef.current.clientY;

      // Calculate new position in pixels
      const newX = productDragStartRef.current.productX + deltaX;
      const newY = productDragStartRef.current.productY + deltaY;

      // Constrain to canvas bounds (allow full range, not just safe zone)
      const clampedX = Math.max(0, Math.min(mockup.originalFrame.width, newX));
      const clampedY = Math.max(0, Math.min(mockup.originalFrame.height, newY));

      // Convert to normalized coordinates (0-1) for storage
      const normalizedX = clampedX / mockup.originalFrame.width;
      const normalizedY = clampedY / mockup.originalFrame.height;

      setProductPosition({ x: normalizedX, y: normalizedY });
    };

    const handleMouseUp = () => {
      setIsDraggingProduct(false);
      productDragStartRef.current = null;
    };

    if (isDraggingProduct) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingProduct, isFirstMockup, mockup.originalFrame]);

  /**
   * Handle mouse down on text for dragging
   */
  const handleTextMouseDown = (e: React.MouseEvent, text: TextElement, scaleRatio: number) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedTextId(text.id);
    setDraggedTextId(text.id);

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      textX: text.x,
      textY: text.y
    };

    setDragPosition({ x: text.x, y: text.y });
  };

  /**
   * Handle mouse move for dragging text
   */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggedTextId || !dragStartRef.current || !previewContainerRef.current) return;

      const canvas = previewCanvas;
      if (!canvas) return;

      const rect = previewContainerRef.current.getBoundingClientRect();
      const scaleRatio = rect.width / canvas.width;

      // Calculate position change in pixels
      const deltaX = (e.clientX - dragStartRef.current.clientX) / scaleRatio;
      const deltaY = (e.clientY - dragStartRef.current.clientY) / scaleRatio;

      // Calculate new position
      const newX = dragStartRef.current.textX + deltaX;
      const newY = dragStartRef.current.textY + deltaY;

      // Constrain to canvas bounds
      const clampedX = Math.max(0, Math.min(canvas.width, newX));
      const clampedY = Math.max(0, Math.min(canvas.height, newY));

      // Update drag position for visual feedback
      setDragPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
      if (draggedTextId && dragPosition) {
        // Commit the drag to update actual text elements
        const newTexts = textElements.map(t =>
          t.id === draggedTextId
            ? { ...t, x: dragPosition.x, y: dragPosition.y }
            : t
        );
        setTextElements(newTexts);

        // Update canvas with new text positions
        const updatedCanvas = renderTextElements(mockup.canvas, newTexts);
        setPreviewCanvas(updatedCanvas);
      }

      // Reset drag state
      setDraggedTextId(null);
      setDragPosition(null);
      dragStartRef.current = null;
    };

    // Only add listeners if we're dragging
    if (draggedTextId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedTextId, dragPosition, textElements, mockup.canvas, previewCanvas]);

  const handleDownload = async (format?: ExportFormat) => {
    const exportFormat = format || selectedFormat;
    setIsDownloading(true);
    try {
      // Use the preview canvas directly (already includes text elements)
      const canvasToExport = previewCanvas || await processAndExport(exportFormat);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvasToExport.toBlob(resolve, 'image/png', 0.95);
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${mockup.name.toLowerCase().replace(/\s+/g, '-')}-${exportFormat.replace(':', 'x')}${textElements.length > 0 ? '-with-text' : ''}-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatLabels: Record<ExportFormat, string> = {
    '1:1': '1:1 (Square)',
    '3:4': '3:4 (Portrait)'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div
        ref={previewContainerRef}
        className={`relative bg-gray-100 ${selectedFormat === '1:1' ? 'aspect-square' : 'aspect-[3/4]'}`}
        onClick={inlineEditingId || (isFirstMockup && showProductControls) ? undefined : handleCanvasClick}
      >
        {previewCanvas ? (
          <>
            <img
              src={previewCanvas.toDataURL()}
              alt={`${mockup.name} preview (${selectedFormat})`}
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
              style={{ imageRendering: 'auto' }}
            />
            {/* Product drag indicator for first mockup */}
            {isFirstMockup && showProductControls && (
              <div
                className="absolute inset-0 cursor-move border-4 border-orange-500 border-dashed rounded-lg pointer-events-auto"
                onMouseDown={handleProductMouseDown}
                onClick={(e) => e.stopPropagation()}
                style={{
                  zIndex: 10
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg bg-opacity-90">
                    <div className="flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      <span className="text-sm font-medium">Drag product to move it around</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Text element overlays for dragging - only show when text editor is open */}
            {showTextEditor && textElements.map((text) => {
              const canvas = previewCanvas!;
              const containerRef = previewContainerRef.current;
              if (!containerRef) return null;

              // Calculate scale ratio
              const displayedWidth = containerRef.offsetWidth;
              const scaleRatio = displayedWidth / canvas.width;

              // Use dragged position if this text is being dragged, otherwise use actual position
              const isDragging = draggedTextId === text.id && dragPosition !== null;
              const textX = isDragging ? dragPosition.x : text.x;
              const textY = isDragging ? dragPosition.y : text.y;

              // Calculate position and size
              const left = textX * scaleRatio;
              const top = textY * scaleRatio;
              const fontSize = text.fontSize * scaleRatio;

              // Don't show this text if it's being edited inline
              if (inlineEditingId === text.id) return null;

              return (
                <div
                  key={text.id}
                  className={`text-element-overlay absolute cursor-move select-none ${selectedTextId === text.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    transform: 'translate(-50%, -50%)',
                    fontFamily: text.fontFamily,
                    fontSize: `${fontSize}px`,
                    fontWeight: text.fontWeight,
                    fontStyle: text.fontStyle,
                    textDecoration: text.textDecoration,
                    color: text.color,
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={(e) => handleTextMouseDown(e, text, scaleRatio)}
                  onDoubleClick={(e) => handleTextDoubleClick(e, text)}
                >
                  {text.text}
                </div>
              );
            })}
            {/* Inline text input */}
            {inlineEditingId && inlineEditPosition && previewCanvas && (
              <div
                className="absolute"
                style={{
                  left: `${inlineEditPosition.x * (previewContainerRef.current!.offsetWidth / previewCanvas.width)}px`,
                  top: `${inlineEditPosition.y * (previewContainerRef.current!.offsetWidth / previewCanvas.width)}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 50
                }}
              >
                <input
                  ref={inlineInputRef}
                  type="text"
                  value={inlineEditText}
                  onChange={(e) => setInlineEditText(e.target.value)}
                  onKeyDown={handleInlineInputKeyDown}
                  onBlur={inlineEditingId === 'new' ? finishInlineEditing : updateExistingTextInline}
                  className="px-2 py-1 border-2 border-blue-500 rounded bg-white text-gray-900 text-base outline-none"
                  style={{
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    minWidth: '100px',
                    maxWidth: '300px'
                  }}
                  placeholder="Type text here..."
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm">Generating preview...</p>
            </div>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
          {selectedFormat}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{mockup.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{mockup.description}</p>

        {/* Format Selection */}
        <div className="mb-3 relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <button
            onClick={() => setShowFormatDropdown(!showFormatDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm text-gray-700">{formatLabels[selectedFormat]}</span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showFormatDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showFormatDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
              <button
                onClick={() => {
                  setSelectedFormat('1:1');
                  setShowFormatDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  selectedFormat === '1:1' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                1:1 (Square) - Best for Instagram
              </button>
              <button
                onClick={() => {
                  setSelectedFormat('3:4');
                  setShowFormatDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  selectedFormat === '3:4' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                3:4 (Portrait) - Best for e-commerce
              </button>
            </div>
          )}
        </div>

        {/* Product Controls (only for first mockup) */}
        {isFirstMockup && (
          <div className="mb-3">
            <button
              onClick={() => {
                setShowProductControls(!showProductControls);
                // When opening product controls, hide text editor to avoid conflicts
                if (!showProductControls) {
                  setShowTextEditor(false);
                }
              }}
              className={`w-full mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                showProductControls || productPosition || productScale !== 1.0
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Type className="w-4 h-4" />
              {showProductControls ? 'Hide Product Controls' : 'Adjust Product'}
            </button>
            {showProductControls && (
              <p className="text-xs text-orange-600 text-center">
                💡 Drag product on image to move • Click elsewhere to add text
              </p>
            )}

            {showProductControls && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-4">
                <h3 className="font-medium text-gray-900">Product Controls</h3>

                {/* Scale Control */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scale: {Math.round(productScale * 100)}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="400"
                    value={productScale * 100}
                    onChange={(e) => handleProductScaleChange(Number(e.target.value) / 100)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50%</span>
                    <span>100%</span>
                    <span>200%</span>
                    <span>300%</span>
                    <span>400%</span>
                  </div>
                </div>

                {/* Position Control */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position: {productPosition && mockup.originalFrame ?
                      `X: ${Math.round(productPosition.x * mockup.originalFrame.width)}px, Y: ${Math.round(productPosition.y * mockup.originalFrame.height)}px` :
                      'Default (Center)'
                    }
                  </label>
                  <div className="text-xs text-gray-600 bg-white p-3 rounded border border-gray-200">
                    <p>💡 Drag product anywhere on canvas - full range available!</p>
                    <p className="mt-1 text-gray-500">
                      Canvas: {mockup.originalFrame?.width}x{mockup.originalFrame?.height}px
                    </p>
                  </div>
                </div>

                {/* Reset Button */}
                <button
                  onClick={() => {
                    // Reset to requested defaults: X: 229px, Y: 310px, Scale: 400%
                    if (mockup.originalFrame) {
                      const initialX = 229 / mockup.originalFrame.width;
                      const initialY = 310 / mockup.originalFrame.height;
                      setProductPosition({ x: initialX, y: initialY });
                    }
                    setProductScale(4.0);
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Reset to Default
                </button>
              </div>
            )}
          </div>
        )}

        {/* Text Editor Button */}
        <button
          onClick={() => {
            setShowTextEditor(!showTextEditor);
            // When opening text editor, hide product controls to avoid conflicts
            if (!showTextEditor) {
              setShowProductControls(false);
            }
          }}
          className={`w-full mb-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            showTextEditor || textElements.length > 0
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Type className="w-4 h-4" />
          {showTextEditor ? 'Hide Text Editor' : textElements.length > 0 ? `Edit Text (${textElements.length})` : 'Add Text'}
        </button>
        {textElements.length === 0 && !showProductControls && (
          <p className="text-xs text-gray-500 text-center mb-3">
            Or click anywhere on the image to add text
          </p>
        )}

        {/* Text Editor Panel */}
        {showTextEditor && (
          <div className="mb-3">
            <TextEditor
              canvas={mockup.canvas}
              onTextUpdate={handleTextUpdate}
              initialTexts={textElements}
              selectedTextId={selectedTextId}
              onTextSelect={setSelectedTextId}
            />
          </div>
        )}

        <button
          onClick={() => handleDownload()}
          disabled={isDownloading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isDownloading
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Download className="w-4 h-4" />
          {isDownloading ? 'Downloading...' : `Download ${selectedFormat}`}
        </button>
      </div>
    </div>
  );
}