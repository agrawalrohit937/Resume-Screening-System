import React, { useState, useRef } from 'react';
import { useCopilot } from './CopilotProvider';
import { Send, Square, FileSearch, Mic, Award, Briefcase } from 'lucide-react';

const SLASH_COMMANDS = [
  { cmd: '/ats', label: 'ATS Scan', desc: 'Match resume against job description', icon: FileSearch },
  { cmd: '/jobs', label: 'Find Jobs', desc: 'Discover matched career roles', icon: Briefcase },
  { cmd: '/interview', label: 'Mock Interview', desc: 'Practice AI voice questions', icon: Mic },
  { cmd: '/enhance', label: 'Enhance Bullets', desc: 'Rewrite resume with measurable impact', icon: Award },
];

export default function CopilotInput() {
  const { sendMessage, isGenerating, stopGeneration } = useCopilot();
  const [text, setText] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const textareaRef = useRef(null);

  const handleInput = (e) => {
    const val = e.target.value;
    setText(val);
    setShowSlashMenu(val.startsWith('/'));

    // Auto-expand textarea height up to 110px
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 110)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (overrideText = null) => {
    const toSend = overrideText || text;
    if (!toSend.trim() || isGenerating) return;

    sendMessage(toSend);
    setText('');
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSelectSlash = (cmd) => {
    setText(cmd + ' ');
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="relative p-2.5 px-3 border-t border-slate-100 bg-white shrink-0 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] sm:pb-2.5">
      {/* Slash Command Popover */}
      {showSlashMenu && (
        <div className="absolute bottom-full left-3 right-3 mb-2 p-1.5 rounded-xl bg-white border border-slate-200 shadow-xl space-y-0.5 z-50">
          <p className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5">Quick Commands</p>
          {SLASH_COMMANDS.map((sc) => {
            const Icon = sc.icon;
            return (
              <button
                key={sc.cmd}
                onClick={() => handleSelectSlash(sc.cmd)}
                className="w-full flex items-center gap-2 p-1.5 px-2 rounded-lg hover:bg-slate-50 text-left transition-colors cursor-pointer group"
              >
                <div className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Icon size={11} />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">{sc.cmd}</span>
                    <span className="text-[11px] text-slate-400">— {sc.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{sc.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Auto-Resizing Textarea Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex items-end gap-2 bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl px-3 py-1.5 transition-all shadow-2xs"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask CareerMitra, paste a JD, or type /..."
          className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none py-1 leading-relaxed max-h-[110px]"
        />

        {isGenerating ? (
          <button
            type="button"
            onClick={stopGeneration}
            className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 mb-0.5"
            title="Stop generating"
          >
            <Square size={10} className="fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!text.trim()}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer mb-0.5 ${
              text.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Send (Enter)"
          >
            <Send size={12} className="translate-x-[0.5px]" />
          </button>
        )}
      </form>
    </div>
  );
}
