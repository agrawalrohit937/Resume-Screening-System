import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Mail, FileText, Copy, Check, Send, Sparkles, CheckCircle2 } from 'lucide-react';

export default function DraftEditor({ draft, onSave, onApproveSend, isSubmitting }) {
  const [activeTab, setActiveTab] = useState('email'); // 'email' | 'cover_letter'
  const [subject, setSubject] = useState(draft?.email_subject || '');
  const [body, setBody] = useState(draft?.email_body || '');
  const [coverLetter, setCoverLetter] = useState(draft?.cover_letter_text || '');
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    setSubject(draft?.email_subject || '');
    setBody(draft?.email_body || '');
    setCoverLetter(draft?.cover_letter_text || '');
  }, [draft]);

  const handleBlurSave = (field, value) => {
    if (onSave) onSave({ [field]: value });
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard! 📋`, { id: 'copy-draft' });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const countWords = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {draft?.needs_manual_review && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm font-medium text-amber-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>Please review this tailored outreach draft closely before sending.</span>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'email'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail size={14} className={activeTab === 'email' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Outreach Email</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cover_letter')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'cover_letter'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} className={activeTab === 'cover_letter' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Cover Letter</span>
          </button>
        </div>

        {/* Compact ATS Match Badge */}
        {draft?.ats_result?.score && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>ATS Match: {draft.ats_result.score}%</span>
          </div>
        )}
      </div>

      {/* TAB 1: Outreach Email */}
      {activeTab === 'email' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Email Subject
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(subject, 'Subject')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                {copiedField === 'Subject' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copiedField === 'Subject' ? 'Copied' : 'Copy Subject'}</span>
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onBlur={(e) => handleBlurSave('email_subject', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Email Body
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-slate-400">
                  {countWords(body)} words
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(body, 'Email Body')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {copiedField === 'Email Body' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedField === 'Email Body' ? 'Copied' : 'Copy Body'}</span>
                </button>
              </div>
            </div>
            <textarea
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={(e) => handleBlurSave('email_body', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-900 leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-y font-sans"
            />
          </div>
        </div>
      )}

      {/* TAB 2: Cover Letter */}
      {activeTab === 'cover_letter' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Tailored Cover Letter
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-slate-400">
                  {countWords(coverLetter)} words
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(coverLetter, 'Cover Letter')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {copiedField === 'Cover Letter' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedField === 'Cover Letter' ? 'Copied' : 'Copy Cover Letter'}</span>
                </button>
              </div>
            </div>
            <textarea
              rows={12}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              onBlur={(e) => handleBlurSave('cover_letter_text', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-900 leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-y font-sans"
            />
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 font-medium">
          ✨ Edits auto-save when clicking outside input fields.
        </p>
        <button
          type="button"
          onClick={onApproveSend}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Dispatching Application...</span>
            </>
          ) : (
            <>
              <Send size={15} />
              <span>Approve & Send Application</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
