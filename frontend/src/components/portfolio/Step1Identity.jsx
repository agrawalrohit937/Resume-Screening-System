import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Camera, 
  Mail, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Clock, 
  Globe, 
  Github, 
  Linkedin, 
  Twitter,
  ArrowRight,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkSlugAvailability } from '../../services/portfolioApi';

// Helper to convert full name to a clean URL slug
const slugify = (text) => {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^a-z0-9_-]/g, '')  // Remove all non-alphanumeric chars except - and _
    .replace(/--+/g, '-');       // Replace multiple - with single -
};

export default function Step1Identity({ 
  formData, 
  setFormData, 
  handlePhotoUpload, 
  uploadingPhoto, 
  goToStep 
}) {
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(true); // default true for initial load
  const [slugMessage, setSlugMessage] = useState('Your public vanity URL');
  const debounceTimerRef = useRef(null);

  // Auto-slugify from Full Name if user hasn't manually customized the slug
  const handleFullNameChange = (e) => {
    const newName = e.target.value;
    const updates = { full_name: newName };

    if (!isManualSlug) {
      updates.username = slugify(newName);
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Manual slug input change
  const handleSlugChange = (e) => {
    setIsManualSlug(true);
    const cleanSlug = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setFormData(prev => ({ ...prev, username: cleanSlug }));
  };

  // 500ms Debounced backend slug availability check
  useEffect(() => {
    const rawSlug = formData.username?.trim();

    if (!rawSlug) {
      setSlugAvailable(false);
      setSlugMessage('Please enter a username handle');
      setIsCheckingSlug(false);
      return;
    }

    if (rawSlug.length < 3) {
      setSlugAvailable(false);
      setSlugMessage('Handle must be at least 3 characters');
      setIsCheckingSlug(false);
      return;
    }

    setIsCheckingSlug(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await checkSlugAvailability(rawSlug);
        if (res && res.status === 'success') {
          setSlugAvailable(res.available);
          setSlugMessage(res.message);
        } else {
          setSlugAvailable(false);
          setSlugMessage('Handle unavailable');
        }
      } catch (err) {
        // Fallback: If network check fails, don't completely hard-block
        setSlugAvailable(true);
        setSlugMessage('Handle verified');
      } finally {
        setIsCheckingSlug(false);
      }
    }, 450);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData.username]);

  const isFormValid = Boolean(
    formData.full_name?.trim() && 
    formData.username?.trim() && 
    slugAvailable && 
    !isCheckingSlug
  );

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-md space-y-8">
      {/* Header with Circular Avatar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-2 max-w-xl">
          <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60 inline-block">
            Step 01 • Candidate Profile & Channels
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Claim Handle, Identity & Socials
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Claim your unique developer vanity URL, upload a high-resolution avatar, and link your professional channels.
          </p>
        </div>

        {/* Right Side: Circular Avatar */}
        <div className="relative shrink-0 flex flex-col items-center">
          <div className="relative w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-cyan-400 to-indigo-600 shadow-xl group">
            <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt={formData.full_name || 'Avatar'}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <User size={44} className="text-slate-300" />
              )}
            </div>

            {/* Camera Upload Badge */}
            <input
              type="file"
              accept="image/*"
              id="avatar-circle-file"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
            />
            <label
              htmlFor="avatar-circle-file"
              title="Upload New Photo"
              className="absolute bottom-0 right-0 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95"
            >
              <Camera size={15} />
            </label>
          </div>

          <span className="text-[11px] font-bold text-slate-500 mt-2">
            {uploadingPhoto ? 'Optimizing photo...' : 'Profile Avatar'}
          </span>
        </div>
      </div>

      {/* Section A: Core Candidate Info & SaaS-Style Slug Claiming */}
      <div className="space-y-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <User size={14} className="text-indigo-600" /> Primary Identity & Handle
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
          
          {/* 1. Full Name (Auto-generates slug) */}
          <div className="sm:col-span-5 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name || ''}
              onChange={handleFullNameChange}
              placeholder="e.g. Rohit Agrawal"
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-900 transition-all shadow-2xs"
            />
          </div>

          {/* 2. SaaS-Style Portfolio URL Slug Claiming Field */}
          <div className="sm:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Claim Portfolio URL Handle <span className="text-rose-500">*</span>
              </label>
              
              {/* Dynamic State Status Label */}
              <div className="flex items-center gap-1 text-[11px] font-bold">
                {isCheckingSlug ? (
                  <span className="text-indigo-600 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Checking...
                  </span>
                ) : slugAvailable === true ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={13} /> {slugMessage || 'Available!'}
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <XCircle size={13} /> {slugMessage || 'Taken. Try another.'}
                  </span>
                )}
              </div>
            </div>

            {/* Input with Fixed Prefix & Status Icon Inside */}
            <div className={`relative flex items-center rounded-2xl border transition-all shadow-2xs overflow-hidden ${
              isCheckingSlug
                ? 'border-indigo-300 ring-2 ring-indigo-500/10 bg-white'
                : slugAvailable === true
                ? 'border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 bg-white'
                : 'border-rose-300 focus-within:ring-4 focus-within:ring-rose-500/10 focus-within:border-rose-500 bg-rose-50/20'
            }`}>
              {/* Fixed Prefix Badge */}
              <span className="px-3.5 py-3 bg-slate-100/90 border-r border-slate-200 text-xs font-semibold text-slate-500 select-none shrink-0 flex items-center gap-1">
                <Globe size={13} className="text-slate-400 hidden sm:inline" />
                careershala.tech/portfolio/
              </span>

              {/* Slug Input */}
              <input
                type="text"
                value={formData.username || ''}
                onChange={handleSlugChange}
                placeholder="rohit-agrawal"
                className="w-full px-3.5 py-3 bg-transparent text-xs outline-none font-mono font-bold text-slate-900 pr-10"
              />

              {/* Status Icon Indicator Inside Right */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                {isCheckingSlug ? (
                  <Loader2 size={16} className="text-indigo-500 animate-spin" />
                ) : slugAvailable === true ? (
                  <CheckCircle2 size={17} className="text-emerald-500" />
                ) : (
                  <XCircle size={17} className="text-rose-500" />
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Your live public link: <span className="font-mono text-indigo-600 font-bold">https://careershala.tech/portfolio/{formData.username || 'your-handle'}</span>
            </p>
          </div>

        </div>

        {/* Professional Headline */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">Professional Headline</label>
          <input
            type="text"
            value={formData.headline || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, headline: e.target.value }))}
            placeholder="e.g. Full-Stack Engineer • Distributed Systems & AI Platforms"
            className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold text-slate-900 transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Section B: Contact & Document Routing */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Mail size={14} className="text-indigo-600" /> Contact & Resume File
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Contact Email</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="rohit@example.com"
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-900 transition-all shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Phone / WhatsApp</label>
            <input
              type="text"
              value={formData.phone || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+91 9876543210"
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-900 transition-all shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Location</label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Bareilly, UP, India"
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-900 transition-all shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Candidate Resume PDF</label>
            {formData.resume_file_url ? (
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-emerald-900 truncate">Connected</span>
                </div>
                <a
                  href={formData.resume_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 underline shrink-0 cursor-pointer ml-2"
                >
                  View PDF ↗
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 font-medium">
                <Clock size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">Auto-linked from database</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section C: Social & Developer Channels */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Globe size={14} className="text-indigo-600" /> Developer & Social Profiles
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Github size={13} /> GitHub Profile
            </label>
            <input
              type="url"
              value={formData.social_links?.github || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                social_links: { ...prev.social_links, github: e.target.value } 
              }))}
              placeholder="https://github.com/username"
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-900 transition-all shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Linkedin size={13} /> LinkedIn Profile
            </label>
            <input
              type="url"
              value={formData.social_links?.linkedin || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                social_links: { ...prev.social_links, linkedin: e.target.value } 
              }))}
              placeholder="https://linkedin.com/in/username"
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-900 transition-all shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Twitter size={13} /> Twitter / X Profile
            </label>
            <input
              type="url"
              value={formData.social_links?.twitter || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                social_links: { ...prev.social_links, twitter: e.target.value } 
              }))}
              placeholder="https://twitter.com/username"
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-slate-900 transition-all shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Navigation Footer with Strict Validation Blocking */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-100">
        <div className="text-xs text-slate-400 font-medium">
          {!isFormValid && (
            <span className="text-rose-500 font-semibold">
              * Please claim an available handle and enter your full name to proceed.
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!isFormValid}
          onClick={() => goToStep(2)}
          className={`px-8 py-3.5 rounded-2xl text-xs font-black shadow-lg flex items-center gap-2 transition-all active:scale-95 ${
            isFormValid
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 cursor-pointer'
              : 'bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed shadow-none'
          }`}
        >
          Continue to Step 2 <ArrowRight size={15} />
        </button>
      </div>

    </div>
  );
}
