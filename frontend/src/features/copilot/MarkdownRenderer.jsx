import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ node, inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeText = String(children).replace(/\n$/, '');

  // Render single-line commands or short snippets as a subtle, minimal inline badge
  const isShortCommand = !codeText.includes('\n') && (codeText.length < 60 || codeText.startsWith('/'));

  if (inline || isShortCommand) {
    return (
      <code className="inline-flex items-center px-1.5 py-0.5 my-0.5 rounded bg-slate-200/80 text-blue-700 font-mono text-[11.5px] font-semibold border border-slate-300/70">
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden text-slate-100 shadow-xs">
      <div className="flex items-center justify-between px-2.5 py-1 bg-slate-800/80 border-b border-slate-700 text-[10.5px] font-mono text-slate-300">
        <span>{match ? match[1] : 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-2.5 text-xs font-mono overflow-x-auto leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-800 space-y-1.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          h1: ({ children }) => <h1 className="text-sm font-extrabold text-slate-900 mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xs font-bold text-slate-900 mt-1.5 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-bold text-slate-800 mt-1 mb-0.5">{children}</h3>,
          h4: ({ children }) => <h4 className="text-[12px] font-semibold text-slate-700 mt-1 mb-0.5">{children}</h4>,
          p: ({ children }) => <p className="mb-1 leading-relaxed text-slate-800">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-3.5 space-y-0.5 mb-1.5 text-slate-700">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-3.5 space-y-0.5 mb-1.5 text-slate-700">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-500 pl-2.5 italic my-1.5 text-slate-600 bg-blue-50/60 py-0.5 rounded-r">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto w-full my-2 rounded-lg border border-slate-200 shadow-2xs scrollbar-thin">
              <table className="w-full text-xs text-left border-collapse table-auto">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 text-slate-700 font-semibold">{children}</thead>,
          th: ({ children }) => (
            <th className="p-1.5 px-2.5 border-b border-slate-200 font-semibold text-slate-800 break-words whitespace-normal">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-1.5 px-2.5 border-b border-slate-100 text-slate-700 break-words whitespace-normal">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
