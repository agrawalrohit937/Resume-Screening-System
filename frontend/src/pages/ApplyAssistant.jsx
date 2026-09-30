import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Briefcase, FileText, CheckCircle,
  Loader2, Send, ArrowRight, History, Plus,
  AlertTriangle, ScanSearch, Mail, RotateCcw
} from 'lucide-react';


import { useAuth } from '../context/AuthContext';
import { getResumes } from '../services/api';
import { useApplyAssistant, STEPS } from '../hooks/useApplyAssistant';
import { applyAssistantApi } from '../services/applyAssistantApi';
import JobDetailsForm from '../components/apply/JobDetailsForm';
import ScreenshotUploadZone from '../components/apply/ScreenshotUploadZone';
import ATSCompatibilityView from '../components/apply/ATSCompatibilityView';
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
    <div className="flex items-center justify-between w-full mb-3 sm:mb-8 relative px-0.5">
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
  const { step, setStep, draft, atsResult, error, isSubmitting, checkATSScore, generateDraft, updateDraft, restoreDraft, sendApplication, reset } = useApplyAssistant();
  const [resumeId, setResumeId] = useState(null);
  const [jobDetailsState, setJobDetailsState] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('apply'); // 'apply' | 'history'
  const [isGmailConnected, setIsGmailConnected] = useState(null); // null = loading

  const [formValues, setFormValues] = useState({
    company_name: '',
    job_title: '',
    hr_email: '',
    job_description: '',
  });
  const [extractingDetails, setExtractingDetails] = useState(false);

  // 👇 Check Gmail connection and only restore draft if returning from Google OAuth redirect
  useEffect(() => {
    const checkAndRestore = async () => {
      const params = new URLSearchParams(location.search);
      const isGmailReturn = params.get('gmail') === 'connected';

      // 1. If returning from Gmail OAuth callback, restore the draft so user can send immediately
      if (isGmailReturn) {
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
              restored = true;
            }
          } catch (e) {
            console.error('[ApplyAssistant] Failed to fetch draft by stored ID', e);
          }
        }

        if (!restored) {
          try {
            const active = await applyAssistantApi.getActiveDraft();
            if (active && active.status === 'ready_for_review') {
              restoreDraft(active);
            }
          } catch {
            // Ignore if no active draft
          }
        }
      } else {
        // Standard page load or refresh: start clean on Job Details form
        sessionStorage.removeItem('pending_application_draft');
        sessionStorage.removeItem('pending_application_id');
        reset();
      }

      // 2. Check Gmail connection status
      try {
        const { is_connected } = await applyAssistantApi.checkGmailConnected();
        setIsGmailConnected(is_connected);

        if (isGmailReturn && is_connected) {
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
  const fetchPrimaryResume = useCallback(async () => {
    try {
      const response = await getResumes({ page_size: 10 });
      const data = response.data;
      if (data && data.resumes && data.resumes.length > 0) {
        const primary =
          data.resumes.find((r) => r.is_primary) ||
          data.resumes.find((r) => r.status === 'parsed') ||
          data.resumes[0];
        if (primary) {
          const validId = primary.id || primary._id;
          setResumeId(validId);
          return validId;
        }
      }
    } catch (err) {
      console.error('Failed to load primary resume for Apply Assistant', err);
    }
    return null;
  }, []);

  useEffect(() => {
    fetchPrimaryResume();
  }, [fetchPrimaryResume, user]);

  // ⚡ 1-Click Express Apply Action
  const handleJobDetailsSubmit = useCallback(
    async (jobDetails) => {
      let targetResumeId = resumeId;
      if (!targetResumeId) {
        targetResumeId = await fetchPrimaryResume();
      }
      if (!targetResumeId) {
        toast.error('Please upload a resume in your Profile section first.');
        return;
      }
      setJobDetailsState(jobDetails);
      generateDraft(targetResumeId, jobDetails);
    },
    [resumeId, fetchPrimaryResume, generateDraft],
  );

  // 🔍 Optional Manual ATS Check Action
  const handleCheckATS = useCallback(
    async (jobDetails) => {
      let targetResumeId = resumeId;
      if (!targetResumeId) {
        targetResumeId = await fetchPrimaryResume();
      }
      if (!targetResumeId) {
        toast.error('Please upload a resume in your Profile section first.');
        return;
      }
      setJobDetailsState(jobDetails);
      checkATSScore(targetResumeId, jobDetails);
    },
    [resumeId, fetchPrimaryResume, checkATSScore],
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
    <div className="w-full max-w-[1550px] mx-auto px-2 sm:px-6 space-y-3.5 sm:space-y-8 font-sans text-slate-900 py-1 sm:py-6">

      {/* Header & Tabs */}
      <div className="space-y-3 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Application Assistant
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Leverage AI to tailor your resume and draft highly converting outreach.
          </p>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-200">
          <button
            onClick={() => {
              setActiveTab('apply');
              reset();
            }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${activeTab === 'apply'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
          >
            <Plus size={16} /> New Application
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                ? 'border-indigo-600 text-indigo-700 font-bold'
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
            className="-mx-1.5 sm:mx-0 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-6 md:p-10"
          >
            <StepIndicator currentStep={step} />

            <div className="mt-3 sm:mt-8">
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
                    >
                      <ATSCompatibilityView
                        atsResult={atsResult}
                        isSubmitting={isSubmitting}
                        onProceedToDraft={handleProceedToDraft}
                        onGoToATSMatcher={handleGoToATSMatcher}
                        onBackToJobDetails={() => setStep(STEPS.JOB_DETAILS)}
                      />
                    </motion.div>
                  )}

                  {/* STEP 1: JOB DETAILS (SPLIT-SCREEN WORKFLOW) */}
                  {step === STEPS.JOB_DETAILS && (
                    <motion.div
                      key="step-details"
                      variants={pageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 items-start"
                    >
                      {/* ── Left Column: Candidate Profile & Input Screenshot Zone ── */}
                      <div className="space-y-4 sm:space-y-6">
                        <div className="space-y-2 sm:space-y-3">
                          <div>
                            <h2 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
                              <FileText size={18} className="text-indigo-600 shrink-0" /> Candidate Profile
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">We'll use your primary profile resume for this application.</p>
                          </div>

                          {/* Profile Resume Attached Card */}
                          <div className="p-3 sm:p-4 bg-slate-50/70 sm:bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 sm:border-slate-200 shadow-none sm:shadow-sm">
                            <div className="flex items-center gap-3 sm:gap-3.5">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 text-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                                <FileText size={18} className="sm:w-5 sm:h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3
                                  className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs"
                                  title={user?.profile_resume_name || "Resume not found"}
                                >
                                  {user?.profile_resume_name || "Resume not found"}
                                </h3>
                                {user?.profile_resume_url ? (
                                  <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                                    <CheckCircle size={12} className="shrink-0" /> Linked from Profile
                                  </p>
                                ) : (
                                  <p className="text-[11px] font-semibold text-rose-500 flex items-center gap-1 mt-0.5">
                                    Please upload a resume in your profile.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Inline "Need to update your resume?" link */}
                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Need to update resume?</span>
                              <Link
                                to="/profile"
                                className="font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5"
                              >
                                Update in Profile <ArrowRight size={11} />
                              </Link>
                            </div>
                          </div>
                        </div>

                        {/* Dedicated spacious Screenshot Upload Zone in Left Column */}
                        <div className="p-0 sm:p-5 bg-transparent sm:bg-white rounded-xl sm:rounded-2xl border-0 sm:border border-slate-200 shadow-none sm:shadow-sm">
                          <ScreenshotUploadZone
                            onExtractStart={() => setExtractingDetails(true)}
                            onExtractSuccess={(extractedData) => {
                              setFormValues((prev) => ({
                                company_name: extractedData.company_name || prev.company_name,
                                job_title: extractedData.job_title || prev.job_title,
                                hr_email: extractedData.hr_email || prev.hr_email,
                                job_description: extractedData.job_description || prev.job_description,
                              }));
                              setExtractingDetails(false);
                            }}
                            onExtractError={() => setExtractingDetails(false)}
                          />
                        </div>
                      </div>

                      {/* ── Right Column: Output Form ── */}
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <h2 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
                            <Briefcase size={18} className="text-indigo-600 shrink-0" /> Job Information
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">Review or complete the target job details below.</p>
                        </div>
                        <div className="p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                          <JobDetailsForm
                            values={formValues}
                            setValues={setFormValues}
                            extracting={extractingDetails}
                            onSubmit={handleJobDetailsSubmit}
                            onCheckATS={handleCheckATS}
                            isSubmitting={isSubmitting}
                          />
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
                        <button
                          type="button"
                          onClick={() => reset()}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <RotateCcw size={13} />
                          <span>Start New Application</span>
                        </button>
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
              className="-mx-1.5 sm:mx-0 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-base font-semibold text-slate-900">Application Log</h2>
                <p className="text-sm text-slate-500 mt-1">Review the status of your previously generated applications.</p>
              </div>
              <div className="p-4 sm:p-6">
                <ApplicationHistoryTable />
              </div>
            </motion.div>
          )}

        </AnimatePresence>

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