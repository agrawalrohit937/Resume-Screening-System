"""
CareerShala Unified Pydantic Schemas Package.
Centralized Data Transfer Objects (DTOs), API Requests, and Responses.
"""

from schemas.user_schema import (
    UserRole,
    ENTERPRISE_ROLES,
    UserStatus,
    AuthProvider,
    TrustedDevice,
    LinkedAccountProvider,
    UserModel,
    SignupRequest,
    LoginRequest,
    RefreshTokenRequest,
    ChangePasswordRequest,
    UpdateProfileRequest,
    UserPublicResponse,
    SetPrimaryResumeRequest,
    TokenResponse,
    MessageResponse,
    PaginatedResponse,
)

from schemas.job_schema import (
    WorkMode,
    JobStatus,
    JobModel,
    JobCreateRequest,
    JobResponse,
    CompanyProfilePayload,
    JobUpdateRequest,
)

from schemas.application_schema import (
    ApplicationStage,
    ApplicationStatus,
    CareerApplicationStatus,
    ApplicationModel,
    CareerApplicationModel,
    ApplicationCreateRequest,
    ApplicationResponse,
    ApplyDraftRequest,
    ApplyDraftResponse,
    ApplyDraftUpdateRequest,
    ApplySendRequest,
    ApplySendResponse,
    ApplyPreviewResponse,
    ApplicationHistoryItem,
    ApplicationHistoryResponse,
    ATSScoreRequest,
    ATSScoreResponse,
    JobDetailsExtractionResponse,
    new_application_document,
)

from schemas.resume_schema import (
    ResumeStatus,
    ContactInfo,
    WorkExperience,
    Education,
    Project,
    Certification,
    ParsedResumeData,
    ResumeModel,
    VerifiedLinks,
    ImpactMetric,
    UserVerifiedData,
)

from schemas.ats_schema import (
    SeniorityLevel,
    JobDescriptionModel,
    ATSResultModel,
    ATSMatchRequest,
    BulkATSMatchRequest,
    ATSMatchResponse,
)

from schemas.copilot_schema import (
    CopilotSessionModel,
    CopilotMessageModel,
    CopilotMemoryModel,
    CreateSessionPayload,
    UpdateSessionPayload,
    MessageFeedbackPayload,
    CopilotV2ChatPayload,
    MigrateLocalPayload,
    CopilotChunkModel,
    RetrievedChunk,
    CitationEvent,
)

from schemas.interview_schema import (
    RecommendationEnum,
    RECOMMENDATION_SCORES,
    Competency,
    InterviewKitModel,
    ScorecardModel,
    CalibrationReport,
    SessionStatus,
    DifficultyLevel,
    CheatingEventType,
    CheatingEventRecord,
    QuestionAnswer,
    InterviewSession,
)

from schemas.portfolio_schema import (
    MetricModel,
    ProjectHighlight,
    SkillCategoryModel,
    PortfolioProject,
    PortfolioExperience,
    PortfolioEducation,
    PortfolioProfileModel,
    PortfolioAnalyticsModel,
    ContactMessageSchema,
)

from schemas.otp_schema import (
    OTPPurpose,
    OTPModel,
    VerifyEmailRequest,
    ResendOtpRequest,
    ForgotPasswordRequest,
    VerifyResetOtpRequest,
    ResetPasswordRequest,
    VerifyLoginOtpRequest,
    LoginChallengeResponse,
    OtpMessageResponse,
)

from schemas.team_schema import (
    TeamInviteRequest,
    TeamInviteResponse,
    AcceptInviteRequest,
    VerifyInviteResponse,
)

from schemas.requisition_schema import (
    RequisitionStatus,
    ApprovalDecision,
    ApprovalStep,
    RequisitionModel,
)

from schemas.eeo_schema import (
    EEOGender,
    EEORaceEthnicity,
    EEOVeteranStatus,
    EEODisabilityStatus,
    EEOSelfIdentificationPayload,
    EEOSelfIdentificationRecord,
)

from schemas.audit_schema import (
    AuditAction,
    AuditResourceType,
    AuditLogModel,
)

from schemas.support_schema import (
    TicketAttachment,
    TicketMessage,
    TicketStatusChange,
    SupportTicketModel,
)

from schemas.revenue_recovery_schema import (
    RecoveryStatus,
    RiskLevel,
    RecoveryStrategy,
    RecoveryChannel,
    ActorType,
    AuditLogEntry,
    VoiceMessage,
    VoiceRecoveryData,
    WinBackOffer,
    RecoveryCaseModel,
)

from schemas.task_job_schema import (
    JobStatus as TaskJobStatus,
    JobType as TaskJobType,
    TaskJobModel,
)

from schemas.credential_schema import Credential
from schemas.cron_schema import (
    CronRunStatus,
    DeliveryStatus,
    CronJobRunModel,
    JobAlertDeliveryModel,
)

