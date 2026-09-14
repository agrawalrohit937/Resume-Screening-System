import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Sparkles, UploadCloud, Image as ImageIcon, Loader2, CheckCircle2, X, Clipboard } from 'lucide-react';
import { applyAssistantApi } from '../../services/applyAssistantApi';

export default function ScreenshotUploadZone({ onExtractStart, onExtractSuccess, onExtractError }) {
  const [extracting, setExtracting] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [extractedSuccess, setExtractedSuccess] = useState(false);
  const [canPasteClipboard, setCanPasteClipboard] = useState(false);

  useEffect(() => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.read === 'function'
    ) {
      setCanPasteClipboard(true);
    }
  }, []);

  const processFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;

      // Filter valid image files
      const validImages = Array.from(files).filter(
        (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)
      );

      if (validImages.length === 0) {
        toast.error('Please upload or paste a valid image file (PNG, JPG, WEBP).');
        return;
      }

      // Create preview object URLs
      const newPreviews = validImages.map((file) => ({
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      }));

      setPreviews(newPreviews);
      setExtracting(true);
      setExtractedSuccess(false);

      if (onExtractStart) onExtractStart();
      toast.loading('✨ AI Vision is analyzing screenshot(s)...', { id: 'screenshot-extract' });

      try {
        const data = await applyAssistantApi.extractFromScreenshot(validImages);

        setExtractedSuccess(true);
        toast.success('Successfully extracted details from screenshot! 🎯', { id: 'screenshot-extract' });

        if (onExtractSuccess) {
          onExtractSuccess(data);
        }
      } catch (err) {
        console.error('[ScreenshotUploadZone] Extraction error:', err);
        let msg = 'Failed to extract text from screenshot';
        if (err.response?.data?.detail) {
          const detail = err.response.data.detail;
          if (typeof detail === 'string') {
            msg = detail;
          } else if (Array.isArray(detail)) {
            msg = detail.map((d) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
          } else if (typeof detail === 'object') {
            msg = detail.msg || JSON.stringify(detail);
          }
        } else if (err.message) {
          msg = err.message;
        }
        toast.error(msg, { id: 'screenshot-extract' });
        if (onExtractError) onExtractError(err);
      } finally {
        setExtracting(false);
      }
    },
    [onExtractStart, onExtractSuccess, onExtractError]
  );

  // ── 1. Drag & Drop Listener ──────────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: processFiles,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    disabled: extracting,
    multiple: true,
  });

  // ── 2. Ctrl+V / Cmd+V Clipboard Paste Listener (Desktop) ─────────────────
  useEffect(() => {
    const handlePaste = (e) => {
      // Don't intercept if user is typing inside an input/textarea
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const namedFile = new File(
              [file],
              `pasted_screenshot_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
              { type: file.type }
            );
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        processFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  // ── 3. Paste from Clipboard Action (Mobile & Supported Browsers) ────────
  const handlePasteFromClipboard = async (e) => {
    e?.stopPropagation?.();
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast.error('Clipboard image access is not supported by your browser.');
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      const imageFiles = [];

      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          const file = new File(
            [blob],
            `clipboard_screenshot_${Date.now()}.${ext}`,
            { type: imageType }
          );
          imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        processFiles(imageFiles);
      } else {
        toast.error('No image found in clipboard. Copy a screenshot first.');
      }
    } catch (err) {
      console.error('[ScreenshotUploadZone] Clipboard read error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Clipboard permission denied. Please allow access.');
      } else {
        toast.error('Could not read image from clipboard.');
      }
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setExtractedSuccess(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600 shrink-0" />
          <h3 className="text-sm font-extrabold text-slate-900">Job Posting Screenshot</h3>
        </div>
        {/* Desktop-only: "Ctrl + V to Paste" badge */}
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
          <Clipboard size={10} /> Ctrl + V to Paste
        </span>
      </div>

      <div
        {...getRootProps()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 overflow-hidden cursor-pointer ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50/90 scale-[0.99]'
            : extracting
            ? 'border-indigo-300 bg-slate-50'
            : previews.length > 0
            ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-400'
            : 'border-indigo-300 sm:border-slate-200 hover:border-indigo-400 bg-indigo-50/25 sm:bg-slate-50/60 hover:bg-indigo-50/40 sm:hover:bg-slate-50 shadow-sm sm:shadow-none ring-2 ring-indigo-500/10 sm:ring-0'
        }`}
      >
        <input {...getInputProps()} />

        {/* ── Image Preview Mode ── */}
        {previews.length > 0 ? (
          <div className="p-4 relative min-h-[180px] flex flex-col items-center justify-center">
            {/* Image Thumbnail Preview Grid */}
            <div className="flex flex-wrap gap-2 justify-center max-h-[220px] overflow-y-auto w-full">
              {previews.map((p, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm max-w-[240px]">
                  <img src={p.url} alt={p.name} className="w-full h-32 object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 backdrop-blur-sm px-2 py-1 text-[10px] text-white font-medium truncate">
                    {p.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions for Previews */}
            {!extracting && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-600 bg-white/90 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors shadow-sm"
                >
                  <X size={12} /> Clear Screenshot
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    open();
                  }}
                  className="sm:hidden inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors shadow-sm"
                >
                  <UploadCloud size={12} /> Change
                </button>
              </div>
            )}

            {/* Scanning Laser Line Overlay when Extracting */}
            {extracting && (
              <div className="absolute inset-0 bg-indigo-900/10 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                <style>{`
                  @keyframes laserScan {
                    0% { top: 0%; }
                    50% { top: 95%; }
                    100% { top: 0%; }
                  }
                `}</style>
                <div
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_#6366f1]"
                  style={{ animation: 'laserScan 2.2s ease-in-out infinite' }}
                />
                <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-indigo-200 shadow-lg flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                  <span className="text-xs font-extrabold text-indigo-900">AI Vision is extracting job details...</span>
                </div>
              </div>
            )}

            {/* Extracted Success Badge */}
            {extractedSuccess && !extracting && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full border border-emerald-200 shadow-sm">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Extracted & Auto-Filled Form!</span>
              </div>
            )}
          </div>
        ) : (
          /* ── Empty Dropzone Prompt Mode ── */
          <div className="p-5 sm:p-7 text-center flex flex-col items-center justify-center min-h-[190px] sm:min-h-[180px]">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-3 shadow-inner">
              <UploadCloud size={22} className="sm:w-6 sm:h-6" />
            </div>

            {/* Desktop prompt */}
            <p className="text-xs font-extrabold text-slate-800 mb-1">
              {isDragActive
                ? 'Drop job screenshot here...'
                : 'Drag & drop screenshot or click to browse'}
            </p>
            <p className="hidden sm:block text-[11px] text-slate-500 font-medium max-w-[240px]">
              Or copy a screenshot to clipboard and press <kbd className="px-1.5 py-0.5 bg-slate-200/80 rounded text-[10px] font-mono text-slate-700">Ctrl+V</kbd> anywhere
            </p>

            {/* Mobile primary action buttons */}
            <div
              className="sm:hidden flex flex-col w-full max-w-[260px] gap-2 mt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => open()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-[#2E9BDA] active:opacity-90 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all"
              >
                <UploadCloud size={16} />
                <span>Upload Screenshot</span>
              </button>

              {canPasteClipboard && (
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white active:bg-slate-100 text-slate-700 border border-slate-200 active:border-indigo-300 text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <Clipboard size={14} className="text-indigo-600" />
                  <span>Paste from Clipboard</span>
                </button>
              )}
            </div>

            <p className="sm:hidden text-[10px] text-slate-400 font-medium mt-2.5">
              Select an image from gallery, files, or paste
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
