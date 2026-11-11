"""
CareerShala Enterprise Repositories — Native PostgreSQL via SQLAlchemy 2.0.
"""

from repositories.user_repo import UserRepository
from repositories.job_repo import JobRepository
from repositories.resume_repo import ResumeRepository
from repositories.application_repo import ApplicationRepository
from repositories.career_application_repo import CareerApplicationRepository
from repositories.audit_log_repo import AuditLogRepository
from repositories.support_ticket_repo import SupportTicketRepository
from repositories.task_job_repo import TaskJobRepository
from repositories.revenue_recovery_repo import RevenueRecoveryRepository
from repositories.company_repo import CompanyRepository
from repositories.portfolio_repo import PortfolioRepository
from repositories.gamification_repo import GamificationRepository
from repositories.interview_kit_repo import InterviewKitRepository
from repositories.team_invite_repo import TeamInviteRepository
from repositories.certificate_repo import CertificateRepository
from repositories.analytics_repo import AnalyticsRepository

__all__ = [
    "UserRepository",
    "JobRepository",
    "ResumeRepository",
    "ApplicationRepository",
    "CareerApplicationRepository",
    "AuditLogRepository",
    "SupportTicketRepository",
    "TaskJobRepository",
    "RevenueRecoveryRepository",
    "CompanyRepository",
    "PortfolioRepository",
    "GamificationRepository",
    "InterviewKitRepository",
    "TeamInviteRepository",
    "CertificateRepository",
    "AnalyticsRepository",
]
