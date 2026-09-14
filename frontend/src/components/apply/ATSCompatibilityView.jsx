import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  ScanSearch, CheckCircle2, AlertTriangle, Sparkles, ArrowRight,
  Copy, Check, Search, Filter, Layers, Briefcase, ChevronLeft, Target
} from 'lucide-react';
import ScoreRing from '../ScoreRing';

// Heuristic keyword category dictionary for ATS keyword classification
const CATEGORY_PATTERNS = [
  {
    category: 'Languages & Frameworks',
    patterns: [
      /^(python|javascript|typescript|java|c\+\+|c#|ruby|go|golang|rust|php|swift|kotlin|scala|r|dart)$/i,
      /^(react|react\.js|vue|vue\.js|angular|next\.js|nuxt|svelte|node|node\.js|express|django|fastapi|flask|spring|spring boot|laravel|rails|asp\.net)$/i,
      /^(html|html5|css|css3|tailwind|bootstrap|sass|less|redux|zustand|graphql|rest|restful)$/i
    ]
  },
  {
    category: 'Cloud & Infrastructure',
    patterns: [
      /^(aws|azure|gcp|google cloud|docker|kubernetes|k8s|terraform|ansible|helm|ci\/cd|jenkins|github actions|gitlab)$/i,
      /^(linux|unix|bash|shell|nginx|apache|serverless|lambda|microservices|cloud formation)$/i
    ]
  },
  {
    category: 'Databases & Storage',
    patterns: [
      /^(sql|postgresql|postgres|mysql|mongodb|redis|elasticsearch|cassandra|dynamodb|sqlite|oracle|mariadb|prisma|hibernate)$/i,
      /^(kafka|rabbitmq|sqs|event-driven|data pipeline|snowflake|bigquery)$/i
    ]
  },
  {
    category: 'Testing & Engineering',
    patterns: [
      /^(jest|cypress|selenium|playwright|mocha|junit|pytest|unit testing|integration testing|tdd|bdd)$/i,
      /^(agile|scrum|kanban|jira|git|github|version control|system design|architecture|clean code)$/i
    ]
  }
];

function categorizeKeyword(keyword) {
  const clean = keyword.trim();
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(clean) || clean.toLowerCase().includes(pattern.source.toLowerCase())) {
        return category;
      }
    }
  }
  return 'Specialized Skills';
}

export default function ATSCompatibilityView({
  atsResult,
  isSubmitting,
  onProceedToDraft,
  onGoToATSMatcher,
  onBackToJobDetails
}) {
  const score = atsResult?.score || 0;
  const isLowScore = atsResult?.is_low_score ?? (score < 80);
  const matchedKeywords = atsResult?.matched_keywords || [];
  const missingKeywords = atsResult?.missing_keywords || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'matched' | 'missing'
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedKeyword, setCopiedKeyword] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Group keywords with category metadata
  const categorizedList = useMemo(() => {
    const list = [];
    matchedKeywords.forEach((kw) => {
      list.push({
        text: kw,
        isMatched: true,
        category: categorizeKeyword(kw)
      });
    });
    missingKeywords.forEach((kw) => {
      list.push({
        text: kw,
        isMatched: false,
        category: categorizeKeyword(kw)
      });
    });
    return list;
  }, [matchedKeywords, missingKeywords]);

  // Extract unique existing categories
  const availableCategories = useMemo(() => {
    const cats = new Set(categorizedList.map((item) => item.category));
    return ['All', ...Array.from(cats)];
  }, [categorizedList]);

  // Filter keywords based on active category, status filter, and search
  const filteredKeywords = useMemo(() => {
    return categorizedList.filter((item) => {
      if (activeCategory !== 'All' && item.category !== activeCategory) return false;
      if (filterType === 'matched' && !item.isMatched) return false;
      if (filterType === 'missing' && item.isMatched) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.text.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [categorizedList, activeCategory, filterType, searchQuery]);

  const totalCount = matchedKeywords.length + missingKeywords.length;
  const matchRate = totalCount > 0 ? Math.round((matchedKeywords.length / totalCount) * 100) : score;

  const handleCopySingle = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedKeyword(text);
    toast.success(`Copied "${text}" to clipboard!`, { id: 'copy-kw' });
    setTimeout(() => setCopiedKeyword(null), 2000);
  };

  const handleCopyAllMissing = () => {
    if (missingKeywords.length === 0) return;
    const text = missingKeywords.join(', ');
    navigator.clipboard?.writeText(text);
    setCopiedAll(true);
    toast.success(`Copied ${missingKeywords.length} missing keywords!`, { id: 'copy-all' });
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToJobDetails}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} /> Back to Job Details
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
          <ScanSearch size={14} /> ATS Compatibility Check
        </div>
      </div>

      {/* ── Score & Match Rate Banner Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="shrink-0">
            <ScoreRing score={score} size={140} label="ATS Match" />
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {score >= 80 ? 'Strong Match Candidate' : score >= 60 ? 'Moderate Match Potential' : 'Needs ATS Optimization'}
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {score >= 80 ? (
                <span>Your resume exhibits high keyword correlation with this job posting. Your chances of passing applicant tracking filters are excellent.</span>
              ) : (
                <span>Your resume matched <strong className="text-indigo-600">{matchedKeywords.length}</strong> keywords, but is missing <strong className="text-rose-600">{missingKeywords.length}</strong> key terms from this job specification.</span>
              )}
            </p>

            {/* Quick action buttons */}
            <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
              {isLowScore ? (
                <>
                  <button
                    type="button"
                    onClick={onGoToATSMatcher}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles size={14} /> Optimize in ATS Matcher
                  </button>
                  <button
                    type="button"
                    onClick={onProceedToDraft}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Continue to Draft <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onProceedToDraft}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-[#2E9BDA] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Briefcase size={15} /> Proceed to Outreach Draft <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Visual Match Breakdown Bar ── */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <Target size={15} className="text-indigo-600" />
              <span className="text-slate-800">Visual Keyword Match Breakdown</span>
            </div>
            <span className="text-slate-500 font-semibold">
              {matchedKeywords.length} of {totalCount} keywords found ({matchRate}%)
            </span>
          </div>

          {/* Dual Segment Progress Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200/80">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalCount > 0 ? (matchedKeywords.length / totalCount) * 100 : 0}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-emerald-500 rounded-full"
              title={`Matched: ${matchedKeywords.length}`}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalCount > 0 ? (missingKeywords.length / totalCount) * 100 : 0}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className="h-full bg-rose-400/90 rounded-full ml-1"
              title={`Missing: ${missingKeywords.length}`}
            />
          </div>

          {/* Breakdown Stats Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="flex items-center gap-2.5 p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Matched</p>
                <p className="text-xs font-bold text-slate-900">{matchedKeywords.length} keywords</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl">
              <AlertTriangle size={16} className="text-rose-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">Missing</p>
                <p className="text-xs font-bold text-slate-900">{missingKeywords.length} keywords</p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
              <Layers size={16} className="text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">Total Analyzed</p>
                <p className="text-xs font-bold text-slate-900">{totalCount} key requirements</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Categorized Keyword Chips Explorer ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        
        {/* Controls: Search, Type Filter, & Copy All */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status filter tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('matched')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'matched'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Matched ({matchedKeywords.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('missing')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'missing'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              Missing ({missingKeywords.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keyword..."
                className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Copy Missing Keywords button */}
            {missingKeywords.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAllMissing}
                title="Copy all missing keywords to clipboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                {copiedAll ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copiedAll ? 'Copied!' : 'Copy Missing'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Slider */}
        {availableCategories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
            <span className="text-slate-400 flex items-center gap-1 text-[11px] font-bold shrink-0 mr-1">
              <Filter size={12} /> Category:
            </span>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Chips Container */}
        <div className="pt-2 min-h-[120px]">
          {filteredKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filteredKeywords.map((item, idx) => {
                const isMatched = item.isMatched;
                return (
                  <motion.button
                    key={`${item.text}-${idx}`}
                    type="button"
                    onClick={() => handleCopySingle(item.text)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    title={`Click to copy "${item.text}" (${isMatched ? 'Matched in resume' : 'Missing from resume'})`}
                    className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                      isMatched
                        ? 'bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 border-emerald-200/90'
                        : 'bg-rose-50/80 hover:bg-rose-100 text-rose-800 border-rose-200'
                    }`}
                  >
                    {isMatched ? (
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={13} className="text-rose-500 shrink-0" />
                    )}

                    <span>{item.text}</span>

                    <span className="text-[10px] font-medium opacity-60 group-hover:opacity-100 transition-opacity ml-0.5">
                      {copiedKeyword === item.text ? (
                        <Check size={11} className="text-emerald-600" />
                      ) : (
                        <Copy size={11} className="text-slate-400 group-hover:text-slate-600" />
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs font-medium">
              No keywords match the current filter or search criteria.
            </div>
          )}
        </div>

        {/* Hint footer */}
        <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100 flex items-center gap-1">
          <Sparkles size={12} className="text-indigo-500" /> Tip: Click on any keyword chip to copy it to your clipboard for easy updating in your resume.
        </p>
      </div>

    </div>
  );
}
