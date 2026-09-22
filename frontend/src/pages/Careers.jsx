import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  Sparkles,
  ArrowRight,
  Laptop,
  HeartHandshake,
  GraduationCap,
  Plane,
  Clock,
  ShieldCheck,
  Code2,
  MapPin,
  Check,
  Copy,
  Linkedin,
  Github,
} from 'lucide-react';
import { submitCareerApplication } from '../services/careersApi';
import CustomDropdown from '../components/common/CustomDropdown';

// Available Positions
const JOB_LISTINGS = [
  {
    id: 'fullstack-sr',
    title: 'Senior Full-Stack Engineer',
    department: 'Engineering',
    type: 'Full-Time',
    location: 'Remote (Worldwide)',
    level: 'Senior / Staff',
    description: 'Design and scale real-time AI mock interview services, resilient asynchronous scoring pipelines, and reactive dashboard experiences.',
    skills: ['React 18', 'FastAPI', 'Python', 'TailwindCSS', 'WebSockets', 'Redis'],
  },
  {
    id: 'ai-llm-lead',
    title: 'Lead NLP / LLM Engineer',
    department: 'AI & Research',
    type: 'Full-Time',
    location: 'Remote (Worldwide)',
    level: 'Lead / Staff',
    description: 'Lead prompt engineering architecture, local model distillation, semantic scoring algorithms, and autonomous interview agents.',
    skills: ['PyTorch', 'Transformers', 'LangChain', 'Vector Search', 'vLLM', 'Fine-Tuning'],
  },
  {
    id: 'backend-arch',
    title: 'Backend Platform Architect',
    department: 'Engineering',
    type: 'Full-Time',
    location: 'Remote (Worldwide)',
    level: 'Senior / Lead',
    description: 'Architect distributed microservices, multi-tenant database isolation, job alert workers, and high-throughput ATS ingestion engines.',
    skills: ['Python', 'FastAPI', 'PostgreSQL', 'MongoDB', 'AsyncIO', 'Docker'],
  },
  {
    id: 'product-designer',
    title: 'Senior Product Designer',
    department: 'Product & Design',
    type: 'Full-Time',
    location: 'Remote (Worldwide)',
    level: 'Mid-Senior',
    description: 'Shape the visual language, design systems, interactive telemetry dashboards, and proctored interview UI for candidates and recruiters.',
    skills: ['Figma', 'Design Systems', 'UX Research', 'Micro-Interactions', 'Prototyping'],
  },
  {
    id: 'frontend-ai',
    title: 'Frontend AI Engineer',
    department: 'Engineering',
    type: 'Full-Time',
    location: 'Remote (Worldwide)',
    level: 'Mid-Senior',
    description: 'Craft ultra-smooth WebRTC video proctoring experiences, canvas audio visualizers, and state-of-the-art interactive feedback telemetry.',
    skills: ['React', 'WebRTC', 'MediaStreams', 'Framer Motion', 'Vite', 'TypeScript'],
  },
  {
    id: 'growth-advocate',
    title: 'Technical Growth & Developer Advocate',
    department: 'Growth',
    type: 'Full-Time',
    location: 'Remote (Worldwide)',
    level: 'All Levels',
    description: 'Drive open-source adoption, write in-depth technical blogs, host AI webinars, and champion the CareerShala developer community.',
    skills: ['DevRel', 'Technical Writing', 'OSS Community', 'Product Marketing', 'AI Tools'],
  },
];

const OPEN_ROLES = [
  ...JOB_LISTINGS.map((j) => `${j.title} (${j.department})`),
  'General / Other Position Application',
];

const PERKS = [
  {
    icon: Laptop,
    title: 'Top-Tier Gear & AI Stack',
    desc: 'Top-spec Apple M3 MacBook, high-res external monitors, and unlimited OpenAI, Anthropic, and cloud compute credits.',
    color: 'from-blue-500/10 to-sky-500/10 text-sky-600',
  },
  {
    icon: Globe,
    title: '100% Remote & Async First',
    desc: 'Work from wherever you are most productive. We value thoughtful async collaboration, outcome over hours, and deep work.',
    color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600',
  },
  {
    icon: HeartHandshake,
    title: 'Premium Healthcare & Wellness',
    desc: 'Comprehensive health, dental, and vision insurance for you and your dependents, plus monthly wellness allowances.',
    color: 'from-rose-500/10 to-pink-500/10 text-rose-600',
  },
  {
    icon: GraduationCap,
    title: '$1,500 Learning Stipend',
    desc: 'Annual education budget for tech conferences, certifications, books, and specialized AI/engineering masterclasses.',
    color: 'from-amber-500/10 to-orange-500/10 text-amber-600',
  },
  {
    icon: Clock,
    title: 'Flexible PTO & Mental Health Days',
    desc: 'Flexible paid time off with mandatory minimums, parental leave, and designated quarterly company recharge days.',
    color: 'from-purple-500/10 to-indigo-500/10 text-purple-600',
  },
  {
    icon: Plane,
    title: 'Annual Global Team Retreats',
    desc: 'Twice-a-year all-expense-paid team get-togethers in inspiring destinations for bonding, hackathons, and fun.',
    color: 'from-cyan-500/10 to-blue-500/10 text-cyan-600',
  },
];

const HIRING_STEPS = [
  {
    step: '01',
    title: 'Application & Resume Review',
    desc: 'Our hiring team reviews your submitted resume, LinkedIn, and GitHub. We respond to all applicants within 48 hours.',
  },
  {
    step: '02',
    title: 'Technical Screen & System Design',
    desc: 'A practical, conversational 45-minute pairing session focused on realistic engineering scenarios—not obscure puzzles.',
  },
  {
    step: '03',
    title: 'Culture & Cross-Functional Alignment',
    desc: 'Meet our founders and cross-functional team members to talk product philosophy, vision, and how you love to work.',
  },
  {
    step: '04',
    title: 'Offer & Seamless Onboarding',
    desc: 'We present a transparent, competitive offer with equity. Once accepted, your hardware arrives at your door before Day 1.',
  },
];

export default function Careers() {
  const fileInputRef = useRef(null);
  const formSectionRef = useRef(null);

  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedRole, setSelectedRole] = useState(OPEN_ROLES[0]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    cover_letter: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Filter jobs by department
  const departments = ['All', 'Engineering', 'AI & Research', 'Product & Design', 'Growth'];
  const filteredJobs = selectedDept === 'All'
    ? JOB_LISTINGS
    : JOB_LISTINGS.filter((j) => j.department === selectedDept);

  // Quick apply from job card
  const handleSelectJob = (job) => {
    const matchedRole = OPEN_ROLES.find((r) => r.startsWith(job.title)) || `${job.title} (${job.department})`;
    setSelectedRole(matchedRole);
    toast.success(`Selected "${job.title}". Complete your application below!`, { icon: '🎯' });
    if (formSectionRef.current) {
      formSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll directly to application form
  const scrollToForm = () => {
    if (formSectionRef.current) {
      formSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
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

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  // Copy Email Helper
  const handleCopyEmail = () => {
    navigator.clipboard.writeText('careers@careershala.tech');
    setCopiedEmail(true);
    toast.success('Email copied to clipboard!');
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  // Handle Form Submission with Strict Validation
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validate Full Name
    if (!formData.full_name.trim()) {
      toast.error('Full Name is required.');
      return;
    }

    // 2. Validate Email Address
    if (!formData.email.trim()) {
      toast.error('Email Address is required.');
      return;
    }

    // 3. Validate LinkedIn URL
    if (!formData.linkedin_url.trim()) {
      toast.error('LinkedIn Profile URL is required.');
      return;
    }

    // 4. Validate GitHub URL
    if (!formData.github_url.trim()) {
      toast.error('GitHub Profile URL is required.');
      return;
    }

    // 5. Validate Resume File (STRICTLY REQUIRED)
    if (!resumeFile) {
      toast.error('Resume is required. Please attach a PDF, DOC, or DOCX file.');
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('full_name', formData.full_name.trim());
      data.append('email', formData.email.trim());
      data.append('role', selectedRole);
      data.append('linkedin_url', formData.linkedin_url.trim());
      data.append('github_url', formData.github_url.trim());
      if (formData.portfolio_url.trim()) {
        data.append('portfolio_url', formData.portfolio_url.trim());
      }
      if (formData.cover_letter.trim()) {
        data.append('cover_letter', formData.cover_letter.trim());
      }
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
          portfolio_url: '',
          cover_letter: '',
        });
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
    <div className="fixed inset-0 overflow-y-auto overscroll-y-contain custom-scrollbar bg-slate-50 text-slate-900 font-sans selection:bg-[#2E9BDA]/20 selection:text-[#2E9BDA]">
      {/* Ambient background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-96 bg-gradient-to-b from-sky-200/50 via-indigo-100/30 to-transparent blur-3xl pointer-events-none -z-10" />

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

          {/* Quick Nav Links */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={scrollToForm}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
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
      <section className="relative pt-12 pb-16 px-4 sm:px-6 text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-bold shadow-xs">
          <Sparkles size={14} className="text-[#2E9BDA] animate-pulse" />
          <span>We're Hiring High-Ownership Builders</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA]" />
          <span className="text-slate-600 font-medium">6 Open Positions</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
          Build the Future of <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-[#2E9BDA] via-[#3B82F6] to-indigo-600 bg-clip-text text-transparent">
            AI Career Intelligence
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          We are engineering autonomous career co-pilots, real-time proctored mock interview simulators, and predictive ATS engines. Join a fast-paced, high-impact team.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <button
            onClick={scrollToForm}
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            Apply for Open Roles <ArrowRight size={15} />
          </button>
          <a
            href="#open-roles"
            className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-xs uppercase tracking-wider border border-slate-200/90 shadow-xs transition-all flex items-center gap-2"
          >
            <Briefcase size={15} className="text-slate-500" /> View 6 Openings
          </a>
        </div>

        {/* Highlight Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-8 max-w-3xl mx-auto">
          {[
            { label: 'Workplace Mode', value: '100% Remote-First', icon: Globe },
            { label: 'Interview Sessions', value: '10K+ Completed', icon: Users },
            { label: 'Engineering Stack', value: 'Modern AI / React', icon: Code2 },
            { label: 'Hiring Decision', value: '< 7 Days Offer', icon: ShieldCheck },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-center flex flex-col items-center justify-center gap-1 hover:border-slate-300 transition-colors"
              >
                <Icon size={18} className="text-[#2E9BDA] mb-1" />
                <span className="text-sm sm:text-base font-extrabold text-slate-900">{stat.value}</span>
                <span className="text-[11px] font-semibold text-slate-500">{stat.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CULTURE & PERKS BENTO GRID ────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#2E9BDA]">Life at CareerShala</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Perks Crafted for High Performance
          </h2>
          <p className="text-sm text-slate-600 font-medium max-w-lg mx-auto">
            We give talented builders the freedom, resources, and environment to do their life's best work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PERKS.map((perk, idx) => {
            const Icon = perk.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-7 shadow-xs hover:shadow-lg hover:border-sky-200 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${perk.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#2E9BDA] transition-colors">
                    {perk.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                    {perk.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── OPEN POSITIONS EXPLORER ───────────────────────────────────────── */}
      <section id="open-roles" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#2E9BDA]">Current Openings</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Join Our Engineering & AI Teams
            </h2>
            <p className="text-sm text-slate-600 font-medium">
              Click any role to pre-fill your application below.
            </p>
          </div>

          {/* Department Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200/90 shadow-xs self-start md:self-auto">
            {departments.map((dept) => {
              const count = dept === 'All' ? JOB_LISTINGS.length : JOB_LISTINGS.filter((j) => j.department === dept).length;
              const isActive = selectedDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{dept}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-200/70 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Job Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-7 shadow-xs hover:shadow-xl hover:border-[#2E9BDA]/40 transition-all duration-300 flex flex-col justify-between space-y-5 group relative"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-50 text-[#2E9BDA] border border-sky-200/80 mb-2">
                      {job.department}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 group-hover:text-[#2E9BDA] transition-colors">
                      {job.title}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                    {job.level}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-slate-400" /> {job.location}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-slate-400" /> {job.type}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  {job.description}
                </p>

                {/* Tech Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {job.skills.map((skill, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card CTA */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <Flame size={13} /> Actively Reviewing
                </span>
                <button
                  onClick={() => handleSelectJob(job)}
                  className="px-4 py-2 rounded-xl bg-slate-900 group-hover:bg-[#2E9BDA] text-white text-xs font-extrabold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  Apply for Role <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HIRING PROCESS JOURNEY ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#2E9BDA]">Transparent Journey</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            How Our Hiring Process Works
          </h2>
          <p className="text-sm text-slate-600 font-medium max-w-md mx-auto">
            Fast, transparent, and respectful of your time. No endless rounds or take-home tests that take weeks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HIRING_STEPS.map((step, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 relative hover:border-slate-300 transition-colors"
            >
              <span className="text-3xl font-black text-slate-200 font-mono">{step.step}</span>
              <h4 className="text-sm font-extrabold text-slate-900">{step.title}</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MAIN APPLICATION FORM SECTION ─────────────────────────────────── */}
      <section ref={formSectionRef} className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Submit Your Application
          </h2>
          <p className="text-sm text-slate-600 font-normal max-w-md mx-auto">
            Please fill out all required fields below and attach your resume.
          </p>
        </div>

        {/* ── APPLICATION FORM CARD (Clean Enterprise Style) ────────────────── */}
        <div className="rounded-xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
          {submittedSuccess ? (
            <div className="p-6 sm:p-8 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white mx-auto flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-slate-900">Application Submitted</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Thank you for applying. Your application and resume have been dispatched to our hiring team at{' '}
                  <strong className="text-slate-800">careers@careershala.tech</strong>. We will review your materials and reach out shortly.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setSubmittedSuccess(false)}
                  className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
                >
                  Submit Another Application
                </button>
                <Link
                  to="/"
                  className="px-4 py-2 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Full Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="careers_full_name"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="careers_full_name"
                    type="text"
                    required
                    aria-label="Full Name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Rohit Agrawal"
                    className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="careers_email"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="careers_email"
                    type="email"
                    required
                    aria-label="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="rohit@example.com"
                    className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
              </div>

              {/* Target Position Dropdown */}
              <div>
                <label
                  htmlFor="careers_position"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Position <span className="text-red-500">*</span>
                </label>
                <CustomDropdown
                  id="careers_position"
                  value={selectedRole}
                  onChange={(val) => setSelectedRole(val)}
                  options={OPEN_ROLES}
                  className="w-full"
                  buttonClassName="bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* LinkedIn URL & GitHub URL Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="careers_linkedin"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    LinkedIn Profile URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="careers_linkedin"
                    type="url"
                    required
                    aria-label="LinkedIn Profile URL"
                    value={formData.linkedin_url}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="careers_github"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    GitHub Profile URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="careers_github"
                    type="url"
                    required
                    aria-label="GitHub Profile URL"
                    value={formData.github_url}
                    onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                    placeholder="https://github.com/username"
                    className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
              </div>

              {/* Portfolio / Personal Website (Optional) */}
              <div>
                <label
                  htmlFor="careers_portfolio"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Portfolio / Personal Website <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="careers_portfolio"
                  type="url"
                  aria-label="Portfolio or Personal Website URL"
                  value={formData.portfolio_url}
                  onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                  placeholder="https://yourportfolio.dev"
                  className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                />
              </div>

              {/* Resume File Upload Dropzone (STRICTLY REQUIRED) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Resume File <span className="text-red-500">*</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {resumeFile ? (
                  <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{resumeFile.name}</p>
                        <p className="text-[11px] text-slate-500 font-normal">
                          {(resumeFile.size / 1024 / 1024).toFixed(2)} MB · Attached
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResumeFile(null)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove file"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`p-6 rounded-md border-2 border-dashed transition-all text-center cursor-pointer ${
                      isDraggingFile
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-600 mx-auto flex items-center justify-center shadow-xs mb-2">
                      <Upload size={16} />
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">PDF, DOC, DOCX up to 10MB (Required)</p>
                  </div>
                )}
              </div>

              {/* Cover Letter (OPTIONAL) */}
              <div>
                <label
                  htmlFor="careers_cover_letter"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Cover Letter / Additional Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="careers_cover_letter"
                  rows={3}
                  value={formData.cover_letter}
                  onChange={(e) => setFormData({ ...formData, cover_letter: e.target.value })}
                  placeholder="Tell us why you are interested in this position or share details about relevant projects..."
                  className="w-full bg-white border border-slate-300 rounded-md py-2 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors leading-relaxed"
                />
              </div>

              {/* Sleek Dark Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Submitting Application...
                  </>
                ) : (
                  <>
                    <Send size={15} /> Submit Application
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Talent Acquisition Direct Contact Note */}
        <div className="rounded-lg bg-white border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Questions about open positions?</h4>
            <p className="text-xs text-slate-500">Reach our talent acquisition team directly at careers@careershala.tech</p>
          </div>
          <button
            type="button"
            onClick={handleCopyEmail}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
          >
            {copiedEmail ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-slate-500" />}
            {copiedEmail ? 'Copied!' : 'Copy Email'}
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 font-medium space-y-2">
        <div className="flex items-center justify-center gap-4 text-slate-600 font-semibold text-[11px]">
          <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link>
          <span>·</span>
          <a href="#open-roles" className="hover:text-slate-900 transition-colors">Open Roles</a>
          <span>·</span>
          <button onClick={scrollToForm} className="hover:text-slate-900 transition-colors">Apply Now</button>
          <span>·</span>
          <a href="mailto:careers@careershala.tech" className="hover:text-slate-900 transition-colors">Contact HR</a>
        </div>
        <p>© {new Date().getFullYear()} CareerShala Technologies. All rights reserved. Equal Opportunity Employer.</p>
      </footer>
    </div>
  );
}
