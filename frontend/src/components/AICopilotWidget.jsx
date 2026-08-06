import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  X,
  Send,
  FileText,
  Target,
  Video,
  Map,
  Github,
  Puzzle,
  Briefcase,
  Bot,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { chatCopilotStream } from '../services/api'

// ── Quick actions mapped to explicit quick_action tags and queries ─────────
const QUICK_ACTIONS = [
  { 
    id: 'review-resume', 
    label: 'Review Resume', 
    icon: FileText, 
    prompt: 'Can you review my resume and tell me its key strengths and weak areas?',
    action: 'review-resume'
  },
  { 
    id: 'improve-ats', 
    label: 'Improve ATS Score', 
    icon: Target, 
    prompt: 'What are the top missing keywords in my ATS match and how can I add them?',
    action: 'improve-ats'
  },
  { 
    id: 'mock-interview', 
    label: 'Mock Interview', 
    icon: Video, 
    prompt: 'Give me 3 coding questions I should practice based on my resume tech stack.',
    action: 'mock-interview'
  },
  { 
    id: 'analyze-github', 
    label: 'Analyze GitHub', 
    icon: Github, 
    prompt: 'Explain my GitHub contribution stats and language distribution.',
    action: 'analyze-github'
  },
  { 
    id: 'skill-gaps', 
    label: 'Find Skill Gaps', 
    icon: Puzzle, 
    prompt: 'Compare my resume technical skills against the target job requirements to highlight skill gaps.',
    action: 'skill-gaps'
  },
  { 
    id: 'career-roadmap', 
    label: 'Career Roadmap', 
    icon: Map, 
    prompt: 'Design a step-by-step career learning roadmap to upskill myself.',
    action: 'career-roadmap'
  },
  { 
    id: 'job-suggestions', 
    label: 'Job Suggestions', 
    icon: Briefcase, 
    prompt: 'What job roles fit my current skills and how should I apply?',
    action: 'job-suggestions'
  },
]

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'bot',
  text: "Hi, I'm CareerShala AI Copilot 👋\nAsk me anything about your resume, mock practice, certifications, or ATS optimization. Try typing `/interview` or `/ats` for quick navigation!",
}

// ── Custom lightweight markdown renderer (zero bundle bloat) ─────────
function parseMarkdown(text) {
  if (!text) return "";
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    if (line.startsWith('### ')) {
      return <h4 key={idx} className="font-extrabold text-slate-800 text-[13px] mt-2 mb-1">{line.slice(4)}</h4>;
    }
    if (line.startsWith('## ')) {
      return <h3 key={idx} className="font-extrabold text-slate-900 text-sm mt-3 mb-1">{line.slice(3)}</h3>;
    }
    if (line.startsWith('# ')) {
      return <h2 key={idx} className="font-black text-slate-950 text-base mt-3.5 mb-1.5">{line.slice(2)}</h2>;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={idx} className="list-disc ml-4 text-[12.5px] text-slate-600 leading-relaxed mb-0.5">
          {renderInlineStyles(line.slice(2))}
        </li>
      );
    }
    if (line.trim() === '') {
      return <div key={idx} className="h-1.5" />;
    }
    return (
      <p key={idx} className="text-[12.5px] text-slate-600 leading-relaxed mb-1.5">
        {renderInlineStyles(line)}
      </p>
    );
  });
}

function renderInlineStyles(text) {
  const parts = [];
  let currentIdx = 0;
  const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchStr = match[0];
    const matchIdx = match.index;

    if (matchIdx > currentIdx) {
      parts.push(text.substring(currentIdx, matchIdx));
    }

    if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
      parts.push(<strong key={matchIdx} className="font-bold text-slate-800">{matchStr.slice(2, -2)}</strong>);
    } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
      parts.push(<code key={matchIdx} className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-mono text-[11px] font-semibold">{matchStr.slice(1, -1)}</code>);
    } else if (matchStr.startsWith('[') && matchStr.includes('](')) {
      const closeBracket = matchStr.indexOf(']');
      const label = matchStr.slice(1, closeBracket);
      const url = matchStr.slice(closeBracket + 2, -1);
      parts.push(
        <a key={matchIdx} href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold">
          {label}
        </a>
      );
    }
    currentIdx = regex.lastIndex;
  }

  if (currentIdx < text.length) {
    parts.push(text.substring(currentIdx));
  }
  return parts.length > 0 ? parts : text;
}

// ── Message Bubble Component with clipboard copy functionality ──
function ChatBubble({ message }) {
  const isBot = message.role === 'bot'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      toast.error("Failed to copy message.")
    }
  }

  return (
    <div className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'} group`}>
      <div className={`flex items-start gap-2.5 max-w-[85%] ${isBot ? '' : 'flex-row-reverse'}`}>
        {isBot && (
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
          >
            <Bot className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
        )}
        <div className="relative">
          <div
            className={`px-4 py-3 rounded-2xl text-[13px] shadow-sm leading-relaxed ${
              isBot
                ? 'bg-slate-100/90 text-slate-700 rounded-tl-sm border border-slate-200/50'
                : 'text-white rounded-tr-sm bg-gradient-to-br from-indigo-500 to-indigo-600'
            }`}
          >
            {isBot ? parseMarkdown(message.text) : message.text}
          </div>
          
          {/* Subtle utility actions on hover */}
          <div className={`absolute top-2.5 ${isBot ? '-right-8' : '-left-8'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}>
            <button
              onClick={handleCopy}
              className="p-1 rounded bg-white hover:bg-slate-50 border border-slate-200/60 shadow-xs text-slate-400 hover:text-slate-600 transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AICopilotWidget() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = window.localStorage.getItem('careershala:copilot:history')
      return saved ? JSON.parse(saved) : [WELCOME_MESSAGE]
    } catch {
      return [WELCOME_MESSAGE]
    }
  })
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [errorState, setErrorState] = useState(null)
  
  const scrollRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Persist history
  useEffect(() => {
    try {
      window.localStorage.setItem('careershala:copilot:history', JSON.stringify(messages))
    } catch (e) {
      console.error("Failed to save conversation history", e)
    }
  }, [messages])

  // Scroll to bottom on updates
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // Open triggers via window events
  useEffect(() => {
    const openFromNavbar = () => setIsOpen(true)
    window.addEventListener('careershala:open-copilot', openFromNavbar)
    return () => window.removeEventListener('careershala:open-copilot', openFromNavbar)
  }, [])

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear this conversation history?")) {
      setMessages([WELCOME_MESSAGE])
      setErrorState(null)
    }
  }

  const sendMessage = async (text, actionKey = null, isRetry = false) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setErrorState(null)
    setInput('')
    
    // Add user message if not retrying
    let currentHistory = [...messages]
    if (!isRetry) {
      const userMsg = { id: `u-${Date.now()}`, role: 'user', text: trimmed }
      currentHistory.push(userMsg)
      setMessages(currentHistory)
    }

    setIsTyping(true)

    // Setup bot reply block
    const botMsgId = `b-${Date.now()}`
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', text: '' }])

    try {
      // Map history formats into array of simple dicts expected by the backend
      const historyPayload = currentHistory.map(m => ({
        role: m.role,
        text: m.text
      }))

      // Request stream from backend API
      const response = await chatCopilotStream(trimmed, historyPayload, actionKey)
      setIsTyping(false)

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let done = false
      let buffer = ''

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        buffer += decoder.decode(value, { stream: !done })

        const lines = buffer.split('\n')
        // Unfinished line is kept in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const cleanLine = line.trim()
          if (!cleanLine) continue;
          if (cleanLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(cleanLine.slice(6))
              
              // Handle short-circuit navigation command
              if (data.navigate) {
                setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: data.response } : m))
                setTimeout(() => {
                  navigate(data.navigate)
                  setIsOpen(false)
                }, 1000)
                return
              }

              // Update token chunk
              if (data.text) {
                setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: m.text + data.text } : m))
              }
            } catch (e) {
              console.warn("Chunk decode failure:", cleanLine)
            }
          }
        }
      }

    } catch (err) {
      console.error("Copilot stream connection failed", err)
      setIsTyping(false)
      
      // Cleanup the empty bot response placeholder on failure
      setMessages(prev => prev.filter(m => m.id !== botMsgId))
      
      setErrorState({
        text: trimmed,
        actionKey: actionKey,
        message: err.message || "Failed to establish real-time connection with Copilot."
      })
    }
  }

  const handleQuickAction = (action) => sendMessage(action.prompt, action.action)

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <>
      {/* Floating launcher trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            onClick={() => setIsOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[60] w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white cursor-pointer shadow-lg select-none"
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #6366f1 60%, #06b6d4)',
              boxShadow: '0 12px 30px -8px rgba(79,70,229,0.5)',
            }}
            title="CareerShala AI Copilot"
            aria-label="Open AI Copilot"
          >
            <Sparkles className="w-6 h-6 animate-pulse" strokeWidth={2.2} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat popup container */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile background backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              onTouchEnd={(e) => {
                e.preventDefault()
                setIsOpen(false)
              }}
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs sm:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="fixed z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-24 sm:right-6 w-full sm:w-[410px] h-[85dvh] max-h-[85vh] sm:h-[620px] sm:max-h-[740px] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border-t border-x sm:border border-slate-200/80 sm:border-white bg-white/95 backdrop-blur-xl shadow-2xl"
              style={{ boxShadow: '0 25px 60px -15px rgba(15,23,42,0.22)' }}
              role="dialog"
              aria-label="CareerShala AI Copilot"
            >
              {/* Mobile Bottom Sheet Pull Bar */}
              <div className="w-12 h-1 rounded-full bg-slate-300/80 mx-auto my-1.5 shrink-0 sm:hidden" />

              {/* Premium Header */}
              <div
                className="relative flex items-center justify-between px-4 py-3 shrink-0 select-none shadow-sm"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
                    <Sparkles className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-white font-extrabold text-[13.5px] tracking-tight">CareerShala AI Copilot</p>
                    <p className="text-indigo-200 text-[10.5px] font-semibold">Smart contextual advisor</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {messages.length > 1 && (
                    <button
                      onClick={handleClearHistory}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                      title="Clear Chat History"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
                    aria-label="Close panel"
                  >
                    <X className="w-5 h-5" strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
                {messages.map((m) => (
                  <ChatBubble key={m.id} message={m} />
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 border border-slate-200/50">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Banner state */}
                {errorState && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/60 text-slate-700 flex flex-col gap-2.5 shadow-sm">
                    <div className="flex items-start gap-2 text-rose-700">
                      <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                      <p className="text-[12px] font-bold leading-tight">{errorState.message}</p>
                    </div>
                    <button
                      onClick={() => sendMessage(errorState.text, errorState.actionKey, true)}
                      className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Message
                    </button>
                  </div>
                )}

                {/* Invisible auto-scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions Panel — shows when only welcome message is present */}
              {messages.length === 1 && !errorState && (
                <div className="px-4 pb-3 shrink-0 select-none">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                    Quick Actions
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
                    {QUICK_ACTIONS.map((action) => {
                      const Icon = action.icon
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all text-left shrink-0 cursor-pointer snap-start group"
                        >
                          <span className="w-6.5 h-6.5 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 group-hover:bg-indigo-100/70 transition-colors">
                            <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 leading-tight">
                            {action.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form
                onSubmit={handleSubmit}
                className="shrink-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-white border-t border-slate-100 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask copilot about your career / resume..."
                  className="flex-1 h-10 px-4 rounded-xl bg-slate-100 text-base sm:text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 border border-transparent transition-all"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-transform active:scale-95 shadow-sm"
                  aria-label="Send query"
                >
                  <Send className="w-4.5 h-4.5" strokeWidth={2.2} />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}