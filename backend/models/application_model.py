"""
Domain model for the AI Apply Assistant module.

Follows the models/ vs schemas/ split already used in this codebase:
models/ = enums + plain dict "document builders" for the repository layer,
schemas/ = Pydantic request/response models for the API layer.

ASSUMPTION FLAG: I don't have your actual resume_model.py / certificate_model.py,
so the ObjectId/timestamp conventions below are a best guess based on the
README's described patterns. Diff this against a real model file before
merging and swap in your actual helpers if they differ.
"""

from datetime import datetime, timezone
from enum import Enum
from bson import ObjectId


class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


APPLICATION_COLLECTION = "job_applications"


def new_application_document(
    *,
    user_id: str,
    resume_id: str,
    company_name: str,
    job_title: str,
    hr_email: str,
    job_description: str,
) -> dict:
    """
    Builds the initial Mongo document for a new draft. Called only from
    application_repo.create() - the service layer never constructs this
    dict directly, so a future field-shape change stays contained here.
    """
    now = datetime.now(timezone.utc)
    return {
        "user_id": ObjectId(user_id),
        "resume_id": ObjectId(resume_id),          # reference only - full resume lives in resume_repo's collection
        "company_name": company_name,
        "job_title": job_title,
        "hr_email": hr_email,
        "job_description": job_description,

        "jd_analysis": None,                        # filled in after the LangGraph run
        "ats_result_ref": None,                      # {result_id, score, missing_keywords} - reference, not a copy

        "generated_draft": None,                     # {email_subject, email_body, cover_letter_text, generated_at}
        "edited_draft": None,

        "cover_letter_pdf_path": None,                # resume PDF path is NOT duplicated here - read from resume_repo at send time

        "status": ApplicationStatus.DRAFT.value,
        "needs_manual_review": False,

        "send_metadata": {
            "sent_at": None,
            "provider_message_id": None,
            "attempts": 0,
            "last_error": None,
        },

        "created_at": now,
        "updated_at": now,
    }


# Valid status transitions. The repository refuses to write a status change
# that isn't listed here - this is the server-side half of the "never
# auto-send" guarantee, enforced at the data layer, not just in a route's
# if-statement that someone could forget to check.
VALID_STATUS_TRANSITIONS: dict[str, set[str]] = {
    ApplicationStatus.DRAFT.value: {ApplicationStatus.READY_FOR_REVIEW.value},
    # READY_FOR_REVIEW -> SENDING directly: the "Approve & Send" button IS the
    # approval act (confirmed client-side + re-checked server-side in the
    # service). APPROVED is kept as a reachable state for a future explicit
    # "approve without sending yet" UI, but today's flow doesn't require it.
    ApplicationStatus.READY_FOR_REVIEW.value: {
        ApplicationStatus.READY_FOR_REVIEW.value,
        ApplicationStatus.APPROVED.value,
        ApplicationStatus.SENDING.value,
    },
    ApplicationStatus.APPROVED.value: {ApplicationStatus.SENDING.value},
    ApplicationStatus.SENDING.value: {ApplicationStatus.SENT.value, ApplicationStatus.FAILED.value},
    ApplicationStatus.FAILED.value: {ApplicationStatus.SENDING.value},   # allow retry-send without regenerating
    ApplicationStatus.SENT.value: set(),                                 # terminal state
}


def is_valid_transition(current: str, target: str) -> bool:
    return target in VALID_STATUS_TRANSITIONS.get(current, set())