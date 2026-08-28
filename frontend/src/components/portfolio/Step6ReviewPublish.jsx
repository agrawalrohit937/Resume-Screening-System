import React from 'react';
import { 
  Rocket, 
  Sparkles, 
  CheckCircle2, 
  Eye, 
  ArrowLeft, 
  Palette,
  Crown,
  Globe,
  Lock
} from 'lucide-react';
import { THEMES } from './ThemeSelectionStep';

export default function Step6ReviewPublish({
  formData,
  totalSkillsCount,
  publicUrl,
  saving,
  handleSaveAndPublish,
  goToStep,
  isPremium
}) {
  const currentTheme = THEMES.find(t => t.id === formData.theme_id) || THEMES[0];

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-2xl text-center space-y-8">
      
      {/* Launch Badge Icon */}
      <div className="relative w-20 h-20 mx-auto">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner border border-emerald-200">
          <Rocket size={38} className="animate-bounce" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-tr from-amber-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-md">
          <Sparkles size={14} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-200/60 inline-block">
            Step 07 • Review & Launch
          </span>
          {isPremium ? (
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-3.5 py-1 rounded-full border border-amber-200/80 inline-flex items-center gap-1">
              <Crown size={12} className="text-amber-600" /> VIP Verified
            </span>
          ) : (
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-200/80 inline-flex items-center gap-1">
              <Lock size={12} className="text-indigo-600" /> Paywall Protected
            </span>
          )}
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Your Portfolio Website is Ready to Launch!
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
          All modules have been assembled with candidate identity, contact channels, 6-domain tech matrix, case studies, and your chosen visual theme.
        </p>
      </div>

      {/* Summary Review Card */}
      <div className="p-6 sm:p-7 bg-slate-50 border border-slate-200 rounded-3xl max-w-xl mx-auto text-left space-y-3.5 text-xs shadow-inner">
        <div className="flex items-center justify-between py-2 border-b border-slate-200">
          <span className="text-slate-500 font-medium">Candidate Name:</span>
          <strong className="text-slate-900 font-bold text-sm">{formData.full_name || 'Candidate'}</strong>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-200">
          <span className="text-slate-500 font-medium">Live Vanity Handle:</span>
          <strong className="text-indigo-600 font-mono text-xs flex items-center gap-1">
            <Globe size={13} /> /portfolio/{formData.username}
          </strong>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-200">
          <span className="text-slate-500 font-medium">Visual Design Theme:</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Palette size={13} className="text-indigo-600" />
              {currentTheme.name}
            </span>
            <button
              type="button"
              onClick={() => goToStep(6)}
              className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
            >
              (Change)
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-200">
          <span className="text-slate-500 font-medium">Featured Case Studies:</span>
          <strong className="text-slate-900 font-bold">{formData.projects?.length || 0} Projects</strong>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-slate-500 font-medium">Active Skills:</span>
          <strong className="text-slate-900 font-bold">{totalSkillsCount} Skills in 6 Domains</strong>
        </div>
      </div>

      {/* Launch Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
        <button
          type="button"
          onClick={() => goToStep(6)}
          className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <ArrowLeft size={16} /> Back to Theme Studio
        </button>

        <button
          type="button"
          onClick={handleSaveAndPublish}
          disabled={saving}
          className="px-10 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-600/30 transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2.5 cursor-pointer"
        >
          <CheckCircle2 size={18} />
          {saving ? 'Publishing Live...' : isPremium ? '🚀 Save & Publish Live Website' : '👑 Unlock & Publish Live Website'}
        </button>

        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <Eye size={16} /> Preview Public Page
        </a>
      </div>
    </div>
  );
}
