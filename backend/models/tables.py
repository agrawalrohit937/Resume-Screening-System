"""
SQLAlchemy 2.0 Declarative Models for CareerShala PostgreSQL Migration.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Float,
    DateTime,
    Text,
    Index,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from config.db import Base


def gen_uuid_str() -> str:
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc)


# ─── 1. User Entity ────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="candidate", index=True)
    roles = Column(JSONB, default=lambda: ["candidate"])
    status = Column(String(50), nullable=False, default="active", index=True)
    tenant_id = Column(String(64), nullable=True, index=True)
    is_invited_staff = Column(Boolean, default=False)
    invited_by = Column(String(64), nullable=True)
    company_name = Column(String(255), nullable=True)

    # Subscription / Premium
    plan = Column(String(50), default="free")
    subscription_active = Column(Boolean, default=False)
    subscription_status = Column(String(50), default="expired")
    subscription_start_date = Column(DateTime(timezone=True), nullable=True)
    subscription_end_date = Column(DateTime(timezone=True), nullable=True)
    plan_updated_at = Column(DateTime(timezone=True), default=now_utc)
    payment_history = Column(JSONB, default=list)

    # Profile & Media
    profile_picture = Column(Text, nullable=True)
    profile_picture_public_id = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    linkedin_url = Column(Text, nullable=True)
    github_username = Column(String(255), nullable=True)
    total_resumes = Column(Integer, default=0)
    total_ats_checks = Column(Integer, default=0)
    last_login = Column(DateTime(timezone=True), nullable=True)
    refresh_token = Column(Text, nullable=True)

    # Gmail OAuth
    gmail_access_token = Column(Text, nullable=True)
    gmail_refresh_token = Column(Text, nullable=True)
    gmail_token_expiry = Column(DateTime(timezone=True), nullable=True)

    # Multi-provider Auth
    auth_method = Column(String(50), nullable=True)
    provider = Column(String(50), default="email")
    email_verified = Column(Boolean, default=False)
    google_picture = Column(Text, nullable=True)
    auth_methods = Column(JSONB, default=list)
    last_login_method = Column(String(50), nullable=True)
    linked_accounts = Column(JSONB, default=dict)

    # Extended Profile
    college = Column(String(255), nullable=True)
    degree = Column(String(255), nullable=True)
    graduation_year = Column(Integer, nullable=True)
    location = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    github_url = Column(Text, nullable=True)
    portfolio_url = Column(Text, nullable=True)
    portfolio_slug = Column(String(255), unique=True, nullable=True, index=True)
    is_portfolio_published = Column(Boolean, default=False)
    profile_resume_url = Column(Text, nullable=True)
    profile_resume_name = Column(String(255), nullable=True)

    # Security
    trusted_devices = Column(JSONB, default=list)

    # Job Alerts
    job_alerts_enabled = Column(Boolean, default=True)
    last_alert_slot = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # ── User Relationships ──────────────────────────────────────────────────
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    candidate_applications = relationship("CandidateApplication", foreign_keys="CandidateApplication.candidate_id", back_populates="candidate", cascade="all, delete-orphan")
    posted_jobs = relationship("Job", foreign_keys="Job.created_by", back_populates="creator")
    copilot_sessions = relationship("CopilotSession", back_populates="user", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    gamification = relationship("UserGamification", back_populates="user", uselist=False, cascade="all, delete-orphan")


# ─── 2. Job Entity ─────────────────────────────────────────────────────────────
class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    company_name = Column(Text, nullable=False)
    title = Column(Text, nullable=False, index=True)
    jd_text_raw = Column(Text, nullable=False)
    required_skills = Column(JSONB, default=list)
    min_years = Column(Float, default=0.0)
    location = Column(Text, default="Remote", index=True)
    work_mode = Column(String(50), default="Remote")
    salary_range = Column(Text, nullable=True)
    status = Column(String(50), default="open", index=True)
    jd_embedding = Column(JSONB, default=list)
    department = Column(Text, nullable=True)
    company_logo = Column(Text, nullable=True)
    company_website = Column(Text, nullable=True)
    company_about = Column(Text, nullable=True)
    company_size = Column(Text, nullable=True)
    is_external = Column(Boolean, default=False)
    external_apply_url = Column(Text, nullable=True)
    external_job_id = Column(Text, nullable=True)
    created_by = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    applicant_count = Column(Integer, default=0)
    education_requirement_mode = Column(String(50), default="preferred")
    required_credentials = Column(JSONB, default=list)

    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # ── Job Relationships ────────────────────────────────────────────────────
    creator = relationship("User", foreign_keys=[created_by], back_populates="posted_jobs")
    applications = relationship("CandidateApplication", back_populates="job", cascade="all, delete-orphan")
    interview_kits = relationship("InterviewKit", back_populates="job", cascade="all, delete-orphan")


# ─── 3. Resume Entity ──────────────────────────────────────────────────────────
class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    filename = Column(Text, nullable=False)
    original_filename = Column(Text, nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    storage_path = Column(Text, nullable=False)
    file_url = Column(Text, nullable=True)
    cloudinary_public_id = Column(Text, nullable=True)
    status = Column(String(50), default="pending", index=True)
    parsed_data = Column(JSONB, nullable=True)
    parse_error = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    ats_score_history = Column(JSONB, default=list)
    tags = Column(JSONB, default=list)
    is_primary = Column(Boolean, default=False)
    version = Column(Integer, default=1)

    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # ── Resume Relationships ─────────────────────────────────────────────────
    user = relationship("User", back_populates="resumes")
    applications = relationship("CandidateApplication", back_populates="resume")
    ats_results = relationship("ATSResult", back_populates="resume", cascade="all, delete-orphan")


# ─── 4. Job Description & ATS Results ──────────────────────────────────────────
class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    company = Column(Text, nullable=True)
    description = Column(Text, nullable=False)
    required_skills = Column(JSONB, default=list)
    preferred_skills = Column(JSONB, default=list)
    experience_years_min = Column(Float, nullable=True)
    experience_years_max = Column(Float, nullable=True)
    seniority_level = Column(String(50), nullable=True)
    location = Column(Text, nullable=True)
    remote = Column(Boolean, default=False)
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    industry = Column(Text, nullable=True)
    raw_text = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)

    user = relationship("User")


class ATSResult(Base):
    __tablename__ = "ats_results"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    resume_id = Column(String(64), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    job_description_id = Column(String(64), nullable=False, index=True)

    final_score = Column(Float, default=0.0)
    experience_score = Column(Float, default=0.0)
    education_score = Column(Float, default=0.0)
    matched_skills = Column(JSONB, default=list)
    missing_skills = Column(JSONB, default=list)
    breakdown = Column(JSONB, default=dict)
    detailed_analysis = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)

    user = relationship("User")
    resume = relationship("Resume", back_populates="ats_results")


# ─── 5. Applications (AI Apply Assistant & Careers Page) ───────────────────────
class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resume_id = Column(String(64), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    job_title = Column(String(255), nullable=False)
    hr_email = Column(String(255), nullable=False)
    job_description = Column(Text, nullable=False)
    jd_analysis = Column(JSONB, nullable=True)
    ats_result_ref = Column(JSONB, nullable=True)
    generated_draft = Column(JSONB, nullable=True)
    edited_draft = Column(JSONB, nullable=True)
    cover_letter_pdf_path = Column(Text, nullable=True)
    status = Column(String(50), default="draft", index=True)
    needs_manual_review = Column(Boolean, default=False)
    send_metadata = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User")
    resume = relationship("Resume")


class CareerApplication(Base):
    __tablename__ = "career_applications"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    applicant_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    role_title = Column(String(255), nullable=False)
    portfolio_url = Column(Text, nullable=True)
    resume_url = Column(Text, nullable=True)
    resume_filename = Column(String(255), nullable=True)
    resume_public_id = Column(String(255), nullable=True)
    cover_letter = Column(Text, nullable=False)
    status = Column(String(50), default="applied", index=True)
    admin_notes = Column(Text, nullable=True)
    email_sent = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class CandidateApplication(Base):
    __tablename__ = "candidate_applications"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    job_id = Column(String(64), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resume_id = Column(String(64), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    match_score = Column(Float, nullable=True)
    quality_score = Column(Float, nullable=True)
    stage = Column(String(50), default="Applied", index=True)
    candidate_name = Column(String(255), nullable=True)
    candidate_email = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    details = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # ── CandidateApplication Relationships ──────────────────────────────────
    job = relationship("Job", back_populates="applications")
    candidate = relationship("User", foreign_keys=[candidate_id], back_populates="candidate_applications")
    resume = relationship("Resume", back_populates="applications")
    scorecards = relationship("Scorecard", back_populates="application", cascade="all, delete-orphan")


# ─── 6. OTP & Security Verification ───────────────────────────────────────────
class OTP(Base):
    __tablename__ = "otps"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    email = Column(String(255), nullable=False, index=True)
    purpose = Column(String(50), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    consumed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)


# ─── 7. Organization, Team & Talent ───────────────────────────────────────────
class TeamInvite(Base):
    __tablename__ = "team_invites"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    invited_by = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(String(50), default="pending", index=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    inviter = relationship("User")


class Requisition(Base):
    __tablename__ = "requisitions"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    department = Column(String(255), nullable=True)
    hiring_manager_id = Column(String(64), nullable=True, index=True)
    status = Column(String(50), default="draft", index=True)
    data = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class TalentPoolProfile(Base):
    __tablename__ = "talent_pool_profiles"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    candidate_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    opted_in = Column(Boolean, default=False, index=True)
    visibility_tier = Column(String(50), default="public")
    years_experience = Column(Float, default=0.0)
    profile_data = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    candidate = relationship("User")


# ─── 8. Audit Logs, Support & System ───────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    event_id = Column(String(64), nullable=True, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    actor_id = Column(String(64), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    target_id = Column(String(64), nullable=True, index=True)
    payload = Column(JSONB, default=dict)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    ticket_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), default="general")
    status = Column(String(50), default="open", index=True)
    priority = Column(String(50), default="medium")
    thread = Column(JSONB, default=list)
    metadata_info = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User")


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(String(64), primary_key=True)
    certificate_type = Column(String(100), nullable=False)
    template_used = Column(String(100), nullable=False)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_name = Column(String(255), nullable=False)
    snapshot = Column(JSONB, default=dict)
    status = Column(String(50), default="active", index=True)
    issued_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    public_url = Column(Text, default="")
    topic = Column(String(255), nullable=True, index=True)
    superseded_by = Column(String(64), nullable=True)
    superseded_at = Column(DateTime(timezone=True), nullable=True)
    schema_version = Column(Integer, default=1)

    user = relationship("User", back_populates="certificates")


# ─── 9. Copilot v2 & Conversational Memory ────────────────────────────────────
class CopilotSession(Base):
    __tablename__ = "copilot_sessions"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), default="default", index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="New Conversation")
    last_message_preview = Column(Text, nullable=True)
    message_count = Column(Integer, default=0)
    pinned = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)
    total_tokens = Column(Integer, default=0)
    total_cost_usd = Column(Float, default=0.0)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User", back_populates="copilot_sessions")
    messages = relationship("CopilotMessage", back_populates="session", cascade="all, delete-orphan", foreign_keys="CopilotMessage.session_id")


class CopilotMessage(Base):
    __tablename__ = "copilot_messages"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    session_id = Column(String(64), ForeignKey("copilot_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    content = Column(Text, default="")
    ui_cards = Column(JSONB, default=list)
    citations = Column(JSONB, default=list)
    tool_calls = Column(JSONB, default=list)
    model_used = Column(String(100), nullable=True)
    provider_used = Column(String(50), nullable=True)
    latency_ms = Column(Integer, nullable=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    feedback = Column(String(20), nullable=True)
    feedback_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)

    session = relationship("CopilotSession", back_populates="messages", foreign_keys=[session_id])
    user = relationship("User")


class CopilotMemory(Base):
    __tablename__ = "copilot_memory"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), default="default", index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String(255), nullable=False, index=True)
    value = Column(Text, nullable=False)
    source_message_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User")


# ─── 10. Background Task Jobs ─────────────────────────────────────────────────
class TaskJob(Base):
    __tablename__ = "task_jobs"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    job_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    user_id = Column(String(64), nullable=True, index=True)
    type = Column(String(100), nullable=False)
    status = Column(String(50), default="queued", index=True)
    progress = Column(Integer, default=0)
    stage_message = Column(Text, nullable=True)
    result_ref = Column(JSONB, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)


# ─── 11. Revenue Recovery ────────────────────────────────────────────────────
class RevenueRecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    case_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    user_email = Column(String(255), nullable=True)
    user_name = Column(String(255), nullable=True)
    plan = Column(String(50), default="pro")
    amount_due_inr = Column(Float, default=0.0)
    status = Column(String(50), default="initiated", index=True)
    strategy = Column(String(50), default="gentle")
    current_step = Column(Integer, default=0)
    attempts = Column(JSONB, default=list)
    audit_trail = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    recovered_at = Column(DateTime(timezone=True), nullable=True)
    stopped_at = Column(DateTime(timezone=True), nullable=True)


# ─── 12. Companies & Employer Branding ─────────────────────────────────────────
class Company(Base):
    __tablename__ = "companies"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    tagline = Column(Text, nullable=True)
    logo_url = Column(Text, nullable=True)
    cover_url = Column(Text, nullable=True)
    website = Column(Text, nullable=True)
    location = Column(Text, nullable=True)
    industry = Column(Text, nullable=True)
    team_size = Column(Text, nullable=True)
    about = Column(Text, nullable=True)
    perks = Column(JSONB, default=list)
    linkedin = Column(Text, nullable=True)
    github = Column(Text, nullable=True)
    twitter = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


# ─── 13. User Portfolio & Profiles ─────────────────────────────────────────────
class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    username = Column(String(255), nullable=False, unique=True, index=True)
    full_name = Column(String(255), nullable=False)
    headline = Column(Text, default="Software Developer")
    bio = Column(Text, nullable=True)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)
    avatar_url = Column(Text, nullable=True)
    resume_file_url = Column(Text, nullable=True)
    show_resume_publicly = Column(Boolean, default=False)
    hero_badge = Column(String(255), default="Open to Opportunities")
    typing_roles = Column(JSONB, default=list)
    hero_metrics = Column(JSONB, default=list)
    social_links = Column(JSONB, default=dict)
    skills = Column(JSONB, default=dict)
    projects = Column(JSONB, default=list)
    experience = Column(JSONB, default=list)
    education = Column(JSONB, default=list)
    theme_id = Column(String(100), default="glassmorphic_pro")
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User", back_populates="profile")


class PortfolioAnalytics(Base):
    __tablename__ = "portfolio_analytics"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    username = Column(String(255), nullable=False, unique=True, index=True)
    total_views = Column(Integer, default=0)
    resume_downloads = Column(Integer, default=0)
    contact_clicks = Column(Integer, default=0)
    views_by_date = Column(JSONB, default=dict)
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


# ─── 14. Structured Interviews & Scorecards ────────────────────────────────────
class InterviewKit(Base):
    __tablename__ = "interview_kits"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), default="default", index=True)
    job_id = Column(String(64), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_name = Column(String(100), nullable=False)
    competencies = Column(JSONB, default=list)
    standard_questions = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    job = relationship("Job", back_populates="interview_kits")


class Scorecard(Base):
    __tablename__ = "scorecards"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), default="default", index=True)
    application_id = Column(String(64), ForeignKey("candidate_applications.id", ondelete="CASCADE"), nullable=True, index=True)
    candidate_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    interviewer_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_name = Column(String(100), nullable=False)
    ratings = Column(JSONB, default=dict)
    recommendation = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    application = relationship("CandidateApplication", back_populates="scorecards")
    candidate = relationship("User", foreign_keys=[candidate_id])
    interviewer = relationship("User", foreign_keys=[interviewer_id])


# ─── 15. User Gamification ────────────────────────────────────────────────────
class UserGamification(Base):
    __tablename__ = "user_gamification"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    total_points = Column(Integer, default=0, index=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    interviews_completed = Column(Integer, default=0)
    questions_answered = Column(Integer, default=0)
    average_score = Column(Float, default=0.0)
    best_score = Column(Float, default=0.0)
    badges = Column(JSONB, default=list)
    active_dates = Column(JSONB, default=list)
    last_practice_date = Column(String(50), nullable=True)
    last_daily_reward_date = Column(String(50), nullable=True)
    recent_points = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User", back_populates="gamification")


# ─── 16. Cron & Job Alert Deliveries ──────────────────────────────────────────
class CronJobRun(Base):
    __tablename__ = "cron_job_runs"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    job_name = Column(String(100), default="job_alerts", index=True)
    slot_id = Column(String(100), nullable=False, index=True)
    slot_type = Column(String(50), default="morning")
    status = Column(String(50), default="running", index=True)
    started_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    candidates_scanned = Column(Integer, default=0)
    candidates_claimed = Column(Integer, default=0)
    emails_delivered = Column(Integer, default=0)
    emails_uncertain = Column(Integer, default=0)
    emails_failed_permanent = Column(Integer, default=0)
    retries_count = Column(Integer, default=0)
    triggered_by = Column(String(50), default="scheduler")
    sample_deliveries = Column(JSONB, default=list)
    error_summary = Column(Text, nullable=True)


class JobAlertDelivery(Base):
    __tablename__ = "job_alert_deliveries"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    candidate_id = Column(String(64), nullable=False, index=True)
    slot_id = Column(String(100), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    status = Column(String(50), default="CLAIMED", index=True)
    matched_job_ids = Column(JSONB, default=list)
    brevo_message_id = Column(Text, nullable=True)
    attempt_count = Column(Integer, default=1)
    claimed_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)


# ─── 17. EEO Compliance Self-Identification ────────────────────────────────────
class EeoResponse(Base):
    __tablename__ = "eeo_responses"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    candidate_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), default="default", index=True)
    gender = Column(String(50), nullable=True)
    race_ethnicity = Column(String(100), nullable=True)
    veteran_status = Column(String(100), nullable=True)
    disability_status = Column(String(100), nullable=True)
    application_id = Column(String(64), nullable=True, index=True)
    job_id = Column(String(64), nullable=True, index=True)
    submitted_at = Column(DateTime(timezone=True), default=now_utc, index=True)


# ─── 18. Security Tokens & Revocations ─────────────────────────────────────────
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    family_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti = Column(String(255), nullable=True, index=True)
    used = Column(Boolean, default=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    jti = Column(String(255), nullable=False, unique=True, index=True)
    revoked_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    reason = Column(String(100), default="logout")


# ─── 19. Webhook Subscriptions ────────────────────────────────────────────────
class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    tenant_id = Column(String(64), default="default", index=True)
    url = Column(Text, nullable=False)
    events = Column(JSONB, default=list)
    secret = Column(Text, nullable=True)
    status = Column(String(50), default="active", index=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


# ─── 20. Distributed Locks ────────────────────────────────────────────────────
class DistributedLockModel(Base):
    __tablename__ = "distributed_locks"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    lock_key = Column(String(255), unique=True, nullable=False, index=True)
    owner = Column(String(255), nullable=False)
    acquired_at = Column(Float, nullable=False)
    expires_at = Column(Float, nullable=False)


# ─── 21. Live Interview Sessions ──────────────────────────────────────────────
class InterviewSessionModel(Base):
    __tablename__ = "interview_sessions"

    id = Column(String(64), primary_key=True, default=gen_uuid_str)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    job_title = Column(String(255), nullable=True)
    difficulty = Column(String(50), default="medium")
    interview_type = Column(String(50), default="mixed")
    status = Column(String(50), default="pending", index=True)
    questions = Column(JSONB, default=list)
    answers = Column(JSONB, default=list)
    cheating_events = Column(JSONB, default=list)
    cheating_score = Column(Float, default=0.0)
    warning_count = Column(Integer, default=0)
    session_aborted = Column(Boolean, default=False)
    abort_reason = Column(Text, nullable=True)
    overall_score = Column(Float, nullable=True)
    avg_confidence = Column(Float, nullable=True)
    avg_clarity = Column(Float, nullable=True)
    avg_relevance = Column(Float, nullable=True)
    total_filler_words = Column(Integer, default=0)
    total_time_secs = Column(Integer, default=0)
    improvement_summary = Column(Text, nullable=True)
    strength_areas = Column(JSONB, default=list)
    weakness_areas = Column(JSONB, default=list)
    is_employer_scheduled = Column(Boolean, default=False)
    magic_token = Column(String(255), nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    employer_id = Column(String(64), nullable=True, index=True)
    employer_name = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    job_id = Column(String(64), nullable=True, index=True)
    full_job_description = Column(Text, nullable=True)
    custom_questions = Column(JSONB, default=list)
    candidate_email = Column(String(255), nullable=True, index=True)
    candidate_name = Column(String(255), nullable=True)
    application_id = Column(String(64), nullable=True, index=True)
    magic_link_url = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User")


class UserNotificationState(Base):
    __tablename__ = "user_notification_states"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False, unique=True)
    read_ids = Column(JSONB, default=list)
    dismissed_ids = Column(JSONB, default=list)
    cleared_at = Column(DateTime(timezone=True), nullable=True)
    all_read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User")

