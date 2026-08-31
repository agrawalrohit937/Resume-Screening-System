import React from 'react';
import { 
  ChevronRight, 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Sparkle 
} from 'lucide-react';

export default function Step2Narrative({
  formData,
  setFormData,
  previewText,
  newTypingRole,
  setNewTypingRole,
  handleAddTypingRole,
  handleRemoveTypingRole,
  handleMetricChange,
  goToStep
}) {
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 border border-slate-200/80 shadow-md space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 border-b border-slate-100 pb-6 sm:pb-8">
        <div className="space-y-1.5 sm:space-y-2 max-w-xl">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60 inline-block">
            Step 02 • Narrative Story & Counters
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Hero Subtitle, Rotating Roles, Bio & Metrics
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Configure your dynamic typing roles, narrative bio, and quantifiable accomplishment highlight cards.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Top Status Badge */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Top Hero Status Badge</label>
          <input
            type="text"
            value={formData.hero_badge || ''}
            onChange={(e) => setFormData({ ...formData, hero_badge: e.target.value })}
            placeholder="✨ Open to High-Impact Software & AI Opportunities"
            className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all shadow-2xs"
          />
        </div>

        {/* Live Dynamic Typing Tag Manager & Preview Box */}
        <div className="space-y-3 p-6 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 rounded-3xl border border-indigo-100 shadow-sm">
          
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
              Dynamic Rotating Subtitle Tags ("I am a...")
            </label>
            <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-100/60 px-2.5 py-0.5 rounded-full">
              Live Rotating Preview
            </span>
          </div>

          {/* Interactive Live Typing Bubble */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="text-slate-400">Visitor will see:</span>
            <span>I am a</span>
            <span className="font-extrabold text-indigo-600 border-r-2 border-indigo-600 pr-1 animate-pulse">
              {previewText || 'Developer'}
            </span>
          </div>

          {/* Chip tags list */}
          <div className="flex flex-wrap gap-2 pt-1">
            {formData.typing_roles?.map((role, rIdx) => (
              <span key={rIdx} className="px-3.5 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
                {role}
                <button type="button" onClick={() => handleRemoveTypingRole(role)} className="hover:text-rose-600 text-slate-400 font-black cursor-pointer">&times;</button>
              </span>
            ))}
          </div>

          {/* Add tag form */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Add another role e.g. NLP Specialist, Backend Architect..."
              value={newTypingRole}
              onChange={(e) => setNewTypingRole(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTypingRole(); } }}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />
            <button type="button" onClick={handleAddTypingRole} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-transform active:scale-95">
              + Add Role
            </button>
          </div>

        </div>

        {/* Bio / Narrative Story */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700">About Me / Professional Narrative</label>
            <span className="text-[11px] text-slate-400">{(formData.bio || '').length} characters</span>
          </div>
          <textarea
            rows={4}
            value={formData.bio || ''}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder="Tell your professional story, engineering achievements, and technical passions in detail..."
            className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 leading-relaxed font-medium transition-all shadow-2xs"
          />
        </div>

        {/* 3 Hero Metric Highlight Cards */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
            Hero Metric Counters (Key Highlights)
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => {
              const m = (formData.hero_metrics && formData.hero_metrics[idx]) || { value: '', label: '' };
              return (
                <div key={idx} className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-indigo-600">Metric #{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Value e.g. 15+"
                    value={m.value}
                    onChange={(e) => handleMetricChange(idx, 'value', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Label e.g. Projects Built"
                    value={m.label}
                    onChange={(e) => handleMetricChange(idx, 'label', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={() => goToStep(1)}
          className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft size={15} /> Back to Step 1
        </button>

        <button
          type="button"
          onClick={() => goToStep(3)}
          className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
        >
          Next: Technical Skills <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
