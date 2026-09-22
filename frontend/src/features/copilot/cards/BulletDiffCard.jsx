import React, { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';

export default function BulletDiffCard({ data }) {
  const [copied, setCopied] = useState(false);
  if (!data) return null;

  const original = data.original || data.before || "Worked on backend APIs and fixed performance bugs.";
  const enhanced = data.enhanced || data.after || "Engineered scalable REST APIs using FastAPI and optimized database query execution plans, reducing p99 latency by 42% across 2M daily requests.";

  const handleCopy = () => {
    navigator.clipboard.writeText(enhanced);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-800 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Sparkles size={13} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">STAR Resume Enhancer</h4>
            <p className="text-[11px] text-emerald-600 font-semibold">Quantified Impact Added</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px] font-medium flex items-center gap-1 transition-all cursor-pointer"
          title="Copy Enhanced Bullet"
        >
          {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Before / After */}
      <div className="space-y-1.5 text-[11.5px]">
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-rose-600 block mb-0.5">
            Before (Weak/Generic)
          </span>
          <p className="text-slate-600 leading-relaxed line-through decoration-rose-400">{original}</p>
        </div>

        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">
            After (STAR + Metrics)
          </span>
          <p className="text-emerald-900 font-medium leading-relaxed">{enhanced}</p>
        </div>
      </div>
    </div>
  );
}
