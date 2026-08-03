"""
Application Configuration — Environment-driven settings via Pydantic v2
"""
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "AI Career Co-Pilot & Smart ATS Platform"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production)$")
    ENV: str = "development"
    # ── MongoDB ───────────────────────────────────────────────────────────────
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "ai_career_platform"
    MONGO_MAX_CONNECTIONS: int = 100
    MONGO_MIN_CONNECTIONS: int = 10

    # ── JWT ───────────────────────────────────────────────────────────────────
    # [SEC-001] No default value — must be set via environment variable.
    # Generate a secure key with: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://resume-screening-system-lyart.vercel.app",
        "https://careershala.tech",
        "https://www.careershala.tech",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [
            "http://localhost:3000",
            "http://localhost:5173",
            "https://resume-screening-system-lyart.vercel.app",
            "https://careershala.tech",
            "https://www.careershala.tech",
        ]

    # ── File Upload ───────────────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_FILE_TYPES: List[str] = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    UPLOAD_DIR: str = "./uploads"

    # ── Application Base URLs (Environment-aware) ──────────────────────────────
    APP_BASE_URL: str = Field(
        default_factory=lambda: os.getenv(
            "APP_BASE_URL",
            os.getenv("FRONTEND_URL", os.getenv("BASE_URL", "https://careershala.tech" if (os.getenv("RENDER") or os.getenv("VERCEL") or os.getenv("ENVIRONMENT") == "production") else "http://localhost:5173"))
        )
    )
    FRONTEND_URL: str = Field(
        default_factory=lambda: os.getenv(
            "FRONTEND_URL",
            os.getenv("APP_BASE_URL", "https://careershala.tech" if (os.getenv("RENDER") or os.getenv("VERCEL") or os.getenv("ENVIRONMENT") == "production") else "http://localhost:5173")
        )
    )
    BASE_URL: str = Field(
        default_factory=lambda: os.getenv(
            "BASE_URL",
            os.getenv("APP_BASE_URL", "https://careershala.tech" if (os.getenv("RENDER") or os.getenv("VERCEL") or os.getenv("ENVIRONMENT") == "production") else "http://localhost:5173")
        )
    )


# ── Cloudinary ───────────────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # ── Brevo HTTP API & Transactional Email Settings ───────────────────────
    BREVO_API_KEY: Optional[str] = None
    MAIL_FROM_EMAIL: Optional[str] = None
    MAIL_FROM_NAME: str = "CareerShala"
    SUPPORT_EMAIL: Optional[str] = None

    # Legacy SMTP Settings (kept for fallback compatibility)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = Field(default_factory=lambda: int(os.getenv("SMTP_PORT", 587)))
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "CareerShala"
    SMTP_USE_SSL: bool = Field(default_factory=lambda: os.getenv("SMTP_USE_SSL", "false").lower() == "true")


    # [SEC-002] No default values — must be set via environment variables.
    # Never commit test or live Razorpay keys to source control.
    RAZORPAY_KEY_ID: str = Field(...)
    RAZORPAY_KEY_SECRET: str = Field(...)

    # ── PDF Generation ──────────────────────────────────────────────────────────
    PDF_TIMEOUT_SECONDS: int = 60
    PUBLIC_PDF_URL_BASE: str = "https://resume-screening-system-hb2d.onrender.com/generated/"

    # ── NLP / ML ──────────────────────────────────────────────────────────────
    BERT_MODEL_NAME: str = "all-MiniLM-L6-v2"
    BERT_SCORE_WEIGHT: float = 0.6
    TFIDF_SCORE_WEIGHT: float = 0.4
    MAX_SEQUENCE_LENGTH: int = 512

    # ── GitHub ────────────────────────────────────────────────────────────────
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_API_BASE: str = "https://api.github.com"

    # ── AI/LLM ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = Field(default="anthropic", pattern="^(openai|anthropic|local)$")
    LLM_MAX_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.7

    # LinkedIn OAuth Settings
    LINKEDIN_CLIENT_ID: Optional[str] = None
    LINKEDIN_CLIENT_SECRET: Optional[str] = None

    LINKEDIN_REDIRECT_URI: str = Field(
        default_factory=lambda: os.getenv(
            "LINKEDIN_REDIRECT_URI",
            f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/linkedin-callback"
        )
    )

    # GitHub OAuth Settings
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None

    GITHUB_REDIRECT_URI: str = Field(
        default_factory=lambda: os.getenv(
            "GITHUB_REDIRECT_URI",
            f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/github-callback"
        )
    )

    # ── Certificates ──────────────────────────────────────────────────────────
    CERT_VERIFY_BASE_URL: Optional[str] = None
    CERT_ISSUER_NAME: str = "CareerShala"

    # ── Redis / Celery ────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ── Sentry ────────────────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ── Pagination ────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    GROQ_API_KEY: str | None = None
    MISTRAL_API_KEY: str | None = None
    GAMIFICATION_ENABLED: bool = True
    LEADERBOARD_SIZE: int = 50
    # [SEC-003] No default value — must be set via environment variable.
    # The Client ID from Google Cloud Console → Credentials → OAuth 2.0 Client ID.
    GOOGLE_CLIENT_ID: str = Field(...)

    # ── Google OAuth — Authorization Code Flow (Gmail offline access) ─────────
    # Required to exchange auth codes for refresh tokens. Get this from
    # Google Cloud Console → Credentials → OAuth 2.0 Client ID → Download JSON.
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    # The redirect URI registered in Google Cloud Console for the Gmail OAuth flow.
    # Must match EXACTLY (including http/https) with what's in Google Console.
    GOOGLE_GMAIL_REDIRECT_URI: str = Field(
        default_factory=lambda: os.getenv(
            "GOOGLE_GMAIL_REDIRECT_URI",
            f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/gmail-callback"
        )
    )

    # ── OTP / Email Verification (NEW) ────────────────────────────────────────
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_PER_HOUR: int = 100

    # ── Trusted Device / Login OTP (NEW) ───────────────────────────────────────
    TRUSTED_DEVICE_COOKIE_NAME: str = "device_id"
    TRUSTED_DEVICE_EXPIRE_DAYS: int = 30
    REQUIRE_OTP_FOR_NEW_DEVICE: bool = True
    LOGIN_CHALLENGE_EXPIRE_MINUTES: int = 10

    # ── Profile Photo Upload ────────────────────────────────────────────────────
    PROFILE_UPLOAD_DIR: str = "uploads/profile"
    PROFILE_MAX_SIZE_MB: int = 5
    PROFILE_ALLOWED_CONTENT_TYPES: List[str] = [
        "image/jpeg", "image/jpg", "image/png", "image/webp"
    ]
    PROFILE_IMAGE_MAX_DIMENSION: int = 1024  # px, longest side after compression
    STATIC_UPLOADS_URL_PREFIX: str = "/static/uploads"

    @field_validator("BERT_SCORE_WEIGHT", "TFIDF_SCORE_WEIGHT")
    @classmethod
    def weights_must_sum_to_one(cls, v, info):
        return v  # Checked at app startup

    @property
    def max_file_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def profile_max_bytes(self) -> int:
        return self.PROFILE_MAX_SIZE_MB * 1024 * 1024

    @property
    def smtp_from(self) -> str:
        return self.MAIL_FROM_EMAIL or self.SMTP_FROM_EMAIL or self.SMTP_USER or "no-reply@careershala.tech"

    @property
    def mail_sender(self) -> dict:
        email = self.MAIL_FROM_EMAIL or self.SMTP_FROM_EMAIL or self.SMTP_USER or "agrawalrohit937@gmail.com"
        name = self.MAIL_FROM_NAME or self.SMTP_FROM_NAME or "CareerShala"
        return {"name": name, "email": email}

    @property
    def cert_verify_base_url(self) -> str:
        if self.CERT_VERIFY_BASE_URL and "careershala.com" not in self.CERT_VERIFY_BASE_URL and "localhost" not in self.CERT_VERIFY_BASE_URL:
            return self.CERT_VERIFY_BASE_URL.rstrip("/")
        
        url_candidates = [self.CERT_VERIFY_BASE_URL, self.FRONTEND_URL, self.APP_BASE_URL, self.BASE_URL]
        base = None
        for candidate in url_candidates:
            if candidate and "localhost" not in candidate and "careershala.com" not in candidate:
                base = candidate.rstrip("/")
                break
        
        if not base:
            if self.ENVIRONMENT == "production" or os.getenv("RENDER") or os.getenv("VERCEL"):
                base = "https://careershala.tech"
            else:
                base = (self.APP_BASE_URL or self.FRONTEND_URL or "http://localhost:5173").rstrip("/")
                
        return f"{base}/verify"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()