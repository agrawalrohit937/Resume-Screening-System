import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  enhancePortfolioContent,
  savePortfolio,
  getMyPortfolio,
  uploadPortfolioPhoto
} from '../services/portfolioApi';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import Step1Identity from '../components/portfolio/Step1Identity';
import Step2Narrative from '../components/portfolio/Step2Narrative';
import Step3Skills from '../components/portfolio/Step3Skills';
import Step4Projects from '../components/portfolio/Step4Projects';
import Step5Experience from '../components/portfolio/Step5Experience';
import ThemeSelectionStep, { THEMES } from '../components/portfolio/ThemeSelectionStep';
import Step6ReviewPublish from '../components/portfolio/Step6ReviewPublish';
import PortfolioPaywallModal from '../components/portfolio/PortfolioPaywallModal';
import { 
  Sparkles, 
  ExternalLink, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Globe, 
  Github, 
  Linkedin, 
  Eye, 
  Share2, 
  Copy,
  Camera,
  Image as ImageIcon,
  User,
  FileText,
  Code2,
  Rocket,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Briefcase,
  Check,
  RefreshCw,
  Layers,
  ArrowRight,
  X,
  ShieldCheck,
  Zap,
  MapPin,
  Mail,
  Phone,
  Link2,
  ArrowLeft,
  Laptop,
  CheckCircle,
  Clock,
  Sparkle,
  Sliders,
  Palette,
  Terminal,
  Cpu,
  Database,
  Wrench,
  LineChart,
  Brain,
  Star,
  Award,
  Server,
  Smartphone,
  Monitor,
  Edit3,
  Flame,
  CheckCheck,
  Twitter,
  Mic,
  Bot,
  Settings
} from 'lucide-react';
import { cleanSkillsDict } from '../components/portfolio/Step3Skills';

export default function PortfolioBuilder() {
  const navigate = useNavigate();
  const { user, refreshUser, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [enhancingIndex, setEnhancingIndex] = useState(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [showPostLaunchModal, setShowPostLaunchModal] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [profileSynced, setProfileSynced] = useState(false);

  const isPremium = user?.plan === 'premium' || user?.isPremium || user?.subscription_tier === 'premium';

  // View mode: 'overview' (Screen 0) or 'step' (Cards 1 to 7)
  const [viewMode, setViewMode] = useState('overview');
  const [currentStep, setCurrentStep] = useState(1);
  const [stepDirection, setStepDirection] = useState(1); // 1 = forward, -1 = backward

  // Accordion state for Projects & Experience
  const [expandedProjectIdx, setExpandedProjectIdx] = useState(0);
  const [expandedExpIdx, setExpandedExpIdx] = useState(0);

  const [newSkillText, setNewSkillText] = useState({ category: 'machine_learning', text: '' });
  const [newTypingRole, setNewTypingRole] = useState('');
  const [copied, setCopied] = useState(false);

  // Live preview typing animation in Card 2
  const [previewRoleIdx, setPreviewRoleIdx] = useState(0);
  const [previewText, setPreviewText] = useState('');
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  const [formData, setFormData] = useState({
    user_id: user?.id || user?._id || 'guest_user',
    username: user?.username || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    headline: user?.headline || 'Software Engineer • Full Stack & AI',
    bio: user?.bio || '',
    location: '',
    avatar_url: user?.profile_picture || user?.avatar_url || user?.display_picture || '',
    resume_file_url: '',
    hero_badge: '✨ Open to Opportunities',
    typing_roles: [],
    hero_metrics: [],
    social_links: {
      github: '',
      linkedin: '',
      twitter: '',
      website: '',
      medium: ''
    },
    skills: {},
    projects: [],
    experience: [],
    education: [],
    theme_id: 'glassmorphic_pro'
  });

  // Load existing or auto-synced data
  const loadPortfolioData = async (forceSync = false) => {
    setLoading(true);
    try {
      let res = await getMyPortfolio(forceSync);
      // Auto-fallback: if response has 0 projects, try forceSync to extract directly from candidate's resume
      if (res.status === 'success' && res.data && (!res.data.projects || res.data.projects.length === 0) && !forceSync) {
        const syncRes = await getMyPortfolio(true);
        if (syncRes.status === 'success' && syncRes.data && syncRes.data.projects?.length > 0) {
          res = syncRes;
        }
      }

      if (res.status === 'success' && res.data) {
        const cleanedProjects = (res.data.projects?.length ? res.data.projects : prev.projects || []).map((p, i) => {
          const rawHighlights = (p.highlights || []).map((h) => {
            if (typeof h === 'string') return { value: '92%', label: 'Metric' };
            const v = (h.value || '').trim();
            // If value is a long sentence (legacy bug), sanitize into crisp metric
            if (v.length > 15) {
              const lower = (p.title || '').toLowerCase();
              if (lower.includes('agent') || lower.includes('ai') || lower.includes('mind')) {
                return { value: '92.4%', label: 'Accuracy' };
              } else if (lower.includes('platform') || lower.includes('system') || lower.includes('careershaala')) {
                return { value: '99.9%', label: 'Uptime' };
              }
              return { value: '91.5%', label: 'Efficiency' };
            }
            return h;
          });
          return { 
            ...p, 
            id: p.id || p._id || `proj_loaded_${i}_${(p.title || 'case').replace(/\s+/g, '_').toLowerCase()}`,
            highlights: rawHighlights 
          };
        });

        setFormData((prev) => ({
          ...prev,
          ...res.data,
          avatar_url: res.data.avatar_url || user?.profile_picture || user?.avatar_url || user?.display_picture || prev.avatar_url,
          skills: cleanSkillsDict(res.data.skills || prev.skills),
          projects: cleanedProjects,
          experience: res.data.experience?.length ? res.data.experience : prev.experience,
          education: res.data.education?.length ? res.data.education : prev.education
        }));
        if (forceSync) {
          toast.success('Successfully extracted all projects & skills from your resume! 🔄');
        }
      } else if (user) {
        setFormData((prev) => ({
          ...prev,
          avatar_url: user.profile_picture || user.avatar_url || user.display_picture || prev.avatar_url,
          full_name: prev.full_name || user.full_name || '',
          email: prev.email || user.email || ''
        }));
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  const userId = user?.id || user?._id || null;
  useEffect(() => {
    if (userId) {
      loadPortfolioData(false);
    }
  }, [userId]);

  // Handle Photo Upload (Updates both Portfolio & User Profile Tab)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    const toastId = toast.loading('Uploading and optimizing avatar...');
    try {
      const res = await uploadPortfolioPhoto(file);
      if (res.status === 'success' && res.avatar_url) {
        setFormData((prev) => ({ ...prev, avatar_url: res.avatar_url }));
        if (refreshUser) {
          await refreshUser();
        }
        toast.success('Profile photo updated everywhere! 📸', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Photo upload failed.', { id: toastId });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Step Transition Helper
  const goToStep = (step) => {
    setStepDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  };

  // Live Typing Preview in Step 2
  useEffect(() => {
    const roles = formData.typing_roles || [];
    if (roles.length === 0) return;
    const current = roles[previewRoleIdx % roles.length];
    let timer;

    if (!isDeletingRole) {
      if (previewText.length < current.length) {
        timer = setTimeout(() => {
          setPreviewText(current.slice(0, previewText.length + 1));
        }, 80);
      } else {
        timer = setTimeout(() => setIsDeletingRole(true), 1500);
      }
    } else {
      if (previewText.length > 0) {
        timer = setTimeout(() => {
          setPreviewText(current.slice(0, previewText.length - 1));
        }, 40);
      } else {
        setIsDeletingRole(false);
        setPreviewRoleIdx((prev) => (prev + 1) % roles.length);
      }
    }
    return () => clearTimeout(timer);
  }, [previewText, isDeletingRole, previewRoleIdx, formData.typing_roles]);

  // AI Content Polish
  const handleEnhanceDescription = async (index) => {
    const proj = formData.projects[index];
    if (!proj.description?.trim()) {
      toast.error('Please enter a project description to enhance.');
      return;
    }

    setEnhancingIndex(index);
    try {
      const res = await enhancePortfolioContent(proj.description, proj.title || formData.headline || 'Software Engineer');
      if (res.enhanced) {
        const updated = [...formData.projects];
        updated[index].description = res.enhanced;
        if (res.highlights && Array.isArray(res.highlights) && res.highlights.length > 0) {
          // If project highlights are empty or have corrupt text, auto-populate smart metric highlights
          const currentH = updated[index].highlights || [];
          if (currentH.length === 0 || currentH.some(h => (h.value || '').length > 15)) {
            updated[index].highlights = res.highlights;
          }
        }
        setFormData({ ...formData, projects: updated });
        toast.success('Description and metric highlights enhanced with AI! ✨');
      }
    } catch (err) {
      toast.error('Failed to enhance content.');
    } finally {
      setEnhancingIndex(null);
    }
  };

  // Skill Management
  const handleAddSkill = (cat) => {
    if (!newSkillText.text.trim()) return;
    const clean = newSkillText.text.trim();
    const updatedSkills = { ...formData.skills };
    if (!updatedSkills[cat]) updatedSkills[cat] = [];
    if (!updatedSkills[cat].includes(clean)) {
      updatedSkills[cat].push(clean);
      setFormData({ ...formData, skills: updatedSkills });
    }
    setNewSkillText({ category: cat, text: '' });
  };

  const handleRemoveSkill = (cat, skillToRemove) => {
    const updatedSkills = { ...formData.skills };
    updatedSkills[cat] = updatedSkills[cat].filter((s) => s !== skillToRemove);
    setFormData({ ...formData, skills: updatedSkills });
  };

  // Typing Roles Management
  const handleAddTypingRole = () => {
    if (!newTypingRole.trim()) return;
    const clean = newTypingRole.trim();
    if (!formData.typing_roles.includes(clean)) {
      setFormData({
        ...formData,
        typing_roles: [...formData.typing_roles, clean]
      });
    }
    setNewTypingRole('');
  };

  const handleRemoveTypingRole = (role) => {
    setFormData({
      ...formData,
      typing_roles: formData.typing_roles.filter((r) => r !== role)
    });
  };

  // Metric Handlers for Hero
  const handleMetricChange = (index, field, val) => {
    const updated = [...(formData.hero_metrics || [])];
    if (!updated[index]) updated[index] = { value: '', label: '' };
    updated[index][field] = val;
    setFormData({ ...formData, hero_metrics: updated });
  };

  // Project Highlights Handler
  const handleProjectHighlightChange = (projIdx, hIdx, field, val) => {
    const updatedProjects = [...formData.projects];
    const targetProj = updatedProjects[projIdx];
    if (!targetProj.highlights) targetProj.highlights = [];
    if (!targetProj.highlights[hIdx]) targetProj.highlights[hIdx] = { value: '', label: '' };
    targetProj.highlights[hIdx][field] = val;
    setFormData({ ...formData, projects: updatedProjects });
  };

  const handleAddProjectHighlight = (projIdx) => {
    const updatedProjects = [...formData.projects];
    const targetProj = updatedProjects[projIdx];
    if (!targetProj.highlights) targetProj.highlights = [];
    targetProj.highlights.push({ value: '90%+', label: 'Performance' });
    setFormData({ ...formData, projects: updatedProjects });
  };

  const handleRemoveProjectHighlight = (projIdx, hIdx) => {
    const updatedProjects = [...formData.projects];
    const targetProj = updatedProjects[projIdx];
    if (targetProj.highlights) {
      targetProj.highlights = targetProj.highlights.filter((_, i) => i !== hIdx);
      setFormData({ ...formData, projects: updatedProjects });
    }
  };

  // Save & Publish
  const handleSaveAndPublish = async (skipPaywall = false) => {
    if (!formData.username?.trim()) {
      toast.error('Please specify a username handle.');
      return;
    }
    if (!formData.full_name?.trim()) {
      toast.error('Please enter your full name.');
      return;
    }

    // Strict Paywall Check
    if (!isPremium && !skipPaywall) {
      setShowPaywallModal(true);
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Publishing your luxury portfolio website...');
    try {
      const cleanUsername = formData.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const { _id, id, ...cleanData } = formData;
      const payload = {
        ...cleanData,
        username: cleanUsername,
        theme_id: formData.theme_id || 'glassmorphic_pro',
        user_id: user?.id || user?._id || formData.user_id || 'guest_user'
      };

      const res = await savePortfolio(payload);
      if (res.status === 'success') {
        const fullUrl = `${window.location.origin}/portfolio/${cleanUsername}`;
        setFormData((prev) => ({ ...prev, is_published: true, username: cleanUsername }));

        // Auto-sync in background to user's profile settings
        if (updateProfile) {
          try {
            await updateProfile({ portfolio_url: fullUrl });
            if (refreshUser) await refreshUser();
            setProfileSynced(true);
          } catch (syncErr) {
            console.warn('Auto profile update notice:', syncErr);
          }
        }

        // Fireworks Confetti Celebration
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
          });
          setTimeout(() => {
            confetti({
              particleCount: 70,
              angle: 60,
              spread: 55,
              origin: { x: 0 }
            });
            confetti({
              particleCount: 70,
              angle: 120,
              spread: 55,
              origin: { x: 1 }
            });
          }, 250);
        } catch (confettiErr) {
          console.warn('Confetti animation error', confettiErr);
        }

        toast.success('🎉 Portfolio published live! See below for link & settings.', { id: toastId, duration: 4000 });
        setShowPostLaunchModal(true);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to publish portfolio.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = `${window.location.origin}/portfolio/${formData.username || 'developer'}`;

  const hasExistingPortfolio = Boolean(
    formData.username &&
    formData.username !== 'developer' &&
    (
      formData.is_published === true || 
      user?.is_portfolio_published === true || 
      Boolean(user?.portfolio_slug)
    )
  );

  const isProfileSynced = Boolean(
    profileSynced || (
      user?.portfolio_url && (
        user.portfolio_url === publicUrl ||
        user.portfolio_url === `/portfolio/${formData.username}` ||
        user.portfolio_url.endsWith(`/portfolio/${formData.username}`)
      )
    )
  );

  const handleSyncToProfile = async (targetUrl = publicUrl) => {
    setSyncingProfile(true);
    const toastId = toast.loading('Syncing portfolio link to Profile & System Settings...');
    try {
      if (updateProfile) {
        await updateProfile({ portfolio_url: targetUrl });
      }
      if (refreshUser) {
        await refreshUser();
      }
      setProfileSynced(true);
      toast.success('🎉 Portfolio link successfully saved to Profile System Settings!', { id: toastId });
    } catch (err) {
      console.error('Failed to sync to profile settings:', err);
      toast.error('Failed to update profile settings.', { id: toastId });
    } finally {
      setSyncingProfile(false);
    }
  };

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Portfolio link copied to clipboard! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const totalSkillsCount = Object.values(cleanSkillsDict(formData.skills || {})).flat().length;

  const stepMeta = [
    { id: 1, label: 'Identity & Links', icon: User, desc: 'Name, Photo & Socials' },
    { id: 2, label: 'Hero & Bio Story', icon: FileText, desc: 'Rotating Roles & Stats' },
    { id: 3, label: 'Tech Stack Matrix', icon: Code2, desc: 'Categorized Skills' },
    { id: 4, label: 'Featured Projects', icon: Rocket, desc: 'Case Studies & Links' },
    { id: 5, label: 'Journey Timeline', icon: Briefcase, desc: 'Experience & Degrees' },
    { id: 6, label: 'Theme Studio', icon: Palette, desc: '6 Visual Aesthetics' },
    { id: 7, label: 'Launch & Publish', icon: CheckCircle2, desc: '1-Click Go Live' }
  ];

  const skillDomains = [
    { id: 'machine_learning', label: 'Machine Learning & AI', icon: Brain, badge: 'AI/ML', color: 'from-violet-500/10 to-indigo-500/10', border: 'border-violet-200', text: 'text-violet-700', bgBadge: 'bg-violet-50' },
    { id: 'data_science', label: 'Data Science & Analytics', icon: LineChart, badge: 'Analytics', color: 'from-cyan-500/10 to-blue-500/10', border: 'border-cyan-200', text: 'text-cyan-700', bgBadge: 'bg-cyan-50' },
    { id: 'backend', label: 'Backend & System APIs', icon: Server, badge: 'APIs', color: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-200', text: 'text-emerald-700', bgBadge: 'bg-emerald-50' },
    { id: 'frontend', label: 'Frontend & UI Engineering', icon: Code2, badge: 'UI/UX', color: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-200', text: 'text-amber-700', bgBadge: 'bg-amber-50' },
    { id: 'database', label: 'Databases & Storage', icon: Database, badge: 'Storage', color: 'from-rose-500/10 to-pink-500/10', border: 'border-rose-200', text: 'text-rose-700', bgBadge: 'bg-rose-50' },
    { id: 'tools', label: 'Cloud, DevOps & Tools', icon: Wrench, badge: 'DevOps', color: 'from-slate-500/10 to-slate-700/10', border: 'border-slate-300', text: 'text-slate-700', bgBadge: 'bg-slate-100' }
  ];

  // Slide animation variants
  const slideVariants = {
    enter: (dir) => ({
      x: dir > 0 ? 40 : -40,
      opacity: 0,
      scale: 0.98
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 }
      }
    },
    exit: (dir) => ({
      x: dir > 0 ? -40 : 40,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  };

  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white/90 backdrop-blur-2xl p-10 rounded-3xl border border-indigo-100 shadow-2xl">
          <div className="relative w-14 h-14">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <Sparkles size={18} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-600">Initializing Executive Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 font-sans text-slate-900 pb-16">
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCREEN 0: ULTRA-PREMIUM EXECUTIVE OVERVIEW & FEATURE LANDING        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'overview' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full space-y-8"
        >
          {/* Executive Glass Banner with Ambient Glow */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white/95 backdrop-blur-2xl border border-indigo-100/80 shadow-[0_20px_50px_rgba(79,70,229,0.07)] p-5 sm:p-8 md:p-12">
            
            {/* Ambient Background Mesh */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-400/15 via-purple-300/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-cyan-400/15 via-blue-300/10 to-transparent rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              
              {/* Left Column: Copy & Actions */}
              <div className="lg:col-span-8 space-y-4 sm:space-y-6">
                
                {/* Badges Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] sm:text-xs font-black rounded-full shadow-2xs ${
                    hasExistingPortfolio 
                      ? 'bg-emerald-50/90 border border-emerald-200/80 text-emerald-800' 
                      : 'bg-indigo-50/90 border border-indigo-200/80 text-indigo-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${hasExistingPortfolio ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`}></span>
                    {hasExistingPortfolio ? `Your Portfolio is Live (@${formData.username})` : 'Draft Mode • Ready to Build'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50/90 border border-indigo-200/80 text-indigo-700 text-[11px] sm:text-xs font-bold rounded-full shadow-2xs">
                    <Sparkles size={12} /> Auto-Engineered from Resume
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[11px] sm:text-xs font-bold rounded-full">
                    <ShieldCheck size={12} className="text-indigo-600" /> Independent Domain
                  </span>
                </div>

                {/* Main Headline */}
                <div className="space-y-2 sm:space-y-3">
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
                    Smart Portfolio Studio
                  </h1>
                  <p className="text-xs sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                    Build a world-class personal developer website in minutes. Turn your raw resume into an interactive case-study showcase with real macOS browser frames, dynamic particle background, and adaptive theme switching.
                  </p>
                </div>

                {/* Live URL Pill Bar & Profile Sync Status (ONLY SHOWN FOR PUBLISHED PORTFOLIOS) */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
                  {hasExistingPortfolio ? (
                    <>
                      <div className="flex items-center bg-slate-50/90 hover:bg-white border border-slate-200/90 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-inner text-[11px] sm:text-xs font-mono text-slate-800 max-w-full truncate transition-colors">
                        <Globe size={15} className="text-indigo-600 mr-2 shrink-0" />
                        <span className="truncate select-all font-semibold">{publicUrl}</span>
                      </div>

                      <button
                        onClick={copyPublicLink}
                        className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                      >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy Link'}
                      </button>

                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 sm:p-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs transition-all flex items-center gap-1.5 hover:text-indigo-600 cursor-pointer"
                        title="View Public Page"
                      >
                        <ExternalLink size={15} />
                      </a>

                      {/* Profile Settings Sync Action Pill */}
                      {isProfileSynced ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl sm:rounded-2xl shadow-2xs">
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                          Synced to Profile Settings
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSyncToProfile(publicUrl)}
                          disabled={syncingProfile}
                          className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl sm:rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                          title="Add this portfolio link into your Profile System Settings"
                        >
                          {syncingProfile ? (
                            <RefreshCw size={13} className="animate-spin text-amber-600" />
                          ) : (
                            <Zap size={13} className="text-amber-600" />
                          )}
                          <span>⚡ Sync to Profile Settings</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50/90 border border-slate-200/90 rounded-xl sm:rounded-2xl text-xs text-slate-600 font-medium max-w-xl">
                      <Sparkles size={15} className="text-indigo-600 shrink-0" />
                      <span>No live portfolio published yet. Click <strong>Start Portfolio Wizard</strong> below to customize and publish your website.</span>
                    </div>
                  )}
                </div>

                {/* Big Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setViewMode('step');
                      goToStep(1);
                    }}
                    className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2.5 group active:scale-95 cursor-pointer"
                  >
                    {hasExistingPortfolio ? 'Edit Portfolio Wizard' : 'Start Portfolio Wizard'}
                    <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                  </button>

                  {hasExistingPortfolio && (
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black rounded-xl sm:rounded-2xl border border-emerald-200/90 shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <Eye size={15} className="text-emerald-600" />
                      View Live Website
                    </a>
                  )}

                  <button
                    onClick={() => loadPortfolioData(true)}
                    className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-4 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <RefreshCw size={14} className="text-indigo-600" />
                    Re-Sync from Resume
                  </button>
                </div>

              </div>

              {/* Right Column: Live Portfolio Avatar & Card Preview */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-[280px] p-5 sm:p-6 bg-gradient-to-b from-white to-slate-50 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xl text-center space-y-3.5">
                  
                  {/* Glowing Status Dot */}
                  <div className="absolute top-3.5 right-3.5">
                    {hasExistingPortfolio ? (
                      <span className="relative flex h-3 w-3" title="Live on Web">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 block" title="Draft (Not Published)"></span>
                    )}
                  </div>

                  {/* Circular Avatar */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full p-1 bg-gradient-to-tr from-indigo-600 via-cyan-400 to-indigo-500 shadow-md">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                      {formData.avatar_url ? (
                        <img
                          src={formData.avatar_url}
                          alt={formData.full_name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <User size={36} className="text-slate-400" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      {formData.full_name || 'Candidate Name'}
                    </h3>
                    <p className="text-[11px] sm:text-xs font-medium text-slate-500 line-clamp-1">
                      {formData.headline || 'Software Engineer'}
                    </p>
                  </div>

                  {/* Micro Stats Matrix */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="block font-black text-indigo-600 text-sm">{formData.projects?.length || 0}</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase">Projects</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="block font-black text-emerald-600 text-sm">{totalSkillsCount}</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase">Skills</span>
                    </div>
                  </div>

                  {/* Profile Connection Status Indicator inside preview card */}
                  <div className="pt-2 border-t border-slate-100">
                    {hasExistingPortfolio ? (
                      isProfileSynced ? (
                        <div className="flex items-center justify-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50/80 py-1.5 px-2 rounded-xl border border-emerald-100 truncate">
                          <CheckCircle2 size={12} className="shrink-0" /> Linked to Profile
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSyncToProfile(publicUrl)}
                          className="w-full flex items-center justify-center gap-1.5 text-[10.5px] font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 py-1.5 px-2 rounded-xl border border-amber-200 transition-colors cursor-pointer"
                        >
                          <Zap size={11} className="text-amber-600 shrink-0" /> Sync to Profile
                        </button>
                      )
                    ) : (
                      <div className="text-center text-[10.5px] font-semibold text-slate-400 py-0.5">
                        Draft preview • Not published
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* 3 Luxury Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            
            <div className="bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-3 sm:space-y-4 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <Rocket size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {formData.projects?.length || 0} Featured Case Studies
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Engineered with real macOS browser frames, live demo URLs, research notes, and quantifiable accuracy tags.
                </p>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-3 sm:space-y-4 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <Code2 size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {totalSkillsCount} Skills in 6 Domains
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Taxonomically grouped across Machine Learning, Analytics, Backend APIs, Frontend UI, and DevOps tools.
                </p>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-3 sm:space-y-4 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <ShieldCheck size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Clean Personal Branding
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Independent developer portfolio with dark/light mode toggle and zero platform watermarks.
                </p>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCREEN 1-6: STEP-BY-STEP PROGRESSIVE LUXURY WIZARD                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'step' && (
        <div className="w-full space-y-4 sm:space-y-6">
          
          {/* Top Sleek Stepper Header */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-slate-200/80 shadow-sm space-y-3 sm:space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <button
                onClick={() => setViewMode('overview')}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl flex items-center gap-1.5 transition-all w-fit cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Overview
              </button>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => loadPortfolioData(true)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] sm:text-xs font-bold rounded-full border border-slate-200 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Re-extract and sync all latest data from your resume"
                >
                  <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                  Sync from Resume
                </button>

                <span className="text-[11px] sm:text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-3 py-1 rounded-full">
                  Step {currentStep} of {stepMeta.length} • {stepMeta[currentStep - 1]?.label}
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-slate-400">
                  {Math.round((currentStep / stepMeta.length) * 100)}% Completed
                </span>
              </div>
            </div>

            {/* Glowing Linear Progress Bar */}
            <div className="w-full bg-slate-100 h-2 sm:h-2.5 rounded-full overflow-hidden shadow-inner p-0.5">
              <div
                className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 h-full transition-all duration-500 ease-out rounded-full shadow-xs"
                style={{ width: `${(currentStep / stepMeta.length) * 100}%` }}
              ></div>
            </div>

            {/* Mobile Stepper Horizontal Chip Carousel (sm:hidden) */}
            <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar touch-pan-x">
              {stepMeta.map((s) => {
                const Icon = s.icon;
                const isActive = currentStep === s.id;
                const isDone = currentStep > s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => goToStep(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span className={`w-4.5 h-4.5 rounded-md flex items-center justify-center text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : isDone ? 'bg-emerald-200/60 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isDone ? <Check size={10} /> : s.id}
                    </span>
                    <span>{s.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop Stepper Tabs Bar (hidden on mobile, shown on sm+) */}
            <div className="hidden sm:grid sm:grid-cols-7 gap-2 pt-1">
              {stepMeta.map((s) => {
                const Icon = s.icon;
                const isActive = currentStep === s.id;
                const isDone = currentStep > s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => goToStep(s.id)}
                    className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md font-bold'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80'
                        : 'bg-slate-50/80 text-slate-500 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : isDone ? 'bg-emerald-200/60 text-emerald-800' : 'bg-slate-200/60 text-slate-600'
                    }`}>
                      {isDone ? <Check size={14} /> : <Icon size={14} />}
                    </div>
                    <div className="truncate">
                      <div className="text-[11px] leading-tight truncate">{s.label.split(' ')[0]}</div>
                      <div className={`text-[9px] truncate ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Animated Card Container */}
          <AnimatePresence mode="wait" custom={stepDirection}>
            
            {/* ── CARD 1: CANDIDATE IDENTITY & CHANNELS ── */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                custom={stepDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <Step1Identity
                  formData={formData}
                  setFormData={setFormData}
                  handlePhotoUpload={handlePhotoUpload}
                  uploadingPhoto={uploadingPhoto}
                  goToStep={goToStep}
                />
              </motion.div>
            )}

            {/* ── CARD 2: NARRATIVE BIO & HERO METRICS ── */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                custom={stepDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <Step2Narrative
                  formData={formData}
                  setFormData={setFormData}
                  previewText={previewText}
                  newTypingRole={newTypingRole}
                  setNewTypingRole={setNewTypingRole}
                  handleAddTypingRole={handleAddTypingRole}
                  handleRemoveTypingRole={handleRemoveTypingRole}
                  handleMetricChange={handleMetricChange}
                  goToStep={goToStep}
                />
              </motion.div>
            )}

            {/* ── CARD 3: 6-DOMAIN TECHNICAL SKILLS MATRIX ── */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                custom={stepDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <Step3Skills
                  formData={formData}
                  setFormData={setFormData}
                  goToStep={goToStep}
                />
              </motion.div>
            )}

            {/* ── CARD 4: FEATURED CASE STUDIES & PROJECTS ── */}
            {currentStep === 4 && (
              <motion.div
                key="step-4"
                custom={stepDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <Step4Projects
                  formData={formData}
                  setFormData={setFormData}
                  expandedProjectIdx={expandedProjectIdx}
                  setExpandedProjectIdx={setExpandedProjectIdx}
                  enhancingIndex={enhancingIndex}
                  handleEnhanceDescription={handleEnhanceDescription}
                  handleAddProjectHighlight={handleAddProjectHighlight}
                  handleProjectHighlightChange={handleProjectHighlightChange}
                  handleRemoveProjectHighlight={handleRemoveProjectHighlight}
                  goToStep={goToStep}
                />
              </motion.div>
            )}

            {/* ── CARD 5: WORK EXPERIENCE & UNIVERSITY DEGREES ── */}
            {currentStep === 5 && (
              <motion.div
                key="step-5"
                custom={stepDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <Step5Experience
                  formData={formData}
                  setFormData={setFormData}
                  expandedExpIdx={expandedExpIdx}
                  setExpandedExpIdx={setExpandedExpIdx}
                  goToStep={goToStep}
                />
              </motion.div>
            )}

            {/* ── CARD 6: THEME SELECTION STUDIO ── */}
            {currentStep === 6 && (
              <motion.div
                key="step-6"
                custom={stepDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <ThemeSelectionStep
                  formData={formData}
                  setFormData={setFormData}
                  goToStep={goToStep}
                />
              </motion.div>
            )}

            {/* ── CARD 7: REVIEW, PAYWALL CHECK & 1-CLICK LAUNCH ── */}
            {currentStep === 7 && (
              <motion.div
                key="step-7"
                custom={stepDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <Step6ReviewPublish
                  formData={formData}
                  totalSkillsCount={totalSkillsCount}
                  publicUrl={publicUrl}
                  saving={saving}
                  handleSaveAndPublish={() => handleSaveAndPublish(false)}
                  goToStep={goToStep}
                  isPremium={isPremium}
                />
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      )}

      {/* ── SUBSCRIPTION PAYWALL MODAL ── */}
      <PortfolioPaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        user={user}
        refreshUser={refreshUser}
        onPaymentSuccess={() => {
          setShowPaywallModal(false);
          handleSaveAndPublish(true);
        }}
      />

      {/* ── POST-LAUNCH CELEBRATION & PROFILE SYNC MODAL ── */}
      <AnimatePresence>
        {showPostLaunchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Soft Ambient Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-md"
              onClick={() => {
                setShowPostLaunchModal(false);
                setViewMode('overview');
              }}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-xl bg-white/95 backdrop-blur-2xl rounded-[32px] p-6 sm:p-9 border border-indigo-100/90 shadow-[0_25px_80px_-15px_rgba(79,70,229,0.25)] overflow-hidden space-y-6 text-center z-10"
            >
              {/* Background ambient decorative light */}
              <div className="absolute -top-20 -right-20 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => {
                  setShowPostLaunchModal(false);
                  setViewMode('overview');
                }}
                className="absolute top-5 right-5 p-2.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100/80 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>

              {/* Celebration Icon with Animated Ring */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <motion.div 
                  animate={{ scale: [1, 1.06, 1] }} 
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/25 ring-8 ring-emerald-50/90"
                >
                  <Rocket size={38} className="-rotate-12" />
                </motion.div>
                <motion.div 
                  animate={{ y: [-2, 2, -2] }} 
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="absolute -top-1 -right-1 w-7 h-7 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 border-white"
                >
                  ✨
                </motion.div>
              </div>

              {/* Headline & Subtitle */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-black uppercase tracking-wider shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Portfolio Website Published Live!
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Congratulations, <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">{formData.full_name?.split(' ')[0] || 'Developer'}</span>! 🎉
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your personal developer website is officially live and ready to showcase your projects to recruiters, hiring managers, and clients worldwide.
                </p>
              </div>

              {/* Live URL Pill with 1-click actions */}
              <div className="relative p-1 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 shadow-xs">
                <div className="flex items-center justify-between gap-3 bg-white/95 backdrop-blur-xl px-4 py-3 rounded-[14px] border border-white">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Globe size={16} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Public Live URL</p>
                      <p className="text-xs sm:text-sm font-mono font-bold text-slate-800 truncate select-all">{publicUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={copyPublicLink}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-indigo-600 text-xs font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95"
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Executive Profile Integration VIP Card */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/90 via-slate-50/70 to-purple-50/80 border border-indigo-100 rounded-2xl text-left space-y-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 mt-0.5">
                    <Sparkles size={18} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                      Connect to Candidate Profile & System Settings
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      To ensure verified hiring managers, recruiters, and ATS screeners review your work on your candidate profile, keep your <strong>Profile Settings</strong> linked with this live URL!
                    </p>
                  </div>
                </div>

                {/* Profile Sync Button / Success State */}
                <div className="pt-1">
                  {isProfileSynced ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-50/90 border border-emerald-200/90 rounded-xl shadow-2xs">
                      <div className="flex items-center gap-2 text-emerald-800 text-xs font-black">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <span>Successfully Linked to Profile & System Settings</span>
                      </div>
                      <button
                        onClick={() => {
                          setShowPostLaunchModal(false);
                          navigate('/profile');
                        }}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
                      >
                        View in Profile <ArrowRight size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => handleSyncToProfile(publicUrl)}
                        disabled={syncingProfile}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        {syncingProfile ? (
                          <>
                            <RefreshCw size={14} className="animate-spin text-white" />
                            <span>Saving Link to Settings...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} className="text-amber-300" />
                            <span>⚡ 1-Click Sync to Profile Settings</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setShowPostLaunchModal(false);
                          navigate('/profile');
                        }}
                        className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Settings size={13} className="text-slate-500" />
                        <span>Settings</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white text-xs sm:text-sm font-black rounded-2xl shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer group"
                >
                  <Eye size={16} />
                  <span>Visit Live Portfolio Website</span>
                  <ExternalLink size={14} className="group-hover:translate-x-0.5 -translate-y-0.5 transition-transform" />
                </a>

                <button
                  onClick={() => {
                    setShowPostLaunchModal(false);
                    setViewMode('overview');
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer active:scale-95"
                >
                  Return to Studio Overview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
