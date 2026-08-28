"""
Dual-Provider LLM Key Pool & Rotation Manager
----------------------------------------------
Provides thread-safe round-robin key rotation and fallback logic for:
1. Groq API Key Pool (Groq LLM tasks: JD Analysis, Evaluation, Copilot, Questions, Enhancer)
2. Google Gemini API Key Pool (Gemini tasks: Email Generator, Cover Letter Generator)
"""

import os
import threading
import structlog
from typing import List, Optional, Callable, Any, Awaitable
from langchain_groq import ChatGroq
try:
    from google import genai
except ImportError:
    try:
        import google.generativeai as genai
    except ImportError:
        genai = None
from core.config import settings

logger = structlog.get_logger(__name__)


class GroqKeyPool:
    """Thread-safe pool and rotation manager for Groq API keys."""

    def __init__(self):
        self._lock = threading.Lock()
        self._index = 0

    def get_keys(self) -> List[str]:
        return settings.groq_api_keys

    def get_next_key(self) -> Optional[str]:
        keys = self.get_keys()
        if not keys:
            return None
        with self._lock:
            key = keys[self._index % len(keys)]
            self._index = (self._index + 1) % len(keys)
            return key

    def get_client(self, model_name: str = "openai/gpt-oss-120b", temperature: float = 0.7) -> ChatGroq:
        key = self.get_next_key()
        if not key:
            logger.warning("Groq API Key Pool is empty. ChatGroq initialized without key.")
        return ChatGroq(
            model_name=model_name,
            temperature=temperature,
            groq_api_key=key,
        )

    async def execute_async_with_fallback(self, coro_fn: Callable[[str], Awaitable[Any]]) -> Any:
        """Executes an async task taking a groq_api_key. If a rate-limit (429) or quota error occurs,
        automatically rotates to the next available Groq key in the pool."""
        keys = self.get_keys()
        if not keys:
            return await coro_fn(None)

        start_index = self._index % len(keys)
        last_exception = None

        for attempt in range(len(keys)):
            current_index = (start_index + attempt) % len(keys)
            key = keys[current_index]
            try:
                result = await coro_fn(key)
                with self._lock:
                    self._index = (current_index + 1) % len(keys)
                return result
            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = any(
                    term in err_str
                    for term in ["429", "rate limit", "rate_limit", "quota", "resourceexhausted", "too many requests"]
                )
                if is_rate_limit and len(keys) > 1:
                    logger.warning(
                        "Groq API key rate-limited or exhausted. Rotating to next key in pool...",
                        failed_key_prefix=key[:8] + "...",
                        attempt=attempt + 1,
                        total_keys=len(keys),
                        error=str(e),
                    )
                    last_exception = e
                    continue
                else:
                    raise e

        logger.error("All Groq API keys in pool failed or rate-limited.", total_keys=len(keys))
        if last_exception:
            raise last_exception


class GeminiKeyPool:
    """Thread-safe pool and rotation manager for Google Gemini API keys."""

    def __init__(self):
        self._lock = threading.Lock()
        self._index = 0

    def get_keys(self) -> List[str]:
        return settings.gemini_api_keys

    def get_next_key(self) -> Optional[str]:
        keys = self.get_keys()
        if not keys:
            return None
        with self._lock:
            key = keys[self._index % len(keys)]
            self._index = (self._index + 1) % len(keys)
            return key

    def get_client(self) -> Optional[genai.Client]:
        key = self.get_next_key()
        if not key:
            logger.warning("Gemini API Key Pool is empty.")
            return None
        return genai.Client(api_key=key)

    async def execute_async_with_fallback(self, coro_fn: Callable[[genai.Client], Awaitable[Any]]) -> Any:
        """Executes an async task using a Gemini Client. If 429 or quota error occurs,
        automatically rotates to the next available Gemini key in the pool."""
        keys = self.get_keys()
        if not keys:
            client = self.get_client()
            return await coro_fn(client)

        start_index = self._index % len(keys)
        last_exception = None

        for attempt in range(len(keys)):
            current_index = (start_index + attempt) % len(keys)
            key = keys[current_index]
            try:
                client = genai.Client(api_key=key)
                result = await coro_fn(client)
                with self._lock:
                    self._index = (current_index + 1) % len(keys)
                return result
            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = any(
                    term in err_str
                    for term in ["429", "rate limit", "rate_limit", "quota", "resourceexhausted", "too many requests"]
                )
                if is_rate_limit and len(keys) > 1:
                    logger.warning(
                        "Gemini API key rate-limited or exhausted. Rotating to next key in pool...",
                        failed_key_prefix=key[:8] + "...",
                        attempt=attempt + 1,
                        total_keys=len(keys),
                        error=str(e),
                    )
                    last_exception = e
                    continue
                else:
                    raise e

        logger.error("All Gemini API keys in pool failed or rate-limited.", total_keys=len(keys))
        if last_exception:
            raise last_exception

    def execute_sync_with_fallback(self, func: Callable[[genai.Client], Any]) -> Any:
        """Synchronous version of Gemini key rotation fallback."""
        keys = self.get_keys()
        if not keys:
            client = self.get_client()
            return func(client)

        start_index = self._index % len(keys)
        last_exception = None

        for attempt in range(len(keys)):
            current_index = (start_index + attempt) % len(keys)
            key = keys[current_index]
            try:
                client = genai.Client(api_key=key)
                result = func(client)
                with self._lock:
                    self._index = (current_index + 1) % len(keys)
                return result
            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = any(
                    term in err_str
                    for term in ["429", "rate limit", "rate_limit", "quota", "resourceexhausted", "too many requests"]
                )
                if is_rate_limit and len(keys) > 1:
                    logger.warning(
                        "Gemini API key rate-limited or exhausted. Rotating to next key in pool...",
                        failed_key_prefix=key[:8] + "...",
                        attempt=attempt + 1,
                        total_keys=len(keys),
                        error=str(e),
                    )
                    last_exception = e
                    continue
                else:
                    raise e

        logger.error("All Gemini API keys in pool failed or rate-limited.", total_keys=len(keys))
        if last_exception:
            raise last_exception


# Global Key Pool Instances
groq_key_pool = GroqKeyPool()
gemini_key_pool = GeminiKeyPool()


# Public Accessors
def get_groq_client(model_name: str = "openai/gpt-oss-120b", temperature: float = 0.7) -> ChatGroq:
    """Returns a ChatGroq client initialized with the next rotated key in the Groq pool."""
    return groq_key_pool.get_client(model_name=model_name, temperature=temperature)


def get_gemini_client() -> Optional[genai.Client]:
    """Returns a Google GenAI client initialized with the next rotated key in the Gemini pool."""
    return gemini_key_pool.get_client()


def get_next_groq_key() -> Optional[str]:
    """Returns the next rotated Groq API key string."""
    return groq_key_pool.get_next_key()


def get_next_gemini_key() -> Optional[str]:
    """Returns the next rotated Gemini API key string."""
    return gemini_key_pool.get_next_key()
