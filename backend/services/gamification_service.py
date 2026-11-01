"""
Gamification Service — points, badges, streaks, levels, and leaderboard
"""

import time
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional, Dict, Any

import structlog
from pymongo.asynchronous.database import AsyncDatabase

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
    "interview_master":  {"name": "Interview Master", "description": "Completed 20 interviews", "icon": "👑", "points": 500, "tier": "legendary"},
}

POINT_RULES = {
    "question_answered":    2,    # Any answer submitted
    "score_5_plus":        5,     # Score >= 5
    "score_7_plus":        10,    # Score >= 7
    "score_9_plus":        20,    # Score >= 9
    "perfect_answer":      30,    # Score = 10
    "interview_completed": 50,    # Full interview done
    "daily_practice":      50,    # Daily visit reward
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

class GamificationService:

    def __init__(self, db: AsyncDatabase):
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

        # Ensure best_score is always tracked and synced
        if doc.get("best_score") is None:
            doc["best_score"] = round(float(doc.get("average_score", 0.0) or 0.0), 3)
            await self.collection.update_one(
                {"user_id": user_id},
                {"$set": {"best_score": doc["best_score"]}}
            )

        # Calculate exact global leaderboard rank dynamically
        total_pts = doc.get("total_points", 0)
        higher_count = await self.collection.count_documents({"total_points": {"$gt": total_pts}})
        doc["rank"] = higher_count + 1

        return doc

    async def claim_daily_visit_reward(self, user_id: str) -> Dict:
        """Award the daily visit bonus once per UTC calendar day."""
        global _leaderboard_cache
        await self.get_profile(user_id)
        today = datetime.now(timezone.utc).date().isoformat()
        points = POINT_RULES["daily_practice"]
        now = datetime.now(timezone.utc)
        result = await self.collection.update_one(
            {
                "user_id": user_id,
                "$or": [
                    {"last_daily_reward_date": {"$exists": False}},
                    {"last_daily_reward_date": {"$ne": today}},
                ],
            },
            {
                "$inc": {"total_points": points},
                "$set": {
                    "last_daily_reward_date": today,
                    "updated_at": now,
                },
                "$push": {
                    "recent_points": {
                        "$each": [{
                            "points": points,
                            "event": "daily_practice",
                            "ts": now.isoformat(),
                        }],
                        "$slice": -20,
                    },
                },
            },
        )

        if result.modified_count == 0:
            return {
                "awarded": 0,
                "points_awarded": 0,
                "already_claimed": True,
                "reward_date": today,
            }

        await self.events_col.insert_one({
            "user_id": user_id,
            "event_type": "daily_practice",
            "points": points,
            "details": {"source": "daily_visit"},
            "created_at": now,
        })
        _leaderboard_cache["data"] = None
        return {
            "awarded": points,
            "points_awarded": points,
            "already_claimed": False,
            "reward_date": today,
        }

    async def _create_profile(self, user_id: str) -> Dict:
        global _leaderboard_cache
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
            "best_score": 0.0,
            "badges": [],
            "recent_points": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await self.collection.insert_one(profile)
        profile["_id"] = result.inserted_id
        _leaderboard_cache["data"] = None
        return profile

    # ─── Process Interview Result ─────────────────────────────────────────────
    async def process_interview_result(
        self,
        user_id: str,
        interview_score: float,
        questions_answered: int,
    ) -> Dict:
        now = datetime.now(timezone.utc)
        profile = await self.get_profile(user_id)
        awarded_points = 0
        new_badges = []
        events_log = []

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

        # Update running average and best score
        old_avg = profile.get("average_score", 0.0)
        old_best = float(profile.get("best_score") if profile.get("best_score") is not None else old_avg)
        old_count = profile.get("total_interviews", 0)
        new_avg = ((old_avg * old_count) + interview_score) / (old_count + 1)
        new_best = max(old_best, float(interview_score))

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

        update_inc = {
            "total_points": awarded_points,
            "total_interviews": 1,
            "total_questions_answered": questions_answered,
        }
        update_set = {
            "average_score": round(new_avg, 3),
            "best_score": round(new_best, 3),
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
                        {
                            "$project": {
                                "full_name": 1,
                                "email": 1,
                                "username": 1,
                                "name": 1,
                                "role": 1,
                                "profile_picture": 1,
                                "avatar_url": 1,
                                "picture": 1,
                                "display_picture": 1,
                                "google_picture": 1,
                                "linked_accounts": 1,
                                "profile_photo_url": 1,
                                "photo_url": 1,
                            }
                        },
                    ],
                    "as": "user_info",
                }
            },
            # Strict filter: only include records where user exists in 'users' collection AND is candidate mode
            {"$match": {"user_info": {"$ne": []}}},
            {"$addFields": {"user_info": {"$arrayElemAt": ["$user_info", 0]}}},
            {"$limit": limit},
        ]

        cursor_or_coro = self.collection.aggregate(pipeline)
        if hasattr(cursor_or_coro, "__await__"):
            cursor = await cursor_or_coro
        else:
            cursor = cursor_or_coro
        docs = await cursor.to_list(length=limit)

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

            # Resolve user's profile photo (custom upload > provider/linked > legacy fields)
            linked_accounts = user_info.get("linked_accounts") or {}
            avatar_url = (
                user_info.get("profile_picture")
                or user_info.get("avatar_url")
                or user_info.get("display_picture")
                or user_info.get("profile_photo_url")
                or user_info.get("photo_url")
                or user_info.get("picture")
                or (linked_accounts.get("google") or {}).get("picture")
                or (linked_accounts.get("github") or {}).get("picture")
                or (linked_accounts.get("linkedin") or {}).get("picture")
                or user_info.get("google_picture")
                or None
            )

            streak_info = self._calculate_streak(doc.get("active_dates") or [])
            result.append({
                "rank": rank,
                "user_id": doc["user_id"],
                "full_name": full_name,
                "role": user_role,
                "avatar_url": avatar_url,
                "profile_picture": avatar_url,
                "display_picture": avatar_url,
                "google_picture": user_info.get("google_picture") or (linked_accounts.get("google") or {}).get("picture"),
                "linked_accounts": linked_accounts,
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
