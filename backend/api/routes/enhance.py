"""
Enhance Routes — AI-powered resume enhancement
"""

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_resume_repo, get_enhancer_service
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from schemas.resume_schema import EnhanceResumeRequest, EnhanceResumeResponse
from services.enhancer_service import EnhancerService
from utils.validators import validate_object_id

router = APIRouter()


@router.post("/resume", response_model=EnhanceResumeResponse)
async def enhance_resume(
    payload: EnhanceResumeRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    enhancer: EnhancerService = Depends(get_enhancer_service),
):
    """
    AI-powered resume enhancement:
    - Rewrites professional summary
    - Upgrades experience bullets with action verbs
    - Injects missing ATS keywords
    - Provides formatting suggestions
    """
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before enhancement.",
        )
    enhanced_response = await enhancer.enhance_resume(
        resume=resume,
        job_description=payload.job_description,
        target_role=payload.target_role,
        enhancement_areas=payload.enhancement_areas,
        tone=payload.tone,
    )

    if payload.save_enhanced:
        # Update the resume with enhanced data
        if not resume.parsed_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No parsed data to update.")

        updated_parsed_data = resume.parsed_data.model_dump()

        # 1. Update enhanced summary
        if enhanced_response.enhanced_summary:
            updated_parsed_data["summary"] = enhanced_response.enhanced_summary

        # 2. Update enhanced experience
        if enhanced_response.enhanced_experience:
            updated_parsed_data["work_experience"] = enhanced_response.enhanced_experience

        # 3. Rebuild raw_text to include ALL enhancements
        #    so ATS scoring picks up the improved content
        updated_raw_text = resume.parsed_data.raw_text or ""

        # Replace old summary with enhanced summary
        if (
            enhanced_response.enhanced_summary
            and resume.parsed_data.summary
            and resume.parsed_data.summary in updated_raw_text
        ):
            updated_raw_text = updated_raw_text.replace(
                resume.parsed_data.summary, enhanced_response.enhanced_summary, 1
            )
        elif enhanced_response.enhanced_summary and resume.parsed_data.summary not in updated_raw_text:
            # Prepend enhanced summary if original not found
            updated_raw_text = enhanced_response.enhanced_summary + "\n\n" + updated_raw_text

        # Replace enhanced experience descriptions in raw_text
        if enhanced_response.enhanced_experience and resume.parsed_data.work_experience:
            for orig_exp, enh_exp in zip(
                resume.parsed_data.work_experience,
                enhanced_response.enhanced_experience
            ):
                orig_desc = orig_exp.description or ""
                enh_desc = enh_exp.get("description", "") if isinstance(enh_exp, dict) else ""
                if orig_desc and enh_desc and orig_desc in updated_raw_text:
                    updated_raw_text = updated_raw_text.replace(orig_desc, enh_desc, 1)

        # Append added keywords to raw_text as a supplemental skills block
        # This ensures ATS scoring sees these JD-aligned keywords
        if enhanced_response.added_keywords:
            keyword_block = "\n\nAdditional Skills & Keywords: " + ", ".join(enhanced_response.added_keywords)
            updated_raw_text = updated_raw_text + keyword_block
            # Also update the skills list in parsed data
            existing_skills = set(s.lower() for s in (updated_parsed_data.get("skills") or []))
            new_skills = [kw for kw in enhanced_response.added_keywords if kw.lower() not in existing_skills]
            updated_parsed_data["skills"] = (updated_parsed_data.get("skills") or []) + new_skills

        updated_parsed_data["raw_text"] = updated_raw_text

        await resume_repo.update_parsed_data(payload.resume_id, updated_parsed_data)

    return enhanced_response
