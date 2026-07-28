import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout, CircleDot, TrendingUp, Star, Flame, Zap, Gem, Trophy, Crown,
  Lock, Gift, Award, X, Check
} from 'lucide-react';

// Assuming deriveCurrentLevelIndex is imported from your config
import { deriveCurrentLevelIndex } from './mockConfig';

// ─── Premium Rank Configuration ──────────────────────────────────────────────
const RANK_STYLES = [
  { icon: Sprout, gradient: 'from-emerald-400 to-green-500', shadow: 'shadow-emerald-300/50', border: 'border-emerald-200', text: 'text-emerald-600', glow: 'bg-emerald-100', label: '🌱' },
  { icon: CircleDot, gradient: 'from-cyan-400 to-blue-500', shadow: 'shadow-blue-300/50', border: 'border-blue-200', text: 'text-blue-600', glow: 'bg-blue-100', label: '🔵' },
  { icon: TrendingUp, gradient: 'from-teal-400 to-teal-500', shadow: 'shadow-teal-300/50', border: 'border-teal-200', text: 'text-teal-600', glow: 'bg-teal-100', label: '🟢' },
  { icon: Star, gradient: 'from-amber-300 to-orange-500', shadow: 'shadow-orange-300/50', border: 'border-orange-200', text: 'text-orange-600', glow: 'bg-orange-100', label: '🥉' },
  { icon: Zap, gradient: 'from-slate-300 to-slate-500', shadow: 'shadow-slate-400/50', border: 'border-slate-300', text: 'text-slate-700', glow: 'bg-slate-200', label: '🥈' },
  { icon: Flame, gradient: 'from-yellow-300 to-amber-500', shadow: 'shadow-yellow-400/50', border: 'border-yellow-200', text: 'text-yellow-700', glow: 'bg-yellow-100', label: '⭐' },
  { icon: Gem, gradient: 'from-fuchsia-400 to-purple-600', shadow: 'shadow-purple-400/50', border: 'border-purple-300', text: 'text-purple-600', glow: 'bg-purple-100', label: '💎' },
  { icon: Trophy, gradient: 'from-rose-400 to-pink-600', shadow: 'shadow-pink-400/50', border: 'border-pink-200', text: 'text-pink-600', glow: 'bg-pink-100', label: '🏆' },
  { icon: Crown, gradient: 'from-amber-400 via-orange-500 to-red-600', shadow: 'shadow-red-400/50', border: 'border-red-300', text: 'text-red-600', glow: 'bg-red-100', label: '👑' },
];

const REWARD_POSITIONS = {
  'Advanced': { icon: Award, label: 'Challenge', color: 'text-orange-600', bg: 'bg-gradient-to-r from-orange-100 to-amber-100' },
  'Expert': { icon: Gift, label: 'Reward', color: 'text-purple-600', bg: 'bg-gradient-to-r from-purple-100 to-fuchsia-100' },
};

const COL_WIDTH = 140; // Increased spacing for bigger badges
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
    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 overflow-hidden relative">
      
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h3 className="font-extrabold text-2xl text-slate-800 tracking-tight flex items-center gap-2">
            Career Path
          </h3>
          <p className="text-sm text-slate-500 mt-1 font-medium">Earn XP to unlock your next milestone</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm" /> Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm ring-2 ring-purple-200" /> Current</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 shadow-sm" /> Locked</span>
        </div>
      </div>

      {/* Scrollable Timeline */}
      <div ref={scrollerRef} className="relative overflow-x-auto scrollbar-hide -mx-2 px-2 pb-8 pt-4">
        <motion.div
          className="relative flex items-start pt-16"
          style={{ minWidth: rankData.length * COL_WIDTH, height: 200 }}
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {/* Thick Background Track */}
          <div className="absolute left-8 right-8 top-[85px] h-3.5 -translate-y-1/2 rounded-full bg-slate-100 shadow-inner" />

          {/* Glowing Animated Progress Fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            className="absolute left-8 top-[85px] h-3.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            style={{ maxWidth: `calc(100% - 64px)` }}
          >
            {/* Shimmer effect inside the line */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </motion.div>

          {/* Nodes */}
          {rankData.map((rank, i) => {
            const RankIcon = rank.rankStyle.icon;
            const isHovered = hoveredIdx === i;
            // Make current node 25% larger
            const nodeSize = rank.isCurrent ? BASE_NODE_SIZE * 1.25 : BASE_NODE_SIZE;

            return (
              <motion.div
                key={rank.name}
                ref={rank.isCurrent ? currentRef : null}
                className="flex flex-col items-center shrink-0 absolute"
                style={{ left: i * COL_WIDTH, width: COL_WIDTH }}
                variants={{
                  hidden: { opacity: 0, y: 30, scale: 0.8 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', bounce: 0.5 } }
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Floating Reward Badge */}
                {rank.reward && (
                  <motion.div
                    className={`absolute -top-6 z-10 ${rank.reward.bg} ${rank.reward.color} rounded-xl px-3 py-1 text-[11px] font-bold flex items-center gap-1.5 shadow-md border border-white/50 backdrop-blur-sm`}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 + 0.5 }}
                    whileHover={{ y: -3, scale: 1.05 }}
                  >
                    <rank.reward.icon className="w-3.5 h-3.5" /> {rank.reward.label}
                  </motion.div>
                )}

                {/* Main 3D Medal Node */}
                <motion.button
                  type="button"
                  disabled={rank.isLocked}
                  onClick={() => !rank.isLocked && setSelectedNode(rank)}
                  className={`relative flex items-center justify-center rounded-full focus:outline-none z-20 ${rank.isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ width: nodeSize, height: nodeSize, top: rank.isCurrent ? -6 : 0 }}
                  whileHover={!rank.isLocked ? { scale: 1.1 } : {}}
                  whileTap={!rank.isLocked ? { scale: 0.9 } : {}}
                  // Floating animation for current rank
                  animate={rank.isCurrent ? { y: [0, -8, 0] } : {}}
                  transition={rank.isCurrent ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : {}}
                >
                  {/* The 3D Coin/Medal Effect */}
                  <div className={`absolute inset-0 rounded-full transition-all duration-300 border-4 border-white ${
                    rank.isLocked
                      ? 'bg-slate-100 shadow-inner'
                      : `bg-gradient-to-br ${rank.rankStyle.gradient} shadow-lg ${rank.rankStyle.shadow} shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]`
                  }`} />

                  {/* Icon */}
                  <div className="relative z-10">
                    {rank.isLocked ? (
                      <Lock className="w-6 h-6 text-slate-300" />
                    ) : (
                      <RankIcon className={`w-7 h-7 text-white drop-shadow-md ${rank.isCurrent ? 'w-8 h-8' : ''}`} />
                    )}
                  </div>

                  {/* Embedded Checkmark for Completed (No more floating on the line) */}
                  {rank.isCompleted && !rank.isCurrent && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md z-30">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </div>
                  )}

                  {/* Pulsing ring for current node */}
                  {rank.isCurrent && (
                    <span className={`absolute -inset-2 rounded-full border-2 ${rank.rankStyle.border} animate-ping opacity-75`} />
                  )}
                </motion.button>

                {/* Rank Text - Pushed down slightly if it's the current active node because the node is bigger */}
                <div className={`flex flex-col items-center transition-all ${rank.isCurrent ? 'mt-4' : 'mt-3'}`}>
                  <p className={`text-[13px] font-extrabold tracking-wide ${
                    rank.isLocked ? 'text-slate-300' : rank.isCurrent ? rank.rankStyle.text : 'text-slate-700'
                  }`}>
                    {rank.name}
                  </p>
                  <span className={`text-[10px] font-bold mt-0.5 px-2 py-0.5 rounded-full ${
                    rank.isLocked ? 'text-slate-300 bg-slate-50' : 'text-slate-500 bg-slate-100'
                  }`}>
                    {rank.threshold.toLocaleString()} XP
                  </span>
                </div>

                {/* You are here marker */}
                {rank.isCurrent && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -bottom-10">
                     <span className={`text-[11px] font-black uppercase tracking-wider ${rank.rankStyle.text} bg-white px-3 py-1 rounded-full shadow-sm border ${rank.rankStyle.border}`}>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', bounce: 0.4 }} onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-w-sm w-full relative overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors z-10">
          <X className="w-4 h-4" />
        </button>

        {/* Big 3D Badge in Modal */}
        <div className="flex justify-center mb-6 mt-2">
          <div className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br ${rank.rankStyle.gradient} flex items-center justify-center shadow-xl shadow-[inset_0_-6px_10px_rgba(0,0,0,0.2)] ${rank.rankStyle.shadow} transform rotate-3`}>
            <RankIcon className="w-12 h-12 text-white drop-shadow-md" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="font-extrabold text-2xl text-slate-800">{rank.name}</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {rank.isCurrent ? 'Your Current Rank' : rank.isCompleted ? 'Rank Achieved' : 'Locked Rank'}
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
           <div className="flex justify-between text-sm font-bold text-slate-600 mb-2">
             <span>Progress</span>
             <span>{Math.min(totalPoints, rank.threshold).toLocaleString()} / {rank.threshold.toLocaleString()} XP</span>
           </div>
           <div className="h-3 rounded-full bg-slate-200 overflow-hidden shadow-inner">
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