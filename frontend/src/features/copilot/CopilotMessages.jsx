import React, { useRef, useEffect, useState } from 'react';
import { useCopilot } from './CopilotProvider';
import MarkdownRenderer from './MarkdownRenderer';
import CitationBadge from './CitationBadge';
import CardRenderer from './cards/CardRenderer';
import { Sparkles, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

export default function CopilotMessages() {
  const { messages, isGenerating, currentStatus, suggestions, sendMessage, rateMessage } = useCopilot();
  const scrollRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Smart auto-scroll: detect if user scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setShouldAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStatus, shouldAutoScroll]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/60 text-slate-800"
    >
      {messages.map((msg, idx) => {
        const isUser = msg.role === 'user';

        return (
          <div
            key={msg.id || idx}
            className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 mt-1">
                <Sparkles size={11} />
              </div>
            )}

            <div className={`max-w-[88%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
              <div
                className={`p-3 rounded-2xl text-sm leading-relaxed max-w-full overflow-hidden break-words ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                    : 'bg-gray-100/90 text-slate-800 rounded-tl-xs border border-gray-200/60 shadow-xs'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <>
                    {msg.content ? (
                      <div className="relative inline">
                        <MarkdownRenderer content={msg.content} />
                        {isGenerating && idx === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-3.5 bg-blue-500 animate-pulse ml-1 align-middle rounded-xs" />
                        )}
                      </div>
                    ) : isGenerating && idx === messages.length - 1 ? (
                      <div className="flex items-center gap-1.5 py-1 px-0.5 text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : null}

                    {/* Citations List */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-gray-200 flex flex-wrap items-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5">
                          Sources:
                        </span>
                        {msg.citations.map((c, ci) => (
                          <CitationBadge key={ci} citation={c} />
                        ))}
                      </div>
                    )}

                    {/* Generative UI Cards */}
                    {msg.ui_cards && msg.ui_cards.length > 0 && (
                      <div className="mt-2">
                        {msg.ui_cards.map((cardItem, cardIdx) => (
                          <CardRenderer key={cardIdx} cardType={cardItem.card} data={cardItem.data} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Feedback Bar for Assistant Messages */}
              {!isUser && msg.id !== 'greeting' && (
                <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-slate-400">
                  <button
                    onClick={() => rateMessage(msg.id, 1)}
                    className={`p-0.5 rounded hover:text-emerald-600 transition-colors cursor-pointer ${
                      msg.user_rating === 1 ? 'text-emerald-600' : ''
                    }`}
                    title="Helpful"
                  >
                    <ThumbsUp size={11} />
                  </button>
                  <button
                    onClick={() => rateMessage(msg.id, -1)}
                    className={`p-0.5 rounded hover:text-rose-500 transition-colors cursor-pointer ${
                      msg.user_rating === -1 ? 'text-rose-500' : ''
                    }`}
                    title="Not helpful"
                  >
                    <ThumbsDown size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Live Status Indicator */}
      {isGenerating && currentStatus && (
        <div className="flex items-center gap-1.5 p-1.5 px-3 rounded-full bg-white border border-slate-200 text-slate-500 text-xs w-fit shadow-xs animate-pulse">
          <Loader2 size={11} className="animate-spin text-blue-600" />
          <span className="font-medium text-[11px]">{currentStatus}</span>
        </div>
      )}

      {/* Quick Suggestion Chips */}
      {!isGenerating && suggestions && suggestions.length > 0 && (
        <div className="pt-1">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(s)}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 text-[11.5px] font-medium transition-all cursor-pointer shadow-xs"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
