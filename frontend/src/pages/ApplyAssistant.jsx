import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Briefcase, FileText, CheckCircle,
  Loader2, Send, ArrowRight, History, Plus,
  AlertTriangle, ScanSearch, Mail
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { getResumes } from '../services/api';
import { useApplyAssistant, STEPS } from '../hooks/useApplyAssistant';
import { applyAssistantApi } from '../services/applyAssistantApi';
import JobDetailsForm from '../components/apply/JobDetailsForm';
import ScoreRing from '../components/ScoreRing';

const DraftEditor = lazy(() => import('../components/apply/DraftEditor'));
const SendConfirmationModal = lazy(() => import('../components/apply/SendConfirmationModal'));
const ApplicationHistoryTable = lazy(() => import('../components/apply/ApplicationHistoryTable'));

// --- Helper Components ---
function StepIndicator({ currentStep }) {
  const steps = [
    { key: STEPS.JOB_DETAILS, label: 'Job Details', number: '01' },
    { key: STEPS.ATS_CHECK, label: 'ATS Score', number: '02' },
    { key: STEPS.GENERATING, label: 'AI Drafting', number: '03' },
    { key: STEPS.REVIEW, label: 'Review', number: '04' },
    { key: STEPS.SENT, label: 'Sent', number: '05' },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStep) || 0;

  return (
    <div className="flex items-center justify-between w-full mb-10 relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-slate-100 -z-10" />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-indigo-600 -z-10 transition-all duration-500 ease-in-out"
        style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;

        return (
          <div key={step.key} className="flex flex-col items-center gap-3 bg-white px-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isActive
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-50'
                  : isPast
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border-2 border-slate-200 text-slate-400'
                }`}
            >
              {isPast ? <CheckCircle size={14} strokeWidth={3} /> : step.number}
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wider hidden sm:block ${isActive ? 'text-indigo-900' : isPast ? 'text-slate-600' : 'text-slate-400'
              }`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Component ---
export default function ApplyAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { step, draft, atsResult, error, isSubmitting, checkATSScore, generateDraft, updateDraft, restoreDraft, sendApplication, reset } = useApplyAssistant();
  const [resumeId, setResumeId] = useState(null);
  const [jobDetailsState, setJobDetailsState] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('apply'); // 'apply' | 'history'
  const [isGmailConnected, setIsGmailConnected] = useState(null); // null = loading

  // 👇 Restore pending draft and check Gmail connection status on mount / return from /gmail-callback
  useEffect(() => {
    const checkAndRestore = async () => {
      // 1. Check for stored pending draft in sessionStorage
      const storedDraftJson = sessionStorage.getItem('pending_application_draft');
      const storedAppId = sessionStorage.getItem('pending_application_id');
      let restored = false;

      if (storedDraftJson) {
        try {
          const parsed = JSON.parse(storedDraftJson);
          restoreDraft(parsed);
          restored = true;
        } catch (e) {
          console.error('[ApplyAssistant] Failed to parse stored draft', e);
        }
      }

      if (!restored && storedAppId) {
        try {
          const fetched = await applyAssistantApi.getDraft(storedAppId);
          if (fetched) {
            restoreDraft(fetched);
            sessionStorage.setItem('pending_application_draft', JSON.stringify(fetched));
            restored = true;
          }
        } catch (e) {
          if (e?.response?.status === 404) {
            sessionStorage.removeItem('pending_application_id');
            sessionStorage.removeItem('pending_application_draft');
          }
          console.error('[ApplyAssistant] Failed to fetch draft by stored ID', e);
        }
      }

      if (!restored) {
        try {
          const active = await applyAssistantApi.getActiveDraft();
          if (active && active.status === 'ready_for_review') {
            restoreDraft(active);
            sessionStorage.setItem('pending_application_draft', JSON.stringify(active));
            sessionStorage.setItem('pending_application_id', active.application_id);
          } else {
            reset();
          }
        } catch (err) {
          // Gracefully catch 404 when no active draft exists
          if (err?.response?.status === 404) {
            reset();
          } else {
            console.error('[ApplyAssistant] Error checking active draft:', err);
            reset();
          }
        }
      }

      // 2. Check Gmail connection
      try {
        const { is_connected } = await applyAssistantApi.checkGmailConnected();
        setIsGmailConnected(is_connected);

        const params = new URLSearchParams(location.search);
        if (params.get('gmail') === 'connected' && is_connected) {
          toast.success('Gmail connected! Your application draft is ready to send.');
          setShowConfirm(true);
          window.history.replaceState({}, '', location.pathname);
        }
      } catch {
        setIsGmailConnected(false);
      }
    };

    checkAndRestore();
  }, [location.search, restoreDraft, reset]);

  // 👇 Fetch the primary parsed resume from the backend on load
  useEffect(() => {
    const fetchPrimaryResume = async () => {
      try {
        const response = await getResumes({ status: 'parsed' });
        const data = response.data;
        if (data && data.resumes && data.resumes.length > 0) {
          setResumeId(data.resumes[0].id);
        }
      } catch (err) {
        console.error('Failed to load primary resume for Apply Assistant', err);
      }
    };

    if (user?.profile_resume_url) {
      fetchPrimaryResume();
    }
  }, [user]);

  const handleJobDetailsSubmit = useCallback(
    (jobDetails) => {
      if (!resumeId) {
        toast.error('Please upload a resume in your Profile section first.');
        return;
      }
      // First check ATS score before generating draft
      setJobDetailsState(jobDetails);
      checkATSScore(resumeId, jobDetails);
    },
    [resumeId, checkATSScore],
  );

  const handleProceedToDraft = useCallback(() => {
    if (resumeId && jobDetailsState) {
      generateDraft(resumeId, jobDetailsState);
    }
  }, [resumeId, jobDetailsState, generateDraft]);

  const handleGoToATSMatcher = useCallback(() => {
    navigate('/results');
  }, [navigate]);

  const handleConfirmSend = useCallback(
    async () => {
      setShowConfirm(false);
      await sendApplication();
    },
    [sendApplication],
  );

  // Redirect user to Google consent screen (server-side, gets refresh token)
  const handleConnectGmail = useCallback(async () => {
    if (draft) {
      sessionStorage.setItem('pending_application_draft', JSON.stringify(draft));
      sessionStorage.setItem('pending_application_id', draft.application_id);
    }
    try {
      const { authorize_url } = await applyAssistantApi.getGmailAuthorizeUrl();
      window.location.href = authorize_url; // Full page redirect to Google
    } catch (err) {
      toast.error('Could not initiate Gmail connection. Please try again.');
      console.error('[ApplyAssistant] Gmail authorize error:', err);
    }
  }, [draft]);

  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header & Tabs */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Application Assistant
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Leverage AI to tailor your resume and draft highly converting outreach.
            </p>
          </div>

          <div className="flex items-center gap-1 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('apply')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'apply'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              <Plus size={16} /> New Application
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              <History size={16} /> History
            </button>
          </div>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {error && activeTab === 'apply' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3"
            >
              <span className="text-lg">⚠️</span> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <AnimatePresence mode="wait">

          {/* --- TAB: NEW APPLICATION --- */}
          {activeTab === 'apply' && (
            <motion.div
              key="tab-apply"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-10"
            >
              <StepIndicator currentStep={step} />

              <div className="mt-8">
                <AnimatePresence mode="wait">

                  {/* STEP 1.5: ATS SCORE CHECK */}
                  {step === STEPS.ATS_CHECK && (
                    <motion.div
                      key="step-ats"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.2 }}
                      className="max-w-2xl mx-auto space-y-8"
                    >
                      {/* ATS Score Display */}
                      <div className="text-center space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
                          <ScanSearch size={14} /> ATS Compatibility Check
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Your ATS Score</h2>
                      </div>

                      <div className="flex flex-col items-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <ScoreRing score={(atsResult?.score || 0) / 100} size={160} label="ATS Match" />

                        <p className="text-2xl font-bold text-slate-900 mt-6">
                          Your ATS Score is <span className={atsResult?.is_low_score ? 'text-amber-500' : 'text-emerald-500'}>{atsResult?.score || 0}</span>/100
                        </p>

                        {atsResult?.is_low_score ? (
                          <>
                            <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-3">
                              <div className="flex items-start gap-3">
                                <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-amber-800">
                                    Your ATS score is below the recommended level
                                  </p>
                                  <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                                    This may reduce your chances of getting shortlisted for this job. However, you can generate a FREE ATS-friendly enhanced resume to improve your score and increase your chances of selection.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
                              <button
                                onClick={handleGoToATSMatcher}
                                className="flex-1 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                              >
                                <Sparkles size={16} /> Yes, Take Me to ATS Matcher
                              </button>
                              <button
                                onClick={handleProceedToDraft}
                                disabled={isSubmitting}
                                className="flex-1 px-6 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                              >
                                No, Continue Anyway <ArrowRight size={16} />
                              </button>
                            </div>

                            {/* Missing keywords summary */}
                            {atsResult?.missing_keywords?.length > 0 && (
                              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  Missing Keywords ({atsResult.missing_keywords.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {atsResult.missing_keywords.slice(0, 12).map((kw) => (
                                    <span key={kw} className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-medium border border-red-100">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="mt-6 p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                              <CheckCircle size={24} className="text-emerald-500 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-emerald-800">
                                Great! Your resume has a strong ATS match for this position.
                              </p>
                              <p className="text-sm text-emerald-600 mt-1">
                                You can proceed with confidence to generate your tailored application.
                              </p>
                            </div>

                            <button
                              onClick={handleProceedToDraft}
                              disabled={isSubmitting}
                              className="mt-6 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 mx-auto"
                            >
                              {isSubmitting ? (
                                <><Loader2 size={16} className="animate-spin" /> Generating...</>
                              ) : (
                                <><Briefcase size={16} /> Proceed to Generate Draft</>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 1: JOB DETAILS */}
                  {step === STEPS.JOB_DETAILS && (
                    <motion.div
                      key="step-details"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-10"
                    >
                      {/* Left: Resume Display */}
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <FileText size={18} className="text-slate-400" /> Candidate Profile
                          </h2>
                          <p className="text-sm text-slate-500 mt-1">We'll use your primary profile resume for this application.</p>
                        </div>

                        {/* 👇 Profile Resume Attached Card */}
                        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                            <FileText size={24} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3
                              className="text-sm font-bold text-slate-900 truncate max-w-[220px] sm:max-w-xs md:max-w-md"
                              title={user?.profile_resume_name || "Resume not found"}
                            >
                              {user?.profile_resume_name || "Resume not found"}
                            </h3>
                            {user?.profile_resume_url ? (
                              <p className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-0.5">
                                <CheckCircle size={12} className="shrink-0" /> Automatically linked from Profile
                              </p>
                            ) : (
                              <p className="text-xs font-medium text-rose-500 flex items-center gap-1 mt-0.5">
                                Please upload a resume in your profile.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Route to Profile for updates */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3 mt-4">
                          <div className="p-2 bg-white rounded-lg text-slate-600 mt-0.5 shadow-sm border border-slate-200">
                            <Sparkles size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Need to update your resume?</p>
                            <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">
                              If you want to use a different resume, head over to your profile to upload the latest version.
                            </p>
                            <Link to="/profile" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                              Go to Profile <ArrowRight size={14} />
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Right: Job Details */}
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <Briefcase size={18} className="text-slate-400" /> Job Information
                          </h2>
                          <p className="text-sm text-slate-500 mt-1">Provide the details of the target role.</p>
                        </div>
                        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                          <JobDetailsForm onSubmit={handleJobDetailsSubmit} isSubmitting={isSubmitting} />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: GENERATING */}
                  {step === STEPS.GENERATING && (
                    <motion.div
                      key="step-generating"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col items-center justify-center py-24 text-center"
                    >
                      <Loader2 className="animate-spin text-indigo-600 mb-6" size={40} />
                      <h3 className="text-xl font-semibold text-slate-900 mb-2">Analyzing Requirements</h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                        The AI is currently evaluating the job description and architecting the optimal outreach strategy based on your profile.
                      </p>
                    </motion.div>
                  )}

                  {/* STEP 3: REVIEW */}
                  {step === STEPS.REVIEW && draft && (
                    <motion.div
                      key="step-review"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">Review Draft</h2>
                          <p className="text-sm text-slate-500 mt-1">Verify and adjust the generated content before sending.</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500 font-medium">Loading editor...</div>}>
                          <DraftEditor
                            draft={draft}
                            onSave={(edits) => updateDraft(edits)}
                            onApproveSend={() => setShowConfirm(true)}
                            isSubmitting={isSubmitting}
                          />
                        </Suspense>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 4: SENT */}
                  {step === STEPS.SENT && (
                    <motion.div
                      key="step-sent"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-6">
                        <Send className="text-emerald-600 ml-1" size={28} />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">Application Dispatched</h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-8">
                        Your tailored application has been successfully queued for delivery with your resume and cover letter attached.
                      </p>
                      <button
                        type="button"
                        onClick={reset}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
                      >
                        Start New Application
                      </button>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* --- TAB: HISTORY --- */}
          {activeTab === 'history' && (
            <motion.div
              key="tab-history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-base font-semibold text-slate-900">Application Log</h2>
                <p className="text-sm text-slate-500 mt-1">Review the status of your previously generated applications.</p>
              </div>
              <div className="p-6">
                <ApplicationHistoryTable />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <Suspense fallback={null}>
        <SendConfirmationModal
          isOpen={showConfirm}
          hrEmail={draft?.hr_email}
          onConfirm={handleConfirmSend}
          onCancel={() => setShowConfirm(false)}
          onConnectGmail={handleConnectGmail}
          isSubmitting={isSubmitting}
          isGmailConnected={isGmailConnected === true}
        />
      </Suspense>
    </div>
  );
}