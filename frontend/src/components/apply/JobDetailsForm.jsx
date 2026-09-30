import { Loader2, Sparkles, ScanSearch } from 'lucide-react';
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
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Job Description *
            </label>
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

