import React, { useState } from 'react';
import { 
  Palette, 
  Sparkles, 
  Eye, 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  X, 
  Crown,
  Layers,
  Laptop,
  Tablet,
  Smartphone,
  ExternalLink,
  Globe,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import GlassmorphicTheme from './themes/GlassmorphicTheme';
import CyberpunkTheme from './themes/CyberpunkTheme';
import MinimalEleganceTheme from './themes/MinimalEleganceTheme';
import NeonDeveloperTheme from './themes/NeonDeveloperTheme';
import ThreeDInteractiveTheme from './themes/ThreeDInteractiveTheme';
import BentoGridTheme from './themes/BentoGridTheme';

export const THEMES = [
  {
    id: 'glassmorphic_pro',
    name: 'Glassmorphic Pro',
    tagline: 'Modern Silicon Valley SaaS',
    badge: 'Popular Choice',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Frosted acrylic glass cards, multi-layered mesh gradients, dynamic glowing particle background, and macOS window chrome.',
    previewBg: 'from-slate-900 via-indigo-950 to-slate-900',
    accentColor: '#6366f1',
    tags: ['Frosted Glass', 'Mesh Particles', 'macOS Chrome', 'Glow Accents'],
    palette: ['#6366f1', '#a855f7', '#06b6d4', '#0f172a'],
    mockCard: 'bg-white/10 backdrop-blur-md border-white/20 text-white shadow-xl',
    mockHeroBadge: 'bg-indigo-500/20 border-indigo-400/30 text-cyan-300'
  },
  {
    id: 'cyberpunk_dark',
    name: 'Cyberpunk Dark',
    tagline: 'Futuristic High-Tech Matrix',
    badge: 'High Impact',
    badgeColor: 'bg-cyan-950 text-cyan-400 border-cyan-500/40',
    description: 'Deep obsidian backdrop with neon cyan and electric yellow accents, terminal prompt ribbons, and high-contrast HUD cards.',
    previewBg: 'from-black via-[#090d16] to-[#040711]',
    accentColor: '#00f0ff',
    tags: ['Neon Cyan', 'Terminal HUD', 'Matrix Grid', 'Dark Mode'],
    palette: ['#00f0ff', '#fcee0a', '#ff0055', '#090d16'],
    mockCard: 'bg-[#090d16]/90 border-cyan-500/30 text-slate-100 shadow-[0_0_20px_rgba(0,240,255,0.15)]',
    mockHeroBadge: 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
  },
  {
    id: 'minimal_elegance',
    name: 'Minimal Elegance',
    tagline: 'Swiss Editorial & Executive',
    badge: 'Clean & Timeless',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Distraction-free pure typography, generous whitespace, razor-thin borders, and monochrome sophistication designed for executive scrutiny.',
    previewBg: 'from-slate-100 via-white to-slate-50',
    accentColor: '#0f172a',
    tags: ['Editorial Serif', 'Monochrome', 'Zero Noise', 'Clean Layout'],
    palette: ['#0f172a', '#334155', '#64748b', '#ffffff'],
    mockCard: 'bg-white border-slate-200 text-slate-900 shadow-sm',
    mockHeroBadge: 'bg-slate-100 border-slate-300 text-slate-800'
  },
  {
    id: 'neon_developer',
    name: 'Neon Developer',
    tagline: 'IDE & Code Syntax Aesthetic',
    badge: 'Engineer Favorite',
    badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-500/40',
    description: 'Engineered like a state-of-the-art IDE. Monospace code headers, git commit badges, syntax highlighted project blocks, and dark mode.',
    previewBg: 'from-[#0d1117] via-[#161b22] to-[#0d1117]',
    accentColor: '#39d353',
    tags: ['IDE Theme', 'Fira Code', 'Git Badges', 'Dark Carbon'],
    palette: ['#39d353', '#58a6ff', '#f78166', '#0d1117'],
    mockCard: 'bg-[#0d1117]/90 border-slate-700 text-slate-200 shadow-lg',
    mockHeroBadge: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
  },
  {
    id: '3d_interactive',
    name: '3D Interactive Space',
    tagline: 'Cosmic Halos & Parallax Depth',
    badge: 'Immersive Experience',
    badgeColor: 'bg-violet-950 text-violet-300 border-violet-500/40',
    description: 'Deep cosmic space navy with floating orb glows, 3D perspective cards, stellar aura gradients, and interactive hover dynamics.',
    previewBg: 'from-[#0b0f19] via-[#1a103c] to-[#0b0f19]',
    accentColor: '#8b5cf6',
    tags: ['Cosmic Halos', '3D Tilt', 'Parallax Orbs', 'Deep Space'],
    palette: ['#8b5cf6', '#38bdf8', '#ec4899', '#0b0f19'],
    mockCard: 'bg-[#121829]/90 border-violet-500/25 text-slate-100 shadow-[0_0_25px_rgba(139,92,246,0.2)]',
    mockHeroBadge: 'bg-violet-950/80 border-violet-400/40 text-violet-200'
  },
  {
    id: 'bento_grid_ux',
    name: 'Bento Grid UX',
    tagline: 'Apple-Inspired Modular Cards',
    badge: 'Trendsetting 2026',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Modern modular asymmetric bento grid boxes. Smooth rounded 3xl cards, subtle warm lighting, and organized visual hierarchy.',
    previewBg: 'from-slate-50 via-slate-100 to-amber-50/30',
    accentColor: '#f59e0b',
    tags: ['Bento Grid', 'Asymmetric Tiles', 'Apple Design', 'Warm Minimal'],
    palette: ['#f59e0b', '#3b82f6', '#10b981', '#1e293b'],
    mockCard: 'bg-white border-slate-200/90 text-slate-800 shadow-md',
    mockHeroBadge: 'bg-amber-50 border-amber-200 text-amber-800'
  }
];

export default function ThemeSelectionStep({
  formData,
  setFormData,
  goToStep
}) {
  const [previewTheme, setPreviewTheme] = useState(null);
  const [deviceView, setDeviceView] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const selectedThemeId = formData.theme_id || 'glassmorphic_pro';

  const handleSelectTheme = (themeId) => {
    setFormData({
      ...formData,
      theme_id: themeId
    });
    toast.success(`Theme switched to ${THEMES.find(t => t.id === themeId)?.name || 'theme'}! ✨`);
  };

  // Render Real Theme inside the Interactive Browser Window
  const renderThemePreview = () => {
    if (!previewTheme) return null;
    const previewData = {
      ...formData,
      theme_id: previewTheme.id
    };
    const commonProps = {
      profile: previewData,
      username: formData.username || 'developer',
      handleResumeDownload: () => toast.success('Resume download tested in preview! 📄'),
      handleContactSubmit: (e) => {
        e.preventDefault();
        toast.success('Contact message tested in preview! ✉️');
      },
      contactForm: { name: 'Lead Recruiter', email: 'recruiter@company.com', message: 'Hello, your portfolio looks incredible!' },
      setContactForm: () => {},
      sending: false
    };

    switch (previewTheme.id) {
      case 'cyberpunk_dark':
        return <CyberpunkTheme {...commonProps} />;
      case 'minimal_elegance':
        return <MinimalEleganceTheme {...commonProps} />;
      case 'neon_developer':
        return <NeonDeveloperTheme {...commonProps} />;
      case '3d_interactive':
        return <ThreeDInteractiveTheme {...commonProps} />;
      case 'bento_grid_ux':
        return <BentoGridTheme {...commonProps} />;
      case 'glassmorphic_pro':
      default:
        return <GlassmorphicTheme {...commonProps} />;
    }
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 border border-slate-200 shadow-md space-y-6 sm:space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-b border-slate-100 pb-6 sm:pb-8">
        <div className="space-y-1.5 sm:space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60 inline-block">
              Step 06 • Theme Studio
            </span>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/80 inline-flex items-center gap-1">
              <Crown size={12} className="text-amber-600" /> 6 Real Full-Website Themes
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Select Your Visual Design Theme
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Click <strong>Full Preview</strong> on any theme to explore the complete, live website (Hero, Tech Matrix, Case Studies, Timeline, and Contact) with your actual data in a crystal-clear simulator.
          </p>
        </div>

        {/* Current Active Theme Indicator */}
        <div className="shrink-0 flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-2xl shadow-xs">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Palette size={18} />
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Portfolio Theme</div>
            <div className="text-xs font-black text-slate-900">
              {THEMES.find(t => t.id === selectedThemeId)?.name || 'Glassmorphic Pro'}
            </div>
          </div>
        </div>
      </div>

      {/* 6 Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {THEMES.map((theme) => {
          const isSelected = selectedThemeId === theme.id;
          return (
            <div
              key={theme.id}
              onClick={() => handleSelectTheme(theme.id)}
              className={`relative rounded-3xl border-2 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer group ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/20 shadow-xl ring-2 ring-indigo-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg'
              }`}
            >
              {/* Active Selection Badge */}
              {isSelected && (
                <div className="absolute top-4 right-4 z-20 bg-indigo-600 text-white text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                  <Check size={13} strokeWidth={3} /> Active
                </div>
              )}

              {/* Theme Mock Visual Preview Banner */}
              <div className={`relative h-44 bg-gradient-to-br ${theme.previewBg} p-5 overflow-hidden flex flex-col justify-between`}>
                
                {/* Palette Dots */}
                <div className="flex items-center gap-1.5 z-10">
                  {theme.palette.map((color, cIdx) => (
                    <span
                      key={cIdx}
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badgeColor}`}>
                    {theme.badge}
                  </span>
                </div>

                {/* Mini Mock Card */}
                <div className={`p-3 rounded-2xl border ${theme.mockCard} shadow-lg relative z-10 mx-1`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${theme.mockHeroBadge}`}>
                      {formData.hero_badge || '✨ Open to Opportunities'}
                    </span>
                    <span className="text-[9px] font-mono opacity-60">2026</span>
                  </div>
                  <div className="text-xs font-black truncate">
                    {formData.full_name || 'Candidate Name'}
                  </div>
                  <div className="text-[10px] opacity-75 truncate mt-0.5">
                    {formData.headline || 'Full Stack & AI Engineer'}
                  </div>
                </div>

                {/* Ambient Glow */}
                <div 
                  className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-2xl opacity-40 pointer-events-none"
                  style={{ backgroundColor: theme.accentColor }}
                />
              </div>

              {/* Theme Content Details */}
              <div className="p-6 space-y-4 flex-1 flex flex-col justify-between bg-white">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {theme.name}
                    </h3>
                  </div>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    {theme.tagline}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {theme.description}
                  </p>
                </div>

                {/* Action Buttons: Preview Modal & Select */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewTheme(theme);
                    }}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Eye size={14} /> Full Website Preview
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTheme(theme.id);
                    }}
                    className={`px-3.5 py-2.5 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check size={14} strokeWidth={3} /> Selected
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> Select
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={() => goToStep(5)}
          className="w-full sm:w-auto px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
        >
          <ArrowLeft size={16} /> Back to Experience
        </button>

        <button
          type="button"
          onClick={() => goToStep(7)}
          className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          Continue to Launch <ArrowRight size={16} />
        </button>
      </div>

      {/* ── CRYSTAL-CLEAR FULL-WEBSITE LIVE SIMULATOR MODAL (CENTERED TO CONTENT AREA) ── */}
      <AnimatePresence>
        {previewTheme && (
          <div className="fixed top-0 bottom-0 right-0 left-0 lg:left-64 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 animate-in fade-in duration-100">
            <div className="relative w-full max-w-5xl h-[90vh] sm:h-[86vh] bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
              
              {/* Browser Window Chrome (Top Header) */}
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                
                {/* Left: macOS dots + Current Theme Name */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-xs font-black text-white">{previewTheme.name}</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">Live Full Website</span>
                  </div>
                </div>

                {/* Middle: Interactive Device Viewport Switcher */}
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeviceView('desktop')}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-bold ${
                      deviceView === 'desktop' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Laptop size={14} /> <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceView('tablet')}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-bold ${
                      deviceView === 'tablet' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Tablet size={14} /> <span className="hidden sm:inline">Tablet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceView('mobile')}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-bold ${
                      deviceView === 'mobile' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone size={14} /> <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>

                {/* Right: Apply Theme & Close */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectTheme(previewTheme.id);
                      setPreviewTheme(null);
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <Check size={14} strokeWidth={3} /> Apply Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTheme(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

              </div>

              {/* Sub-Bar: Quick Switcher Tabs & URL */}
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 text-xs shrink-0 overflow-x-auto">
                <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                  <Globe size={13} className="text-indigo-400 shrink-0" />
                  <span className="truncate">https://careershala.tech/portfolio/{formData.username || 'developer'}</span>
                </div>

                {/* Quick Theme Switch Pills */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">Switch:</span>
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreviewTheme(t)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                        previewTheme.id === t.id
                          ? 'bg-indigo-600 text-white font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Render Viewport (Device frame scaled, crystal-sharp scrollable) */}
              <div className="flex-1 bg-slate-950 overflow-y-auto flex justify-center p-2 sm:p-3">
                <div
                  className={`w-full transition-all duration-200 overflow-y-auto bg-white rounded-xl shadow-2xl ${
                    deviceView === 'desktop'
                      ? 'max-w-full'
                      : deviceView === 'tablet'
                      ? 'max-w-2xl border-4 border-slate-700'
                      : 'max-w-sm border-8 border-slate-700 rounded-[32px]'
                  }`}
                  style={{ height: '100%' }}
                >
                  {renderThemePreview()}
                </div>
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}