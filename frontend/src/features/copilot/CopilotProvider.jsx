import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  streamChatV2,
  submitMessageFeedback,
} from '../../services/copilotApi';

const CopilotContext = createContext(null);

export const useCopilot = () => {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
};

const INITIAL_GREETING = {
  id: 'greeting',
  role: 'assistant',
  content: "Hi there! 👋 I'm CareerMitra, your personal AI career mentor.\n\nHow can I help boost your career today?",
  created_at: new Date().toISOString(),
};

const getContextualSuggestions = (pathname = '') => {
  if (pathname.includes('/results')) {
    return [
      { label: '🎯 Missing Skills', prompt: 'What key skills am I missing for this job description?' },
      { label: '📈 Boost ATS Score', prompt: 'Give me 3 actionable steps to increase my ATS match score above 85%' },
      { label: '✨ Bullet Diffs', prompt: 'Rewrite my resume experience bullets to match this target role' },
      { label: '🔍 Recruiter Perspective', prompt: 'What would a recruiter flag as weak in my resume for this role?' },
    ];
  }
  if (pathname.includes('/interview') || pathname.includes('/live-interview')) {
    return [
      { label: '🎙️ Mock Question', prompt: 'Ask me a real behavioral interview question for my target role' },
      { label: '💡 STAR Method', prompt: 'How should I structure my answer using the STAR framework?' },
      { label: '🧠 System Design', prompt: 'Give me a system design practice problem with key discussion points' },
      { label: '📊 Scoring Criteria', prompt: 'What do interviewers evaluate most in technical answers?' },
    ];
  }
  if (pathname.includes('/jobs')) {
    return [
      { label: '💼 Best Matches', prompt: 'Which of the recommended jobs best fit my verified skill set?' },
      { label: '📝 Tailor Resume', prompt: 'How should I tailor my profile for top tech job postings?' },
      { label: '🎯 Skill Gap', prompt: 'What skill should I learn next to unlock higher-paying roles?' },
      { label: '⚡ Recruiter Note', prompt: 'Draft a short, compelling message to connect with the hiring manager' },
    ];
  }
  if (pathname.includes('/github')) {
    return [
      { label: '🐙 Repo Analysis', prompt: 'How can I make my top GitHub repository stand out to recruiters?' },
      { label: '⭐ Readme Review', prompt: 'Give me tips to write a high-converting README for my project' },
      { label: '🛠️ Project Ideas', prompt: 'Suggest 2 standout full-stack projects to add to my portfolio' },
      { label: '🚀 Code Quality', prompt: 'What engineering practices impress hiring managers looking at code?' },
    ];
  }
  // Default General / Dashboard
  return [
    { label: '🎯 ATS Match', prompt: 'Review my ATS match score and readiness' },
    { label: '✨ Polish Resume', prompt: 'Rewrite my top 3 resume bullets for higher impact' },
    { label: '🎙️ Mock Interview', prompt: 'Practice a mock interview for my role' },
    { label: '🚀 Career Roadmap', prompt: 'Build a 4-week learning roadmap for my career' },
  ];
};

export function CopilotProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth?.() || {};
  const user = auth.user;
  const userId = user?.id || user?._id || user?.user_id || null;

  const [isOpen, setIsOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [suggestions, setSuggestions] = useState(() => getContextualSuggestions(location?.pathname));

  const abortControllerRef = useRef(null);

  // Dynamically update quick suggestions when candidate changes page
  useEffect(() => {
    setSuggestions(getContextualSuggestions(location?.pathname));
  }, [location?.pathname]);

  // Clean up any stale localStorage chat caches on mount / user switch
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('careershala:copilot:')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (e) {
      // ignore
    }
  }, [userId]);

  // Reset state when user logs out or switches accounts
  useEffect(() => {
    if (!userId) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
      setCurrentStatus('');
      setCurrentSessionId(null);
      setMessages([INITIAL_GREETING]);
      setIsOpen(false);
    }
  }, [userId]);

  // Global event listeners (Ctrl/Cmd+K, logout event, custom open trigger)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('careershala:open-copilot', handleOpen);

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleLogout = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
      setCurrentStatus('');
      setCurrentSessionId(null);
      setMessages([INITIAL_GREETING]);
      setIsOpen(false);
    };
    window.addEventListener('careershala:logout', handleLogout);

    return () => {
      window.removeEventListener('careershala:open-copilot', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('careershala:logout', handleLogout);
    };
  }, []);

  // Stop active streaming generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setCurrentStatus('');
  }, []);

  // Start fresh in-memory chat
  const createNewChat = useCallback(() => {
    stopGeneration();
    setCurrentSessionId(null);
    setMessages([INITIAL_GREETING]);
    setSuggestions(getContextualSuggestions(location?.pathname));
  }, [stopGeneration, location?.pathname]);

  // Send message
  const sendMessage = async (text, quickAction = null, forceRefresh = false) => {
    const trimmed = text?.trim();
    if (!trimmed || isGenerating) return;

    // Optimistically append user message
    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    // Placeholder bot message for streaming tokens
    const botMsgId = `bot_${Date.now()}`;
    const botMsg = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      ui_cards: [],
      citations: [],
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setIsGenerating(true);
    setCurrentStatus('Analyzing request...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamChatV2({
        message: trimmed,
        sessionId: currentSessionId,
        history: messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content || '',
        })),
        quickAction,
        forceRefresh,
        signal: controller.signal,
        onEvent: (ev) => {
          switch (ev.type) {
            case 'session':
              if (ev.session_id) {
                setCurrentSessionId(ev.session_id);
              }
              break;

            case 'status':
              setCurrentStatus(ev.label || '');
              break;

            case 'tool_call': {
              const toolName = ev.tool || ev.name || 'tool';
              setCurrentStatus(`Executing ${toolName.replace(/_/g, ' ')}...`);
              break;
            }

            case 'tool_result':
              break;

            case 'ui_card':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, ui_cards: [...(m.ui_cards || []), { card: ev.card, data: ev.data }] }
                    : m
                )
              );
              break;

            case 'citation':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                        ...m,
                        citations: [
                          ...(m.citations || []),
                          {
                            source: ev.source,
                            label: ev.label || ev.title,
                            href: ev.href,
                            score: ev.score,
                            snippet: ev.snippet,
                          },
                        ],
                      }
                    : m
                )
              );
              break;

            case 'token': {
              const delta = ev.delta || ev.text || ev.chunk || '';
              if (delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId ? { ...m, content: (m.content || '') + delta } : m
                  )
                );
              }
              break;
            }

            case 'suggestions':
              if (Array.isArray(ev.items) && ev.items.length > 0) {
                setSuggestions(ev.items);
              }
              break;

            case 'navigate':
              if (ev.to) {
                navigate(ev.to);
              }
              break;

            case 'done':
              setIsGenerating(false);
              setCurrentStatus('');
              break;

            case 'error':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, content: (m.content || '') + `\n\n⚠️ *${ev.message || 'Error encountered'}*` }
                    : m
                )
              );
              setIsGenerating(false);
              setCurrentStatus('');
              break;

            default:
              break;
          }
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `⚠️ Unable to reach Copilot: ${err.message || 'Network error. Please try again.'}`,
                }
              : m
          )
        );
      }
    } finally {
      setIsGenerating(false);
      setCurrentStatus('');
      abortControllerRef.current = null;
    }
  };

  // Submit thumbs rating on message
  const rateMessage = async (messageId, rating) => {
    try {
      await submitMessageFeedback(messageId, rating);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, user_rating: rating } : m))
      );
    } catch (e) {
      console.warn('Could not record message feedback:', e);
    }
  };

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        setIsOpen,
        currentSessionId,
        messages,
        isGenerating,
        currentStatus,
        suggestions,
        sendMessage,
        stopGeneration,
        createNewChat,
        startNewSession: createNewChat,
        clearMessages: createNewChat,
        rateMessage,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}
