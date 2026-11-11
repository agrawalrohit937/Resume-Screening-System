"""add_foreign_keys_and_relationships

Revision ID: f5a192b43e81
Revises: d280236b5dec
Create Date: 2026-11-10 22:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5a192b43e81'
down_revision: Union[str, Sequence[str], None] = 'd280236b5dec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enforce relational foreign key constraints with cascade rules."""
    # Resumes -> Users
    op.create_foreign_key(
        'fk_resumes_users', 'resumes', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # Jobs -> Users (creator)
    op.create_foreign_key(
        'fk_jobs_users', 'jobs', 'users', ['created_by'], ['id'], ondelete='SET NULL'
    )
    # Job Descriptions -> Users
    op.create_foreign_key(
        'fk_job_descriptions_users', 'job_descriptions', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # ATS Results -> Users & Resumes
    op.create_foreign_key(
        'fk_ats_results_users', 'ats_results', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_ats_results_resumes', 'ats_results', 'resumes', ['resume_id'], ['id'], ondelete='CASCADE'
    )
    # Job Applications -> Users & Resumes
    op.create_foreign_key(
        'fk_job_applications_users', 'job_applications', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_job_applications_resumes', 'job_applications', 'resumes', ['resume_id'], ['id'], ondelete='CASCADE'
    )
    # Candidate Applications -> Jobs, Users & Resumes
    op.create_foreign_key(
        'fk_candidate_applications_jobs', 'candidate_applications', 'jobs', ['job_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_candidate_applications_users', 'candidate_applications', 'users', ['candidate_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_candidate_applications_resumes', 'candidate_applications', 'resumes', ['resume_id'], ['id'], ondelete='SET NULL'
    )
    # Team Invites -> Users
    op.create_foreign_key(
        'fk_team_invites_users', 'team_invites', 'users', ['invited_by'], ['id'], ondelete='CASCADE'
    )
    # Talent Pool -> Users
    op.create_foreign_key(
        'fk_talent_pool_profiles_users', 'talent_pool_profiles', 'users', ['candidate_id'], ['id'], ondelete='CASCADE'
    )
    # Support Tickets -> Users
    op.create_foreign_key(
        'fk_support_tickets_users', 'support_tickets', 'users', ['user_id'], ['id'], ondelete='SET NULL'
    )
    # Certificates -> Users
    op.create_foreign_key(
        'fk_certificates_users', 'certificates', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # Copilot Sessions -> Users
    op.create_foreign_key(
        'fk_copilot_sessions_users', 'copilot_sessions', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # Copilot Messages -> Copilot Sessions & Users
    op.create_foreign_key(
        'fk_copilot_messages_sessions', 'copilot_messages', 'copilot_sessions', ['session_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_copilot_messages_users', 'copilot_messages', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # Copilot Memory -> Users
    op.create_foreign_key(
        'fk_copilot_memory_users', 'copilot_memory', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # User Profiles -> Users
    op.create_foreign_key(
        'fk_user_profiles_users', 'user_profiles', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # Interview Kits -> Jobs
    op.create_foreign_key(
        'fk_interview_kits_jobs', 'interview_kits', 'jobs', ['job_id'], ['id'], ondelete='CASCADE'
    )
    # Scorecards -> Candidate Applications & Users
    op.create_foreign_key(
        'fk_scorecards_applications', 'scorecards', 'candidate_applications', ['application_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_scorecards_candidates', 'scorecards', 'users', ['candidate_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_scorecards_interviewers', 'scorecards', 'users', ['interviewer_id'], ['id'], ondelete='CASCADE'
    )
    # User Gamification -> Users
    op.create_foreign_key(
        'fk_user_gamification_users', 'user_gamification', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # Refresh Tokens -> Users
    op.create_foreign_key(
        'fk_refresh_tokens_users', 'refresh_tokens', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # Interview Sessions -> Users
    op.create_foreign_key(
        'fk_interview_sessions_users', 'interview_sessions', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    # User Notification States -> Users
    op.create_foreign_key(
        'fk_user_notification_states_users', 'user_notification_states', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    """Drop foreign key constraints."""
    op.drop_constraint('fk_user_notification_states_users', 'user_notification_states', type_='foreignkey')
    op.drop_constraint('fk_interview_sessions_users', 'interview_sessions', type_='foreignkey')
    op.drop_constraint('fk_refresh_tokens_users', 'refresh_tokens', type_='foreignkey')
    op.drop_constraint('fk_user_gamification_users', 'user_gamification', type_='foreignkey')
    op.drop_constraint('fk_scorecards_interviewers', 'scorecards', type_='foreignkey')
    op.drop_constraint('fk_scorecards_candidates', 'scorecards', type_='foreignkey')
    op.drop_constraint('fk_scorecards_applications', 'scorecards', type_='foreignkey')
    op.drop_constraint('fk_interview_kits_jobs', 'interview_kits', type_='foreignkey')
    op.drop_constraint('fk_user_profiles_users', 'user_profiles', type_='foreignkey')
    op.drop_constraint('fk_copilot_memory_users', 'copilot_memory', type_='foreignkey')
    op.drop_constraint('fk_copilot_messages_users', 'copilot_messages', type_='foreignkey')
    op.drop_constraint('fk_copilot_messages_sessions', 'copilot_messages', type_='foreignkey')
    op.drop_constraint('fk_copilot_sessions_users', 'copilot_sessions', type_='foreignkey')
    op.drop_constraint('fk_certificates_users', 'certificates', type_='foreignkey')
    op.drop_constraint('fk_support_tickets_users', 'support_tickets', type_='foreignkey')
    op.drop_constraint('fk_talent_pool_profiles_users', 'talent_pool_profiles', type_='foreignkey')
    op.drop_constraint('fk_team_invites_users', 'team_invites', type_='foreignkey')
    op.drop_constraint('fk_candidate_applications_resumes', 'candidate_applications', type_='foreignkey')
    op.drop_constraint('fk_candidate_applications_users', 'candidate_applications', type_='foreignkey')
    op.drop_constraint('fk_candidate_applications_jobs', 'candidate_applications', type_='foreignkey')
    op.drop_constraint('fk_job_applications_resumes', 'job_applications', type_='foreignkey')
    op.drop_constraint('fk_job_applications_users', 'job_applications', type_='foreignkey')
    op.drop_constraint('fk_ats_results_resumes', 'ats_results', type_='foreignkey')
    op.drop_constraint('fk_ats_results_users', 'ats_results', type_='foreignkey')
    op.drop_constraint('fk_job_descriptions_users', 'job_descriptions', type_='foreignkey')
    op.drop_constraint('fk_jobs_users', 'jobs', type_='foreignkey')
    op.drop_constraint('fk_resumes_users', 'resumes', type_='foreignkey')

