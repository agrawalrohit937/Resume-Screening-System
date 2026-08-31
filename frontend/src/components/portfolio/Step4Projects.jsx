import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  ChevronRight, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCheck,
  Camera,
  UploadCloud,
  Image as ImageIcon,
  RefreshCw,
  X,
  GripVertical,
  Globe,
  Github,
  FileText,
  Layers,
  Check,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { Reorder, AnimatePresence, motion, useDragControls } from 'framer-motion';
import toast from 'react-hot-toast';

// Popular quick-tag suggestions for 1-tap addition
const POPULAR_CATEGORIES = [
  'AI & Machine Learning',
  'Full-Stack Web App',
  'Data Science & Analytics',
  'Mobile & Cloud Systems',
  'DevOps & Backend API'
];

const POPULAR_TECHS = [
  'React',
  'Python',
  'FastAPI',
  'Node.js',
  'TypeScript',
  'Docker',
  'PostgreSQL',
  'TailwindCSS',
  'PyTorch'
];

// ── MEMOIZED PROJECT ITEM CARD FOR 60FPS SMOOTH RENDERING ──
const ProjectCard = memo(function ProjectCard({
  proj,
  idx,
  isExpanded,
  isFetching,
  onToggleExpand,
  onUpdateProject,
  onDeleteProject,
  onAutoFetchScreenshot,
  onFileUpload,
  onGeneratePlaceholder,
  onRemoveCover,
  onImageInteraction,
  onEnhanceDescription,
  onAddHighlight,
  onUpdateHighlight,
  onRemoveHighlight,
  totalProjects
}) {
  const dragControls = useDragControls();
  const currentImage = proj.image_url || `https://placehold.co/1200x800/1e293b/38bdf8?text=${encodeURIComponent(proj.title || 'Project Cover')}`;

  return (
    <Reorder.Item
      value={proj}
      dragListener={false}
      dragControls={dragControls}
      layout
      transition={{ 
        layout: { type: "spring", stiffness: 500, damping: 35 }, 
        duration: 0.15 
      }}
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(99, 102, 241, 0.7)", 
        zIndex: 100,
        cursor: "grabbing"
      }}
      className={`rounded-2xl sm:rounded-3xl border select-none ${
        isExpanded 
          ? 'bg-slate-50/95 border-indigo-300 shadow-md p-4 sm:p-7' 
          : 'bg-white hover:bg-slate-50/80 border-slate-200 p-3.5 sm:p-5 shadow-xs hover:border-slate-300'
      }`}
    >
      {/* Collapsed Bar */}
      <div className="flex items-center justify-between gap-2.5 sm:gap-4">
        <div 
          className="flex items-center gap-2.5 sm:gap-4 truncate flex-1 cursor-pointer"
          onClick={onToggleExpand}
        >
          {/* Dedicated YouTube-style Drag Grip Handle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="text-slate-400 hover:text-indigo-600 active:text-indigo-700 transition-colors p-1.5 hover:bg-indigo-50 active:bg-indigo-100 rounded-xl cursor-grab active:cursor-grabbing shrink-0 touch-none select-none flex items-center justify-center group/grab"
            title="Hold & drag up or down to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={18} className="group-hover/grab:scale-110 transition-transform" />
          </div>

          {/* Dynamic Serial Number */}
          <span className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
            isExpanded ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
          }`}>
            #{idx + 1}
          </span>
          
          {/* Thumbnail */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onImageInteraction(idx, currentImage);
            }}
            className="w-14 h-10 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300 relative cursor-pointer hidden sm:block shadow-xs group/thumb"
            title="Tap to preview image"
          >
            <img 
              src={currentImage} 
              alt="" 
              loading="lazy"
              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform" 
              onError={(e) => {
                e.currentTarget.src = `https://placehold.co/1200x800/1e293b/ffffff?text=${encodeURIComponent(proj.title || 'Cover')}`;
              }}
            />
          </div>

          {/* Project Title + Category + Badges */}
          <div className="truncate flex-1">
            <div className="flex items-center gap-2 truncate">
              <h4 className="text-sm font-black text-slate-900 truncate">
                {proj.title || 'Untitled Project'}
              </h4>
              {proj.year && (
                <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 hidden md:inline">
                  ({proj.year})
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {proj.category || 'CASE STUDY'}
              </span>

              {/* Status Badges */}
              {proj.live_url && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 hidden sm:inline-flex items-center gap-1">
                  <Globe size={10} /> Live
                </span>
              )}
              {proj.github_url && (
                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 hidden sm:inline-flex items-center gap-1">
                  <Github size={10} /> Repo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {totalProjects > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject(idx);
              }}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              title="Delete Project"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isExpanded 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60'
            }`}
          >
            {isExpanded ? 'Collapse' : 'Edit'}
          </button>
        </div>
      </div>

      {/* ── EXPANDED EDITOR STUDIO ── */}
      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-6">
          
          {/* 1. Cover Image Studio */}
          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <ImageIcon size={15} className="text-indigo-600" /> Project Cover Banner
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Capture live screenshot from website link, upload image, or generate dynamic placeholder.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isFetching || (!proj.live_url && !proj.github_url)}
                  onClick={() => onAutoFetchScreenshot(idx)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
                  title={proj.live_url || proj.github_url ? "Auto-capture live website screenshot" : "Enter a Live Demo or GitHub URL first"}
                >
                  <Camera size={13} className={isFetching ? "animate-spin" : ""} />
                  {isFetching ? 'Capturing live site...' : '📸 Auto-Capture Cover'}
                </button>

                <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-200 transition-colors">
                  <UploadCloud size={13} className="text-indigo-600" /> Upload
                  <input
                    id={`project-file-input-${idx}`}
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFileUpload(e, idx)}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => onGeneratePlaceholder(idx)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer border border-slate-200 transition-colors"
                  title="Regenerate Placeholder Cover"
                >
                  <RefreshCw size={13} />
                </button>

                {proj.image_url && (
                  <button
                    type="button"
                    onClick={() => onRemoveCover(idx)}
                    className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl cursor-pointer border border-slate-200 transition-colors"
                    title="Remove Cover Image"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Image Frame */}
            <div 
              onClick={() => onImageInteraction(idx, currentImage)}
              onDoubleClick={() => document.getElementById(`project-file-input-${idx}`)?.click()}
              className="relative w-full h-44 sm:h-56 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 cursor-pointer group shadow-inner"
              title="Single tap to preview • Double tap to change image"
            >
              <img
                src={currentImage}
                alt="Project Cover"
                loading="lazy"
                className={`w-full h-full object-cover transition-opacity duration-200 ${isFetching ? "opacity-30" : "opacity-100 group-hover:scale-101 transition-transform"}`}
                onError={(e) => {
                  e.currentTarget.src = `https://placehold.co/1200x800/1e293b/38bdf8?text=${encodeURIComponent(proj.title || 'Project Cover')}`;
                }}
              />

              {/* Loading State Overlay */}
              {isFetching && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 text-white gap-2.5 z-10">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></div>
                  <span className="text-xs font-mono font-bold">📸 Capturing live site screenshot...</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between px-1">
              <span>💡 Tap image to preview</span>
              <span>⚡ Double-tap to replace image</span>
            </div>
          </div>

          {/* 2. Core Details (Title, Category, Year) */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-6 space-y-1">
                <label className="block text-[11px] font-black uppercase text-slate-700">
                  Project Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={proj.title || ''}
                  onChange={(e) => onUpdateProject(idx, 'title', e.target.value)}
                  placeholder="e.g. AI-Powered Autonomous Agent Platform"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-4 space-y-1">
                <label className="block text-[11px] font-black uppercase text-slate-700">Domain Category</label>
                <input
                  type="text"
                  value={proj.category || ''}
                  onChange={(e) => onUpdateProject(idx, 'category', e.target.value)}
                  placeholder="e.g. AI & FULL-STACK"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[11px] font-black uppercase text-slate-700">Year</label>
                <input
                  type="text"
                  value={proj.year || ''}
                  onChange={(e) => onUpdateProject(idx, 'year', e.target.value)}
                  placeholder="2026"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono shadow-2xs"
                />
              </div>
            </div>

            {/* Quick Category Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Quick Select:</span>
              {POPULAR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onUpdateProject(idx, 'category', cat.toUpperCase())}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    proj.category?.toUpperCase() === cat.toUpperCase()
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Executive Summary / Description with AI Polish */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black uppercase text-slate-700">
                Executive Architecture Summary
              </label>
              <button
                type="button"
                onClick={() => onEnhanceDescription(idx)}
                disabled={!proj.description}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Sparkles size={13} /> ✨ AI Polish & Metrics
              </button>
            </div>
            <textarea
              rows={3}
              value={proj.description || ''}
              onChange={(e) => onUpdateProject(idx, 'description', e.target.value)}
              placeholder="Describe the architectural problem solved, key algorithms, performance gains, and live deployment..."
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-medium shadow-2xs"
            />
          </div>

          {/* 4. Tech Stack Tag Studio */}
          <div className="space-y-2.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <label className="block text-[11px] font-black uppercase text-slate-700">
              Project Tech Stack
            </label>
            
            <div className="flex flex-wrap gap-1.5 items-center">
              {(proj.technologies || []).map((t, tIdx) => (
                <span key={tIdx} className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  {t}
                  <button
                    type="button"
                    onClick={() => {
                      const updTech = (proj.technologies || []).filter((_, i) => i !== tIdx);
                      onUpdateProject(idx, 'technologies', updTech);
                    }}
                    className="text-slate-400 hover:text-rose-600 font-black cursor-pointer"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="+ Add tech & press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      const cur = proj.technologies || [];
                      if (!cur.includes(val)) {
                        onUpdateProject(idx, 'technologies', [...cur, val]);
                      }
                      e.currentTarget.value = '';
                    }
                  }
                }}
                className="px-3.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* Quick Popular Tech Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">1-Tap Add:</span>
              {POPULAR_TECHS.map((tech) => {
                const isAdded = (proj.technologies || []).includes(tech);
                return (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => {
                      const cur = proj.technologies || [];
                      if (!isAdded) {
                        onUpdateProject(idx, 'technologies', [...cur, tech]);
                      }
                    }}
                    disabled={isAdded}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      isAdded 
                        ? 'bg-slate-100 text-slate-400 cursor-default' 
                        : 'bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200'
                    }`}
                  >
                    +{tech}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Quantifiable Metric Highlights */}
          <div className="space-y-2.5 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black uppercase text-slate-700">
                Quantifiable Metric Highlights
              </label>
              <button
                type="button"
                onClick={() => onAddHighlight(idx)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                + Add Metric Result
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {proj.highlights?.map((h, hIdx) => (
                <div key={hIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <input
                    type="text"
                    placeholder="Value (e.g. 94.2%)"
                    value={h.value || ''}
                    onChange={(e) => onUpdateHighlight(idx, hIdx, 'value', e.target.value)}
                    className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Label (e.g. Accuracy)"
                    value={h.label || ''}
                    onChange={(e) => onUpdateHighlight(idx, hIdx, 'label', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveHighlight(idx, hIdx)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    title="Remove metric"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Live Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Globe size={13} className="text-indigo-600" /> Live Demo URL
              </label>
              <input
                type="url"
                value={proj.live_url || ''}
                onChange={(e) => onUpdateProject(idx, 'live_url', e.target.value)}
                placeholder="https://my-app.vercel.app"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Github size={13} className="text-slate-800" /> GitHub Repository
              </label>
              <input
                type="url"
                value={proj.github_url || ''}
                onChange={(e) => onUpdateProject(idx, 'github_url', e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <FileText size={13} className="text-amber-600" /> Article / Notes URL
              </label>
              <input
                type="url"
                value={proj.notes_url || ''}
                onChange={(e) => onUpdateProject(idx, 'notes_url', e.target.value)}
                placeholder="https://medium.com/@user/article"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
              />
            </div>
          </div>

          {/* Bottom Done / Collapse Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onToggleExpand}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <CheckCheck size={14} className="text-emerald-600" /> Save & Close Case Study
            </button>
          </div>

        </div>
      )}
    </Reorder.Item>
  );
});

// ── MAIN STEP4 PROJECTS COMPONENT ──
export default function Step4Projects({
  formData,
  setFormData,
  expandedProjectIdx,
  setExpandedProjectIdx,
  enhancingIndex,
  handleEnhanceDescription,
  handleAddProjectHighlight,
  handleProjectHighlightChange,
  handleRemoveProjectHighlight,
  goToStep
}) {
  const [fetchingScreenshotIdx, setFetchingScreenshotIdx] = useState(null);
  const [activeImagePreview, setActiveImagePreview] = useState(null);
  const [lastTapTime, setLastTapTime] = useState({});

  // Close preview on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveImagePreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Centralized, fast project updater
  const handleUpdateProject = useCallback((idx, field, value) => {
    setFormData(prev => {
      const updated = [...prev.projects];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, projects: updated };
    });
  }, [setFormData]);

  // Fast delete project
  const handleDeleteProject = useCallback((idx) => {
    setFormData(prev => {
      const updated = prev.projects.filter((_, i) => i !== idx);
      return { ...prev, projects: updated };
    });
    setExpandedProjectIdx(prev => (prev === idx ? null : prev > idx ? prev - 1 : prev));
    toast.success('Project deleted');
  }, [setFormData, setExpandedProjectIdx]);


  // Ensure every project has a permanent unique ID so React & Framer Motion track cards seamlessly
  useEffect(() => {
    if (!formData.projects || formData.projects.length === 0) return;
    const hasMissingId = formData.projects.some(p => !p.id && !p._dndId);
    if (hasMissingId) {
      const withIds = formData.projects.map((p, i) => ({
        ...p,
        id: p.id || p._dndId || `proj_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`
      }));
      setFormData(prev => ({ ...prev, projects: withIds }));
    }
  }, [formData.projects, setFormData]);

  // Single vs Double Tap
  const handleImageInteraction = useCallback((idx, currentImage) => {
    const now = Date.now();
    const last = lastTapTime[idx] || 0;

    if (now - last < 350) {
      const fileInput = document.getElementById(`project-file-input-${idx}`);
      if (fileInput) fileInput.click();
    } else {
      setActiveImagePreview(currentImage);
    }
    setLastTapTime(prev => ({ ...prev, [idx]: now }));
  }, [lastTapTime]);

  // Async screenshot fetch via Microlink API
  const handleFetchScreenshot = useCallback(async (idx) => {
    const project = formData.projects[idx];
    const targetUrl = project.live_url || project.github_url || project.live_link || project.github_link;

    if (!targetUrl) {
      toast.error('Please enter a Live Demo or GitHub URL first!');
      return;
    }

    setFetchingScreenshotIdx(idx);
    const cleanUrl = targetUrl.trim();

    try {
      const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(cleanUrl)}&screenshot=true&meta=false`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      const screenshotUrl = json?.data?.screenshot?.url;

      if (!screenshotUrl) throw new Error('No screenshot in response');

      handleUpdateProject(idx, 'image_url', screenshotUrl);
      toast.success('📸 Live site screenshot captured!');
    } catch (err) {
      toast.error('Failed to capture screenshot. You can upload an image manually.');
    } finally {
      setFetchingScreenshotIdx(null);
    }
  }, [formData.projects, handleUpdateProject]);

  // File upload
  const handleImageFileUpload = useCallback((e, idx) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      handleUpdateProject(idx, 'image_url', uploadEvent.target?.result);
      toast.success('Project cover uploaded!');
    };
    reader.readAsDataURL(file);
  }, [handleUpdateProject]);

  // Dynamic placeholder
  const handleGeneratePlaceholder = useCallback((idx) => {
    const project = formData.projects[idx];
    const titleText = encodeURIComponent(project.title || 'Project Cover');
    const placeholderUrl = `https://placehold.co/1200x800/1e293b/38bdf8?text=${titleText}`;
    handleUpdateProject(idx, 'image_url', placeholderUrl);
  }, [formData.projects, handleUpdateProject]);

  // Remove cover
  const handleRemoveCover = useCallback((idx) => {
    handleUpdateProject(idx, 'image_url', '');
    toast.success('Cover removed');
  }, [handleUpdateProject]);

  // DnD Reorder
  const handleReorder = useCallback((newProjects) => {
    setFormData(prev => ({ ...prev, projects: newProjects }));
  }, [setFormData]);

  // Quick stats
  const totalProjectsCount = formData.projects?.length || 0;
  const liveCount = formData.projects?.filter(p => p.live_url)?.length || 0;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 border border-slate-200 shadow-md space-y-6 sm:space-y-8 relative">
      
      {/* ── HEADER & LIVE METRICS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-b border-slate-100 pb-6 sm:pb-8">
        <div className="space-y-1.5 sm:space-y-2 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60 inline-block">
              Step 04 • Portfolio Showcase
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {totalProjectsCount} {totalProjectsCount === 1 ? 'Project' : 'Projects'} • {liveCount} Live
            </span>
          </div>

          <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Featured Case Studies
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Drag cards with <span className="font-semibold text-slate-700">⠿</span> to reorder. Tap any image to preview or double-tap to change image.
          </p>
        </div>

        {/* Add Project Button */}
        <div className="shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              const newIdx = formData.projects.length;
              const newTitle = 'New Engineering Project';
              const placeholderUrl = `https://placehold.co/1200x800/1e293b/38bdf8?text=${encodeURIComponent(newTitle)}`;
              setFormData(prev => ({
                ...prev,
                projects: [
                  ...prev.projects,
                  { 
                    id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    title: newTitle, 
                    category: 'AI & FULL-STACK', 
                    year: new Date().getFullYear().toString(), 
                    description: '', 
                    technologies: ['FastAPI', 'React', 'TypeScript'], 
                    live_url: '', 
                    github_url: '', 
                    notes_url: '', 
                    image_url: placeholderUrl, 
                    highlights: [{ value: '92%', label: 'Performance' }] 
                  }
                ]
              }));
              setExpandedProjectIdx(newIdx);
            }}
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl flex items-center gap-2 shrink-0 cursor-pointer shadow-md shadow-indigo-600/20 transition-transform active:scale-95"
          >
            <Plus size={15} /> Add Case Study
          </button>
        </div>
      </div>

      {/* ── EMPTY STATE IF NO PROJECTS ── */}
      {totalProjectsCount === 0 && (
        <div className="text-center py-16 px-6 bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-3xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Layers size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-800">No Projects Added Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Showcase your technical projects with quantifiable metrics and live demos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormData(prev => ({
                ...prev,
                projects: [
                  { 
                    id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    title: 'New Engineering Project', 
                    category: 'AI & FULL-STACK', 
                    year: new Date().getFullYear().toString(), 
                    description: '', 
                    technologies: ['FastAPI', 'React'], 
                    live_url: '', 
                    github_url: '', 
                    notes_url: '', 
                    image_url: '', 
                    highlights: [] 
                  }
                ]
              }));
              setExpandedProjectIdx(0);
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            + Create First Project
          </button>
        </div>
      )}

      {/* ── DRAG & DROP REORDERABLE PROJECT LIST (60FPS HARDWARE ACCELERATED) ── */}
      <Reorder.Group
        axis="y"
        values={formData.projects || []}
        onReorder={handleReorder}
        className="space-y-4"
      >
        {formData.projects?.map((proj, idx) => (
          <ProjectCard
            key={proj.id || proj._dndId || `proj_stable_${idx}`}
            proj={proj}
            idx={idx}
            isExpanded={expandedProjectIdx === idx}
            isFetching={fetchingScreenshotIdx === idx}
            totalProjects={formData.projects.length}
            onToggleExpand={() => setExpandedProjectIdx(prev => (prev === idx ? null : idx))}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onAutoFetchScreenshot={handleFetchScreenshot}
            onFileUpload={handleImageFileUpload}
            onGeneratePlaceholder={handleGeneratePlaceholder}
            onRemoveCover={handleRemoveCover}
            onImageInteraction={handleImageInteraction}
            onEnhanceDescription={handleEnhanceDescription}
            onAddHighlight={handleAddProjectHighlight}
            onUpdateHighlight={handleProjectHighlightChange}
            onRemoveHighlight={handleRemoveProjectHighlight}
          />
        ))}
      </Reorder.Group>

      {/* Navigation Footer */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={() => goToStep(3)}
          className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={15} /> Back to Step 3
        </button>

        <button
          type="button"
          onClick={() => goToStep(5)}
          className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
        >
          Next: Experience & Timeline <ChevronRight size={15} />
        </button>
      </div>

      {/* ── CLEAN & SIMPLE SINGLE-TAP SHORT SCREEN IMAGE PREVIEW MODAL ── */}
      {activeImagePreview && (
        <div 
          onClick={() => setActiveImagePreview(null)}
          className="fixed top-0 bottom-0 right-0 left-0 lg:left-64 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-100"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700"
          >
            {/* Minimal Header with Close Button */}
            <div className="px-4 py-2.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300">Project Cover Preview</span>
              <button
                type="button"
                onClick={() => setActiveImagePreview(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Short Screen Image Container */}
            <div className="p-3 bg-black flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img 
                src={activeImagePreview} 
                alt="Project Cover" 
                className="max-h-[56vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
