import { useState, useCallback } from 'react';
import applyAssistantApi from '../services/applyAssistantApi';

export const STEPS = {
  JOB_DETAILS: 'job_details',
  ATS_CHECK: 'ats_check',
  GENERATING: 'generating',
  REVIEW: 'review',
  SENT: 'sent',
};

function formatErrorMessage(err, fallback = 'An unexpected error occurred.') {
  const detail = err?.response?.data?.detail || err?.message;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.msg || item.message || JSON.stringify(item);
        }
        return String(item);
      })
      .join(', ');
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail);
}

export function useApplyAssistant() {
  const [step, setStep] = useState(STEPS.JOB_DETAILS);
  const [draft, setDraft] = useState(null);
  const [atsResult, setAtsResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkATSScore = useCallback(async (resumeId, jobDetails) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await applyAssistantApi.checkATSScore({ resume_id: resumeId, ...jobDetails });
      setAtsResult(result);
      setStep(STEPS.ATS_CHECK);
      return result;
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to check ATS score. Please try again.'));
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const generateDraft = useCallback(async (resumeId, jobDetails) => {
    setIsSubmitting(true);
    setError(null);
    setStep(STEPS.GENERATING);
    try {
      const result = await applyAssistantApi.generateDraft({ resume_id: resumeId, ...jobDetails });
      setDraft(result);
      setStep(STEPS.REVIEW);
      return result;
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to generate draft. Please try again.'));
      setStep(STEPS.JOB_DETAILS);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const updateDraft = useCallback(
    async (edits) => {
      if (!draft) return;
      try {
        const result = await applyAssistantApi.updateDraft(draft.application_id, edits);
        setDraft(result);
        return result;
      } catch (err) {
        setError(formatErrorMessage(err, 'Failed to update draft.'));
        throw err;
      }
    },
    [draft],
  );

  const sendApplication = useCallback(async () => {
    if (!draft) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await applyAssistantApi.sendApplication(draft.application_id);
      setDraft((prev) => ({ ...prev, status: result.status }));
      setStep(STEPS.SENT);
      return result;
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to send application.'));
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [draft]);

  const reset = useCallback(() => {
    setStep(STEPS.JOB_DETAILS);
    setDraft(null);
    setAtsResult(null);
    setError(null);
  }, []);

  return { step, draft, atsResult, error, isSubmitting, checkATSScore, generateDraft, updateDraft, sendApplication, reset };
}
