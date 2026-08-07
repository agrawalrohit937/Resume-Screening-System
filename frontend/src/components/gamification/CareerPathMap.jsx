import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout, CircleDot, TrendingUp, Star, Flame, Zap, Gem, Trophy, Crown,
  Lock, Gift, Award, X, Check
} from 'lucide-react';

// Assuming deriveCurrentLevelIndex is imported from your config
import { deriveCurrentLevelIndex } from './mockConfig';

// ─── Professional Rank Configuration ─────────────────────────────────────────
const RANK_STYLES = [
  { icon: Sprout, gradient: 'from-slate-500 to-slate-600', shadow: 'shadow-sm', border: 'border-slate-300', text: 'text-slate-700', glow: 'bg-slate-100', label: '🌱' },
  { icon: CircleDot, gradient: 'from-slate-600 to-slate-700', shadow: 'shadow-sm', border: 'border-slate-400', text: 'text-slate-800', glow: 'bg-slate-100', label: '🔵' },
  { icon: TrendingUp, gradient: 'from-[#2E9BDA] to-[#1d6fa5]', shadow: 'shadow-sm', border: 'border-[#2E9BDA]/40', text: 'text-[#1d6fa5]', glow: 'bg-blue-50', label: '🟢' },
  { icon: Star, gradient: 'from-blue-600 to-indigo-600', shadow: 'shadow-sm', border: 'border-indigo-300', text: 'text-indigo-700', glow: 'bg-indigo-50', label: '🥉' },
  { icon: Zap, gradient: 'from-indigo-600 to-indigo-800', shadow: 'shadow-sm', border: 'border-indigo-400', text: 'text-indigo-800', glow: 'bg-indigo-50', label: '🥈' },
  { icon: Flame, gradient: 'from-slate-700 to-slate-900', shadow: 'shadow-sm', border: 'border-slate-600', text: 'text-slate-900', glow: 'bg-slate-100', label: '⭐' },
  { icon: Gem, gradient: 'from-amber-500 to-amber-600', shadow: 'shadow-sm', border: 'border-amber-400', text: 'text-amber-700', glow: 'bg-amber-50', label: '💎' },
  { icon: Trophy, gradient: 'from-amber-600 to-amber-700', shadow: 'shadow-sm', border: 'border-amber-500', text: 'text-amber-800', glow: 'bg-amber-50', label: '🏆' },
  { icon: Crown, gradient: 'from-slate-900 via-indigo-950 to-[#0f172a]', shadow: 'shadow-md', border: 'border-slate-700', text: 'text-slate-900', glow: 'bg-slate-100', label: '👑' },
];

const REWARD_POSITIONS = {
  'Advanced': { icon: Award, label: 'Challenge', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  'Expert': { icon: Gift, label: 'Reward', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
};

const COL_WIDTH = 140;
const BASE_NODE_SIZE = 56;

export default function CareerPathMap({ profile, levels }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const scrollerRef = useRef(null);
  const currentRef = useRef(null);

  const totalPoints = profile?.total_points || 0;
  const currentIdx = deriveCurrentLevelIndex(levels, totalPoints);

  const rankData = useMemo(() => {
    return levels.map((level, i) => {
      const rankStyle = RANK_STYLES[i] || RANK_STYLES[RANK_STYLES.length - 1];
      const isCompleted = i < currentIdx;
      const isCurrent = i === currentIdx;
      const isLocked = i > currentIdx;
      const rewardKey = Object.keys(REWARD_POSITIONS).find(k => k.toLowerCase() === (level.name || '').toLowerCase());

      return {
        index: i, level: level.level, name: level.name || `Level ${i + 1}`,
        threshold: level.threshold, rankStyle, isCompleted, isCurrent, isLocked,
        reward: rewardKey ? REWARD_POSITIONS[rewardKey] : null,
      };
    });
  }, [levels, currentIdx]);

  const fillPct = rankData.length > 1 ? (Math.max(currentIdx, 0) / (rankData.length - 1)) * 100 : 0;

  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [rankData.length, currentIdx]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-8 overflow-hidden relative">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
        <div>
          <h3 className="font-extrabold text-[20px] sm:text-[22px] text-slate-900 tracking-tight flex items-center gap-2">
            Career Path
          </h3>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 sm:mt-1 font-medium">Earn XP to unlock your next milestone</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-[10px] sm:text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl sm:rounded-full border border-slate-200/70 uppercase tracking-wider">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0" /> Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#2E9BDA] shadow-sm ring-2 ring-[#2E9BDA]/20 shrink-0" /> Current</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-slate-300 shadow-sm shrink-0" /> Locked</span>
        </div>
      </div>

      {/* Scrollable Timeline */}
      <div ref={scrollerRef} className="relative overflow-x-auto scrollbar-hide -mx-2 px-2 pb-10 pt-4">
        <motion.div
          className="relative flex items-start pt-16"
          style={{ minWidth: rankData.length * COL_WIDTH, height: 230 }}
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {/* Thick Background Track */}
          <div className="absolute left-8 right-8 top-[85px] h-2.5 -translate-y-1/2 rounded-full bg-slate-100 shadow-inner" />

          {/* Solid Professional Blue Progress Fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            className="absolute left-8 top-[85px] h-2.5 -translate-y-1/2 rounded-full bg-[#2E9BDA]"
            style={{ maxWidth: `calc(100% - 64px)` }}
          />


          {/* Nodes */}
          {rankData.map((rank, i) => {
            const RankIcon = rank.rankStyle.icon;
            const isHovered = hoveredIdx === i;
            const nodeSize = rank.isCurrent ? BASE_NODE_SIZE * 1.25 : BASE_NODE_SIZE;

            return (
              <motion.div
                key={rank.name}
                ref={rank.isCurrent ? currentRef : null}
                className="flex flex-col items-center shrink-0 absolute"
                style={{ left: i * COL_WIDTH, width: COL_WIDTH }}
                variants={{
                  hidden: { opacity: 0, y: 20, scale: 0.8 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', bounce: 0.4 } }
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Floating Reward Badge (Subtle and Clean) */}
                {rank.reward && (
                  <motion.div
                    className={`absolute -top-7 z-10 ${rank.reward.bg} ${rank.reward.color} rounded-xl px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm border`}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 + 0.5 }}
                    whileHover={{ y: -2, scale: 1.02 }}
                  >
                    <rank.reward.icon className="w-3.5 h-3.5" /> {rank.reward.label}
                  </motion.div>
                )}

                {/* Main Node */}
                <motion.button
                  type="button"
                  disabled={rank.isLocked}
                  onClick={() => !rank.isLocked && setSelectedNode(rank)}
                  className={`relative flex items-center justify-center rounded-full focus:outline-none z-20 ${rank.isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ width: nodeSize, height: nodeSize, top: rank.isCurrent ? -6 : 0 }}
                  whileHover={!rank.isLocked ? { scale: 1.05 } : {}}
                  whileTap={!rank.isLocked ? { scale: 0.95 } : {}}
                  animate={rank.isCurrent ? { y: [0, -6, 0] } : {}}
                  transition={rank.isCurrent ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" } : {}}
                >
                  {/* Clean Gradient styling without harsh shadows */}
                  <div className={`absolute inset-0 rounded-full transition-all duration-300 border-[3px] border-white ${rank.isLocked
                      ? 'bg-slate-100 shadow-sm'
                      : `bg-gradient-to-br ${rank.rankStyle.gradient} shadow-md`
                    }`} />

                  {/* Icon */}
                  <div className="relative z-10">
                    {rank.isLocked ? (
                      <Lock className="w-5 h-5 text-slate-300" />
                    ) : (
                      <RankIcon className={`w-6 h-6 text-white ${rank.isCurrent ? 'w-7 h-7' : ''}`} />
                    )}
                  </div>

                  {/* Checkmark for Completed */}
                  {rank.isCompleted && !rank.isCurrent && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-sm z-30">
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                    </div>
                  )}

                  {/* Soft Pulsing ring for current node */}
                  {rank.isCurrent && (
                    <span className={`absolute -inset-2 rounded-full border-2 ${rank.rankStyle.border} animate-ping opacity-60`} />
                  )}
                </motion.button>

                {/* Rank Text */}
                <div className={`flex flex-col items-center transition-all ${rank.isCurrent ? 'mt-4' : 'mt-3'}`}>
                  <p className={`text-[13px] font-bold ${rank.isLocked ? 'text-slate-400' : rank.isCurrent ? rank.rankStyle.text : 'text-blue-950'
                    }`}>
                    {rank.name}
                  </p>
                  <span className={`text-[10.5px] font-bold mt-1 px-2 py-0.5 rounded-md ${rank.isLocked ? 'text-slate-400 bg-slate-50' : 'text-blue-900/60 bg-blue-50/50'
                    }`}>
                    {rank.threshold.toLocaleString()} XP
                  </span>
                </div>

                {/* You are here marker */}
                {rank.isCurrent && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -bottom-9">
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${rank.rankStyle.text} bg-white px-3 py-1 rounded-full shadow-sm border ${rank.rankStyle.border}`}>
                      You are here
                    </span>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedNode && (
          <RankDetail rank={selectedNode} onClose={() => setSelectedNode(null)} totalPoints={totalPoints} />
        )}
      </AnimatePresence>
    </div>
  );
}

function RankDetail({ rank, onClose, totalPoints }) {
  const RankIcon = rank.rankStyle.icon;
  const pointsProgress = rank.isCompleted ? 100 : Math.min(100, Math.round((totalPoints / rank.threshold) * 100));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/40 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', bounce: 0.3 }} onClick={e => e.stopPropagation()}
        className="bg-white rounded-[24px] shadow-2xl border border-blue-100 p-6 max-w-sm w-full relative overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors z-10">
          <X className="w-4 h-4" />
        </button>

        {/* Big Badge in Modal */}
        <div className="flex justify-center mb-6 mt-4">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${rank.rankStyle.gradient} flex items-center justify-center shadow-lg ${rank.rankStyle.shadow}`}>
            <RankIcon className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="font-extrabold text-[22px] text-blue-950">{rank.name}</h3>
          <p className="text-[13px] font-semibold text-blue-900/50 mt-1">
            {rank.isCurrent ? 'Your Current Rank' : rank.isCompleted ? 'Rank Achieved' : 'Locked Rank'}
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <div className="flex justify-between text-[12px] font-bold text-blue-900/60 mb-2.5">
            <span>Progress</span>
            <span className="text-blue-950">{Math.min(totalPoints, rank.threshold).toLocaleString()} / {rank.threshold.toLocaleString()} XP</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pointsProgress}%` }} transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${rank.rankStyle.gradient}`}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}