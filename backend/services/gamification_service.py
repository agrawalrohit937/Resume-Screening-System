"""
Gamification Service — points, badges, streaks, levels, and leaderboard.
100% Native PostgreSQL via SQLAlchemy 2.0.
"""

import time
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional, Dict, Any

import structlog
from sqlalchemy import select, func, desc

from config.db import get_pg_session_factory
from models import UserGamification, User, gen_uuid_str

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


def _profile_to_dict(profile: UserGamification) -> Dict[str, Any]:
    return {
        "_id": str(profile.id),
        "id": str(profile.id),
        "user_id": str(profile.user_id),
        "total_points": profile.total_points or 0,
        "current_streak": profile.current_streak or 0,
        "longest_streak": profile.longest_streak or 0,
        "last_practice_date": profile.last_practice_date,
        "last_daily_reward_date": profile.last_daily_reward_date,
        "active_dates": profile.active_dates or [],
        "total_interviews": profile.interviews_completed or 0,
        "interviews_completed": profile.interviews_completed or 0,
        "total_questions_answered": profile.questions_answered or 0,
        "questions_answered": profile.questions_answered or 0,
        "average_score": float(profile.average_score or 0.0),
        "best_score": float(profile.best_score or 0.0),
        "badges": profile.badges or [],
        "recent_points": profile.recent_points or [],
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


class GamificationService:
    def __init__(self, db: Optional[Any] = None, session_factory=None):
        self.session_factory = session_factory or get_pg_session_factory()

    def _calculate_streak(self, active_dates: List[str], today: Optional[date] = None) -> Dict[str, int]:
        if not today:
            today = datetime.now(timezone.utc).date()
        if not active_dates:
            return {"current_streak": 0, "longest_streak": 0}

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

    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        async with self.session_factory() as session:
            stmt = select(UserGamification).where(UserGamification.user_id == str(user_id))
            res = await session.execute(stmt)
            profile = res.scalar_one_or_none()

            if not profile:
                profile = await self._create_profile(user_id)
                return profile

            now = datetime.now(timezone.utc)
            today = now.date()
            active_dates = list(profile.active_dates or [])

            if not active_dates and profile.last_practice_date:
                active_dates = [profile.last_practice_date[:10]]
                profile.active_dates = active_dates

            streak_info = self._calculate_streak(active_dates, today)
            profile.current_streak = streak_info["current_streak"]
            profile.longest_streak = max(profile.longest_streak or 0, streak_info["longest_streak"])

            if profile.best_score is None:
                profile.best_score = round(float(profile.average_score or 0.0), 3)

            await session.commit()
            await session.refresh(profile)

            # Global rank
            rank_stmt = select(func.count()).select_from(UserGamification).where(
                UserGamification.total_points > (profile.total_points or 0)
            )
            rank_res = await session.execute(rank_stmt)
            rank = (rank_res.scalar() or 0) + 1

            doc = _profile_to_dict(profile)
            doc["level_info"] = self._compute_level(doc.get("total_points", 0))
            doc["rank"] = rank
            return doc

    async def claim_daily_visit_reward(self, user_id: str) -> Dict[str, Any]:
        global _leaderboard_cache
        today = datetime.now(timezone.utc).date().isoformat()
        points = POINT_RULES["daily_practice"]
        now = datetime.now(timezone.utc)

        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(UserGamification).where(UserGamification.user_id == str(user_id))
                res = await session.execute(stmt)
                profile = res.scalar_one_or_none()

                if not profile:
                    profile = UserGamification(
                        id=gen_uuid_str(),
                        user_id=str(user_id),
                        total_points=0,
                        current_streak=0,
                        longest_streak=0,
                        interviews_completed=0,
                        questions_answered=0,
                        average_score=0.0,
                        best_score=0.0,
                        badges=[],
                        active_dates=[],
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(profile)
                    await session.flush()

                if profile.last_daily_reward_date == today:
                    return {
                        "awarded": 0,
                        "points_awarded": 0,
                        "already_claimed": True,
                        "reward_date": today,
                    }

                profile.total_points = (profile.total_points or 0) + points
                profile.last_daily_reward_date = today
                profile.updated_at = now

                recent = list(profile.recent_points or [])
                recent.append({
                    "points": points,
                    "event": "daily_practice",
                    "ts": now.isoformat(),
                })
                profile.recent_points = recent[-20:]

        _leaderboard_cache["data"] = None
        return {
            "awarded": points,
            "points_awarded": points,
            "already_claimed": False,
            "reward_date": today,
        }

    async def _create_profile(self, user_id: str) -> Dict[str, Any]:
        global _leaderboard_cache
        now = datetime.now(timezone.utc)
        async with self.session_factory() as session:
            async with session.begin():
                profile = UserGamification(
                    id=gen_uuid_str(),
                    user_id=str(user_id),
                    total_points=0,
                    current_streak=0,
                    longest_streak=0,
                    interviews_completed=0,
                    questions_answered=0,
                    average_score=0.0,
                    best_score=0.0,
                    badges=[],
                    active_dates=[],
                    recent_points=[],
                    created_at=now,
                    updated_at=now,
                )
                session.add(profile)
            await session.refresh(profile)

        _leaderboard_cache["data"] = None
        doc = _profile_to_dict(profile)
        doc["level_info"] = self._compute_level(0)
        doc["rank"] = 1
        return doc

    async def process_interview_result(
        self,
        user_id: str,
        interview_score: float,
        questions_answered: int,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        today = now.date()
        today_str = today.isoformat()

        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(UserGamification).where(UserGamification.user_id == str(user_id))
                res = await session.execute(stmt)
                profile = res.scalar_one_or_none()

                if not profile:
                    profile = UserGamification(
                        id=gen_uuid_str(),
                        user_id=str(user_id),
                        total_points=0,
                        current_streak=0,
                        longest_streak=0,
                        interviews_completed=0,
                        questions_answered=0,
                        average_score=0.0,
                        best_score=0.0,
                        badges=[],
                        active_dates=[],
                        recent_points=[],
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(profile)
                    await session.flush()

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
                existing_active = list(profile.active_dates or [])
                if today_str not in existing_active:
                    existing_active.append(today_str)
                profile.active_dates = existing_active

                streak_info = self._calculate_streak(existing_active, today)
                new_streak = streak_info["current_streak"]
                profile.current_streak = new_streak
                profile.longest_streak = max(profile.longest_streak or 0, streak_info["longest_streak"])

                streak_bonus = 0
                if profile.last_practice_date:
                    try:
                        last_d = date.fromisoformat(profile.last_practice_date[:10])
                        if last_d == today - timedelta(days=1):
                            streak_bonus = POINT_RULES["streak_bonus_daily"] * new_streak
                    except Exception:
                        pass

                profile.last_practice_date = today_str
                awarded_points += streak_bonus
                if streak_bonus > 0:
                    events_log.append({"type": "streak_bonus", "pts": streak_bonus})

                # Badge checks
                total_interviews = (profile.interviews_completed or 0) + 1
                badge_checks = [
                    ("first_interview", total_interviews == 1),
                    ("ai_ready", pct >= 80),
                    ("top_performer", pct >= 90),
                    ("consistent_learner", total_interviews == 5),
                    ("interview_master", total_interviews == 20),
                    ("perfect_score", pct == 100),
                    ("streak_3", new_streak >= 3),
                    ("streak_7", new_streak >= 7),
                    ("streak_30", new_streak >= 30),
                ]
                existing_badges = set(b.get("id") for b in (profile.badges or []))
                for badge_id, condition in badge_checks:
                    if condition and badge_id not in existing_badges:
                        badge_data = {**BADGES[badge_id], "id": badge_id, "earned_at": now.isoformat()}
                        new_badges.append(badge_data)
                        awarded_points += BADGES[badge_id]["points"]
                        existing_badges.add(badge_id)

                if new_badges:
                    profile.badges = list(profile.badges or []) + new_badges

                # Running average and best score
                old_avg = float(profile.average_score or 0.0)
                old_best = float(profile.best_score or 0.0)
                old_count = profile.interviews_completed or 0
                new_avg = ((old_avg * old_count) + interview_score) / (old_count + 1)
                new_best = max(old_best, float(interview_score))

                profile.total_points = (profile.total_points or 0) + awarded_points
                profile.interviews_completed = total_interviews
                profile.questions_answered = (profile.questions_answered or 0) + questions_answered
                profile.average_score = round(new_avg, 3)
                profile.best_score = round(new_best, 3)
                profile.updated_at = now

                point_events = [
                    {"points": e["pts"], "event": e["type"], "ts": now.isoformat()}
                    for e in events_log if e["pts"] != 0
                ]
                for b in new_badges:
                    point_events.append({
                        "points": b["points"],
                        "event": f"badge_earned:{b['id']}",
                        "ts": now.isoformat(),
                    })

                recent = list(profile.recent_points or []) + point_events
                profile.recent_points = recent[-20:]
                total_points_new = profile.total_points

        return {
            "points_awarded": awarded_points,
            "new_badges": new_badges,
            "streak": new_streak,
            "events_log": events_log,
            "new_total": total_points_new,
            "level_info": self._compute_level(total_points_new),
        }

    def _compute_level(self, total_points: int) -> Dict[str, Any]:
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

    async def get_leaderboard(self, limit: int = 20) -> List[Dict[str, Any]]:
        global _leaderboard_cache
        now = time.time()
        if _leaderboard_cache["data"] is not None and (now - _leaderboard_cache["ts"]) < _LEADERBOARD_CACHE_TTL:
            return _leaderboard_cache["data"]

        async with self.session_factory() as session:
            stmt = (
                select(UserGamification, User)
                .join(User, UserGamification.user_id == User.id)
                .where(User.role.notin_(["admin", "recruiter"]))
                .order_by(desc(UserGamification.total_points))
                .limit(limit)
            )
            res = await session.execute(stmt)
            rows = res.all()

        result = []
        rank = 1
        for gam_profile, user_obj in rows:
            user_role = (user_obj.role or "candidate").lower()
            full_name = (getattr(user_obj, "full_name", None) or getattr(user_obj, "name", None) or "").strip()
            if not full_name:
                email = (user_obj.email or "").strip()
                if email and "@" in email:
                    full_name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
                else:
                    full_name = "Anonymous Candidate"

            streak_info = self._calculate_streak(gam_profile.active_dates or [])
            badges = gam_profile.badges or []
            avatar = getattr(user_obj, "profile_picture", None)

            result.append({
                "rank": rank,
                "user_id": str(gam_profile.user_id),
                "full_name": full_name,
                "role": user_role,
                "avatar_url": avatar,
                "profile_picture": avatar,
                "display_picture": avatar,
                "google_picture": avatar,
                "linked_accounts": {},
                "total_points": gam_profile.total_points or 0,
                "level_info": self._compute_level(gam_profile.total_points or 0),
                "current_streak": streak_info["current_streak"],
                "total_interviews": gam_profile.interviews_completed or 0,
                "average_score": float(gam_profile.average_score or 0.0),
                "badge_count": len(badges),
                "top_badge": badges[-1] if badges else None,
            })
            rank += 1

        _leaderboard_cache["data"] = result
        _leaderboard_cache["ts"] = time.time()
        return result
