import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  streamChatV2,
  fetchSessions,
  createSession,
  deleteSession,
  fetchSessionMessages,
  submitMessageFeedback,
  migrateLocalStorage,
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
  content: "Hi, I'm CareerShala AI Copilot 👋\n\nI can analyze your resume, optimize ATS scores, conduct mock interview practice, and draft personalized career roadmaps. Try asking a question or typing `/ats` or `/interview`!",
  created_at: new Date().toISOString(),
};

export function CopilotProvider({ children }) {
  const auth = useAuth?.() || {};
  const user = auth.user;
  const userId = user?.id || user?._id || user?.user_id || null;

  // Key storage per user to prevent cross-account chat leaks
  const sessionKey = userId ? `careershala:copilot:${userId}:session_id` : null;
  const messagesKey = userId ? `careershala:copilot:${userId}:continuous_messages` : null;

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentTools, setCurrentTools] = useState([]);
  const [suggestions, setSuggestions] = useState([
    'Review my ATS match score',
    'Rewrite my top 3 resume bullets',
    'Practice mock interview',
    'Build 4-week learning roadmap',
  ]);

  const abortControllerRef = useRef(null);

  // Synchronize and isolate chat state whenever active user changes or logs out
  useEffect(() => {
    // 1. Abort any running generation from prior user
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setCurrentStatus('');
    setCurrentTools([]);

    // 2. If logged out, reset all internal state to default
    if (!userId) {
      setSessions([]);
      setCurrentSessionId(null);
      setMessages([INITIAL_GREETING]);
      setSuggestions([
        'Review my ATS match score',
        'Rewrite my top 3 resume bullets',
        'Practice mock interview',
        'Build 4-week learning roadmap',
      ]);
      return;
    }

    // 3. Load user-keyed storage for the authenticated user
    let isMounted = true;
    let localMessagesLoaded = false;

    if (messagesKey) {
      const savedMessages = localStorage.getItem(messagesKey);
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            localMessagesLoaded = true;
          }
        } catch (e) {
          console.warn('Could not parse local messages for user:', e);
        }
      }
    }

    if (sessionKey) {
      const savedSessionId = localStorage.getItem(sessionKey);
      if (savedSessionId && savedSessionId !== 'undefined' && savedSessionId !== 'null') {
        setCurrentSessionId(savedSessionId);
      }
    }

    // Load backend conversation list for this user
    const loadInitialBackendChat = async () => {
      try {
        const res = await fetchSessions();
        if (!isMounted) return;
        if (res && res.sessions && res.sessions.length > 0) {
          setSessions(res.sessions);
          if (!localMessagesLoaded) {
            const latest = res.sessions[0];
            const sId = latest?.id || latest?._id || latest?.session_id;
            if (sId && sId !== 'undefined' && sId !== 'null') {
              setCurrentSessionId(sId);
              if (sessionKey) localStorage.setItem(sessionKey, sId);
              const msgRes = await fetchSessionMessages(sId);
              if (isMounted && msgRes && msgRes.messages && msgRes.messages.length > 0) {
                setMessages(msgRes.messages);
              }
            }
          }
        } else {
          setSessions([]);
          if (!localMessagesLoaded) {
            setCurrentSessionId(null);
            setMessages([INITIAL_GREETING]);
          }
        }
      } catch (e) {
        console.warn('Could not load backend chat for user:', e);
      }
    };

    loadInitialBackendChat();

    return () => {
      isMounted = false;
    };
  }, [userId, sessionKey, messagesKey]);

  // Persist continuous chat messages to user-keyed localStorage
  useEffect(() => {
    if (messagesKey && messages && messages.length > 1) {
      try {
        localStorage.setItem(messagesKey, JSON.stringify(messages));
      } catch (e) {
        // quota or privacy mode
      }
    }
  }, [messages, messagesKey]);

  // Global event listener for navbar / button trigger & logout event
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
      setCurrentTools([]);
      setSessions([]);
      setCurrentSessionId(null);
      setMessages([INITIAL_GREETING]);
      setIsOpen(false);
      setIsExpanded(false);
    };
    window.addEventListener('careershala:logout', handleLogout);

    return () => {
      window.removeEventListener('careershala:open-copilot', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('careershala:logout', handleLogout);
    };
  }, []);

  // Switch active session
  const switchSession = async (sessionId) => {
    if (isGenerating) stopGeneration();
    setCurrentSessionId(sessionId);
    if (sessionKey) localStorage.setItem(sessionKey, sessionId);
    await loadSessionMessages(sessionId);
  };

  // Start fresh session
  const createNewChat = async () => {
    if (isGenerating) stopGeneration();
    try {
      if (messagesKey) localStorage.removeItem(messagesKey);
      const newSession = await createSession('New Conversation');
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      if (sessionKey) localStorage.setItem(sessionKey, newSession.id);
      setMessages([INITIAL_GREETING]);
      setSuggestions([
        'Review my ATS match score',
        'Rewrite my top 3 resume bullets',
        'Practice mock interview',
        'Build 4-week learning roadmap',
      ]);
    } catch {
      if (messagesKey) localStorage.removeItem(messagesKey);
      setCurrentSessionId(null);
      setMessages([INITIAL_GREETING]);
    }
  };

  // Delete session
  const removeSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        createNewChat();
      }
    } catch (e) {
      console.error('Failed to remove session:', e);
    }
  };

  // Stop active streaming generation
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setCurrentStatus('');
    setCurrentTools([]);
  };

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
      citations: [],
      ui_cards: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setIsGenerating(true);
    setCurrentStatus('Analyzing request...');
    setCurrentTools([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamChatV2({
        message: trimmed,
        sessionId: currentSessionId,
        quickAction,
        forceRefresh,
        signal: controller.signal,
        onEvent: (ev) => {
          switch (ev.type) {
            case 'session':
              if (ev.session_id && ev.session_id !== currentSessionId) {
                setCurrentSessionId(ev.session_id);
                if (sessionKey) localStorage.setItem(sessionKey, ev.session_id);
              }
              break;

            case 'status':
              setCurrentStatus(ev.label || '');
              break;

            case 'tool_call': {
              const toolName = ev.tool || ev.name || 'tool';
              setCurrentTools((prev) => [...prev, { name: toolName, input: ev.args }]);
              setCurrentStatus(`Executing ${toolName.replace(/_/g, ' ')}...`);
              break;
            }

            case 'tool_result': {
              const toolName = ev.tool || ev.name || '';
              setCurrentTools((prev) =>
                prev.map((t) => (t.name === toolName ? { ...t, done: true, summary: ev.summary } : t))
              );
              break;
            }

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
              if (Array.isArray(ev.items)) {
                setSuggestions(ev.items);
              }
              break;

            case 'navigate':
              if (ev.to) {
                window.location.href = ev.to;
              }
              break;

            case 'done':
              setIsGenerating(false);
              setCurrentStatus('');
              setCurrentTools([]);
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
      setCurrentTools([]);
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
        isExpanded,
        setIsExpanded,
        sessions,
        currentSessionId,
        messages,
        isGenerating,
        currentStatus,
        currentTools,
        suggestions,
        sendMessage,
        stopGeneration,
        createNewChat,
        startNewSession: createNewChat,
        clearMessages: createNewChat,
        switchSession,
        removeSession,
        rateMessage,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}
