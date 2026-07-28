import { useState, useEffect } from 'react';

// NOTE: the ATS score block below is inlined rather than a separate
// ATSInsightPanel.jsx component - per the reuse-first audit, swap this
// block for your existing ATS score display component from
// Results.jsx / Analytics.jsx if one already exists, instead of keeping
// a second visualization of the same data.

export default function DraftEditor({ draft, onSave, onApproveSend, isSubmitting }) {
  const [subject, setSubject] = useState(draft?.email_subject || '');
  const [body, setBody] = useState(draft?.email_body || '');
  const [coverLetter, setCoverLetter] = useState(draft?.cover_letter_text || '');

  useEffect(() => {
    setSubject(draft?.email_subject || '');
    setBody(draft?.email_body || '');
    setCoverLetter(draft?.cover_letter_text || '');
  }, [draft]);

  const handleBlurSave = (field, value) => onSave({ [field]: value });

  return (
    <div className="space-y-6">
      {draft?.needs_manual_review && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          This draft needed a manual look after a couple of automated regeneration attempts -
          please review it closely before sending.
        </div>
      )}

      {draft?.ats_result && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
          <p className="text-sm font-medium text-indigo-900">ATS Match Score: {draft.ats_result.score}%</p>
          {draft.ats_result.missing_keywords?.length > 0 && (
            <p className="text-sm text-indigo-700 mt-1">
              Missing keywords: {draft.ats_result.missing_keywords.join(', ')}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onBlur={(e) => handleBlurSave('email_subject', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
        <textarea
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={(e) => handleBlurSave('email_body', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter</label>
        <textarea
          rows={12}
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          onBlur={(e) => handleBlurSave('cover_letter_text', e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={onApproveSend}
        disabled={isSubmitting}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
      >
        {isSubmitting ? 'Sending...' : 'Approve & Send'}
      </button>
    </div>
  );
}
