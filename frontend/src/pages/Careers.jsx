import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Briefcase,
  Upload,
  FileText,
  Send,
  CheckCircle2,
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  MapPin,
  Check,
  Copy,
  Linkedin,
  Github,
} from 'lucide-react';
import { submitCareerApplication } from '../services/careersApi';
import CustomDropdown from '../components/common/CustomDropdown';
import SEO from '../components/common/SEO';

const JOB_LISTINGS = [
  {
    id: 'fullstack-eng',
    title: 'Full-Stack Engineer',
    department: 'Engineering',
    type: 'Full-Time',
    location: 'Remote',
    level: 'Mid-Senior',
    description: 'Build and scale real-time AI mock interview workflows, ATS scoring APIs, and responsive React dashboards.',
    skills: ['React 18', 'FastAPI', 'Python', 'TailwindCSS', 'PostgreSQL'],
  },
  {
    id: 'ai-nlp-eng',
    title: 'AI / NLP Engineer',
    department: 'AI & Research',
    type: 'Full-Time',
    location: 'Remote',
    level: 'Mid-Senior',
    description: 'Develop LangGraph agent pipelines, semantic BGE vector matching, and LLM evaluation workflows.',
    skills: ['Python', 'LangGraph', 'LLMs', 'BGE Embeddings', 'NLP'],
  },
  {
    id: 'backend-eng',
    title: 'Backend Platform Engineer',
    department: 'Engineering',
    type: 'Full-Time',
    location: 'Remote',
    level: 'Mid-Senior',
    description: 'Design multi-tenant database architectures, RBAC security, and high-throughput async FastAPI services.',
    skills: ['Python', 'FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Docker'],
  },
  {
    id: 'product-designer',
    title: 'Product Designer',
    department: 'Product & Design',
    type: 'Full-Time',
    location: 'Remote',
    level: 'Mid-Senior',
    description: 'Craft clean UI systems, interactive ATS analytics views, and intuitive candidate/recruiter workflows.',
    skills: ['Figma', 'Design Systems', 'UX Research', 'Prototyping'],
  },
];

const OPEN_ROLES = [
  ...JOB_LISTINGS.map((j) => `${j.title} (${j.department})`),
  'General / Other Position Application',
];

export default function Careers() {
  const fileInputRef = useRef(null);
  const formSectionRef = useRef(null);

  const [selectedRole, setSelectedRole] = useState(OPEN_ROLES[0]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    linkedin_url: '',
    github_url: '',
    cover_letter: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectJob = (job) => {
    const matchedRole = OPEN_ROLES.find((r) => r.startsWith(job.title)) || `${job.title} (${job.department})`;
    setSelectedRole(matchedRole);
    toast.success(`Selected "${job.title}". Complete your application below!`);
    scrollToForm();
  };

  const validateAndSetFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }
    const validExts = ['.pdf', '.doc', '.docx'];
    const name = file.name.toLowerCase();
    if (!validExts.some((ext) => name.endsWith(ext))) {
      toast.error('Please upload a PDF, DOC, or DOCX document.');
      return;
    }
    setResumeFile(file);
    toast.success(`Attached resume: ${file.name}`);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('careers@careershala.tech');
    setCopiedEmail(true);
    toast.success('Email copied to clipboard!');
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name.trim()) return toast.error('Full Name is required.');
    if (!formData.email.trim()) return toast.error('Email Address is required.');
    if (!formData.linkedin_url.trim()) return toast.error('LinkedIn Profile URL is required.');
    if (!formData.github_url.trim()) return toast.error('GitHub Profile URL is required.');
    if (!resumeFile) return toast.error('Resume is required. Please attach a PDF, DOC, or DOCX file.');

    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('full_name', formData.full_name.trim());
      data.append('email', formData.email.trim());
      data.append('role', selectedRole);
      data.append('linkedin_url', formData.linkedin_url.trim());
      data.append('github_url', formData.github_url.trim());
      if (formData.cover_letter.trim()) data.append('cover_letter', formData.cover_letter.trim());
      data.append('resume_file', resumeFile);

      const res = await submitCareerApplication(data);
      if (res?.success) {
        setSubmittedSuccess(true);
        toast.success('Application & Resume successfully submitted!');
        setFormData({
          full_name: '',
          email: '',
          linkedin_url: '',
          github_url: '',
          cover_letter: '',
        });
        setResumeFile(null);
      } else {
        toast.error(res?.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to submit application.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-contain custom-scrollbar bg-slate-50 text-slate-900 font-sans selection:bg-[#2E9BDA]/20 selection:text-[#2E9BDA]">
      <SEO
        title="Careers at CareerShala — Join the AI Career Platform Team"
        description="Explore engineering, AI research, and product roles at CareerShala."
        canonical="https://www.careershala.tech/careers"
      />

      {/* Ambient background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-80 bg-gradient-to-b from-sky-200/40 via-indigo-100/20 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* ── STICKY HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center group-hover:shadow-md group-hover:scale-105 transition-all duration-300 p-1.5">
              <img
                src="/logo_t.webp"
                alt="CareerShala Logo"
                width={40}
                height={40}
                decoding="async"
                loading="eager"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:opacity-90 transition-opacity">
                Career<span className="text-[#2E9BDA]">Shala</span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest -mt-1">
                Careers & Talent
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={scrollToForm}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <FileText size={14} className="text-[#2E9BDA]" /> Apply Now
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-xs hover:shadow-md flex items-center gap-1.5"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
      <section className="relative pt-10 pb-10 px-4 sm:px-6 text-center max-w-4xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-bold shadow-xs">
          <Sparkles size={14} className="text-[#2E9BDA]" />
          <span>We're Hiring Builders</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA]" />
          <span className="text-slate-600 font-medium">{JOB_LISTINGS.length} Open Positions</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
          Build the Future of{' '}
          <span className="bg-gradient-to-r from-[#2E9BDA] via-[#3B82F6] to-indigo-600 bg-clip-text text-transparent">
            AI Career Intelligence
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          Join us in building AI career co-pilots, proctored mock interviews, and transparent ATS engines. Reach us anytime at{' '}
          <button
            type="button"
            onClick={handleCopyEmail}
            className="inline-flex items-center gap-1 font-bold text-[#2E9BDA] hover:underline cursor-pointer"
          >
            <span>careers@careershala.tech</span>
            {copiedEmail ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={scrollToForm}
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            Apply for Open Roles <ArrowRight size={15} />
          </button>
          <a
            href="#open-roles"
            className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-xs uppercase tracking-wider border border-slate-200 shadow-xs transition-all flex items-center gap-2"
          >
            <Briefcase size={15} className="text-slate-500" /> View {JOB_LISTINGS.length} Openings
          </a>
        </div>
      </section>

      {/* ── OPEN POSITIONS ────────────────────────────────────────────────── */}
      <section id="open-roles" className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#2E9BDA]">Current Openings</span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Open Positions</h2>
          <p className="text-sm text-slate-600 font-medium">
            Click any role to pre-fill your application below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {JOB_LISTINGS.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-[#2E9BDA]/50 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-50 text-[#2E9BDA] border border-sky-200/80 mb-1.5">
                      {job.department}
                    </span>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-[#2E9BDA] transition-colors">
                      {job.title}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                    {job.level}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{job.description}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <MapPin size={13} className="text-[#2E9BDA]" />
                  {job.location} · {job.type}
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectJob(job)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-[#2E9BDA] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>Apply</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── APPLICATION FORM ──────────────────────────────────────────────── */}
      <section ref={formSectionRef} className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          {submittedSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-900">Application Received!</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Thank you for applying to CareerShala. Our team has received your resume and will review your profile shortly.
              </p>
              <button
                type="button"
                onClick={() => setSubmittedSuccess(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Submit Another Application
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900">Submit Your Application</h2>
                <p className="text-xs text-slate-500 mt-0.5">All fields marked with * are required.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Role / Position *</label>
                <CustomDropdown
                  value={selectedRole}
                  onChange={setSelectedRole}
                  options={OPEN_ROLES.map((r) => ({ value: r, label: r }))}
                  className="w-full"
                  buttonClassName="h-11 text-sm font-medium rounded-xl border-slate-200 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Rohit Agrawal"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-sm outline-none focus:border-[#2E9BDA] focus:ring-4 focus:ring-sky-100 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-sm outline-none focus:border-[#2E9BDA] focus:ring-4 focus:ring-sky-100 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Linkedin size={13} className="text-sky-600" />
                    <span>LinkedIn URL *</span>
                  </label>
                  <input
                    type="url"
                    value={formData.linkedin_url}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-sm outline-none focus:border-[#2E9BDA] focus:ring-4 focus:ring-sky-100 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Github size={13} className="text-slate-700" />
                    <span>GitHub URL *</span>
                  </label>
                  <input
                    type="url"
                    value={formData.github_url}
                    onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-sm outline-none focus:border-[#2E9BDA] focus:ring-4 focus:ring-sky-100 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Resume (PDF, DOC, DOCX · Max 10MB) *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0])}
                  className="hidden"
                />
                {resumeFile ? (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-sky-50 border border-sky-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={16} className="text-[#2E9BDA] shrink-0" />
                      <span className="text-sm font-bold text-slate-900 truncate">{resumeFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResumeFile(null)}
                      className="text-slate-500 hover:text-rose-600 p-1 cursor-pointer"
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingFile(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      validateAndSetFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      isDraggingFile
                        ? 'border-[#2E9BDA] bg-sky-50/70'
                        : 'border-slate-200 hover:border-[#2E9BDA] hover:bg-slate-50'
                    }`}
                  >
                    <Upload size={22} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-bold text-slate-700">Click or drag & drop your resume</p>
                    <p className="text-xs text-slate-400 mt-0.5">PDF, DOC, or DOCX up to 10MB</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Why CareerShala? / Cover Note (Optional)</label>
                <textarea
                  rows={3}
                  value={formData.cover_letter}
                  onChange={(e) => setFormData({ ...formData, cover_letter: e.target.value })}
                  placeholder="Tell us briefly about your work and why you'd like to join..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-sm outline-none focus:border-[#2E9BDA] focus:ring-4 focus:ring-sky-100 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Submit Application</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
