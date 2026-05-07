"""
ATS Service — Hybrid TF-IDF + BERT scoring engine
final_score = 0.6 * BERT + 0.3 * TF-IDF + 0.1 * keyword_boost
"""
import requests
import time
import threading
from typing import List, Optional, Tuple

import numpy as np
import structlog
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from core.config import settings
from models.resume_model import ResumeModel
from models.result_model import ATSResultModel, SkillGap, ExplainSection
from utils.nlp_utils import (
    clean_text, get_tfidf_similarity, extract_keywords,
    detect_skills_in_text, TECH_SKILLS, extract_sections
)
from utils.validators import normalize_score, score_to_label

logger = structlog.get_logger(__name__)

# ─── Singleton BERT Model (thread-safe) ───────────────────────────────────────
_bert_model: Optional[SentenceTransformer] = None   # FIX: was accidentally commented out
_bert_lock = threading.Lock()

HF_API_URL = "https://huggingface.co/spaces/rk937/ats-bert-api"


def _get_bert_model() -> SentenceTransformer:
    global _bert_model
    if _bert_model is None:
        with _bert_lock:
            if _bert_model is None:  # double-checked locking
                logger.info("Loading BERT model", model=settings.BERT_MODEL_NAME)
                _bert_model = SentenceTransformer(settings.BERT_MODEL_NAME)
                logger.info("BERT model loaded successfully")
    return _bert_model


class ATSService:
    """
    Hybrid ATS scoring combining BERT semantic similarity and TF-IDF keyword matching.
    """

    def __init__(self):
        # Score formula: 60% BERT + 30% TF-IDF + 10% keyword match boost
        self.bert_weight = 0.60
        self.tfidf_weight = 0.30
        self.kw_boost_weight = 0.10

    # ─── Primary Scoring Pipeline ─────────────────────────────────────────────
    async def score_resume(
        self,
        resume: ResumeModel,
        job_description: str,
        job_title: str,
        required_skills: List[str] = [],
        preferred_skills: List[str] = [],
    ) -> dict:
        """
        Full ATS scoring pipeline.
        Returns a dict ready to be saved as ATSResultModel.
        """
        t_start = time.perf_counter()

        # ── Build Resume Text (robust: sections first, then full raw_text fallback)
        resume_text = self._build_resume_text(resume)
        if not resume_text.strip():
            raise ValueError("Resume has no parsed text. Re-upload and parse first.")

        # ── Step 1: Core Similarity ──────────────────────────────────────────
        bert_score = self._compute_bert_similarity(resume_text, job_description)
        tfidf_score = get_tfidf_similarity(resume_text, job_description)

        # ── Step 2: Keyword Analysis ─────────────────────────────────────────
        matched_kw, missing_kw, kw_score = self._keyword_analysis(
            resume_text, job_description, required_skills
        )

        # ── Step 3: Skill Matching ────────────────────────────────────────────
        matched_skills, missing_skills = self._match_skills(
            resume.parsed_data.skills if resume.parsed_data else [],
            required_skills + preferred_skills,
            job_description,
        )

        # ── Step 4: Component Scores ──────────────────────────────────────────
        experience_score = self._score_experience(resume, job_description)
        education_score = self._score_education(resume, job_description)

        # Skills score: if no required/preferred skills passed, detect from JD
        all_jd_skills_count = len(required_skills + preferred_skills)
        if all_jd_skills_count == 0:
            # Auto-detect skills from JD text
            jd_tech, _ = detect_skills_in_text(job_description)
            all_jd_skills_count = max(len(jd_tech), 1)
        skills_score = normalize_score(len(matched_skills) / all_jd_skills_count)

        # ── Step 5: Final Composite Score ─────────────────────────────────────
        # Formula: 60% BERT semantic + 30% TF-IDF keyword + 10% keyword match boost
        keyword_boost = kw_score * 0.10
        raw_final = (
            self.bert_weight * bert_score
            + self.tfidf_weight * tfidf_score
            + keyword_boost
        )
        final_score = normalize_score(raw_final)

        # ── Step 6: Skill Gaps ────────────────────────────────────────────────
        skill_gaps = self._build_skill_gaps(missing_skills, required_skills)

        # ── Step 7: Explanation ───────────────────────────────────────────────
        explanation = self._explain_scores(
            bert_score=bert_score,
            tfidf_score=tfidf_score,
            kw_score=kw_score,
            experience_score=experience_score,
            education_score=education_score,
            skills_score=skills_score,
            matched_kw=matched_kw,
            missing_kw=missing_kw[:10],
        )

        # ── Step 8: Strengths & Weaknesses ────────────────────────────────────
        strengths, weaknesses = self._derive_strengths_weaknesses(
            final_score, matched_skills, missing_skills, experience_score, education_score
        )
        improvement_suggestions = self._build_suggestions(missing_kw, missing_skills, weaknesses)
        overall_assessment = self._build_overall_assessment(final_score, job_title, matched_skills)
        recommendation = score_to_label(final_score)

        processing_time_ms = int((time.perf_counter() - t_start) * 1000)

        logger.info(
            "ATS score computed",
            bert=round(bert_score, 3),
            tfidf=round(tfidf_score, 3),
            kw=round(kw_score, 3),
            final=final_score,
            resume_chars=len(resume_text),
        )

        return dict(
            bert_score=round(bert_score, 4),
            tfidf_score=round(tfidf_score, 4),
            final_score=final_score,
            keyword_score=kw_score,
            experience_score=experience_score,
            education_score=education_score,
            skills_score=skills_score,
            matched_keywords=matched_kw,
            missing_keywords=missing_kw,
            keyword_match_rate=kw_score,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            skill_gaps=[sg.model_dump() for sg in skill_gaps],
            explanation=[e.model_dump() for e in explanation],
            overall_assessment=overall_assessment,
            improvement_suggestions=improvement_suggestions,
            strengths=strengths,
            weaknesses=weaknesses,
            recommendation=recommendation,
            processing_time_ms=processing_time_ms,
            model_versions={
                "bert": settings.BERT_MODEL_NAME,
                "tfidf": "sklearn-1.4",
            },
        )
    
    def _compute_hf_similarity(self, text1: str, text2: str) -> float:
        try:
            response = requests.post(
                HF_API_URL,
                json={"data": [text1[:3000], text2[:3000]]},
                timeout=30
            )

            if response.status_code != 200:
                logger.warning("HF status error", status=response.status_code)
                return 0.0

            result = response.json()

            if "data" in result and len(result["data"]) > 0:
                score_data = result["data"][0]

                if isinstance(score_data, dict) and "score" in score_data:
                    return normalize_score(score_data["score"] / 100)

            logger.warning("HF invalid response", response=result)
            return 0.0

        except Exception as e:
            logger.error("HF similarity failed", error=str(e))
        return 0.0

    # ─── Resume Text Builder (robust) ────────────────────────────────────────
    def _build_resume_text(self, resume: ResumeModel) -> str:
        """Build the best possible resume text for scoring.
        Priority: sections (if detected) supplemented by full raw_text.
        Always falls back to full raw_text to avoid empty text.
        """
        if not resume.parsed_data:
            return ""
        raw = resume.parsed_data.raw_text or ""
        if not raw.strip():
            return ""

        sections = extract_sections(raw)
        relevant_parts = [
            sections.get("summary", ""),
            sections.get("experience", ""),
            sections.get("skills", ""),
            sections.get("projects", ""),
            sections.get("certifications", ""),
        ]
        section_text = " ".join(s for s in relevant_parts if s).strip()

        # If sections detected well (>20% of raw), use sections + raw combined
        if len(section_text) > len(raw) * 0.2:
            # Combine: section text gives structure, raw_text ensures nothing is missed
            combined = section_text + " " + raw
            return combined[:8000]  # limit for BERT

        # Fallback: use full raw text — sections weren't detected reliably
        return raw[:8000]

    # ─── BERT Similarity ──────────────────────────────────────────────────────
    def _compute_bert_similarity(self, text1: str, text2: str) -> float:
        try:
            model = _get_bert_model()
            # Truncate to 4096 chars for BERT token limit
            t1 = clean_text(text1)[:4096]
            t2 = clean_text(text2)[:4096]
            if not t1.strip() or not t2.strip():
                return 0.0
            embeddings = model.encode([t1, t2], convert_to_numpy=True, normalize_embeddings=True)
            sim = float(np.dot(embeddings[0], embeddings[1]))
            # Cosine sim of normalized vectors is in [-1, 1]; clamp to [0, 1]
            return normalize_score(sim)
        except Exception as e:
            logger.warning("BERT similarity failed", error=str(e))
            return 0.0

    # ─── Bulk BERT Embeddings ──────────────────────────────────────────────────
    def bulk_bert_similarity(self, resume_texts: List[str], jd_text: str) -> List[float]:
        try:
            model = _get_bert_model()
            all_texts = [clean_text(t)[:4096] for t in resume_texts] + [clean_text(jd_text)[:4096]]
            embeddings = model.encode(all_texts, convert_to_numpy=True, normalize_embeddings=True)
            jd_embedding = embeddings[-1].reshape(1, -1)
            resume_embeddings = embeddings[:-1]
            sims = cosine_similarity(resume_embeddings, jd_embedding).flatten()
            return [normalize_score(float(s)) for s in sims]
        except Exception as e:
            logger.error("Bulk BERT failed", error=str(e))
            return [0.0] * len(resume_texts)

    # ─── Keyword Analysis ──────────────────────────────────────────────────────────
    def _keyword_analysis(
        self,
        resume_text: str,
        jd_text: str,
        required_skills: List[str],
    ) -> Tuple[List[str], List[str], float]:
        # Extract important keywords from JD using TF-IDF
        jd_kw_tfidf = {kw for kw, _ in extract_keywords(jd_text, top_n=50)}
        # Also add tech skills found in JD for richer matching
        jd_tech, _ = detect_skills_in_text(jd_text)
        jd_keywords = jd_kw_tfidf | {s.lower() for s in jd_tech}
        # Required skills always included
        jd_keywords.update(s.lower() for s in required_skills)
        # Remove very short tokens that cause false positives
        jd_keywords = {kw for kw in jd_keywords if len(kw) > 2}

        resume_lower = resume_text.lower()
        matched = [kw for kw in jd_keywords if kw in resume_lower]
        missing = [kw for kw in jd_keywords if kw not in resume_lower]
        rate = normalize_score(len(matched) / max(len(jd_keywords), 1))
        return sorted(matched), sorted(missing), rate

    # ─── Skill Matching ───────────────────────────────────────────────────────
    def _match_skills(
        self,
        resume_skills: List[str],
        jd_skills: List[str],
        jd_text: str,
    ) -> Tuple[List[str], List[str]]:
        # Merge explicit skills with auto-detected
        jd_tech, _ = detect_skills_in_text(jd_text)
        all_jd_skills = set(s.lower() for s in jd_skills + jd_tech)
        resume_skill_set = set(s.lower() for s in resume_skills)

        matched = sorted(all_jd_skills & resume_skill_set)
        missing = sorted(all_jd_skills - resume_skill_set)
        return matched, missing

    # ─── Experience Score ─────────────────────────────────────────────────────
    def _score_experience(self, resume: ResumeModel, jd_text: str) -> float:
        if not resume.parsed_data:
            return 0.0
        exp_years = resume.parsed_data.total_experience_years

        import re
        jd_lower = jd_text.lower()
        req_years_match = re.search(r"(\d+)\+?\s*years?\s+(?:of\s+)?experience", jd_lower)
        if req_years_match:
            required = float(req_years_match.group(1))
            if exp_years >= required:
                return 1.0
            elif exp_years >= required * 0.7:
                return 0.75
            elif exp_years >= required * 0.5:
                return 0.5
            else:
                return 0.25
        # No requirement specified — score proportionally (cap at 10 yrs)
        return normalize_score(min(exp_years / 10.0, 1.0))

    # ─── Education Score ──────────────────────────────────────────────────────
    def _score_education(self, resume: ResumeModel, jd_text: str) -> float:
        if not resume.parsed_data or not resume.parsed_data.education:
            return 0.3  # No education listed but not penalized heavily
        degrees = [e.degree for e in resume.parsed_data.education if e.degree]
        jd_lower = jd_text.lower()

        if any("phd" in (d or "").lower() or "doctor" in (d or "").lower() for d in degrees):
            return 1.0
        if any("master" in (d or "").lower() or "m.s" in (d or "").lower() for d in degrees):
            if "phd" in jd_lower or "doctorate" in jd_lower:
                return 0.8
            return 1.0
        if any("bachelor" in (d or "").lower() or "b.s" in (d or "").lower() for d in degrees):
            if "master" in jd_lower:
                return 0.7
            return 0.9
        return 0.5

    # ─── Skill Gap Builder ────────────────────────────────────────────────────
    def _build_skill_gaps(
        self, missing_skills: List[str], required_skills: List[str]
    ) -> List[SkillGap]:
        req_set = set(s.lower() for s in required_skills)
        gaps = []
        for skill in missing_skills[:15]:
            importance = "critical" if skill in req_set else "important"
            resources = self._get_learning_resources(skill)
            gaps.append(SkillGap(
                skill=skill,
                importance=importance,
                learning_resources=resources,
                estimated_learning_weeks=self._estimate_weeks(skill),
            ))
        return gaps

    def _get_learning_resources(self, skill: str) -> List[dict]:
        resource_map = {
            "python": [
                {"title": "Python.org Official Docs", "url": "https://docs.python.org", "platform": "official"},
                {"title": "Real Python", "url": "https://realpython.com", "platform": "blog"},
            ],
            "docker": [
                {"title": "Docker Get Started", "url": "https://docs.docker.com/get-started/", "platform": "official"},
            ],
            "kubernetes": [
                {"title": "Kubernetes Basics", "url": "https://kubernetes.io/docs/tutorials/", "platform": "official"},
            ],
            "react": [
                {"title": "React Docs", "url": "https://react.dev", "platform": "official"},
            ],
            "aws": [
                {"title": "AWS Training", "url": "https://aws.amazon.com/training/", "platform": "official"},
            ],
        }
        return resource_map.get(skill.lower(), [
            {"title": f"Learn {skill.title()} on Coursera", "url": f"https://www.coursera.org/search?query={skill}", "platform": "coursera"},
            {"title": f"{skill.title()} on freeCodeCamp", "url": f"https://www.freecodecamp.org/news/tag/{skill.lower().replace(' ', '-')}/", "platform": "freecodecamp"},
        ])

    def _estimate_weeks(self, skill: str) -> int:
        complex_skills = {"kubernetes", "aws", "machine learning", "tensorflow", "pytorch", "scala"}
        if skill.lower() in complex_skills:
            return 12
        return 4

    # ─── Explanation Builder ──────────────────────────────────────────────────
    def _explain_scores(self, **kwargs) -> List[ExplainSection]:
        bert = kwargs["bert_score"]
        tfidf = kwargs["tfidf_score"]
        kw = kwargs["kw_score"]
        exp = kwargs["experience_score"]
        edu = kwargs["education_score"]
        skills = kwargs["skills_score"]
        matched_kw = kwargs["matched_kw"]
        missing_kw = kwargs["missing_kw"]

        sections = [
            ExplainSection(
                section="Semantic Similarity (BERT)",
                score=bert,
                reason=f"Your resume has {bert*100:.0f}% semantic alignment with the job description based on contextual meaning.",
                suggestions=(
                    ["Incorporate domain-specific terminology from the JD"] if bert < 0.6
                    else ["Great semantic alignment — keep using relevant terminology"]
                ),
            ),
            ExplainSection(
                section="Keyword Match (TF-IDF)",
                score=tfidf,
                reason=f"Keyword overlap score is {tfidf*100:.0f}%. Found {len(matched_kw)} keywords from JD in your resume.",
                suggestions=(
                    [f"Add missing keywords: {', '.join(missing_kw[:5])}"] if missing_kw
                    else ["Excellent keyword coverage"]
                ),
            ),
            ExplainSection(
                section="Experience Relevance",
                score=exp,
                reason=f"Experience alignment with role requirements: {exp*100:.0f}%.",
                suggestions=(
                    ["Quantify achievements with metrics (%, $, throughput)"] if exp < 0.7
                    else ["Experience level is well-matched"]
                ),
            ),
            ExplainSection(
                section="Education Match",
                score=edu,
                reason=f"Education score: {edu*100:.0f}% based on degree level vs. requirements.",
                suggestions=(
                    ["Consider relevant certifications to compensate for education gap"] if edu < 0.7
                    else ["Education meets or exceeds requirements"]
                ),
            ),
            ExplainSection(
                section="Skills Coverage",
                score=skills,
                reason=f"You match {skills*100:.0f}% of required/preferred skills.",
                suggestions=(
                    [f"Prioritize learning: {', '.join(missing_kw[:3])}"] if skills < 0.6
                    else ["Strong skills alignment"]
                ),
            ),
        ]
        return sections

    # ─── Strengths & Weaknesses ───────────────────────────────────────────────
    def _derive_strengths_weaknesses(
        self, final_score, matched_skills, missing_skills, exp_score, edu_score
    ) -> Tuple[List[str], List[str]]:
        strengths, weaknesses = [], []

        if final_score >= 0.75:
            strengths.append("Strong overall alignment with the job requirements")
        if matched_skills:
            strengths.append(f"Demonstrates {len(matched_skills)} matching skills: {', '.join(matched_skills[:5])}")
        if exp_score >= 0.8:
            strengths.append("Experience level meets or exceeds job requirements")
        if edu_score >= 0.9:
            strengths.append("Education qualifications are well-matched")

        if missing_skills:
            weaknesses.append(f"Missing {len(missing_skills)} required/preferred skills")
        if final_score < 0.5:
            weaknesses.append("Low overall match — significant gap between profile and requirements")
        if exp_score < 0.5:
            weaknesses.append("Experience level may be below expectations for this role")

        return strengths or ["Resume submitted successfully"], weaknesses or ["Minor skill gaps identified"]

    def _build_suggestions(self, missing_kw, missing_skills, weaknesses) -> List[str]:
        suggestions = []
        if missing_kw[:3]:
            suggestions.append(f"Add these high-impact keywords: {', '.join(missing_kw[:3])}")
        if missing_skills[:3]:
            suggestions.append(f"Develop skills in: {', '.join(missing_skills[:3])}")
        suggestions.append("Quantify achievements: 'Improved performance by 30%' > 'Improved performance'")
        suggestions.append("Use strong action verbs: Built, Designed, Led, Optimized, Reduced")
        if len(weaknesses) > 1:
            suggestions.append("Consider tailoring this resume specifically for the target role")
        return suggestions

    def _build_overall_assessment(self, score, job_title, matched_skills) -> str:
        label = score_to_label(score)
        skill_str = ", ".join(matched_skills[:3]) if matched_skills else "various areas"
        if label == "strong_match":
            return f"Excellent candidate for {job_title}. Strong alignment across {skill_str}. Highly recommended for interview."
        elif label == "good_match":
            return f"Good fit for {job_title}. Demonstrates relevant skills in {skill_str}. Consider for interview with minor gaps noted."
        elif label == "partial_match":
            return f"Partial match for {job_title}. Shows potential in {skill_str} but has notable gaps. Recommend upskilling before applying."
        else:
            return f"Low match for {job_title}. Significant skill and experience gaps detected. Recommend substantial profile improvement."
