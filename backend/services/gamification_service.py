"""
Gamification Service — Points, badges, streaks, leaderboard, daily rewards, missions, weekly challenges, reward chests
"""

import time
import calendar
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional, Dict, Any

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = structlog.get_logger(__name__)

# ─── Simple in-memory cache with TTL ─────────────────────────────────────────
_leaderboard_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_LEADERBOARD_CACHE_TTL = 30  # seconds

# ─── Badge Definitions ────────────────────────────────────────────────────────
BADGES = {
    "first_interview":   {"name": "First Steps", "description": "Completed your first AI interview", "icon": "🎯", "points": 50, "tier": "bronze"},
    "ai_ready":          {"name": "AI Ready", "description": "Scored 80%+ on a technical interview", "icon": "🤖", "points": 100, "tier": "silver"},
    "top_performer":     {"name": "Top Performer", "description": "Scored 90%+ on any interview", "icon": "⭐", "points": 150, "tier": "gold"},
    "consistent_learner":{"name": "Consistent Learner", "description": "Completed 5 interviews", "icon": "📚", "points": 75, "tier": "silver"},
    "streak_3":          {"name": "On Fire", "description": "3-day practice streak", "icon": "🔥", "points": 60, "tier": "bronze"},
    "streak_7":          {"name": "Week Warrior", "description": "7-day practice streak", "icon": "⚡", "points": 120, "tier": "silver"},
    "streak_30":         {"name": "Unstoppable", "description": "30-day practice streak", "icon": "🏆", "points": 300, "tier": "platinum"},
    "perfect_score":     {"name": "Perfection", "description": "Scored 10/10 on a question", "icon": "💎", "points": 200, "tier": "gold"},
    "speed_demon":       {"name": "Speed Demon", "description": "Answered within 30 seconds with 8+ score", "icon": "⚡", "points": 80, "tier": "silver"},
    "interview_master":  {"name": "Interview Master", "description": "Completed 20 interviews", "icon": "👑", "points": 500, "tier": "legendary"},
    "integrity_pro":     {"name": "Integrity Pro", "description": "Passed 5 sessions with 0 cheating flags", "icon": "🛡️", "points": 100, "tier": "gold"},
}

POINT_RULES = {
    "question_answered":    2,    # Any answer submitted
    "score_5_plus":        5,     # Score >= 5
    "score_7_plus":        10,    # Score >= 7
    "score_9_plus":        20,    # Score >= 9
    "perfect_answer":      30,    # Score = 10
    "interview_completed": 50,    # Full interview done
    "daily_practice":      25,    # First interview of day
    "streak_bonus_daily":  10,    # Streak multiplier per day
}

LEVEL_THRESHOLDS = [
    (0,    "Beginner",     "🌱"),
    (100,  "Junior",       "🔵"),
    (300,  "Developing",   "🟢"),
    (600,  "Competent",    "🟡"),
    (1000, "Proficient",   "🟠"),
    (1500, "Advanced",     "🔴"),
    (2500, "Expert",       "💜"),
    (4000, "Master",       "🏆"),
    (6000, "Legend",       "👑"),
]

# ─── Weekly Challenge Configuration ──────────────────────────────────────────
WEEKLY_CHALLENGES = [
    {
        "id": "crack-ai-interview",
        "title": "Crack the AI Interview",
        "difficulty": "Hard",
        "objective": "Score 75%+ in a full AI interview",
        "target_score_pct": 75,
        "reward_xp": 500,
        "badge_reward": "ai_ready",
    },
    {
        "id": "streak-king",
        "title": "Streak King",
        "difficulty": "Medium",
        "objective": "Maintain a 5-day streak this week",
        "target_streak": 5,
        "reward_xp": 300,
        "badge_reward": "streak_7",
    },
    {
        "id": "speed-round",
        "title": "Speed Round",
        "difficulty": "Medium",
        "objective": "Answer 10 questions with 8+ score",
        "target_answers_high_score": 10,
        "reward_xp": 350,
        "badge_reward": "speed_demon",
    },
    {
        "id": "perfectionist",
        "title": "Perfectionist",
        "difficulty": "Expert",
        "objective": "Score 90%+ on any interview",
        "target_score_pct": 90,
        "reward_xp": 600,
        "badge_reward": "top_performer",
    },
    {
        "id": "iron-will",
        "title": "Iron Will",
        "difficulty": "Easy",
        "objective": "Complete 3 interviews this week",
        "target_interviews": 3,
        "reward_xp": 200,
        "badge_reward": "consistent_learner",
    },
]

# ─── Reward Chest Tiers ──────────────────────────────────────────────────────
REWARD_CHEST_TIERS = [
    {"id": "common_chest",  "name": "Common Chest",    "tier": "common",    "xp_required": 200,   "reward_xp": 30,   "reward_coins": 10,  "icon": "📦"},
    {"id": "rare_chest",    "name": "Rare Chest",       "tier": "rare",      "xp_required": 800,   "reward_xp": 80,   "reward_coins": 30,  "icon": "🎁"},
    {"id": "epic_chest",    "name": "Epic Chest",       "tier": "epic",      "xp_required": 2000,  "reward_xp": 150,  "reward_coins": 60,  "icon": "💎"},
    {"id": "legendary_chest", "name": "Legendary Chest", "tier": "legendary", "xp_required": 5000, "reward_xp": 300,  "reward_coins": 150, "icon": "👑"},
]

# ─── Daily Reward Config ─────────────────────────────────────────────────────
DAILY_REWARD_DAYS = 7
DAILY_REWARD_DEFINITIONS = [
    {"day": 1, "type": "xp", "amount": 20},
    {"day": 2, "type": "xp", "amount": 25},
    {"day": 3, "type": "bonus", "label": "Bonus", "amount": 0},
    {"day": 4, "type": "xp", "amount": 30},
    {"day": 5, "type": "xp", "amount": 35},
    {"day": 6, "type": "bonus", "label": "Bonus", "amount": 0},
    {"day": 7, "type": "bonus", "label": "Big Bonus", "amount": 0},
]

# ─── Daily Missions Configuration ────────────────────────────────────────────
DAILY_MISSIONS = [
    {"id": "interview-warrior",    "title": "Complete 1 mock interview",     "icon": "Target",     "target": 1,  "xp": 50},
    {"id": "ats-hunter",           "title": "Reach a 75+ ATS score",         "icon": "TrendingUp", "target": 75, "xp": 40},
    {"id": "brain-trainer",        "title": "Answer 5 interview questions",  "icon": "BookOpen",   "target": 5,  "xp": 30},
]


class GamificationService:

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.user_gamification
        self.events_col = db.gamification_events

    # ─── Dynamic Streak Calculation ──────────────────────────────────────────
    def _calculate_streak(self, active_dates: List[str], today: Optional[date] = None) -> Dict[str, int]:
        if not today:
            today = datetime.now(timezone.utc).date()
        if not active_dates:
            return {"current_streak": 0, "longest_streak": 0}

        # Parse and sort unique valid dates
        parsed_dates = []
        for d_str in active_dates:
            try:
                if d_str and isinstance(d_str, str):
                    parsed_dates.append(date.fromisoformat(d_str[:10]))
            except Exception:
                pass
        parsed_dates = sorted(set(parsed_dates))

        if not parsed_dates:
            return {"current_streak": 0, "longest_streak": 0}

        date_set = set(parsed_dates)

        # Current streak: check if today or yesterday is in date_set
        yesterday = today - timedelta(days=1)
        current_streak = 0

        if today in date_set:
            check_date = today
        elif yesterday in date_set:
            check_date = yesterday
        else:
            check_date = None

        if check_date:
            while check_date in date_set:
                current_streak += 1
                check_date -= timedelta(days=1)

        # Longest streak calculation across all time
        longest_streak = 0
        temp_streak = 0
        prev_d = None
        for d in parsed_dates:
            if prev_d is None or d == prev_d + timedelta(days=1):
                temp_streak += 1
            else:
                temp_streak = 1
            if temp_streak > longest_streak:
                longest_streak = temp_streak
            prev_d = d

        return {
            "current_streak": current_streak,
            "longest_streak": max(longest_streak, current_streak)
        }

    # ─── Get or Create Profile ────────────────────────────────────────────────
    async def get_profile(self, user_id: str) -> Dict:
        doc = await self.collection.find_one({"user_id": user_id})
        if not doc:
            doc = await self._create_profile(user_id)
        doc["_id"] = str(doc["_id"])

        now = datetime.now(timezone.utc)
        today = now.date()
        active_dates = doc.get("active_dates") or []
        last_str = doc.get("last_practice_date")
        old_streak = doc.get("current_streak", 0)

        # Backfill active_dates for legacy profiles if active_dates is empty but last_practice_date exists
        if not active_dates and last_str:
            try:
                active_dates = [last_str[:10]]
                doc["active_dates"] = active_dates
                await self.collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"active_dates": active_dates}}
                )
            except Exception:
                pass

        # Compute accurate dynamic streak strictly derived from active_dates
        streak_info = self._calculate_streak(active_dates, today)
        doc["current_streak"] = streak_info["current_streak"]
        doc["longest_streak"] = max(doc.get("longest_streak", 0), streak_info["longest_streak"])

        # Auto-heal database to ensure current_streak and longest_streak are always in sync
        await self.collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "current_streak": doc["current_streak"],
                "longest_streak": doc["longest_streak"]
            }}
        )

        doc["level_info"] = self._compute_level(doc.get("total_points", 0))

        # Calculate exact global leaderboard rank dynamically
        total_pts = doc.get("total_points", 0)
        higher_count = await self.collection.count_documents({"total_points": {"$gt": total_pts}})
        doc["rank"] = higher_count + 1

        return doc

    async def _create_profile(self, user_id: str) -> Dict:
        profile = {
            "user_id": user_id,
            "total_points": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "last_practice_date": None,
            "active_dates": [],
            "total_interviews": 0,
            "total_questions_answered": 0,
            "average_score": 0.0,
            "badges": [],
            "recent_points": [],
            "clean_sessions": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            # Daily reward tracking
            "daily_reward_day": 0,
            "daily_reward_streak": 0,
            "last_reward_claim_date": None,
            # Daily missions
            "daily_interviews_today": 0,
            "daily_questions_today": 0,
            "last_daily_reset": None,
            # Weekly challenge
            "weekly_challenge_progress": 0.0,
            "weekly_challenge_claimed": False,
            "weekly_challenge_week_id": None,
            # Reward chests
            "claimed_chests": [],
        }
        result = await self.collection.insert_one(profile)
        profile["_id"] = result.inserted_id
        return profile

    # ─── Award Points ─────────────────────────────────────────────────────────
    async def award_points(
        self,
        user_id: str,
        event_type: str,
        points: int,
        details: Optional[Dict] = None,
    ) -> Dict:
        global _leaderboard_cache
        now = datetime.now(timezone.utc)
        await self.events_col.insert_one({
            "user_id": user_id, "event_type": event_type,
            "points": points, "details": details or {}, "created_at": now,
        })
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"total_points": points},
                "$push": {"recent_points": {"$each": [{"points": points, "event": event_type, "ts": now.isoformat()}], "$slice": -20}},
                "$set": {"updated_at": now},
            },
            upsert=True,
        )
        _leaderboard_cache["data"] = None
        return {"awarded": points, "event_type": event_type}

    # ─── Process Interview Result ─────────────────────────────────────────────
    async def process_interview_result(
        self,
        user_id: str,
        interview_score: float,
        questions_answered: int,
        clean_session: bool = True,
        answer_details: Optional[List[Dict]] = None,
    ) -> Dict:
        now = datetime.now(timezone.utc)
        profile = await self.get_profile(user_id)
        awarded_points = 0
        new_badges = []
        events_log = []

        # Auto-reset daily missions if new day
        await self._reset_daily_if_needed(user_id, profile, now)

        # Base completion points
        awarded_points += POINT_RULES["interview_completed"]
        events_log.append({"type": "interview_completed", "pts": POINT_RULES["interview_completed"]})

        # Score-based bonus
        pct = interview_score * 100
        if pct >= 90:
            awarded_points += POINT_RULES["score_9_plus"]
            events_log.append({"type": "score_9_plus", "pts": POINT_RULES["score_9_plus"]})
        elif pct >= 70:
            awarded_points += POINT_RULES["score_7_plus"]
            events_log.append({"type": "score_7_plus", "pts": POINT_RULES["score_7_plus"]})
        elif pct >= 50:
            awarded_points += POINT_RULES["score_5_plus"]
            events_log.append({"type": "score_5_plus", "pts": POINT_RULES["score_5_plus"]})

        # Per-question points
        q_pts = questions_answered * POINT_RULES["question_answered"]
        awarded_points += q_pts
        events_log.append({"type": "questions_answered", "pts": q_pts, "count": questions_answered})

        # Streak update
        streak_result = await self._update_streak(user_id, profile, now)
        awarded_points += streak_result["streak_bonus"]
        if streak_result["streak_bonus"] > 0:
            events_log.append({"type": "streak_bonus", "pts": streak_result["streak_bonus"]})

        # Badge checks
        total_interviews = profile.get("total_interviews", 0) + 1
        badge_checks = [
            ("first_interview", total_interviews == 1),
            ("ai_ready", pct >= 80),
            ("top_performer", pct >= 90),
            ("consistent_learner", total_interviews == 5),
            ("interview_master", total_interviews == 20),
            ("perfect_score", pct == 100),
            ("streak_3", streak_result["new_streak"] >= 3),
            ("streak_7", streak_result["new_streak"] >= 7),
            ("streak_30", streak_result["new_streak"] >= 30),
        ]
        existing_badges = set(b.get("id") for b in profile.get("badges", []))
        for badge_id, condition in badge_checks:
            if condition and badge_id not in existing_badges:
                badge_data = {**BADGES[badge_id], "id": badge_id, "earned_at": now.isoformat()}
                new_badges.append(badge_data)
                awarded_points += BADGES[badge_id]["points"]
                existing_badges.add(badge_id)

        total_points_new = profile.get("total_points", 0) + awarded_points

        # Update running average
        old_avg = profile.get("average_score", 0.0)
        old_count = profile.get("total_interviews", 0)
        new_avg = ((old_avg * old_count) + interview_score) / (old_count + 1)

        point_events = [
            {"points": e["pts"], "event": e["type"], "ts": now.isoformat()}
            for e in events_log
            if e["pts"] != 0
        ]
        for b in new_badges:
            point_events.append({
                "points": b["points"],
                "event": f"badge_earned:{b['id']}",
                "ts": now.isoformat(),
            })

        # Increment daily counters (after reset check)
        update_inc = {
            "total_points": awarded_points,
            "total_interviews": 1,
            "total_questions_answered": questions_answered,
            "daily_interviews_today": 1,
            "daily_questions_today": questions_answered,
        }
        update_set = {
            "average_score": round(new_avg, 3),
            "updated_at": now,
            "current_streak": streak_result["new_streak"],
        }
        update_doc = {"$inc": update_inc, "$set": update_set}
        push_doc = {}
        if new_badges:
            push_doc["badges"] = {"$each": new_badges}
        if point_events:
            push_doc["recent_points"] = {"$each": point_events, "$slice": -20}
        if push_doc:
            update_doc["$push"] = push_doc
        if clean_session:
            update_doc["$inc"]["clean_sessions"] = 1

        await self.collection.update_one({"user_id": user_id}, update_doc, upsert=True)

        if point_events:
            await self.events_col.insert_many([
                {
                    "user_id": user_id,
                    "event_type": pe["event"],
                    "points": pe["points"],
                    "details": {"source": "process_interview_result"},
                    "created_at": now,
                }
                for pe in point_events
            ])

        # Update weekly challenge progress after interview
        await self._update_weekly_challenge_progress(user_id, interview_score, now)

        return {
            "points_awarded": awarded_points,
            "new_badges": new_badges,
            "streak": streak_result["new_streak"],
            "events_log": events_log,
            "new_total": total_points_new,
            "level_info": self._compute_level(total_points_new),
        }

    async def _update_streak(self, user_id: str, profile: Dict, now: datetime) -> Dict:
        today = now.date()
        today_str = today.isoformat()
        last_str = profile.get("last_practice_date")

        # Combine existing active_dates with today
        existing_active = list(profile.get("active_dates") or [])
        if today_str not in existing_active:
            existing_active.append(today_str)

        # Calculate accurate streak from active_dates
        streak_info = self._calculate_streak(existing_active, today)
        new_streak = streak_info["current_streak"]
        longest = max(profile.get("longest_streak", 0), streak_info["longest_streak"])

        # Determine streak bonus
        streak_bonus = 0
        if last_str:
            try:
                last_date = date.fromisoformat(last_str[:10])
                if last_date == today - timedelta(days=1):
                    streak_bonus = POINT_RULES["streak_bonus_daily"] * new_streak
            except Exception:
                pass

        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "last_practice_date": today_str,
                    "current_streak": new_streak,
                    "longest_streak": longest,
                },
                "$addToSet": {
                    "active_dates": today_str
                }
            },
            upsert=True,
        )
        return {"new_streak": new_streak, "streak_bonus": streak_bonus}

    def _compute_level(self, total_points: int) -> Dict:
        level_num, level_name, level_icon = LEVEL_THRESHOLDS[0]
        for i, (threshold, name, icon) in enumerate(LEVEL_THRESHOLDS):
            if total_points >= threshold:
                level_num, level_name, level_icon = i + 1, name, icon
            else:
                break

        current_idx = level_num - 1
        if current_idx < len(LEVEL_THRESHOLDS) - 1:
            current_thresh = LEVEL_THRESHOLDS[current_idx][0]
            next_thresh = LEVEL_THRESHOLDS[current_idx + 1][0]
            progress = round((total_points - current_thresh) / (next_thresh - current_thresh) * 100, 1)
            pts_to_next = next_thresh - total_points
        else:
            progress = 100.0
            pts_to_next = 0

        return {
            "level": level_num,
            "name": level_name,
            "icon": level_icon,
            "progress_pct": progress,
            "points_to_next": pts_to_next,
        }

    # ─── Level Catalog ────────────────────────────────────────────────────────
    def get_level_catalog(self) -> List[Dict]:
        return [
            {"level": i + 1, "name": name, "icon": icon, "threshold": threshold}
            for i, (threshold, name, icon) in enumerate(LEVEL_THRESHOLDS)
        ]

    # ─── Leaderboard ──────────────────────────────────────────────────────────
    async def get_leaderboard(self, limit: int = 20) -> List[Dict]:
        global _leaderboard_cache
        now = time.time()
        if _leaderboard_cache["data"] is not None and (now - _leaderboard_cache["ts"]) < _LEADERBOARD_CACHE_TTL:
            logger.debug("Returning cached leaderboard", age_seconds=round(now - _leaderboard_cache["ts"], 1))
            return _leaderboard_cache["data"]

        pipeline = [
            {"$sort": {"total_points": -1}},
            {
                "$lookup": {
                    "from": "users",
                    "let": {"uid": "$user_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": [{"$toString": "$_id"}, {"$toString": "$$uid"}]},
                                        {"$ne": ["$role", "admin"]},
                                        {"$ne": ["$role", "recruiter"]},
                                    ]
                                }
                            }
                        },
                        {"$project": {"full_name": 1, "email": 1, "username": 1, "name": 1, "role": 1}},
                    ],
                    "as": "user_info",
                }
            },
            # Strict filter: only include records where user exists in 'users' collection AND is candidate mode
            {"$match": {"user_info": {"$ne": []}}},
            {"$addFields": {"user_info": {"$arrayElemAt": ["$user_info", 0]}}},
            {"$limit": limit},
        ]

        docs = []
        async for doc in self.collection.aggregate(pipeline):
            docs.append(doc)

        result = []
        rank = 1
        for doc in docs:
            user_info = doc.get("user_info")
            if not user_info:
                continue  # Skip if user does not exist in users table

            user_role = (user_info.get("role") or "candidate").lower()
            if user_role in ["admin", "recruiter"]:
                continue  # Only candidate mode users should be shown on leaderboard

            full_name = (user_info.get("full_name") or "").strip()
            if not full_name:
                full_name = (user_info.get("name") or "").strip()
            if not full_name:
                full_name = (user_info.get("username") or "").strip()
            if not full_name:
                email = (user_info.get("email") or "").strip()
                if email and "@" in email:
                    full_name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
                elif email:
                    full_name = email
            if not full_name or full_name.lower() == "unknown":
                full_name = "Anonymous Candidate"

            streak_info = self._calculate_streak(doc.get("active_dates") or [])
            result.append({
                "rank": rank,
                "user_id": doc["user_id"],
                "full_name": full_name,
                "role": user_role,
                "total_points": doc.get("total_points", 0),
                "level_info": self._compute_level(doc.get("total_points", 0)),
                "current_streak": streak_info["current_streak"],
                "total_interviews": doc.get("total_interviews", 0),
                "average_score": doc.get("average_score", 0.0),
                "badge_count": len(doc.get("badges", [])),
                "top_badge": doc["badges"][-1] if doc.get("badges") else None,
            })
            rank += 1

        _leaderboard_cache["data"] = result
        _leaderboard_cache["ts"] = time.time()
        return result

    async def mark_daily_activity(self, user_id: str):
        """Mark daily activity and award daily practice points if first visit today."""
        now = datetime.now(timezone.utc)
        profile = await self.get_profile(user_id)
        streak_result = await self._update_streak(user_id, profile, now)

        # Check if already claimed today by looking at last update date
        last_update = profile.get("updated_at")
        already_claimed_today = False
        if last_update:
            try:
                if isinstance(last_update, str):
                    last_update_date = date.fromisoformat(last_update[:10])
                else:
                    last_update_date = last_update.date()
                already_claimed_today = (last_update_date == now.date())
            except Exception:
                pass

        if not already_claimed_today:
            await self.award_points(user_id, "daily_practice", 25)

        return streak_result

    # ═══════════════════════════════════════════════════════════════════════════
    # NEW: Daily Reward (7-Day Claim Track)
    # ═══════════════════════════════════════════════════════════════════════════

    async def get_daily_reward_status(self, user_id: str) -> Dict:
        """Return the current daily reward state for the user."""
        profile = await self.get_profile(user_id)
        today = date.today()
        last_claim = profile.get("last_reward_claim_date")

        # If last claim was yesterday or earlier, advance the day in cycle
        current_day = profile.get("daily_reward_day", 0)
        reward_streak = profile.get("daily_reward_streak", 0)

        if last_claim:
            try:
                last_claim_date = date.fromisoformat(last_claim) if isinstance(last_claim, str) else last_claim
                if last_claim_date < today:
                    # Advance to next day in cycle
                    if current_day >= DAILY_REWARD_DAYS:
                        # Completed full cycle — start new cycle and increment streak
                        current_day = 1
                        reward_streak += 1
                    else:
                        current_day += 1
                # If last_claim_date == today, keep current_day as-is (already claimed today)
            except Exception:
                current_day = 1
        else:
            # Never claimed before — day 1 is available
            current_day = 1

        # Build the reward days array with claim status
        days_status = []
        for i, reward_def in enumerate(DAILY_REWARD_DEFINITIONS):
            day_num = reward_def["day"]
            is_claimed = False
            if last_claim:
                try:
                    last_claim_date = date.fromisoformat(last_claim) if isinstance(last_claim, str) else last_claim
                    if last_claim_date == today:
                        # Today was claimed — so current_day-1 is claimed, others before it too
                        if day_num < current_day:
                            is_claimed = True
                        elif day_num == current_day - 1 and day_num <= DAILY_REWARD_DAYS and current_day > 1:
                            # If current_day > 1, day before it was claimed today
                            if i == current_day - 2:  # 0-indexed
                                is_claimed = True
                except Exception:
                    pass
            # Also mark all days before current_day as claimed if last_claim exists
            if last_claim and day_num < current_day:
                is_claimed = True

            days_status.append({
                "day": day_num,
                "type": reward_def["type"],
                "amount": reward_def.get("amount", 0),
                "label": reward_def.get("label", None),
                "claimed": is_claimed,
                "isToday": (day_num == current_day and (not last_claim or today != (date.fromisoformat(last_claim) if isinstance(last_claim, str) else last_claim))),
            })

        return {
            "current_day": current_day,
            "reward_streak": reward_streak,
            "cycle_completed": current_day > DAILY_REWARD_DAYS,
            "days": days_status,
            "can_claim_today": any(d["isToday"] for d in days_status) and not any(d["claimed"] and d["isToday"] for d in days_status),
        }

    async def claim_daily_reward(self, user_id: str) -> Dict:
        """Claim today's daily reward."""
        profile = await self.get_profile(user_id)
        today = date.today()
        last_claim = profile.get("last_reward_claim_date")

        # Validate: check if already claimed today
        if last_claim:
            try:
                last_claim_date = date.fromisoformat(last_claim) if isinstance(last_claim, str) else last_claim
                if last_claim_date >= today:
                    return {"error": "Daily reward already claimed today.", "claimed": False}
            except Exception:
                pass

        # Determine which day to claim
        current_day = profile.get("daily_reward_day", 0)
        reward_streak = profile.get("daily_reward_streak", 0)

        if current_day < 1:
            current_day = 1
        elif current_day > DAILY_REWARD_DAYS:
            # Completed cycle, start new one
            current_day = 1
            reward_streak += 1

        # Find the reward definition for this day
        reward_def = DAILY_REWARD_DEFINITIONS[current_day - 1]
        points_awarded = 0
        bonus_label = None

        if reward_def["type"] == "xp":
            points_awarded = reward_def["amount"]
        elif reward_def["type"] == "bonus":
            # Bonus days give extra points
            bonus_label = reward_def.get("label", "Bonus")
            points_awarded = 50  # Base bonus XP

        # Award points
        if points_awarded > 0:
            await self.award_points(user_id, f"daily_reward_day_{current_day}", points_awarded)

        # Update daily reward state: advance to next day
        next_day = current_day + 1
        if next_day > DAILY_REWARD_DAYS:
            # Completed full cycle
            next_day = DAILY_REWARD_DAYS + 1  # Signal completed
            await self.award_points(user_id, "daily_reward_cycle_complete", 100)  # Bonus for completing cycle
            points_awarded += 100

        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "daily_reward_day": next_day,
                    "daily_reward_streak": reward_streak + (1 if next_day > DAILY_REWARD_DAYS else 0),
                    "last_reward_claim_date": today.isoformat(),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

        return {
            "claimed": True,
            "day": current_day,
            "reward_type": reward_def["type"],
            "points_awarded": points_awarded,
            "bonus_label": bonus_label,
            "cycle_completed": next_day > DAILY_REWARD_DAYS,
            "reward_streak": reward_streak + (1 if next_day > DAILY_REWARD_DAYS else 0),
            "next_day": next_day if next_day <= DAILY_REWARD_DAYS else 1,
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # NEW: Daily Missions
    # ═══════════════════════════════════════════════════════════════════════════

    async def _reset_daily_if_needed(self, user_id: str, profile: Dict, now: datetime):
        """Reset daily counters if a new day has started."""
        today = now.date()
        last_reset = profile.get("last_daily_reset")
        if last_reset:
            try:
                last_reset_date = date.fromisoformat(last_reset) if isinstance(last_reset, str) else last_reset
                if last_reset_date < today:
                    await self.collection.update_one(
                        {"user_id": user_id},
                        {
                            "$set": {
                                "daily_interviews_today": 0,
                                "daily_questions_today": 0,
                                "last_daily_reset": today.isoformat(),
                            }
                        },
                        upsert=True,
                    )
            except Exception:
                pass
        else:
            await self.collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "daily_interviews_today": 0,
                        "daily_questions_today": 0,
                        "last_daily_reset": today.isoformat(),
                    }
                },
                upsert=True,
            )

    async def get_daily_missions(self, user_id: str) -> Dict:
        """Get daily missions with real progress from profile."""
        profile = await self.get_profile(user_id)
        now = datetime.now(timezone.utc)
        await self._reset_daily_if_needed(user_id, profile, now)

        # Re-fetch after potential reset
        profile = await self.get_profile(user_id)
        avg_pct = round((profile.get("average_score", 0) or 0) * 100)

        missions = []
        for mission_def in DAILY_MISSIONS:
            if mission_def["id"] == "interview-warrior":
                progress = profile.get("daily_interviews_today", 0)
            elif mission_def["id"] == "brain-trainer":
                progress = profile.get("daily_questions_today", 0)
            elif mission_def["id"] == "ats-hunter":
                progress = avg_pct
            else:
                progress = 0

            missions.append({
                "id": mission_def["id"],
                "title": mission_def["title"],
                "icon": mission_def["icon"],
                "target": mission_def["target"],
                "xp": mission_def["xp"],
                "progress": min(progress, mission_def["target"]),
                "completed": progress >= mission_def["target"],
            })

        return {"missions": missions, "date": now.strftime("%Y-%m-%d")}

    # ═══════════════════════════════════════════════════════════════════════════
    # NEW: Weekly Challenge
    # ═══════════════════════════════════════════════════════════════════════════

    def _get_current_week_id(self) -> str:
        """Get ISO week identifier like '2025-W15'."""
        today = date.today()
        year, week_num, _ = today.isocalendar()
        return f"{year}-W{week_num:02d}"

    def _get_weekly_challenge_for_week(self, week_id: str) -> Dict:
        """Deterministically pick a challenge based on week ID."""
        # Hash the week_id to pick a challenge
        idx = abs(hash(week_id)) % len(WEEKLY_CHALLENGES)
        return {**WEEKLY_CHALLENGES[idx], "week_id": week_id}

    async def get_weekly_challenge(self, user_id: str) -> Dict:
        """Get the current weekly challenge with progress."""
        profile = await self.get_profile(user_id)
        week_id = self._get_current_week_id()
        challenge = self._get_weekly_challenge_for_week(week_id)

        stored_week_id = profile.get("weekly_challenge_week_id")
        stored_progress = profile.get("weekly_challenge_progress", 0.0)
        stored_claimed = profile.get("weekly_challenge_claimed", False)

        # If week changed, reset progress
        if stored_week_id != week_id:
            await self.collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "weekly_challenge_week_id": week_id,
                        "weekly_challenge_progress": 0.0,
                        "weekly_challenge_claimed": False,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
                upsert=True,
            )
            stored_progress = 0.0
            stored_claimed = False

        # Compute progress from real profile data
        progress_pct = 0
        if "target_score_pct" in challenge:
            avg_pct = round((profile.get("average_score", 0) or 0) * 100)
            progress_pct = min(100, round((avg_pct / challenge["target_score_pct"]) * 100))
        elif "target_streak" in challenge:
            streak = profile.get("current_streak", 0)
            progress_pct = min(100, round((streak / challenge["target_streak"]) * 100))
        elif "target_answers_high_score" in challenge:
            # Use total questions answered this week approximation
            total_q = profile.get("total_questions_answered", 0)
            progress_pct = min(100, round((total_q / challenge["target_answers_high_score"]) * 100))
        elif "target_interviews" in challenge:
            total_i = profile.get("total_interviews", 0)
            progress_pct = min(100, round((total_i / challenge["target_interviews"]) * 100))

        # Use the higher of stored progress or computed progress
        final_progress = max(stored_progress, progress_pct / 100.0)

        return {
            "challenge": challenge,
            "progress_pct": round(final_progress * 100),
            "completed": final_progress >= 1.0,
            "claimed": stored_claimed,
            "week_id": week_id,
        }

    async def _update_weekly_challenge_progress(self, user_id: str, interview_score: float, now: datetime):
        """Update weekly challenge progress after an interview."""
        profile = await self.get_profile(user_id)
        week_id = self._get_current_week_id()
        stored_week_id = profile.get("weekly_challenge_week_id")

        if stored_week_id != week_id:
            # Week changed, will be handled by get_weekly_challenge
            return

        challenge = self._get_weekly_challenge_for_week(week_id)
        new_progress = profile.get("weekly_challenge_progress", 0.0)

        if "target_score_pct" in challenge:
            pct = interview_score * 100
            if pct >= challenge["target_score_pct"]:
                new_progress = 1.0
        elif "target_streak" in challenge:
            streak = profile.get("current_streak", 0)
            new_progress = max(new_progress, min(1.0, streak / challenge["target_streak"]))
        elif "target_interviews" in challenge:
            total_i = profile.get("total_interviews", 0) + 1
            new_progress = max(new_progress, min(1.0, total_i / challenge["target_interviews"]))

        await self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"weekly_challenge_progress": new_progress, "updated_at": now}},
            upsert=True,
        )

    async def claim_weekly_challenge(self, user_id: str) -> Dict:
        """Claim the weekly challenge reward."""
        profile = await self.get_profile(user_id)
        week_id = self._get_current_week_id()
        stored_week_id = profile.get("weekly_challenge_week_id")
        claimed = profile.get("weekly_challenge_claimed", False)

        if stored_week_id != week_id:
            return {"error": "No active challenge for this week.", "claimed": False}
        if claimed:
            return {"error": "Weekly challenge already claimed.", "claimed": False}

        progress = profile.get("weekly_challenge_progress", 0.0)
        if progress < 1.0:
            return {"error": "Challenge not yet completed.", "claimed": False}

        challenge = self._get_weekly_challenge_for_week(week_id)
        reward_xp = challenge.get("reward_xp", 200)

        # Award points
        await self.award_points(user_id, f"weekly_challenge:{challenge['id']}", reward_xp)

        # Award badge if applicable
        badge_id = challenge.get("badge_reward")
        if badge_id and badge_id in BADGES:
            existing_badges = set(b.get("id") for b in profile.get("badges", []))
            if badge_id not in existing_badges:
                now = datetime.now(timezone.utc)
                badge_data = {**BADGES[badge_id], "id": badge_id, "earned_at": now.isoformat()}
                await self.collection.update_one(
                    {"user_id": user_id},
                    {"$push": {"badges": badge_data}},
                    upsert=True,
                )

        await self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"weekly_challenge_claimed": True, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )

        return {
            "claimed": True,
            "reward_xp": reward_xp,
            "badge_awarded": badge_id if badge_id and badge_id in BADGES else None,
            "challenge_id": challenge["id"],
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # NEW: Reward Chests
    # ═══════════════════════════════════════════════════════════════════════════

    async def get_reward_chests(self, user_id: str) -> List[Dict]:
        """Get all reward chests with their claimable status."""
        profile = await self.get_profile(user_id)
        total_points = profile.get("total_points", 0)
        claimed_chests = set(profile.get("claimed_chests", []))

        chests = []
        for chest in REWARD_CHEST_TIERS:
            is_claimable = total_points >= chest["xp_required"]
            is_claimed = chest["id"] in claimed_chests

            chests.append({
                "id": chest["id"],
                "name": chest["name"],
                "tier": chest["tier"],
                "xp_required": chest["xp_required"],
                "reward_xp": chest["reward_xp"],
                "reward_coins": chest["reward_coins"],
                "icon": chest["icon"],
                "claimable": is_claimable and not is_claimed,
                "locked": not is_claimable,
                "claimed": is_claimed,
            })

        return chests

    async def claim_reward_chest(self, user_id: str, chest_id: str) -> Dict:
        """Claim a reward chest."""
        profile = await self.get_profile(user_id)
        total_points = profile.get("total_points", 0)
        claimed_chests = set(profile.get("claimed_chests", []))

        # Find the chest
        chest = None
        for c in REWARD_CHEST_TIERS:
            if c["id"] == chest_id:
                chest = c
                break

        if not chest:
            return {"error": "Chest not found.", "claimed": False}
        if chest["id"] in claimed_chests:
            return {"error": "Chest already claimed.", "claimed": False}
        if total_points < chest["xp_required"]:
            return {"error": "Not enough XP to claim this chest.", "claimed": False}

        # Award XP
        if chest["reward_xp"] > 0:
            await self.award_points(user_id, f"chest:{chest_id}", chest["reward_xp"])

        # Mark as claimed
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$push": {"claimed_chests": chest_id},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
            upsert=True,
        )

        return {
            "claimed": True,
            "chest_id": chest_id,
            "reward_xp": chest["reward_xp"],
            "reward_coins": chest["reward_coins"],
            "tier": chest["tier"],
        }


# ─── Module-level helper to invalidate leaderboard cache ────────────────────
def invalidate_leaderboard_cache():
    """Exposed for any external code that directly modifies points without
    going through award_points() (e.g. test scripts, migrations)."""
    global _leaderboard_cache
    _leaderboard_cache["data"] = None

