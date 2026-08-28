import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getPublicPortfolio,
  trackPortfolioEvent,
  sendContactMessage
} from '../services/portfolioApi';
import toast from 'react-hot-toast';
import { ShieldAlert, Globe } from 'lucide-react';

import GlassmorphicTheme from '../components/portfolio/themes/GlassmorphicTheme';
import CyberpunkTheme from '../components/portfolio/themes/CyberpunkTheme';
import MinimalEleganceTheme from '../components/portfolio/themes/MinimalEleganceTheme';
import NeonDeveloperTheme from '../components/portfolio/themes/NeonDeveloperTheme';
import ThreeDInteractiveTheme from '../components/portfolio/themes/ThreeDInteractiveTheme';
import BentoGridTheme from '../components/portfolio/themes/BentoGridTheme';
import { cleanSkillsDict } from '../components/portfolio/Step3Skills';

export default function PublicPortfolio() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [sending, setSending] = useState(false);

  // Fetch Public Profile Data
  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const res = await getPublicPortfolio(username);
        const profileData = res?.data || (res?.full_name || res?.username ? res : null);
        if (profileData) {
          setProfile({
            ...profileData,
            skills: cleanSkillsDict(profileData.skills)
          });
          trackPortfolioEvent(username, 'view');
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        console.error(err);
        setError('Portfolio does not exist or is currently private.');
      } finally {
        setLoading(false);
      }
    };
    if (username) {
      fetchPortfolio();
    }
  }, [username]);

  // Handle Resume Download
  const handleResumeDownload = () => {
    trackPortfolioEvent(username, 'download');
    if (profile?.resume_file_url) {
      window.open(profile.resume_file_url, '_blank');
      toast.success('Downloading candidate resume...');
    } else {
      toast.error('Resume file is not attached.');
    }
  };

  // Handle Contact Submit
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSending(true);
    const toastId = toast.loading('Transmitting message to candidate...');
    try {
      await sendContactMessage(username, contactForm);
      toast.success('Message delivered successfully! 🚀', { id: toastId });
      setContactForm({ name: '', email: '', message: '' });
      trackPortfolioEvent(username, 'contact');
    } catch (err) {
      toast.error('Failed to send message. Please try again.', { id: toastId });
    } finally {
      setSending(false);
    }
  };

  // ── Loading Skeleton State ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center space-y-4 text-center p-6 font-sans">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-cyan-400 animate-spin flex items-center justify-center p-1">
          <div className="w-full h-full bg-[#0b0f19] rounded-[20px]"></div>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white tracking-tight">Initializing Portfolio...</h2>
          <p className="text-xs text-slate-400">Loading custom themes, verified metrics, and case studies...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center text-center p-6 space-y-6 font-sans">
        <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center shadow-lg">
          <ShieldAlert size={40} />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-3xl font-black tracking-tight">Portfolio Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The developer portfolio for <strong className="text-slate-200">@{username}</strong> could not be located or has not been published yet.
          </p>
        </div>
        <Link
          to="/"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
        >
          <Globe size={16} /> Return to CareerShala
        </Link>
      </div>
    );
  }

  const commonProps = {
    profile,
    username,
    handleResumeDownload,
    handleContactSubmit,
    contactForm,
    setContactForm,
    sending
  };

  const selectedTheme = profile.theme_id || 'glassmorphic_pro';

  switch (selectedTheme) {
    case 'cyberpunk_dark':
      return <CyberpunkTheme {...commonProps} />;
    case 'minimal_elegance':
      return <MinimalEleganceTheme {...commonProps} />;
    case 'neon_developer':
      return <NeonDeveloperTheme {...commonProps} />;
    case '3d_interactive':
      return <ThreeDInteractiveTheme {...commonProps} />;
    case 'bento_grid_ux':
      return <BentoGridTheme {...commonProps} />;
    case 'glassmorphic_pro':
    default:
      return <GlassmorphicTheme {...commonProps} />;
  }
}