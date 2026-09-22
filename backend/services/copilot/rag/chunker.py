"""
Section-Aware Document Chunker for Copilot Hybrid RAG.

Splits resumes, job descriptions, interview transcripts, and help docs into
semantically coherent units (~500 tokens max, ~80 token overlap) while strictly
preserving bullet-point boundaries and injecting contextual breadcrumbs.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, List, Optional


def _sha256(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def _estimate_tokens(text: str) -> int:
    # Conservative approximation: ~4 characters per token in English
    return max(1, len(text) // 4)


def _split_into_paragraphs_or_bullets(text: str) -> List[str]:
    """Splits text cleanly along bullet points (•, -, *, numbers) or double newlines."""
    lines = text.splitlines()
    units: List[str] = []
    current_unit: List[str] = []

    bullet_pattern = re.compile(r"^\s*([•\-\*\u2022\u2023\u25E6\u2043\u2219]|\d+[\.\)])\s+")

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_unit:
                units.append("\n".join(current_unit).strip())
                current_unit = []
            continue

        if bullet_pattern.match(stripped):
            if current_unit:
                units.append("\n".join(current_unit).strip())
                current_unit = [stripped]
            else:
                current_unit.append(stripped)
        else:
            current_unit.append(stripped)

    if current_unit:
        units.append("\n".join(current_unit).strip())

    return [u for u in units if u]


def _chunk_units(
    units: List[str],
    breadcrumb: str,
    max_tokens: int = 500,
    overlap_tokens: int = 80,
) -> List[str]:
    """
    Packs semantic units into chunks bounded by max_tokens with sliding unit overlap.
    Prepends the contextual breadcrumb to each chunk.
    """
    if not units:
        return []

    chunks: List[str] = []
    current_chunk_units: List[str] = []
    current_token_count = _estimate_tokens(breadcrumb)

    for unit in units:
        unit_tokens = _estimate_tokens(unit)
        if current_token_count + unit_tokens > max_tokens and current_chunk_units:
            full_text = f"{breadcrumb}\n\n" + "\n\n".join(current_chunk_units)
            chunks.append(full_text.strip())

            # Form overlap: take trailing units up to overlap_tokens
            overlap_accum: List[str] = []
            accum_tokens = 0
            for prev_u in reversed(current_chunk_units):
                prev_t = _estimate_tokens(prev_u)
                if accum_tokens + prev_t <= overlap_tokens:
                    overlap_accum.insert(0, prev_u)
                    accum_tokens += prev_t
                else:
                    break

            current_chunk_units = overlap_accum + [unit]
            current_token_count = _estimate_tokens(breadcrumb) + accum_tokens + unit_tokens
        else:
            current_chunk_units.append(unit)
            current_token_count += unit_tokens

    if current_chunk_units:
        full_text = f"{breadcrumb}\n\n" + "\n\n".join(current_chunk_units)
        chunks.append(full_text.strip())

    return chunks


class DocumentChunker:
    """
    Enterprise-grade section-aware chunker for CareerShala Copilot.
    """

    MAX_TOKENS = 500
    OVERLAP_TOKENS = 80

    @classmethod
    def chunk_resume(
        cls,
        parsed_resume: Dict[str, Any],
        raw_text: str = "",
        resume_id: str = "default_resume",
    ) -> List[Dict[str, Any]]:
        """
        Chunks a structured resume into section-bound chunks with breadcrumbs.
        """
        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        # 1. Summary
        summary = str(parsed_resume.get("summary") or "").strip()
        if summary:
            breadcrumb = "[Resume > Professional Summary]"
            text = f"{breadcrumb}\n\n{summary}"
            chunks.append({
                "source_type": "resume",
                "source_id": resume_id,
                "chunk_index": chunk_idx,
                "title": "Professional Summary",
                "text": text,
                "text_hash": _sha256(text),
                "metadata": {"section": "summary"},
            })
            chunk_idx += 1

        # 2. Skills
        skills = parsed_resume.get("skills") or parsed_resume.get("technical_skills") or []
        if isinstance(skills, list) and skills:
            skills_str = ", ".join(str(s).strip() for s in skills if s)
            breadcrumb = "[Resume > Technical & Core Skills]"
            text = f"{breadcrumb}\n\n{skills_str}"
            chunks.append({
                "source_type": "resume",
                "source_id": resume_id,
                "chunk_index": chunk_idx,
                "title": "Technical Skills",
                "text": text,
                "text_hash": _sha256(text),
                "metadata": {"section": "skills", "skill_count": len(skills)},
            })
            chunk_idx += 1

        # 3. Work Experience
        experiences = parsed_resume.get("experience") or parsed_resume.get("work_experience") or []
        if isinstance(experiences, list):
            for exp in experiences:
                if not isinstance(exp, dict):
                    continue
                role = exp.get("title") or exp.get("role") or "Role"
                company = exp.get("company") or exp.get("organization") or "Company"
                dates = exp.get("dates") or exp.get("duration") or ""
                desc = exp.get("description") or exp.get("summary") or ""
                responsibilities = exp.get("responsibilities") or exp.get("bullets") or []

                header = f"{role} at {company}"
                if dates:
                    header += f" ({dates})"

                breadcrumb = f"[Resume > Experience > {header}]"
                units = []
                if desc:
                    units.append(str(desc).strip())
                if isinstance(responsibilities, list):
                    for resp in responsibilities:
                        if resp:
                            units.append(f"• {str(resp).strip()}")
                elif isinstance(responsibilities, str) and responsibilities:
                    units.extend(_split_into_paragraphs_or_bullets(responsibilities))

                if not units:
                    continue

                exp_chunks = _chunk_units(units, breadcrumb, cls.MAX_TOKENS, cls.OVERLAP_TOKENS)
                for c_text in exp_chunks:
                    chunks.append({
                        "source_type": "resume",
                        "source_id": resume_id,
                        "chunk_index": chunk_idx,
                        "title": f"Experience: {header}",
                        "text": c_text,
                        "text_hash": _sha256(c_text),
                        "metadata": {
                            "section": "experience",
                            "role": role,
                            "company": company,
                            "dates": dates,
                        },
                    })
                    chunk_idx += 1

        # 4. Education
        education = parsed_resume.get("education") or []
        if isinstance(education, list):
            for edu in education:
                if not isinstance(edu, dict):
                    continue
                degree = edu.get("degree") or "Degree"
                institution = edu.get("institution") or edu.get("school") or edu.get("college") or "Institution"
                year = edu.get("year") or edu.get("grad_year") or ""
                gpa = edu.get("gpa") or edu.get("grade") or ""

                edu_title = f"{degree}, {institution}"
                breadcrumb = f"[Resume > Education > {edu_title}]"
                body = f"Degree: {degree}\nInstitution: {institution}"
                if year:
                    body += f"\nGraduation: {year}"
                if gpa:
                    body += f"\nGPA/Grade: {gpa}"

                text = f"{breadcrumb}\n\n{body}"
                chunks.append({
                    "source_type": "resume",
                    "source_id": resume_id,
                    "chunk_index": chunk_idx,
                    "title": f"Education: {edu_title}",
                    "text": text,
                    "text_hash": _sha256(text),
                    "metadata": {"section": "education", "degree": degree, "institution": institution},
                })
                chunk_idx += 1

        # 5. Projects
        projects = parsed_resume.get("projects") or []
        if isinstance(projects, list):
            for proj in projects:
                if not isinstance(proj, dict):
                    continue
                proj_name = proj.get("name") or proj.get("title") or "Project"
                proj_desc = proj.get("description") or ""
                tech = proj.get("technologies") or proj.get("tools") or []

                breadcrumb = f"[Resume > Project > {proj_name}]"
                units = []
                if proj_desc:
                    units.extend(_split_into_paragraphs_or_bullets(str(proj_desc)))
                if isinstance(tech, list) and tech:
                    units.append(f"Technologies: {', '.join(str(t) for t in tech)}")

                if not units:
                    continue

                proj_chunks = _chunk_units(units, breadcrumb, cls.MAX_TOKENS, cls.OVERLAP_TOKENS)
                for c_text in proj_chunks:
                    chunks.append({
                        "source_type": "resume",
                        "source_id": resume_id,
                        "chunk_index": chunk_idx,
                        "title": f"Project: {proj_name}",
                        "text": c_text,
                        "text_hash": _sha256(c_text),
                        "metadata": {"section": "projects", "project_name": proj_name},
                    })
                    chunk_idx += 1

        # 6. Fallback if structured sections were sparse but raw_text exists
        if len(chunks) <= 1 and raw_text and len(raw_text.strip()) > 100:
            units = _split_into_paragraphs_or_bullets(raw_text)
            breadcrumb = "[Resume > General Content]"
            for c_text in _chunk_units(units, breadcrumb, cls.MAX_TOKENS, cls.OVERLAP_TOKENS):
                chunks.append({
                    "source_type": "resume",
                    "source_id": resume_id,
                    "chunk_index": chunk_idx,
                    "title": f"Resume Content (Part {chunk_idx + 1})",
                    "text": c_text,
                    "text_hash": _sha256(c_text),
                    "metadata": {"section": "raw"},
                })
                chunk_idx += 1

        return chunks

    @classmethod
    def chunk_job_description(
        cls,
        job_data: Dict[str, Any],
        job_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Chunks a job description with role context breadcrumbs.
        """
        title = job_data.get("title") or "Job"
        company = job_data.get("company") or "Company"
        location = job_data.get("location") or ""
        breadcrumb_prefix = f"[Job Description > {title} at {company}]"

        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        # Overview
        desc = str(job_data.get("description") or "").strip()
        if desc:
            units = _split_into_paragraphs_or_bullets(desc)
            desc_chunks = _chunk_units(units, f"{breadcrumb_prefix} > Overview", cls.MAX_TOKENS, cls.OVERLAP_TOKENS)
            for c_text in desc_chunks:
                chunks.append({
                    "source_type": "job_description",
                    "source_id": str(job_id),
                    "chunk_index": chunk_idx,
                    "title": f"{title} - Overview",
                    "text": c_text,
                    "text_hash": _sha256(c_text),
                    "metadata": {"section": "overview", "job_title": title, "company": company, "location": location},
                })
                chunk_idx += 1

        # Requirements
        reqs = job_data.get("requirements") or job_data.get("skills_required") or []
        if reqs:
            if isinstance(reqs, list):
                units = [f"• {str(r).strip()}" for r in reqs if r]
            else:
                units = _split_into_paragraphs_or_bullets(str(reqs))

            req_chunks = _chunk_units(units, f"{breadcrumb_prefix} > Requirements", cls.MAX_TOKENS, cls.OVERLAP_TOKENS)
            for c_text in req_chunks:
                chunks.append({
                    "source_type": "job_description",
                    "source_id": str(job_id),
                    "chunk_index": chunk_idx,
                    "title": f"{title} - Requirements",
                    "text": c_text,
                    "text_hash": _sha256(c_text),
                    "metadata": {"section": "requirements", "job_title": title, "company": company},
                })
                chunk_idx += 1

        return chunks

    @classmethod
    def chunk_interview_transcript(
        cls,
        session_data: Dict[str, Any],
        session_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Chunks mock interview Q&As into individual QA units.
        """
        job_role = session_data.get("target_role") or "Mock Interview"
        history = session_data.get("questions") or session_data.get("history") or []
        chunks: List[Dict[str, Any]] = []

        if not isinstance(history, list):
            return chunks

        for idx, item in enumerate(history):
            if not isinstance(item, dict):
                continue
            question = item.get("question") or ""
            answer = item.get("answer") or item.get("candidate_response") or ""
            feedback = item.get("feedback") or item.get("critique") or ""
            score = item.get("score")

            breadcrumb = f"[Interview > {job_role} > Question {idx + 1}]"
            body = f"Question: {question}\n\nCandidate Answer: {answer}"
            if feedback:
                body += f"\n\nInterviewer Feedback: {feedback}"
            if score is not None:
                body += f"\nScore: {score}/10"

            text = f"{breadcrumb}\n\n{body}"
            chunks.append({
                "source_type": "interview_transcript",
                "source_id": str(session_id),
                "chunk_index": idx,
                "title": f"Interview Q{idx + 1}: {question[:60]}...",
                "text": text,
                "text_hash": _sha256(text),
                "metadata": {"section": "interview", "question_index": idx + 1, "score": score},
            })

        return chunks

    @classmethod
    def chunk_help_doc(
        cls,
        doc_title: str,
        content: str,
        doc_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Chunks markdown help and FAQ documentation by headers.
        """
        chunks: List[Dict[str, Any]] = []
        sections = re.split(r"\n(?=#{1,3}\s+)", content)
        chunk_idx = 0

        for sec in sections:
            stripped = sec.strip()
            if not stripped:
                continue

            header_match = re.match(r"^#{1,3}\s+(.+)", stripped)
            sec_header = header_match.group(1).strip() if header_match else "Guidance"
            breadcrumb = f"[Help Doc > {doc_title} > {sec_header}]"

            units = _split_into_paragraphs_or_bullets(stripped)
            sec_chunks = _chunk_units(units, breadcrumb, cls.MAX_TOKENS, cls.OVERLAP_TOKENS)
            for c_text in sec_chunks:
                chunks.append({
                    "source_type": "help_doc",
                    "source_id": str(doc_id),
                    "chunk_index": chunk_idx,
                    "title": f"{doc_title}: {sec_header}",
                    "text": c_text,
                    "text_hash": _sha256(c_text),
                    "metadata": {"section": "help", "doc_title": doc_title, "header": sec_header},
                })
                chunk_idx += 1

        return chunks
