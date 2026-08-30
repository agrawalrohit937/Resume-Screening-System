"""
Portfolio API Routes — Resume auto-parsing, AI enhancer, portfolio CRUD, analytics, and contact relay
"""

from datetime import datetime
from typing import Optional
import json
import re
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, Request, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
import structlog
from fastapi_cache.decorator import cache
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.deps import get_db, security
from core.security import decode_token
from core.llm_client import groq_key_pool
from models.portfolio_model import (
    ContactMessageSchema,
    PortfolioAnalyticsModel,
    PortfolioProfileModel,
    SkillCategoryModel,
)
from services.portfolio_service import (
    categorize_skills,
    sanitize_portfolio_skills,
    parse_resume_to_portfolio_data,
    extract_all_projects,
    extract_all_experience,
    extract_all_education,
    ai_extract_portfolio_from_resume,
)
from services.email_service import EmailService
from services.cloudinary_service import upload_profile_picture

logger = structlog.get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Portfolio Generator"])


# ─── Helper to optionally get current user ID ─────────────────────────────────
async def get_optional_user(credentials=Depends(security), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        return user_id
    except Exception:
        return None


# ─── 1. Resume Parsing & Hybrid Extraction ────────────────────────────────────
@router.post("/parse-resume", summary="Extract structured data and categorized skills from PDF")
async def parse_resume_for_portfolio(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF resume documents are supported."
        )
    try:
        content = await file.read()
        print("\n" + "="*70)
        print(f"📥 [PORTFOLIO_UPLOAD] Received resume file: '{file.filename}' ({len(content)} bytes)")
        
        # 1. Extract raw text
        raw_text = ""
        try:
            import io
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        raw_text += t + "\n"
        except Exception as e_pdf:
            print(f"⚠️ [PORTFOLIO_UPLOAD] PDFPlumber error: {e_pdf}")

        # 2. Try Gemini AI Extraction First
        ai_data = {}
        if raw_text and len(raw_text.strip()) >= 50:
            print("🚀 [PORTFOLIO_UPLOAD] Attempting Gemini AI Extraction...")
            try:
                ai_data = await ai_extract_portfolio_from_resume(raw_text)
            except Exception as e_ai:
                print(f"❌ [PORTFOLIO_UPLOAD] Gemini AI extraction failed: {e_ai}")

        if ai_data and ai_data.get("projects") and len(ai_data.get("projects", [])) > 0:
            print(f"✅ [PORTFOLIO_UPLOAD] Successfully used [AI_SYSTEM] for '{file.filename}'!")
            return {
                "status": "success",
                "source": "ai_system",
                "data": ai_data
            }

        # 3. Fallback to Local Rule-Based / NLP Parser
        print(f"⚙️ [PORTFOLIO_UPLOAD] Using [FALLBACK_PARSER] for '{file.filename}'...")
        parsed_data = parse_resume_to_portfolio_data(content, file.filename)
        print(f"✅ [PORTFOLIO_UPLOAD] Fallback parser completed. Projects: {len(parsed_data.get('projects', []))}")
        print("="*70 + "\n")
        return {
            "status": "success",
            "source": "fallback_parser",
            "data": parsed_data
        }
    except Exception as exc:
        print(f"❌ [PORTFOLIO_UPLOAD] Resume parsing failed: {str(exc)}")
        logger.error("Failed to parse resume for portfolio", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume parsing failed: {str(exc)}"
        )


# ─── 1.1 Candidate Profile Photo Upload (Cloudinary Cloud Storage) ────────────
@router.post("/upload-photo", summary="Upload candidate profile photo to Cloudinary")
async def upload_portfolio_photo(
    file: UploadFile = File(...),
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Accepts multipart image upload, streams bytes directly to Cloudinary,
    and stores the HTTPS secure_url in MongoDB user_profiles and users collections.
    """
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    MAX_SIZE = 5 * 1024 * 1024  # 5MB

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Supported formats: JPG, PNG, WEBP."
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image size exceeds 5MB limit."
        )

    target_id = str(user_id) if user_id else f"user_{int(datetime.utcnow().timestamp())}"
    
    try:
        secure_url, public_id = await upload_profile_picture(
            file_bytes=file_bytes,
            user_id=target_id
        )
    except Exception as upload_err:
        logger.error("Cloudinary upload failed", user_id=target_id, error=str(upload_err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cloudinary upload failed: {str(upload_err)}"
        )

    # Synchronize with main user account and user_profiles collection
    if user_id:
        from bson import ObjectId
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
        await db.users.update_one(
            query,
            {"$set": {
                "profile_picture": secure_url,
                "profile_picture_public_id": public_id,
                "avatar_url": secure_url,
                "profile_photo_url": secure_url
            }}
        )
        await db.user_profiles.update_one(
            {"user_id": str(user_id)},
            {"$set": {"avatar_url": secure_url}},
            upsert=True
        )

    return {
        "status": "success",
        "avatar_url": secure_url,
        "url": secure_url,
        "public_id": public_id
    }


# ─── 2. AI Content Enhancer ───────────────────────────────────────────────────
class EnhanceRequest(BaseModel):
    raw_text: str
    target_role: Optional[str] = "Software Engineer"
    tone: Optional[str] = "Professional & High Impact"


@router.post("/enhance-content", summary="Enhance project summary or bio using professional action verbs")
async def enhance_portfolio_content(req: EnhanceRequest):
    if not req.raw_text or not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")

    raw = req.raw_text.strip()
    
    # AI Enhancement via Groq LLaMA 3.3 70B
    prompt = (
        "You are an elite technical portfolio and resume writer.\n"
        f"Transform the following raw project description or candidate bio for a '{req.target_role}' role.\n"
        f"Tone: {req.tone}.\n\n"
        "Guidelines:\n"
        "1. Start with high-impact power action verbs (e.g., Architected, Engineered, Spearheaded, Implemented).\n"
        "2. Make it concise (2-3 punchy sentences or clear bullets).\n"
        "3. Highlight technical depth, scalability, and measurable outcomes without inventing fake metrics if none exist.\n"
        "4. Return ONLY the enhanced plain text without markdown fences, quotes, or conversational filler.\n\n"
        f"Original text:\n{raw}"
    )

    enhanced = None
    try:
        async def _call_groq_enhancer(key: Optional[str]) -> Optional[str]:
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You are a professional software engineering portfolio copywriter."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.4,
                "max_tokens": 250
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"].strip()
                return None

        enhanced = await groq_key_pool.execute_async_with_fallback(_call_groq_enhancer)
    except Exception as err:
        logger.warning("Groq content enhancer fallback triggered", error=str(err))

    if not enhanced:
        enhanced = (
            f"Architected and deployed a scalable solution for {raw}. "
            f"Optimized end-to-end performance, ensured clean modular code principles, "
            f"and delivered production-ready features tailored for modern {req.target_role} environments."
        )

    # Synthesize smart quantifiable metric highlights matching this project
    from services.portfolio_service import extract_smart_metrics
    smart_highlights = extract_smart_metrics(req.target_role or "Project", enhanced or raw)

    return {
        "status": "success",
        "original": raw,
        "enhanced": enhanced,
        "highlights": smart_highlights
    }


# ─── 2.5 Check Slug Availability ──────────────────────────────────────────────
@router.get("/check-slug", summary="Check portfolio slug/username availability")
async def check_slug_availability(
    slug: str = Query(..., description="The slug or username to check"),
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    clean_slug = slug.strip().lower().replace(" ", "-")
    clean_slug = re.sub(r'[^a-z0-9_-]', '', clean_slug)

    if not clean_slug or len(clean_slug) < 3:
        return {
            "status": "success",
            "available": False,
            "message": "Slug must be at least 3 characters."
        }

    # Reserved slugs
    reserved = ["admin", "api", "dashboard", "login", "signup", "settings", "me", "public", "portfolio", "support", "help", "careershala"]
    if clean_slug in reserved:
        return {
            "status": "success",
            "available": False,
            "message": "This handle is reserved. Please pick another."
        }

    # Query user_profiles
    existing_profile = await db.user_profiles.find_one({
        "$or": [
            {"username": clean_slug},
            {"username": {"$regex": f"^{re.escape(clean_slug)}$", "$options": "i"}}
        ]
    })

    if existing_profile:
        profile_uid = str(existing_profile.get("user_id", ""))
        if user_id and (profile_uid == str(user_id) or str(existing_profile.get("_id")) == str(user_id)):
            return {
                "status": "success",
                "available": True,
                "message": "This is your current handle."
            }
        return {
            "status": "success",
            "available": False,
            "message": "Handle is already claimed. Try another."
        }

    # Query users collection
    existing_user = await db.users.find_one({
        "$or": [
            {"username": clean_slug},
            {"username": {"$regex": f"^{re.escape(clean_slug)}$", "$options": "i"}}
        ]
    })

    if existing_user:
        user_uid = str(existing_user.get("_id", ""))
        if user_id and user_uid == str(user_id):
            return {
                "status": "success",
                "available": True,
                "message": "Matches your account username."
            }
        return {
            "status": "success",
            "available": False,
            "message": "Handle is already taken. Try another."
        }

    return {
        "status": "success",
        "available": True,
        "message": "Handle is available!"
    }


# ─── 3. Save / Update User Portfolio (Syncs with User Profile) ─────────────────
@router.post("/save", summary="Create or update user portfolio profile")
@router.post("/publish", summary="Publish user portfolio profile")
async def save_portfolio(
    profile: PortfolioProfileModel,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    clean_username = profile.username.strip().lower()
    clean_username = re.sub(r'[^a-z0-9_-]', '', clean_username)
    if not clean_username or len(clean_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Portfolio URL slug must be at least 3 alphanumeric characters."
        )

    uid = str(user_id or profile.user_id or "")

    # Check if this slug is claimed by a DIFFERENT user
    existing_by_slug = await db.user_profiles.find_one({
        "$or": [
            {"username": clean_username},
            {"username": {"$regex": f"^{re.escape(clean_username)}$", "$options": "i"}}
        ]
    })
    if existing_by_slug:
        owner_uid = str(existing_by_slug.get("user_id", ""))
        if uid and owner_uid and owner_uid != uid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The portfolio handle '{clean_username}' is already claimed by another developer."
            )

    profile_dict = profile.model_dump(by_alias=True, exclude_unset=True)
    profile_dict.pop("_id", None)
    profile_dict.pop("id", None)
    profile_dict["username"] = clean_username
    if uid:
        profile_dict["user_id"] = uid
    profile_dict["is_published"] = True
    profile_dict["updated_at"] = datetime.utcnow()

    # Preserve and sanitize dynamic domain-agnostic skills dictionary
    profile_dict["skills"] = sanitize_portfolio_skills(profile.skills)

    # Upsert by user_id if available, otherwise by username
    if uid:
        await db.user_profiles.update_one(
            {"user_id": uid},
            {"$set": profile_dict},
            upsert=True
        )
    else:
        await db.user_profiles.update_one(
            {"username": clean_username},
            {"$set": profile_dict},
            upsert=True
        )

    # Sync portfolio link, photo, headline, and social links to main user account
    if uid:
        from bson import ObjectId
        query = {"_id": ObjectId(uid)} if ObjectId.is_valid(str(uid)) else {"_id": str(uid)}
        user_updates = {
            "portfolio_slug": clean_username,
            "portfolio_url": f"/portfolio/{clean_username}",
            "is_portfolio_published": True,
            "updated_at": datetime.utcnow()
        }
        if profile.avatar_url:
            user_updates["profile_picture"] = profile.avatar_url
            user_updates["avatar_url"] = profile.avatar_url
            user_updates["profile_photo_url"] = profile.avatar_url
        if profile.headline:
            user_updates["headline"] = profile.headline
        if profile.bio:
            user_updates["bio"] = profile.bio
        if profile.location:
            user_updates["location"] = profile.location
        if profile.social_links:
            if profile.social_links.get("github"):
                user_updates["github_url"] = profile.social_links["github"]
            if profile.social_links.get("linkedin"):
                user_updates["linkedin_url"] = profile.social_links["linkedin"]

        await db.users.update_one(query, {"$set": user_updates})

    # Initialize analytics document if missing
    await db.portfolio_analytics.update_one(
        {"username": clean_username},
        {"$setOnInsert": {
            "username": clean_username,
            "total_views": 0,
            "resume_downloads": 0,
            "contact_clicks": 0,
            "messages_received": 0,
            "last_visited": datetime.utcnow()
        }},
        upsert=True
    )

    return {
        "status": "success",
        "message": "Portfolio saved and linked successfully to user account",
        "username": clean_username,
        "public_url": f"/portfolio/{clean_username}"
    }


# ─── 4. Get Current User's Saved Portfolio ────────────────────────────────────
@router.get("/me", summary="Fetch current user's portfolio data (auto-synced with resume)")
async def get_my_portfolio(
    sync_from_resume: bool = False,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    if not user_id:
        return {"status": "empty", "data": None}
    
    from bson import ObjectId
    user_doc = None
    if ObjectId.is_valid(user_id):
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        user_doc = await db.users.find_one({"_id": user_id})

    # Robust multi-field resume query
    query_filters = [
        {"user_id": str(user_id)},
        {"user_id": user_id}
    ]
    if user_doc:
        if user_doc.get("email"):
            query_filters.append({"user_id": user_doc.get("email")})
            query_filters.append({"email": user_doc.get("email")})
        if user_doc.get("_id"):
            query_filters.append({"user_id": str(user_doc.get("_id"))})

    resume_doc = await db.resumes.find_one(
        {"$or": query_filters},
        sort=[("created_at", -1)]
    )

    # Auto-resolve resume file download URL from database
    stored_resume_url = ""
    if user_doc:
        stored_resume_url = user_doc.get("profile_resume_url") or user_doc.get("resume_url") or ""
    if not stored_resume_url and resume_doc:
        stored_resume_url = resume_doc.get("file_url") or ""

    doc = await db.user_profiles.find_one({"user_id": str(user_id)})
    if not doc:
        doc = await db.user_profiles.find_one({"user_id": user_id})

    # Only filter TRUE static placeholder dummies from early development, NEVER candidate projects
    LEGACY_DUMMIES = [
        "careerpilotai demo",
        "sentiment & emotion analysis system",
        "sentiment and emotion analysis system",
        "diabetes prediction & clinical risk assessment",
        "diabetes prediction",
        "sample project",
        "dummy project"
    ]

    # Detect if existing cached projects have bad URL titles, link clutter, or long text in metric badges
    has_corrupt_projects = False
    existing_projects = doc.get("projects") or [] if doc else []
    for p in existing_projects:
        t = (p.get("title") or "").strip().lower()
        d = (p.get("description") or "").strip()
        c = (p.get("category") or "").strip().upper()
        if t.startswith("http") or t.startswith("www.") or c in ["GITHUB", "LINK", "LIVE"] or "live demo:" in d.lower() or "github:" in d.lower():
            has_corrupt_projects = True
            break
        for h in (p.get("highlights") or []):
            if isinstance(h, dict) and len(str(h.get("value") or "").strip()) > 15:
                has_corrupt_projects = True
                break

    # If user already has a clean saved portfolio with >= 3 projects and didn't request a forced sync
    if doc and not sync_from_resume and not has_corrupt_projects:
        # Ensure resume_file_url and avatar_url stay automatically synchronized
        if stored_resume_url and not doc.get("resume_file_url"):
            doc["resume_file_url"] = stored_resume_url
        if user_doc and user_doc.get("profile_picture") and not doc.get("avatar_url"):
            doc["avatar_url"] = user_doc.get("profile_picture")

        # Filter out legacy dummy projects if any were saved in past sessions
        cleaned_projects = [
            p for p in existing_projects 
            if not any(dummy in (p.get("title") or "").lower() for dummy in LEGACY_DUMMIES)
        ]
        doc["projects"] = cleaned_projects

        # Ensure skills are 100% sanitized with zero 'other' categories
        if doc.get("skills"):
            doc["skills"] = sanitize_portfolio_skills(doc["skills"])

        # If existing document has genuine projects, return it directly
        if len(cleaned_projects) >= 3:
            doc["_id"] = str(doc["_id"])
            return {"status": "success", "data": doc}

    # Extract all resume data from parsed_data or raw text
    parsed = resume_doc.get("parsed_data", {}) if resume_doc else {}
    raw_text = ""
    if isinstance(parsed, dict):
        raw_text = parsed.get("raw_text", "")
    if not raw_text and resume_doc:
        raw_text = resume_doc.get("extracted_text") or resume_doc.get("raw_text") or ""
    
    # Fallback to local file text if available
    if not raw_text and resume_doc and resume_doc.get("storage_path"):
        import os
        sp = resume_doc.get("storage_path")
        if os.path.exists(sp):
            try:
                from utils.pdf_extractor import extract_text_from_pdf_sync
                with open(sp, "rb") as f:
                    raw_text = extract_text_from_pdf_sync(f.read())
            except Exception:
                pass

    contact_info = parsed.get("contact_info", {}) if isinstance(parsed, dict) else {}

    # High-precision AI extraction using existing Enhancer Graph
    ai_data = {}
    ai_used = False
    if raw_text:
        print("\n" + "="*70)
        print("🔍 [PORTFOLIO_TELEMETRY] Starting resume extraction pipeline...")
        print(f"📄 [PORTFOLIO_TELEMETRY] Input text source length: {len(raw_text)} chars")
        print("="*70)
        try:
            ai_data = await ai_extract_portfolio_from_resume(raw_text, original_parsed=parsed if isinstance(parsed, dict) else None)
            if ai_data and ai_data.get("projects") and len(ai_data.get("projects", [])) > 0:
                ai_used = True
                print("🌟 [PORTFOLIO_TELEMETRY] AI extraction pipeline: [SUCCESS - GEMINI AI USED]")
            else:
                print("⚠️ [PORTFOLIO_TELEMETRY] AI extraction pipeline: [EMPTY - USING FALLBACK PARSER]")
        except Exception as e:
            print(f"❌ [PORTFOLIO_TELEMETRY] AI extraction pipeline: [FAILED with error: {e}] -> [USING FALLBACK PARSER]")
            logger.warning("AI resume extraction fallback", error=str(e))

    # Extract all skills
    all_skills = []
    skills_source = "FALLBACK_NLP_ONTOLOGY"
    if ai_data.get("skills"):
        categorized = ai_data["skills"]
        all_skills = [s for v in categorized.values() for s in (v if isinstance(v, list) else [])]
        skills_source = "GEMINI_AI_CATEGORIZED"
    else:
        if parsed:
            all_skills = parsed.get("skills", []) or parsed.get("technical_skills", [])
        elif resume_doc:
            all_skills = resume_doc.get("skills", [])
        categorized = categorize_skills(all_skills if isinstance(all_skills, list) else [])

    # Extract ALL projects
    projects_list = []
    projects_source = "FALLBACK_REGEX"
    if ai_data.get("projects") and len(ai_data["projects"]) > 0:
        projects_list = ai_data["projects"]
        projects_source = "GEMINI_AI_EXTRACTED"
    else:
        if parsed and parsed.get("projects"):
            for p in parsed.get("projects", []):
                p_tech = p.get("technologies") or []
                cat_tag = " · ".join(p_tech[:3]).upper() if p_tech else "PROJECT"
                projects_list.append({
                    "title": p.get("name") or p.get("title") or "Project",
                    "description": p.get("description") or "",
                    "technologies": p_tech,
                    "live_url": p.get("url") or "",
                    "github_url": p.get("github_url") or "",
                    "notes_url": "",
                    "image_url": "",
                    "category": cat_tag,
                    "year": "2026",
                    "highlights": []
                })

        if raw_text:
            raw_projects = extract_all_projects(raw_text, all_skills if isinstance(all_skills, list) else [])
            for rp in raw_projects:
                if not any(p["title"].lower() == rp["title"].lower() for p in projects_list):
                    projects_list.append(rp)

    # Extract ALL experiences
    experience_list = []
    exp_source = "FALLBACK_REGEX"
    if ai_data.get("experience") and len(ai_data["experience"]) > 0:
        experience_list = ai_data["experience"]
        exp_source = "GEMINI_AI_EXTRACTED"
    else:
        if parsed and parsed.get("work_experience"):
            for exp in parsed.get("work_experience", []):
                experience_list.append({
                    "company": exp.get("company") or "",
                    "role": exp.get("title") or "Software / AI Development",
                    "start_date": exp.get("start_date") or "",
                    "end_date": exp.get("end_date") or "Present",
                    "location": exp.get("location") or "",
                    "description": exp.get("description") or ""
                })

        if raw_text:
            raw_experiences = extract_all_experience(raw_text)
            for rexp in raw_experiences:
                if not any(e["company"].lower() == rexp["company"].lower() for e in experience_list):
                    experience_list.append(rexp)

    # Extract ALL education
    education_list = []
    edu_source = "FALLBACK_REGEX"
    if ai_data.get("education") and len(ai_data["education"]) > 0:
        education_list = ai_data["education"]
        edu_source = "GEMINI_AI_EXTRACTED"
    else:
        if parsed and parsed.get("education"):
            for edu in parsed.get("education", []):
                education_list.append({
                    "institution": edu.get("institution") or "",
                    "degree": edu.get("degree") or edu.get("field_of_study") or "",
                    "field_of_study": edu.get("field_of_study") or "",
                    "graduation_year": str(edu.get("end_year") or "2026"),
                    "grade": str(edu.get("gpa") or "") if edu.get("gpa") else ""
                })

        if raw_text:
            raw_education = extract_all_education(raw_text)
            for redu in raw_education:
                if not any(ed["institution"].lower() == redu["institution"].lower() for ed in education_list):
                    education_list.append(redu)

    # Resolve candidate name & slug
    candidate_name = ""
    name_source = "DEFAULT"
    if user_doc and user_doc.get("full_name"):
        candidate_name = user_doc.get("full_name")
        name_source = "USER_DOC"
    elif ai_data.get("full_name"):
        candidate_name = ai_data.get("full_name")
        name_source = "GEMINI_AI"
    elif parsed.get("full_name"):
        candidate_name = parsed.get("full_name")
        name_source = "PARSER_DOC"
    elif user_doc and user_doc.get("email"):
        candidate_name = user_doc.get("email").split("@")[0].title()
        name_source = "USER_EMAIL_FALLBACK"
    else:
        candidate_name = "Developer"

    slug = candidate_name.lower().replace(" ", "-").replace(".", "-")

    # Resolve Headline (AI > User doc > Inferred)
    headline = user_doc.get("headline") if user_doc and user_doc.get("headline") else ""
    headline_source = "USER_DOC" if headline else ""
    if not headline and ai_data.get("headline"):
        headline = ai_data.get("headline")
        headline_source = "GEMINI_AI"
    if not headline:
        headline_source = "INFERRED_FROM_SKILLS"
        if categorized.get("machine_learning") or categorized.get("data_science"):
            headline = "Data Science • Machine Learning • AI Engineering"
        elif categorized.get("backend") and categorized.get("frontend"):
            headline = "Full-Stack Software & AI Engineer"
        elif categorized.get("backend"):
            headline = "Backend & Systems Engineer"
        else:
            headline = "Software Engineer • Full Stack & AI"

    # Resolve Bio (AI > User doc > Parsed summary)
    resolved_bio = ""
    bio_source = "NONE"
    if user_doc and user_doc.get("bio"):
        resolved_bio = user_doc.get("bio")
        bio_source = "USER_DOC"
    elif ai_data.get("bio"):
        resolved_bio = ai_data.get("bio")
        bio_source = "GEMINI_AI"
    elif parsed.get("summary"):
        resolved_bio = parsed.get("summary")
        bio_source = "PARSER_SUMMARY"

    # Resolve Location (AI > User doc > Contact info)
    resolved_location = ""
    loc_source = "NONE"
    if ai_data.get("location"):
        resolved_location = ai_data.get("location")
        loc_source = "GEMINI_AI"
    elif user_doc and user_doc.get("location"):
        resolved_location = user_doc.get("location")
        loc_source = "USER_DOC"
    elif contact_info.get("location"):
        resolved_location = contact_info.get("location")
        loc_source = "PARSER_CONTACT_INFO"

    # Resolve Social Links (AI > Contact Info > User doc)
    github_link = ai_data.get("github_url") or ""
    if not github_link:
        if contact_info.get("github"):
            github_link = contact_info.get("github")
        elif user_doc and user_doc.get("github_username"):
            gh = user_doc.get("github_username")
            github_link = gh if gh.startswith("http") else f"https://github.com/{gh}"

    linkedin_link = ai_data.get("linkedin_url") or ""
    if not linkedin_link:
        if contact_info.get("linkedin"):
            linkedin_link = contact_info.get("linkedin")
        elif user_doc and user_doc.get("linkedin_url"):
            linkedin_link = user_doc.get("linkedin_url")

    website_link = ai_data.get("website_url") or contact_info.get("portfolio") or (user_doc.get("website") if user_doc else "") or ""

    # Filter out legacy dummy projects from projects_list
    projects_list = [
        p for p in projects_list
        if not any(dummy in (p.get("title") or "").lower() for dummy in LEGACY_DUMMIES)
    ]

    # Dynamic metrics & roles
    dyn_typing_roles = []
    if headline:
        dyn_typing_roles.append(headline)
    if categorized.get("backend") and categorized.get("frontend"):
        dyn_typing_roles.append("Full-Stack Developer")
    if categorized.get("machine_learning") or categorized.get("data_science"):
        dyn_typing_roles.append("AI & Machine Learning Engineer")
    if not dyn_typing_roles:
        dyn_typing_roles = ["Software Engineer"]

    dyn_metrics = []
    if len(projects_list) > 0:
        dyn_metrics.append({"value": f"{len(projects_list)}+", "label": "Projects Built"})
    if len(all_skills) > 0:
        dyn_metrics.append({"value": f"{len(all_skills)}+", "label": "Technical Skills"})

    auto_data = {
        "user_id": str(user_id),
        "username": slug,
        "full_name": candidate_name,
        "headline": headline,
        "bio": resolved_bio,
        "email": ai_data.get("email") or contact_info.get("email") or (user_doc.get("email") if user_doc else "") or "",
        "phone": ai_data.get("phone") or contact_info.get("phone") or (user_doc.get("phone") if user_doc else "") or "",
        "location": resolved_location,
        "avatar_url": (user_doc.get("profile_picture") if user_doc else "") or (user_doc.get("avatar_url") if user_doc else "") or "",
        "resume_file_url": stored_resume_url,
        "hero_badge": "✨ Open to Opportunities",
        "typing_roles": dyn_typing_roles,
        "hero_metrics": dyn_metrics,
        "social_links": {
            "github": github_link,
            "linkedin": linkedin_link,
            "twitter": "",
            "website": website_link,
            "medium": ""
        },
        "skills": sanitize_portfolio_skills(categorized),
        "projects": projects_list,
        "experience": experience_list,
        "education": education_list,
        "theme_id": (doc.get("theme_id") if doc else "") or "glassmorphic_pro"
    }

    print("\n" + "="*70)
    print("📊 [PORTFOLIO_TELEMETRY] FIELD PROVENANCE & EXTRACTION AUDIT:")
    print(f"   👤 Name       : '{auto_data['full_name']}' [Source: {name_source}]")
    print(f"   🎯 Headline   : '{auto_data['headline']}' [Source: {headline_source}]")
    print(f"   📍 Location   : '{auto_data['location']}' [Source: {loc_source}]")
    print(f"   📝 Bio        : len={len(auto_data['bio'])} chars [Source: {bio_source}]")
    print(f"   🛠️ Skills     : {len(all_skills)} skills [Source: {skills_source}]")
    print(f"   🚀 Projects   : {len(auto_data['projects'])} items [Source: {projects_source}]")
    print(f"   💼 Experience : {len(auto_data['experience'])} items [Source: {exp_source}]")
    print(f"   🎓 Education  : {len(auto_data['education'])} items [Source: {edu_source}]")
    print(f"   🔗 GitHub     : '{auto_data['social_links']['github']}'")
    print(f"   🔗 LinkedIn   : '{auto_data['social_links']['linkedin']}'")
    print("="*70 + "\n")
    auto_data["is_published"] = bool(doc.get("is_published", False)) if doc else False

    # Automatically save clean profile in MongoDB
    if not doc or has_corrupt_projects or sync_from_resume:
        await db.user_profiles.update_one(
            {"user_id": str(user_id)},
            {"$set": auto_data},
            upsert=True
        )

    return {"status": "success", "data": auto_data}


# ─── 5. Public Portfolio View ─────────────────────────────────────────────────
@router.get("/public/{username}", summary="Public portfolio viewer data")
async def get_public_portfolio(username: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    clean_username = username.strip().lower()
    norm_query = re.sub(r'[\s\-_]', '', clean_username)
    
    # 1. Check user_profiles collection (case-insensitive & slug variations)
    doc = await db.user_profiles.find_one({
        "$or": [
            {"username": clean_username},
            {"username": {"$regex": f"^{re.escape(clean_username)}$", "$options": "i"}},
            {"username": clean_username.replace("-", "_")},
            {"username": clean_username.replace("_", "-")},
            {"username": norm_query}
        ]
    })

    # 1b. Try matching by portfolio_slug or username in db.users
    if not doc:
        matched_user_doc = await db.users.find_one({
            "$or": [
                {"portfolio_slug": clean_username},
                {"portfolio_slug": {"$regex": f"^{re.escape(clean_username)}$", "$options": "i"}},
                {"username": clean_username},
                {"username": {"$regex": f"^{re.escape(clean_username)}$", "$options": "i"}}
            ]
        })
        if matched_user_doc:
            uid = str(matched_user_doc["_id"])
            doc = await db.user_profiles.find_one({"user_id": uid})

    # 1c. Try matching by full_name or email in user_profiles
    if not doc:
        doc = await db.user_profiles.find_one({
            "$or": [
                {"full_name": {"$regex": f"^{re.escape(clean_username.replace('-', ' '))}$", "$options": "i"}},
                {"full_name": {"$regex": f"^{re.escape(clean_username.replace('_', ' '))}$", "$options": "i"}},
                {"email": {"$regex": f"^{re.escape(clean_username)}@", "$options": "i"}}
            ]
        })
    
    # 2. Fallback: Check if user exists in db.users and generate profile on-the-fly
    if not doc:
        user_matches = await db.users.find({}).to_list(length=300)
        matched_user = None
        for u in user_matches:
            name_slug = u.get("full_name", "").lower().replace(" ", "-")
            name_norm = re.sub(r'[\s\-_]', '', u.get("full_name", "").lower())
            email_slug = u.get("email", "").split("@")[0].lower()
            email_norm = re.sub(r'[\s\-_.]', '', email_slug)
            user_uname = u.get("username", "").lower()

            if clean_username in (name_slug, email_slug, user_uname) or norm_query in (name_norm, email_norm):
                matched_user = u
                break

        if matched_user:
            uid = str(matched_user.get("_id"))
            resume_doc = await db.resumes.find_one(
                {"$or": [{"user_id": uid}, {"user_id": matched_user.get("email")}, {"email": matched_user.get("email")}]},
                sort=[("created_at", -1)]
            )
            
            extracted_skills = []
            if resume_doc and "parsed_data" in resume_doc and isinstance(resume_doc["parsed_data"], dict):
                extracted_skills = resume_doc["parsed_data"].get("skills", [])
            elif resume_doc and "skills" in resume_doc:
                extracted_skills = resume_doc.get("skills", [])

            categorized = categorize_skills(extracted_skills if isinstance(extracted_skills, list) else [])

            # Extract projects from resume
            pub_raw_text = ""
            if resume_doc and "parsed_data" in resume_doc and isinstance(resume_doc["parsed_data"], dict):
                pub_raw_text = resume_doc["parsed_data"].get("raw_text", "")
            if not pub_raw_text and resume_doc:
                pub_raw_text = resume_doc.get("extracted_text") or resume_doc.get("raw_text") or ""

            pub_projects = []
            if pub_raw_text:
                pub_projects = extract_all_projects(pub_raw_text, extracted_skills if isinstance(extracted_skills, list) else [])

            doc = {
                "_id": uid,
                "user_id": uid,
                "username": clean_username,
                "full_name": matched_user.get("full_name", "Developer"),
                "headline": matched_user.get("headline") or "Software & AI Engineer",
                "bio": matched_user.get("bio") or "Passionate software engineer building modern intelligent platforms.",
                "email": "protected@careershal.internal",
                "phone": matched_user.get("phone", ""),
                "avatar_url": matched_user.get("profile_picture") or matched_user.get("profile_photo_url") or matched_user.get("avatar_url", ""),
                "resume_file_url": resume_doc.get("file_url") if resume_doc else "",
                "skills": categorized,
                "projects": pub_projects,
                "social_links": {
                    "github": matched_user.get("github_url", ""),
                    "linkedin": matched_user.get("linkedin_url", ""),
                    "twitter": "",
                    "website": ""
                },
                "is_published": True
            }

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or is currently private."
        )

    doc["_id"] = str(doc.get("_id", ""))
    doc["email"] = "protected@careershal.internal"
    if doc.get("skills"):
        doc["skills"] = sanitize_portfolio_skills(doc["skills"])
    return {"status": "success", "data": doc}


# ─── 6. Analytics Event Tracker ───────────────────────────────────────────────
@router.post("/analytics/track/{username}/{event_type}", summary="Track page views and clicks")
@limiter.limit("1/minute")
async def track_portfolio_event(
    request: Request,
    username: str,
    event_type: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    clean_username = username.strip().lower()
    field_map = {
        "view": "total_views",
        "download": "resume_downloads",
        "contact_click": "contact_clicks"
    }
    field_name = field_map.get(event_type)
    if not field_name:
        raise HTTPException(status_code=400, detail="Invalid event type")

    await db.portfolio_analytics.update_one(
        {"username": clean_username},
        {
            "$inc": {field_name: 1},
            "$set": {"last_visited": datetime.utcnow()}
        },
        upsert=True
    )
    return {"status": "tracked", "event": event_type}


@router.get("/analytics/{username}", summary="Get portfolio metrics")
async def get_portfolio_analytics(username: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    clean_username = username.strip().lower()
    stats = await db.portfolio_analytics.find_one({"username": clean_username})
    if not stats:
        return {
            "username": clean_username,
            "total_views": 0,
            "resume_downloads": 0,
            "contact_clicks": 0,
            "messages_received": 0
        }
    stats["_id"] = str(stats["_id"])
    return stats


# ─── 7. Dynamic Contact Form Email Forwarder ──────────────────────────────────
@router.post("/contact/{username}", summary="Securely forward recruiter message to candidate email")
async def send_contact_message(
    username: str,
    msg: ContactMessageSchema,
    bg_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    clean_username = username.strip().lower()
    profile = await db.user_profiles.find_one({"username": clean_username})
    if not profile or "email" not in profile:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    target_email = profile["email"]

    # Increment messages received in analytics
    await db.portfolio_analytics.update_one(
        {"username": clean_username},
        {"$inc": {"messages_received": 1}}
    )

    # Dispatch email in background task
    async def _send_mail():
        logger.info(
            "Dispatching contact message to candidate",
            to_email=target_email,
            from_name=msg.sender_name,
            from_email=msg.sender_email
        )
        try:
            # We can use the existing EmailService if available
            email_svc = EmailService()
            subject = f"[CareerShal Recruiter Inquiry] {msg.subject}"
            body_html = f"""
            <h3>New Message Received from your CareerShal Portfolio!</h3>
            <p><strong>Sender:</strong> {msg.sender_name} ({msg.sender_email})</p>
            <p><strong>Subject:</strong> {msg.subject}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">{msg.message}</p>
            <hr />
            <p style="color: #64748B; font-size: 12px;">This email was sent via CareerShal's secure contact router.</p>
            """
            # If email_svc has send_generic_email or similar
            if hasattr(email_svc, 'send_email'):
                await email_svc.send_email(to_email=target_email, subject=subject, html_content=body_html)
        except Exception as e:
            logger.error("Failed to forward contact email", error=str(e))

    bg_tasks.add_task(_send_mail)

    return {
        "status": "success",
        "message": f"Your message has been securely sent to {profile.get('full_name', 'the candidate')}."
    }
