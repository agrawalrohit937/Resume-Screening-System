import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Sparkles, UploadCloud, Image as ImageIcon, Loader2, CheckCircle2, X, Clipboard } from 'lucide-react';
import { applyAssistantApi } from '../../services/applyAssistantApi';

export default function ScreenshotUploadZone({ onExtractStart, onExtractSuccess, onExtractError }) {
  const [extracting, setExtracting] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [extractedSuccess, setExtractedSuccess] = useState(false);

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
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    disabled: extracting,
    multiple: true,
  });

  // ── 2. Ctrl+V / Cmd+V Clipboard Paste Listener ──────────────────────────
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
          <Sparkles size={16} className="text-indigo-600" />
          <h3 className="text-sm font-extrabold text-slate-900">Job Posting Screenshot</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
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
            : 'border-slate-200 hover:border-indigo-300 bg-slate-50/60 hover:bg-slate-50'
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

            {/* Clear Button */}
            {!extracting && (
              <button
                type="button"
                onClick={handleClear}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-600 bg-white/90 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors shadow-sm"
              >
                <X size={12} /> Clear Screenshot
              </button>
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
          <div className="p-7 text-center flex flex-col items-center justify-center min-h-[180px]">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-inner">
              <UploadCloud size={24} />
            </div>
            <p className="text-xs font-extrabold text-slate-800 mb-1">
              {isDragActive ? 'Drop job screenshot here...' : 'Drag & drop screenshot or click to browse'}
            </p>
            <p className="text-[11px] text-slate-500 font-medium max-w-[240px]">
              Or copy a screenshot to clipboard and press <kbd className="px-1.5 py-0.5 bg-slate-200/80 rounded text-[10px] font-mono text-slate-700">Ctrl+V</kbd> anywhere
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
