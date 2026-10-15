import { Loader2, Sparkles, ScanSearch, Clipboard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobDetailsForm({ values, setValues, extracting, onSubmit, onCheckATS, isSubmitting }) {
  const safeValues = values || {
    company_name: '',
    job_title: '',
    hr_email: '',
    job_description: '',
  };

  const handleChange = (field) => (e) => {
    if (typeof setValues === 'function') {
      setValues((prev) => ({ ...(prev || {}), [field]: e.target.value }));
    }
  };

  const handlePasteJD = async (e) => {
    e.preventDefault();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
          setValues((prev) => ({
            ...(prev || {}),
            hr_email: (prev && prev.hr_email) ? prev.hr_email : (emailMatch ? emailMatch[0] : ''),
            job_description: text
          }));
          toast.success('Job description pasted! 📋✨');
          return;
        }
      }
      toast.error('No text found in clipboard. Copy job description first.');
    } catch (err) {
      toast.error('Clipboard permission blocked. Please paste directly into the box.');
    }
  };

  const validateFields = () => {
    if (!safeValues.company_name?.trim()) {
      toast.error('Please enter the company name.');
      return false;
    }
    if (!safeValues.job_title?.trim()) {
      toast.error('Please enter the job title.');
      return false;
    }
    if (!safeValues.hr_email?.trim()) {
      toast.error('Please enter the recruiter / HR email.');
      return false;
    }
    if (!safeValues.job_description?.trim()) {
      toast.error('Please provide the job description.');
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateFields()) return;
    if (onSubmit) onSubmit(safeValues);
  };

  const handleCheckATS = (e) => {
    e.preventDefault();
    if (!validateFields()) return;
    if (onCheckATS) onCheckATS(safeValues);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {extracting ? (
        /* Shimmer / Skeleton Loading State while AI Vision processes screenshot */
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg w-fit border border-indigo-100">
            <Loader2 size={14} className="animate-spin text-indigo-600" />
            <span>AI Vision is extracting details for form fields...</span>
          </div>

          <div className="space-y-2">
            <div className="h-3 w-28 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-11 w-full rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="h-3 w-24 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-11 w-full rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="h-3 w-32 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-11 w-full rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="h-3 w-36 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-36 w-full rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-pulse" />
          </div>
        </div>
      ) : (
        /* Clean Output Form */
        <>
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={safeValues.company_name}
              onChange={handleChange('company_name')}
              placeholder="e.g. Google / Stripe"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Job Title *
            </label>
            <input
              type="text"
              required
              value={safeValues.job_title}
              onChange={handleChange('job_title')}
              placeholder="e.g. Senior Full-Stack Engineer"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              HR / Recruiter Email *
            </label>
            <input
              type="email"
              required
              value={safeValues.hr_email}
              onChange={handleChange('hr_email')}
              placeholder="e.g. careers@company.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Job Description *
              </label>
              <button
                type="button"
                onClick={handlePasteJD}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 px-2.5 py-0.5 rounded-lg border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
              >
                <Clipboard size={12} className="text-indigo-600" />
                <span>Paste JD</span>
              </button>
            </div>
            <textarea
              required
              rows={7}
              value={safeValues.job_description}
              onChange={handleChange('job_description')}
              placeholder="Paste the full job description or auto-extract via screenshot on the left..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all resize-none"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Primary Action: 1-Click Express Apply */}
            <button
              type="submit"
              disabled={isSubmitting || extracting}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-[#2E9BDA] hover:from-indigo-700 hover:to-[#2380b8] px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Drafting Tailored Application...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-amber-300" />
                  <span>⚡ 1-Click Express Apply (Auto-Draft)</span>
                </>
              )}
            </button>
          </div>

        </>
      )}
    </form>
  );
}

