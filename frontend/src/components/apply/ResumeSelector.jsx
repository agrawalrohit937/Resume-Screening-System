import { useEffect, useState } from 'react';
// ASSUMPTION: reuse your existing resume-list API wrapper - swap this
// import for whatever services/api.js (or a dedicated resumeApi.js)
// already exposes for GET /resume/.
import api from '../../services/api';

/**
 * Auto-resolves the user's parsed resume with ZERO new backend logic:
 * 0 parsed resumes -> prompt upload (existing upload flow)
 * 1 parsed resume  -> auto-select silently, render nothing
 * 2+ parsed resumes -> show a picker
 */
export default function ResumeSelector({ onResolved }) {
  const [state, setState] = useState({ status: 'loading', resumes: [] });
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api
      .get('/resume/', { params: { status: 'parsed' } })
      .then((res) => {
        const raw = res.data?.resumes || res.data?.items || (Array.isArray(res.data) ? res.data : []);
        const parsed = Array.isArray(raw) ? raw : [];
        if (parsed.length === 0) {
          setState({ status: 'none', resumes: [] });
        } else {
          const autoId = parsed[0]._id || parsed[0].id;
          setSelectedId(autoId);
          onResolved(autoId);

          if (parsed.length === 1) {
            setState({ status: 'single', resumes: parsed });
          } else {
            setState({ status: 'multiple', resumes: parsed });
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch resumes:', err);
        setState({ status: 'none', resumes: [] });
      });
  }, [onResolved]);

  const handleSelect = (id) => {
    setSelectedId(id);
    onResolved(id);
  };

  if (state.status === 'loading') {
    return <p className="text-sm text-gray-500">Checking your resumes...</p>;
  }

  if (state.status === 'none') {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        You don't have a parsed resume yet.{' '}
        <a href="/upload" className="font-medium underline">
          Upload one first
        </a>
        , then come back here.
      </div>
    );
  }

  if (state.status === 'single') {
    return null; // auto-resolved silently
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-slate-700">Attached Resume</label>
        <span className="text-xs text-slate-500 font-medium">Auto-selected latest</span>
      </div>
      <div className="space-y-2">
        {state.resumes.map((r) => {
          const id = r._id || r.id;
          const isSelected = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              className={`w-full flex items-center justify-between text-left rounded-lg border px-3 py-2 text-sm font-medium transition ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 ring-1 ring-indigo-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">{r.filename || r.name || 'Resume'}</span>
              {isSelected && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">Active</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
