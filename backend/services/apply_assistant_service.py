"""
Service layer for the AI Apply Assistant - ties together resume, ATS, PDF, email, and the LangGraph workflow.
"""

from datetime import datetime, timezone
from typing import List, Tuple
from fastapi import HTTPException, status as http_status

from config.db import get_database
from repositories.application_repo import ApplicationRepository
from models.application_model import ApplicationStatus
from workflows.apply_assistant_graph import apply_assistant_graph
from workflows.ats_graph import ats_engine
from repositories.resume_repo import ResumeRepository
from services.pdf_generator_service import render_html_to_pdf
from services.email_service import send_with_attachments, send_application_via_gmail_api
from repositories.user_repo import UserRepository


class ApplyAssistantService:
    def __init__(self, db=None):
        self._db = db
        self._repo = None
        self._resume_repo = None

    @property
    def repo(self) -> ApplicationRepository:
        if self._repo is None:
            self._repo = ApplicationRepository(self._db)
        return self._repo

    @property
    def resume_repo(self) -> ResumeRepository:
        if self._resume_repo is None:
            db = self._db if self._db is not None else get_database()
            self._resume_repo = ResumeRepository(db)
        return self._resume_repo

    async def _get_resume(self, resume_id: str, user_id: str) -> dict:
        resume = await self.resume_repo.get_by_id_and_user(resume_id, user_id)
        if not resume:
            resume = await self.resume_repo.get_by_id(resume_id)
        if not resume:
            raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Resume not found")

        resume_dict = resume.model_dump() if hasattr(resume, "model_dump") else (resume.dict() if hasattr(resume, "dict") else resume)
        
        status_val = resume_dict.get("status")
        if hasattr(status_val, "value"):
            status_val = status_val.value
        elif isinstance(status_val, str):
            status_val = status_val.lower()
            
        if status_val != "parsed":
            raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Resume has not finished parsing yet")
            
        return resume_dict

    def _get_resume_text(self, resume_doc: dict) -> str:
        parsed_data = resume_doc.get("parsed_data") or {}
        text = None
        if isinstance(parsed_data, dict):
            text = parsed_data.get("raw_text")
        elif hasattr(parsed_data, "raw_text"):
            text = parsed_data.raw_text

        if not text:
            text = resume_doc.get("parsed_text") or resume_doc.get("extracted_text") or resume_doc.get("raw_text")
        if not text:
            raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Resume has no extracted text to work with")
        return text

    def _resume_pdf_path(self, resume_doc: dict) -> str:
        path = resume_doc.get("file_url") or resume_doc.get("storage_path") or resume_doc.get("file_path") or resume_doc.get("pdf_path")
        if not path:
            raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Resume file not found in storage")
        return path

    async def _run_ats_match(self, resume_text: str, job_description: str) -> dict:
        """
        Runs the semantic ATS graph workflow instead of the strict regex matcher.
        """
        initial_state = {
            "resume_text": resume_text,
            "jd_text": job_description,
            "extracted_data": {},
            "matched_skills": [],
            "missing_skills": [],
            "experience_score": 0.0,
            "education_score": 0.0,
            "final_score": 0.0,
            "recommendation": "",
            "feedback_suggestions": []
        }
        
        # Invoke the LangGraph ATS pipeline
        result_state = await ats_engine.ainvoke(initial_state)
        
        return {
            "result_id": "semantic_ats_graph",
            "score": int(result_state.get("final_score", 0)),
            "matched_keywords": result_state.get("matched_skills", []),
            "missing_keywords": result_state.get("missing_keywords", []),
            "recommendation": result_state.get("recommendation", ""),
            "feedback": result_state.get("feedback_suggestions", [])
        }

    async def _render_cover_letter_pdf(self, application_id: str, cover_letter_text: str, company_name: str, full_name: str = "Candidate") -> str:
        context = {"body": cover_letter_text, "company_name": company_name}
        
        # Clean special characters and spaces for a professional PDF filename
        safe_name = "".join(c if c.isalnum() else "_" for c in full_name)
        safe_company = "".join(c if c.isalnum() else "_" for c in company_name)
        filename_key = f"{safe_name}_{safe_company}_Cover_Letter"

        return await render_html_to_pdf(
            template_name="cover_letter.html",
            context=context,
            output_key=filename_key,
        )

    # ---------------- public service methods (called from the API layer) ----------------

    async def generate_draft(
        self, *, user_id: str, resume_id: str, company_name: str,
        job_title: str, hr_email: str, job_description: str,
    ) -> dict:
        resume_doc = await self._get_resume(resume_id, user_id)
        resume_text = self._get_resume_text(resume_doc)

        ats_result = await self._run_ats_match(resume_text, job_description)

        application = await self.repo.create(
            user_id=user_id, resume_id=resume_id, company_name=company_name,
            job_title=job_title, hr_email=hr_email, job_description=job_description,
        )

        initial_state = {
            "resume_text": resume_text,
            "ats_result": ats_result,
            "company_name": company_name,
            "job_title": job_title,
            "hr_email": hr_email,
            "job_description": job_description,
            "retry_count": 0,
        }

        final_state = await apply_assistant_graph.ainvoke(initial_state)

        generated_draft = {
            "email_subject": final_state.get("email_subject", ""),
            "email_body": final_state.get("email_body", ""),
            "cover_letter_text": final_state.get("cover_letter_text", ""),
            "generated_at": datetime.now(timezone.utc),
        }

        ats_result_ref = {
            "result_id": ats_result.get("result_id"),
            "score": ats_result.get("score"),
            "missing_keywords": ats_result.get("missing_keywords", []),
        }

        return await self.repo.save_generated_draft(
            str(application["_id"]),
            jd_analysis=final_state.get("jd_analysis", {}),
            ats_result_ref=ats_result_ref,
            generated_draft=generated_draft,
            needs_manual_review=final_state.get("needs_manual_review", False),
        )

    async def update_draft(self, *, application_id: str, user_id: str, edits: dict) -> dict:
        application = await self.repo.get_by_id(application_id, user_id)
        if not application:
            raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Application not found")
        return await self.repo.save_edited_draft(application_id, user_id, edits)

    async def preview_cover_letter(self, *, application_id: str, user_id: str) -> str:
        application = await self.repo.get_by_id(application_id, user_id)
        if not application:
            raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Application not found")

        resume_doc = await self._get_resume(str(application["resume_id"]), user_id)
        resume_data = resume_doc.get("parsed_data", {})
        full_name = resume_data.get("full_name") or "Candidate"

        draft = application.get("edited_draft") or application.get("generated_draft") or {}
        return await self._render_cover_letter_pdf(
            application_id, draft.get("cover_letter_text", ""), application["company_name"], full_name
        )

    async def send_application(self, *, application_id: str, user_id: str, user_repo: UserRepository) -> dict:
        application = await self.repo.get_by_id(application_id, user_id)
        if not application:
            raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Application not found")

        current_status = application["status"]
        if current_status not in (ApplicationStatus.READY_FOR_REVIEW.value, ApplicationStatus.FAILED.value):
            raise HTTPException(
                http_status.HTTP_409_CONFLICT,
                f"Application not ready to send. Current status: {current_status}",
            )

        locked = await self.repo.update_status(application_id, current_status, ApplicationStatus.SENDING.value)
        if not locked:
            raise HTTPException(http_status.HTTP_409_CONFLICT, "Application status changed - please refresh and try again")

        try:
            resume_doc = await self._get_resume(str(application["resume_id"]), user_id)
            resume_pdf_path = self._resume_pdf_path(resume_doc)

            resume_data = resume_doc.get("parsed_data", {})
            full_name = resume_data.get("full_name") or "Candidate"

            draft = application.get("edited_draft") or application.get("generated_draft") or {}
            cover_letter_pdf_path = await self._render_cover_letter_pdf(
                application_id, draft.get("cover_letter_text", ""), application["company_name"], full_name
            )

            provider_message_id = await send_application_via_gmail_api(
                to=application["hr_email"],
                subject=draft.get("email_subject", ""),
                html_body=draft.get("email_body", ""),
                attachments=[resume_pdf_path, cover_letter_pdf_path],
                user_id=user_id,
                user_repo=user_repo,
            )

            await self.repo.update_status(
                application_id, ApplicationStatus.SENDING.value, ApplicationStatus.SENT.value,
                send_metadata={
                    "sent_at": datetime.now(timezone.utc),
                    "provider_message_id": provider_message_id,
                    "attempts": 1,
                    "last_error": None,
                },
            )
        except Exception as exc:
            await self.repo.update_status(
                application_id, ApplicationStatus.SENDING.value, ApplicationStatus.FAILED.value,
                send_metadata={"last_error": str(exc)},
            )
            raise HTTPException(http_status.HTTP_502_BAD_GATEWAY, f"Failed to send application: {exc}")

        return await self.repo.get_by_id(application_id, user_id)

    async def get_history(self, *, user_id: str, page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        return await self.repo.list_by_user(user_id, page, page_size)