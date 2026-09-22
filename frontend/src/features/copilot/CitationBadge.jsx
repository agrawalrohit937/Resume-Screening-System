import React from 'react';
import { BookOpen, FileText, Briefcase, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CitationBadge({ citation }) {
  const navigate = useNavigate();
  if (!citation) return null;

  const source = citation.source || citation.source_type || 'doc';
  const label = citation.label || citation.title || 'Source';
  const href = citation.href;
  const score = citation.score ? Math.round(citation.score * 100) : null;

  const getIcon = () => {
    if (source.includes('resume')) return <FileText size={11} className="text-blue-600" />;
    if (source.includes('job')) return <Briefcase size={11} className="text-emerald-600" />;
    return <BookOpen size={11} className="text-purple-600" />;
  };

  const handleClick = (e) => {
    if (href) {
      e.preventDefault();
      if (href.startsWith('/')) {
        navigate(href);
      } else {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      title={citation.snippet || `Cited from ${label}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-[11px] text-slate-700 transition-all cursor-pointer shadow-2xs my-0.5 mr-1 group"
    >
      {getIcon()}
      <span className="font-medium text-slate-800 truncate max-w-[160px]">{label}</span>
      {score !== null && (
        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
          {score}%
        </span>
      )}
      {href && <ExternalLink size={9} className="text-slate-400 group-hover:text-slate-600" />}
    </button>
  );
}
