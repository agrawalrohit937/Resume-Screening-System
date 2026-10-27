"""
Application Configuration — Environment-driven settings via Pydantic v2
"""
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, List, Optional

from dotenv import load_dotenv
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_FILE_PATH.exists():
    load_dotenv(str(ENV_FILE_PATH))


def get_api_keys(prefix: str | List[str], count: int = 5, fallback: Optional[str] = None) -> List[str]:
    """Collect unique, non-empty, stripped API keys from numbered env vars and optional fallback."""
    prefixes = [prefix] if isinstance(prefix, str) else prefix
    keys: List[str] = []

    if fallback and (cleaned_fb := fallback.strip()) and cleaned_fb not in keys:
        keys.append(cleaned_fb)

    for p in prefixes:
        for i in range(1, count + 1):
            val = os.getenv(f"{p}_{i}")
            if val and (cleaned := val.strip()) and cleaned not in keys:
                keys.append(cleaned)

    return keys


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── 1. Application & URLs ──────────────────────────────────────────────────
    APP_NAME: str = "AI Career Co-Pilot & Smart ATS Platform"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:5173"

    # ── 2. Database (MongoDB) ──────────────────────────────────────────────────
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "ai_career_platform"
    MONGO_MAX_CONNECTIONS: int = 100
    MONGO_MIN_CONNECTIONS: int = 10

    # ── 3. Security & JWT ─────────────────────────────────────────────────────
    SECRET_KEY: str = Field(
        default="careershala-dev-secret-key-minimum-32-chars-long-for-local-recruiter-preview",
        min_length=32
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_PREVIOUS_SECRET_KEY: Optional[str] = None
    JWT_SECRET_ROTATION_ENABLED: bool = True
    CRON_SECRET: Optional[str] = None

    # ── 4. CORS ───────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = Field(default_factory=list)
    CORS_ORIGIN_REGEX: Optional[str] = None

    # ── 5. File & Upload Constraints ──────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 10
    MAX_PDF_PAGES: int = 15
    ALLOWED_FILE_TYPES: List[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    UPLOAD_DIR: str = "./uploads"

    # ── Rate Limits ───────────────────────────────────────────────────────────
    RATELIMIT_DEFAULT: str = "300/minute"
    RATELIMIT_ATS: str = "30/minute"
    RATELIMIT_RESUME: str = "20/minute"
    RATELIMIT_COPILOT: str = "30/minute"
    RATELIMIT_AUTH: str = "10/minute"
    RATELIMIT_ENHANCE: str = "20/minute"

    PROFILE_MAX_SIZE_MB: int = 5
    PROFILE_ALLOWED_CONTENT_TYPES: List[str] = [
        "image/jpeg", "image/jpg", "image/png", "image/webp"
    ]
    PROFILE_IMAGE_MAX_DIMENSION: int = 1024

    # ── 6. Cloudinary Storage ─────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # ── 7. Email Communications (Brevo API + Inboxes) ─────────────────────────
    BREVO_API_KEY: Optional[str] = None
    MAIL_FROM_EMAIL: Optional[str] = None
    MAIL_FROM_NAME: str = "CareerShala"
    ADMIN_EMAIL: Optional[str] = None
    SUPPORT_EMAIL: Optional[str] = None
    CAREERS_EMAIL: Optional[str] = None
    INFO_EMAIL: Optional[str] = None

    # ── 8. Payment Gateway (Razorpay) ─────────────────────────────────────────
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # ── 9. AI / LLM Providers ─────────────────────────────────────────────────
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None

    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    HF_TOKEN: Optional[str] = None

    # ── 10. OAuth Integrations ────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = Field(default="dev-google-client-id.apps.googleusercontent.com")
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_GMAIL_REDIRECT_URI: Optional[str] = None

    LINKEDIN_CLIENT_ID: Optional[str] = None
    LINKEDIN_CLIENT_SECRET: Optional[str] = None
    LINKEDIN_REDIRECT_URI: Optional[str] = None

    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_REDIRECT_URI: Optional[str] = None
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_API_BASE: str = "https://api.github.com"

    # ── 11. Security Verification & OTP ───────────────────────────────────────
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_PER_HOUR: int = 100

    TRUSTED_DEVICE_COOKIE_NAME: str = "device_id"
    TRUSTED_DEVICE_EXPIRE_DAYS: int = 30
    REQUIRE_OTP_FOR_NEW_DEVICE: bool = False
    LOGIN_CHALLENGE_EXPIRE_MINUTES: int = 10

    # ── 12. Certificates & Pagination ─────────────────────────────────────────
    CERT_VERIFY_BASE_URL: Optional[str] = None
    CERT_ISSUER_NAME: str = "CareerShala"
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # ── URL & Origin Normalization ────────────────────────────────────────────
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _parse_allowed_origins(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def _finalize_settings(self) -> "Settings":
        if self.FRONTEND_URL:
            self.FRONTEND_URL = self.FRONTEND_URL.strip().rstrip("/")

        default_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://localhost:8000",
            "https://careershala.tech",
            "https://www.careershala.tech",
        ]

        origins_set = set(self.ALLOWED_ORIGINS or [])
        origins_set.update(default_origins)

        if self.FRONTEND_URL:
            origins_set.add(self.FRONTEND_URL)
            if "://" in self.FRONTEND_URL:
                scheme, domain = self.FRONTEND_URL.split("://", 1)
                if domain.startswith("www."):
                    origins_set.add(f"{scheme}://{domain[4:]}")
                else:
                    origins_set.add(f"{scheme}://www.{domain}")

        self.ALLOWED_ORIGINS = sorted(list(origins_set))

        if not self.CORS_ORIGIN_REGEX:
            self.CORS_ORIGIN_REGEX = r"^https:\/\/(.*\.)?careershala\.tech$|^https:\/\/.*\.vercel\.app$"

        return self

    # ── Helper Properties ─────────────────────────────────────────────────────
    @property
    def max_file_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def profile_max_bytes(self) -> int:
        return self.PROFILE_MAX_SIZE_MB * 1024 * 1024

    @property
    def mail_sender(self) -> dict:
        email = self.MAIL_FROM_EMAIL or self.ADMIN_EMAIL or "notifications@localhost"
        name = self.MAIL_FROM_NAME or "Career Platform"
        return {"name": name, "email": email}

    @property
    def cert_verify_base_url(self) -> str:
        if self.CERT_VERIFY_BASE_URL:
            return self.CERT_VERIFY_BASE_URL.rstrip("/")
        return f"{self.FRONTEND_URL.rstrip('/')}/verify"

    @property
    def groq_api_keys(self) -> List[str]:
        return get_api_keys("GROQ_API_KEY", count=5, fallback=self.GROQ_API_KEY)

    @property
    def gemini_api_keys(self) -> List[str]:
        return get_api_keys(
            ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
            count=5,
            fallback=self.GEMINI_API_KEY or self.GOOGLE_API_KEY,
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()