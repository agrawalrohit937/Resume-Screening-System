"""
API routes for the AI Apply Assistant.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status as http_status, File, UploadFile, Request
from fastapi.responses import FileResponse

from api.deps import get_current_user, get_user_repo
from repositories.user_repo import UserRepository
from schemas.application_schema import (
    ApplyDraftRequest,
    ApplyDraftUpdateRequest,
    ApplyDraftResponse,
    ApplySendResponse,
    ApplicationHistoryResponse,
    ApplicationHistoryItem,
    ATSResultSummary,
    ATSScoreRequest,
    ATSScoreResponse,
    JobDetailsExtractionResponse,
)
from services.apply_assistant_service import ApplyAssistantService
from repositories.resume_repo import ResumeRepository
from config.db import get_database

router = APIRouter(prefix="/apply", tags=["Apply Assistant"])
service = ApplyAssistantService()


def _user_id(current_user) -> str:
    return str(getattr(current_user, "id", None) or current_user["_id"])


@router.post("/extract-from-screenshot", response_model=JobDetailsExtractionResponse)
@router.post("/extract-job-details", response_model=JobDetailsExtractionResponse)
async def extract_from_screenshot(
    request: Request,
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_user),
):
    """
    Extract job posting details (company_name, job_title, hr_email, job_description)
    from one or multiple screenshot images using AI Vision OCR.
    """
    upload_list = []

    if files:
        upload_list.extend([f for f in files if f and hasattr(f, "filename") and f.filename])
    if file and hasattr(file, "filename") and file.filename:
        upload_list.append(file)

    try:
        form = await request.form()
        for key in form.keys():
            for val in form.getlist(key):
                if hasattr(val, "read") and hasattr(val, "filename") and val.filename:
                    if val not in upload_list:
                        upload_list.append(val)
    except Exception as err:
        logger.warning("Could not parse request form directly", error=str(err))

    if not upload_list:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="At least one screenshot image file is required.",
        )

    image_data_list = []
    for f in upload_list:
        filename = f.filename or ""
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        content_type = getattr(f, "content_type", "") or ""

        content = await f.read()
        if not content:
            continue

        mime_type = content_type if content_type.startswith("image/") else f"image/{ext if ext != 'jpg' else 'jpeg'}"
        image_data_list.append((content, mime_type))

    if not image_data_list:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="No valid image content found in uploaded files.",
        )

    extracted_dict = await service.extract_job_details_from_screenshots(image_data_list)

    return JobDetailsExtractionResponse(
        company_name=extracted_dict.get("company_name", "") or "",
        job_title=extracted_dict.get("job_title", "") or "",
        hr_email=extracted_dict.get("hr_email", "") or "",
        job_description=extracted_dict.get("job_description", "") or "",
    )


def _to_draft_response(doc: dict) -> ApplyDraftResponse:
    draft = doc.get("edited_draft") or doc.get("generated_draft") or {}
    ats_ref = doc.get("ats_result_ref") or {}
    return ApplyDraftResponse(
        application_id=str(doc["_id"]),
        status=doc["status"],
        email_subject=draft.get("email_subject"),
        email_body=draft.get("email_body"),
        cover_letter_text=draft.get("cover_letter_text"),
        ats_result=ATSResultSummary(**ats_ref) if ats_ref.get("result_id") else None,
        needs_manual_review=doc.get("needs_manual_review", False),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.post("/ats-score", response_model=ATSScoreResponse)
async def check_ats_score(
    payload: ATSScoreRequest,
    current_user=Depends(get_current_user),
):
    """Check ATS keyword match score for a resume against a job description
    using the semantic LangGraph ATS engine.
    """
    user_id = _user_id(current_user)
    
    # Resolve resume and get text
    db = get_database()
    resume_repo = ResumeRepository(db)
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, user_id)
    if not resume:
        resume = await resume_repo.get_by_id(payload.resume_id)
    if not resume:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Resume not found")
    
    resume_dict = resume.model_dump() if hasattr(resume, "model_dump") else (resume.dict() if hasattr(resume, "dict") else resume)
    status_val = resume_dict.get("status")
    if hasattr(status_val, "value"):
        status_val = status_val.value
    elif isinstance(status_val, str):
        status_val = status_val.lower()
    if status_val != "parsed":
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Resume has not finished parsing yet")
    
    parsed_data = resume_dict.get("parsed_data") or {}
    resume_text = None
    if isinstance(parsed_data, dict):
        resume_text = parsed_data.get("raw_text")
    elif hasattr(parsed_data, "raw_text"):
        resume_text = parsed_data.raw_text
    if not resume_text:
        resume_text = resume_dict.get("parsed_text") or resume_dict.get("extracted_text") or resume_dict.get("raw_text")
    if not resume_text:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Resume has no extracted text")
    
    # 👇 Run the semantic ATS check via ApplyAssistantService (which uses ats_engine graph)
    ats_result = await service._run_ats_match(resume_text=resume_text, job_description=payload.job_description)
    
    score = ats_result.get("score", 0)
    return ATSScoreResponse(
        score=score,
        matched_keywords=ats_result.get("matched_keywords", []),
        missing_keywords=ats_result.get("missing_keywords", []),
        is_low_score=score < 80,
    )


@router.post("/draft", response_model=ApplyDraftResponse, status_code=http_status.HTTP_201_CREATED)
async def generate_draft(payload: ApplyDraftRequest, current_user=Depends(get_current_user)):
    doc = await service.generate_draft(
        user_id=_user_id(current_user),
        resume_id=payload.resume_id,
        company_name=payload.company_name,
        job_title=payload.job_title,
        hr_email=payload.hr_email,
        job_description=payload.job_description,
    )
    return _to_draft_response(doc)


@router.put("/draft/{application_id}", response_model=ApplyDraftResponse)
async def update_draft(application_id: str, payload: ApplyDraftUpdateRequest, current_user=Depends(get_current_user)):
    doc = await service.update_draft(
        application_id=application_id,
        user_id=_user_id(current_user),
        edits=payload.model_dump(exclude_unset=True),
    )
    return _to_draft_response(doc)


@router.get("/draft/{application_id}", response_model=ApplyDraftResponse)
async def get_draft(application_id: str, current_user=Depends(get_current_user)):
    doc = await service.repo.get_by_id(application_id, _user_id(current_user))
    if not doc:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Application draft not found")
    return _to_draft_response(doc)


@router.get("/active-draft", response_model=Optional[ApplyDraftResponse])
async def get_active_draft(current_user=Depends(get_current_user)):
    items, total = await service.get_history(user_id=_user_id(current_user), page=1, page_size=5)
    for item in items:
        if item.get("status") in ("ready_for_review", "sending", "created"):
            full_doc = await service.repo.get_by_id(str(item["_id"]), _user_id(current_user))
            if full_doc:
                return _to_draft_response(full_doc)
    return None


@router.get("/draft/{application_id}/preview")
async def preview_draft(application_id: str, current_user=Depends(get_current_user)):
    pdf_path = await service.preview_cover_letter(application_id=application_id, user_id=_user_id(current_user))
    return FileResponse(pdf_path, media_type="application/pdf", filename="cover_letter_preview.pdf")


@router.post("/draft/{application_id}/send", response_model=ApplySendResponse)
async def send_application(
    application_id: str,
    current_user=Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Send the application email via the user's Gmail account.

    Tokens are managed entirely server-side — no access_token is required
    from the frontend. The backend auto-refreshes the token as needed.
    Returns HTTP 428 if the user has not yet connected their Gmail account.
    """
    doc = await service.send_application(
        application_id=application_id,
        user_id=_user_id(current_user),
        user_repo=user_repo,
    )
    return ApplySendResponse(
        application_id=str(doc["_id"]),
        status=doc["status"],
        sent_at=doc.get("send_metadata", {}).get("sent_at"),
    )


@router.get("/history", response_model=ApplicationHistoryResponse)
async def get_history(page: int = 1, page_size: int = 20, current_user=Depends(get_current_user)):
    items, total = await service.get_history(user_id=_user_id(current_user), page=page, page_size=page_size)
    return ApplicationHistoryResponse(
        items=[
            ApplicationHistoryItem(
                application_id=str(i["_id"]),
                company_name=i["company_name"],
                job_title=i["job_title"],
                status=i["status"],
                created_at=i["created_at"],
            )
            for i in items
        ],
        total=total,
        page=page,
    )