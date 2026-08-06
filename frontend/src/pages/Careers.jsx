import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Flame,
  Briefcase,
  Upload,
  FileText,
  Send,
  Users,
  CheckCircle2,
  Globe,
  RefreshCw,
  X,
  Paperclip,
  ChevronDown,
} from 'lucide-react';
import { submitCareerApplication } from '../services/careersApi';

// Open Roles for Dropdown
const OPEN_ROLES = [
  'Senior Full-Stack Engineer (Engineering)',
  'Lead NLP / LLM Engineer (AI Research)',
  'Senior Product Designer (Design)',
  'Backend Platform Architect (Engineering)',
  'Technical Growth & Developer Advocate (Growth)',
  'General / Other Position Application',
];

export default function Careers() {
  const fileInputRef = useRef(null);

  const [selectedRole, setSelectedRole] = useState(OPEN_ROLES[0]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    portfolio_url: '',
    cover_letter: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds 10MB limit.');
        return;
      }
      setResumeFile(file);
      toast.success(`Selected resume: ${file.name}`);
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || !formData.cover_letter) {
      toast.error('Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('full_name', formData.full_name.trim());
      data.append('email', formData.email.trim());
      data.append('role', selectedRole);
      if (formData.portfolio_url) {
        data.append('portfolio_url', formData.portfolio_url.trim());
      }
      data.append('cover_letter', formData.cover_letter.trim());
      if (resumeFile) {
        data.append('resume_file', resumeFile);
      }

      const res = await submitCareerApplication(data);

      if (res?.success) {
        setSubmittedSuccess(true);
        toast.success('Application & Resume sent to hiring team!');
        setFormData({ full_name: '', email: '', portfolio_url: '', cover_letter: '' });
        setResumeFile(null);
      } else {
        toast.error(res?.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      console.error('Submit Application Error:', err);
      const msg = err.response?.data?.detail || err.message || 'Failed to submit application.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#2E9BDA]/20 selection:text-[#2E9BDA] relative">
      {/* Background Decorator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 bg-gradient-to-b from-sky-200/40 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:scale-105 transition-all duration-300 p-1.5">
              <img src="/logo_t.png" alt="CareerShala Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:opacity-80 transition-opacity">
              Career<span className="text-[#2E9BDA]">Shala</span> <span className="text-xs font-bold text-slate-400 font-mono">/ Careers</span>
            </span>
          </Link>

          <Link
            to="/"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        
        {/* Header Title */}
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-black uppercase tracking-wider">
            <Flame size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
            WE ARE HIRING!
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Apply to Join CareerShala
          </h1>
          <p className="text-sm text-slate-600 font-medium max-w-md mx-auto">
            Fill out the quick form below, attach your PDF resume, and our engineering team will get back to you within 48 hours.
          </p>
        </div>

        {/* ── APPLICATION FORM CARD ─────────────────────────────────────────── */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-10 shadow-xl shadow-slate-200/50 space-y-6">

          {submittedSuccess ? (
            <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Application Submitted!</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md mx-auto leading-relaxed">
                Your application and resume PDF have been dispatched via Brevo to our hiring team. We'll review your profile and reach out shortly!
              </p>
              <button
                onClick={() => setSubmittedSuccess(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-slate-800 transition-colors"
              >
                Submit Another Application
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Full Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Users size={13} className="text-[#2E9BDA]" /> Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none focus:border-[#2E9BDA] focus:ring-1 focus:ring-[#2E9BDA]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Send size={13} className="text-[#2E9BDA]" /> Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email" required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="rahul@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none focus:border-[#2E9BDA] focus:ring-1 focus:ring-[#2E9BDA]"
                  />
                </div>
              </div>

              {/* Target Position Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Briefcase size={13} className="text-[#2E9BDA]" /> Target Position <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 appearance-none focus:outline-none focus:border-[#2E9BDA] focus:ring-1 focus:ring-[#2E9BDA] pr-10 cursor-pointer"
                  >
                    {OPEN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Portfolio / GitHub Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Globe size={13} className="text-[#2E9BDA]" /> Portfolio / GitHub Link <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={formData.portfolio_url}
                  onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                  placeholder="https://github.com/rahulsharma"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none focus:border-[#2E9BDA] focus:ring-1 focus:ring-[#2E9BDA]"
                />
              </div>

              {/* PDF Resume Upload Dropzone */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Paperclip size={13} className="text-[#2E9BDA]" /> Attach Resume (PDF)
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {resumeFile ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 truncate max-w-xs">{resumeFile.name}</p>
                        <p className="text-[11px] text-emerald-700 font-semibold">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB · Attached</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResumeFile(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#2E9BDA] bg-slate-50 hover:bg-sky-50/50 cursor-pointer transition-all text-center space-y-2 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#2E9BDA] mx-auto flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Upload size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Click to upload your Resume <span className="text-[#2E9BDA]">(PDF format)</span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">Supports PDF, DOC, DOCX up to 10MB</p>
                  </div>
                )}
              </div>

              {/* Cover Letter / Pitch */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <FileText size={13} className="text-[#2E9BDA]" /> Cover Letter / Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4} required
                  value={formData.cover_letter}
                  onChange={(e) => setFormData({ ...formData, cover_letter: e.target.value })}
                  placeholder="Briefly describe your experience and why you are interested in this position..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none focus:border-[#2E9BDA] focus:ring-1 focus:ring-[#2E9BDA] leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#3B82F6] hover:from-[#3B82F6] hover:to-indigo-600 text-white font-extrabold text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-[#2E9BDA]/25 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Submitting Application & Resume...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit Application
                  </>
                )}
              </button>
            </form>
          )}
        </div>

      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 font-medium">
        <p>© {new Date().getFullYear()} CareerShala Technologies. All rights reserved.</p>
      </footer>
    </div>
  );
}
