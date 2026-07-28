"""
CareerShala AI Copilot Service
==============================
Handles dynamic context aggregation, TTL caching, navigation shortcuts,
and streaming chat responses using existing LLM keys.
"""

import json
import re
import time
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, List, Optional, Any
import httpx
import structlog

from core.config import settings
from config.db import get_database
from models.certificate_model import CertificateRecord
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository

logger = structlog.get_logger(__name__)

# --- Provider Models & Urls ---
GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions"
MISTRAL_BASE = "https://api.mistral.ai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
MISTRAL_MODEL = "mistral-large-latest"


class CopilotContextCache:
    """Simple in-memory cache with Time-To-Live (TTL)."""
    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self._cache = {}

    def get(self, user_id: str, key: str) -> Optional[Any]:
        cache_key = f"{user_id}:{key}"
        if cache_key in self._cache:
            entry = self._cache[cache_key]
            if time.time() - entry["timestamp"] < self.ttl:
                return entry["data"]
            else:
                del self._cache[cache_key]
        return None

    def set(self, user_id: str, key: str, data: Any) -> None:
        cache_key = f"{user_id}:{key}"
        self._cache[cache_key] = {
            "timestamp": time.time(),
            "data": data
        }

    def clear(self, user_id: str, key: Optional[str] = None) -> None:
        if key:
            self._cache.pop(f"{user_id}:{key}", None)
        else:
            prefix = f"{user_id}:"
            to_remove = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in to_remove:
                del self._cache[k]


# Instantiate a global cache with a 5-minute TTL
context_cache = CopilotContextCache(ttl_seconds=300)


class CopilotService:
    def __init__(self):
        self.cache = context_cache

    def check_navigation_shortcut(self, message: str) -> Optional[dict]:
        """Check if message is a simple navigation command. Returns navigation route info if matched."""
        msg_lower = message.lower().strip()
        
        # Shortcut commands starting with "/"
        direct_commands = {
            "/interview": ("/interview", "Taking you to the Interview Practice center! 🎙️"),
            "/ats": ("/results", "Opening the ATS Matcher results! 📊"),
            "/upload": ("/upload", "Opening your Resume Library! 📄"),
            "/enhance": ("/enhance", "Navigating to the AI Resume Enhancer! ✨"),
            "/github": ("/github", "Taking you to GitHub Analysis! 🐙"),
            "/fake-detect": ("/fake-detect", "Opening the Authenticity Check! 🔍"),
            "/gamification": ("/gamification", "Heading to the Rewards Hub! 🏆"),
            "/billing": ("/billing", "Redirecting to Premium Billing! 💳"),
            "/profile": ("/profile", "Opening your Profile settings! ⚙️"),
            "/dashboard": ("/dashboard", "Taking you to the Career Dashboard! 🏠")
        }
        
        if msg_lower in direct_commands:
            route, res = direct_commands[msg_lower]
            return {"response": res, "navigate": route}
            
        # Match natural language navigation
        nav_patterns = [
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(interview|mock|practice)\b", "/interview", "Redirecting to the Interview Practice center! 🎙️"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(ats|match|results|score)\b", "/results", "Opening the ATS Matcher results! 📊"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(upload|resume library|library)\b", "/upload", "Navigating to your Resume Library! 📄"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(enhance|builder|improve resume)\b", "/enhance", "Taking you to the AI Resume Enhancer! ✨"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(github|git|repo)\b", "/github", "Navigating to GitHub Analysis! 🐙"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(fake detect|authenticity|verification)\b", "/fake-detect", "Taking you to Authenticity Check! 🔍"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(rewards|gamification|leaderboard|badges|points)\b", "/gamification", "Opening the Rewards Hub! 🏆"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(billing|subscription|premium|upgrade|plan)\b", "/billing", "Opening Billing & Premium plans! 💳"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(profile|settings|account)\b", "/profile", "Taking you to your Profile! ⚙️"),
            (r"\b(go to|navigate to|open|show|visit|take me to)\s+(dashboard|home|overview)\b", "/dashboard", "Returning to your Career Dashboard! 🏠")
        ]
        
        for pattern, route, res in nav_patterns:
            if re.search(pattern, msg_lower):
                return {"response": res, "navigate": route}
                
        return None

    def parse_intents(self, message: str, quick_action: Optional[str] = None) -> List[str]:
        """Detect modules mentioned in the prompt or explicit action tags to aggregate target context."""
        if quick_action:
            # Map quick action identifiers directly to target modules
            action_map = {
                "review-resume": ["resume"],
                "improve-ats": ["ats", "resume"],
                "mock-interview": ["interview", "resume"],
                "analyze-github": ["github"],
                "skill-gaps": ["resume", "ats"],
                "career-roadmap": ["resume", "ats"],
                "job-suggestions": ["resume", "ats"]
            }
            if quick_action in action_map:
                return action_map[quick_action]

        msg_lower = message.lower()
        intents = []
        
        if any(kw in msg_lower for kw in ["resume", "cv", "experience", "education", "profile", "work"]):
            intents.append("resume")
        if any(kw in msg_lower for kw in ["ats", "match", "score", "percentage", "job description", "jd"]):
            intents.append("ats")
        if any(kw in msg_lower for kw in ["github", "git", "repo", "contribution", "code base"]):
            intents.append("github")
        if any(kw in msg_lower for kw in ["interview", "mock", "practice", "question", "answer"]):
            intents.append("interview")
        if any(kw in msg_lower for kw in ["certificate", "cert", "verify"]):
            intents.append("certificates")
        if any(kw in msg_lower for kw in ["roadmap", "roadmap", "learn", "study", "pathway", "skill gap"]):
            intents.extend(["resume", "ats"]) # Roadmaps & Skill gaps require resume + ATS criteria

        return list(set(intents))

    async def compile_context(
        self,
        user_id: str,
        intents: List[str],
        db,
        resume_repo: ResumeRepository,
        result_repo: ResultRepository,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """Compile a combined dictionary of user status, fetching only required module items."""
        context = {}
        
        # Always fetch user info as core context
        context["user"] = {
            "id": user_id,
        }

        # 1. Resume
        if "resume" in intents:
            context["resume"] = await self._fetch_resume(user_id, resume_repo, force_refresh)
            
        # 2. ATS
        if "ats" in intents:
            context["ats"] = await self._fetch_ats(user_id, result_repo, force_refresh)
            
        # 3. GitHub
        if "github" in intents:
            context["github"] = await self._fetch_github(user_id, db, force_refresh)
            
        # 4. Interview
        if "interview" in intents:
            context["interview"] = await self._fetch_interview(user_id, db, force_refresh)
            
        # 5. Certificates
        if "certificates" in intents:
            context["certificates"] = await self._fetch_certificates(user_id, force_refresh)

        return context

    # --- Individual Cache-backed Fetchers ---

    async def _fetch_resume(self, user_id: str, resume_repo: ResumeRepository, force: bool) -> Optional[dict]:
        if not force:
            cached = self.cache.get(user_id, "resume")
            if cached is not None:
                return cached
        try:
            resumes, _ = await resume_repo.get_by_user(user_id, limit=1)
            data = None
            if resumes:
                latest = resumes[0]
                if latest.parsed_data:
                    parsed = latest.parsed_data
                    data = {
                        "filename": latest.original_filename or latest.filename,
                        "skills": parsed.skills[:15],
                        "technical_skills": parsed.technical_skills[:12],
                        "experience_years": parsed.total_experience_years,
                        "recent_roles": [exp.title for exp in (parsed.work_experience or [])[:3]],
                        "education": [edu.degree for edu in (parsed.education or [])[:2]]
                    }
            self.cache.set(user_id, "resume", data)
            return data
        except Exception as e:
            logger.warn("Failed to fetch resume context", error=str(e))
            return None

    async def _fetch_ats(self, user_id: str, result_repo: ResultRepository, force: bool) -> Optional[dict]:
        if not force:
            cached = self.cache.get(user_id, "ats")
            if cached is not None:
                return cached
        try:
            results, _ = await result_repo.get_results_by_user(user_id, limit=1)
            data = None
            if results:
                latest = results[0]
                data = {
                    "latest_score": latest.final_score,
                    "matched_keywords_count": len(latest.matched_keywords),
                    "missing_keywords_count": len(latest.missing_keywords),
                    "top_missing_keywords": latest.missing_keywords[:10],
                    "recommendation": latest.recommendation
                }
            self.cache.set(user_id, "ats", data)
            return data
        except Exception as e:
            logger.warn("Failed to fetch ATS context", error=str(e))
            return None

    async def _fetch_github(self, user_id: str, db, force: bool) -> Optional[dict]:
        if not force:
            cached = self.cache.get(user_id, "github")
            if cached is not None:
                return cached
        try:
            profile = await db.github_profiles.find_one({"user_id": user_id})
            data = None
            if profile:
                data = {
                    "username": profile.get("username"),
                    "public_repos": profile.get("public_repos"),
                    "followers": profile.get("followers"),
                    "contribution_score": profile.get("contribution_score"),
                    "detected_stack": profile.get("tech_stack", [])[:8]
                }
            self.cache.set(user_id, "github", data)
            return data
        except Exception as e:
            logger.warn("Failed to fetch GitHub context", error=str(e))
            return None

    async def _fetch_interview(self, user_id: str, db, force: bool) -> Optional[dict]:
        if not force:
            cached = self.cache.get(user_id, "interview")
            if cached is not None:
                return cached
        try:
            cursor = db.interview_sessions.find({"user_id": user_id}).sort("created_at", -1).limit(5)
            sessions = await cursor.to_list(length=5)
            data = None
            if sessions:
                avg_score = sum(s.get("avg_score", 0) for s in sessions) / len(sessions)
                data = {
                    "total_sessions": len(sessions),
                    "average_score": round(avg_score, 2),
                    "last_interview_role": sessions[0].get("job_title"),
                    "last_interview_difficulty": sessions[0].get("difficulty")
                }
            self.cache.set(user_id, "interview", data)
            return data
        except Exception as e:
            logger.warn("Failed to fetch Interview context", error=str(e))
            return None

    async def _fetch_certificates(self, user_id: str, force: bool) -> Optional[dict]:
        if not force:
            cached = self.cache.get(user_id, "certificates")
            if cached is not None:
                return cached
        try:
            records = await CertificateRecord.find_by_user(user_id, page_size=10)
            data = None
            if records:
                data = {
                    "total_certificates": len(records),
                    "list": [
                        {
                            "name": r.snapshot.get("assessment_name"),
                            "score": r.snapshot.get("score"),
                            "grade": r.snapshot.get("grade_label")
                        }
                        for r in records
                    ]
                }
            self.cache.set(user_id, "certificates", data)
            return data
        except Exception as e:
            logger.warn("Failed to fetch Certificates context", error=str(e))
            return None

    # --- Streaming Completers ---

    async def chat_copilot_stream(
        self,
        user_name: str,
        user_context: dict,
        message: str,
        history: List[dict]
    ) -> AsyncGenerator[str, None]:
        """Generator that streams assistant responses chunk by chunk."""
        
        # Build contextual instructions based on parsed data modules
        active_modules = [k for k, v in user_context.items() if k != "user" and v is not None]
        context_str = json.dumps(user_context, indent=2) if active_modules else "No active module context needed."

        system_prompt = f"""You are CareerShala AI Copilot, a premium, context-aware AI assistant designed to help candidates prepare for interviews, improve their resumes, optimize their ATS scores, analyze GitHub profiles, and navigate career roadmaps.

CANDIDATE INFORMATION:
- Name: {user_name}

DYNAMIC CONTEXT DETECTED (Modules: {", ".join(active_modules) if active_modules else "None"}):
{context_str}

GUIDELINES:
1. Be professional, supportive, encouraging, and highly actionable.
2. Keep responses concise, direct, and focused. Do NOT write long reports or generic summaries.
3. Recommend specific steps related to their details. If they have missing skills in their ATS data, suggest target learning projects.
4. Support clean Markdown formatting (bold, headers, bullet points, code blocks).
5. If the user asks about specific system operations (like practicing an interview, running a match, looking at certifications), direct them to navigate there (e.g., "visit the Interview Practice page under mock interviews" or "open the ATS Matcher results").
6. Never summarize resumes automatically unless asked.
7. Keep answer lengths between 2 to 5 sentences unless answering a detailed study gap or career roadmap request. Include TODOs where future AI expansion points are located.
"""

        # Map history roles to system models
        messages = [{"role": "system", "content": system_prompt}]
        for h in history[-8:]: # Last 8 messages to keep token window small
            role = "assistant" if h.get("role") == "bot" else "user"
            messages.append({"role": role, "content": h.get("text", "")})
        
        messages.append({"role": "user", "content": message})

        # Try to stream using configured providers
        if hasattr(settings, 'GROQ_API_KEY') and settings.GROQ_API_KEY:
            async for chunk in self._stream_groq(messages):
                yield chunk
        elif hasattr(settings, 'MISTRAL_API_KEY') and settings.MISTRAL_API_KEY:
            async for chunk in self._stream_mistral(messages):
                yield chunk
        elif settings.ANTHROPIC_API_KEY:
            async for chunk in self._stream_anthropic(system_prompt, messages):
                yield chunk
        elif settings.OPENAI_API_KEY:
            async for chunk in self._stream_openai(messages):
                yield chunk
        else:
            # Fallback template response streamed token by token
            fallback_text = (
                f"Hi {user_name}! I am CareerShala AI Copilot. It seems no LLM API keys are configured in your backend settings.\n\n"
                f"However, I was able to detect your message is related to the modules: **{', '.join(active_modules) if active_modules else 'General Info'}**.\n"
                "Please configure an API Key (Groq, Mistral, Anthropic, or OpenAI) to unlock the full intelligence of your Copilot!"
            )
            for word in fallback_text.split(" "):
                yield word + " "
                await time_sleep_async(0.06)

    # --- Provider SSE Stream Readers ---

    async def _stream_groq(self, messages: List[dict]) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    GROQ_BASE,
                    headers={
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": GROQ_MODEL,
                        "messages": messages,
                        "stream": True,
                        "temperature": 0.5,
                        "max_tokens": 1000
                    }
                ) as r:
                    async for line in r.aiter_lines():
                        if not line.strip():
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data["choices"][0]["delta"]
                                if "content" in delta:
                                    yield delta["content"]
                            except Exception:
                                pass
        except Exception as e:
            logger.error("Groq stream error", error=str(e))
            yield f"\n[System Error streaming response from Groq: {str(e)}]"

    async def _stream_mistral(self, messages: List[dict]) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    MISTRAL_BASE,
                    headers={
                        "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": MISTRAL_MODEL,
                        "messages": messages,
                        "stream": True,
                        "temperature": 0.5
                    }
                ) as r:
                    async for line in r.aiter_lines():
                        if not line.strip():
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data["choices"][0]["delta"]
                                if "content" in delta:
                                    yield delta["content"]
                            except Exception:
                                pass
        except Exception as e:
            logger.error("Mistral stream error", error=str(e))
            yield f"\n[System Error streaming response from Mistral: {str(e)}]"

    async def _stream_anthropic(self, system_prompt: str, messages: List[dict]) -> AsyncGenerator[str, None]:
        # Anthropic messages format splits system prompt into top level and requires a different format
        anthropic_messages = []
        for m in messages:
            if m["role"] == "system":
                continue
            anthropic_messages.append({"role": m["role"], "content": m["content"]})
            
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-haiku-20240307",
                        "max_tokens": 1000,
                        "system": system_prompt,
                        "messages": anthropic_messages,
                        "stream": True
                    }
                ) as r:
                    async for line in r.aiter_lines():
                        if not line.strip():
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            try:
                                data = json.loads(data_str)
                                if data.get("type") == "content_block_delta":
                                    yield data["delta"]["text"]
                            except Exception:
                                pass
        except Exception as e:
            logger.error("Anthropic stream error", error=str(e))
            yield f"\n[System Error streaming response from Anthropic: {str(e)}]"

    async def _stream_openai(self, messages: List[dict]) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-3.5-turbo",
                        "messages": messages,
                        "stream": True,
                        "max_tokens": 1000,
                        "temperature": 0.5
                    }
                ) as r:
                    async for line in r.aiter_lines():
                        if not line.strip():
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data["choices"][0]["delta"]
                                if "content" in delta:
                                    yield delta["content"]
                            except Exception:
                                pass
        except Exception as e:
            logger.error("OpenAI stream error", error=str(e))
            yield f"\n[System Error streaming response from OpenAI: {str(e)}]"


async def time_sleep_async(secs: float):
    import asyncio
    await asyncio.sleep(secs)
