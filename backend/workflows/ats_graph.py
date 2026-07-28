"""
ATS Evaluation Graph — Fully Deterministic & Enterprise Grade Engine.
Pipeline:
- Node 1: Deterministic Extraction via Skill Ontology & NLP Extractor
- Node 2: Dual-Stage Matcher (Knockout Math + Dense Vector Embedding Similarity)
- Node 3: Final Dual-Stage Scorer & Actionable Feedback Generator
"""

from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from services.nlp_extractor import extract_resume_data_deterministic
from services.strict_ats_service import (
    evaluate_knockout_math,
    compute_vector_similarity
)


# 1. Define the Global State
class ATSState(TypedDict, total=False):
    resume_text: str          # Input 1: Raw text extracted from PDF
    jd_text: str              # Input 2: Job description pasted by user
    required_skills: List[str]

    # Updated by Extraction Node (Node 1)
    extracted_data: dict      # Structured dict with normalized & expanded skills

    # Updated by JD Matching & Evaluation Node (Node 2)
    matched_skills: List[str]
    missing_skills: List[str]
    experience_score: float
    education_score: float
    vector_score: float
    math_score: float

    # Updated by Final Scoring Node (Node 3)
    final_score: float        # 0-100 scale
    recommendation: str
    feedback_suggestions: List[str]


# ==========================================
# NODE 1: Deterministic Extraction Engine (Replaces LLM)
# ==========================================

async def extract_resume_data(state: ATSState):
    """
    Takes raw resume text and performs deterministic NLP skill and metadata extraction
    via skill_ontology.py and nlp_extractor.py. Eliminates LLM latency & hallucination.
    """
    raw_text = state.get("resume_text", "")

    # Deterministic Extraction (No Groq LLM required)
    extracted_dict = extract_resume_data_deterministic(raw_text)

    skills_found = len(extracted_dict.get("skills", []) or [])
    if skills_found < 3:
        print(
            f"[ATSGraph] WARNING: Deterministic extractor found {skills_found} skills. "
            "Check resume raw text quality."
        )

    return {"extracted_data": extracted_dict}


# ==========================================
# NODE 2: Dual-Stage Deterministic Matcher (Replaces LLM)
# ==========================================

async def evaluate_jd_match(state: ATSState):
    """
    Compares extracted candidate data against the Job Description using:
    1. Filter 1: Knockout Math Engine (Ontology-backed mandatory skills, experience, education).
    2. Filter 2: Dense Vector Similarity (sentence-transformers / TF-IDF fallback).
    """
    extracted_data = state.get("extracted_data", {})
    resume_text = state.get("resume_text", "")
    jd_text = state.get("jd_text", "")

    if not jd_text or not jd_text.strip():
        return {
            "matched_skills": extracted_data.get("skills", []),
            "missing_skills": [],
            "experience_score": 1.0,
            "education_score": 1.0,
            "vector_score": 100.0,
            "math_score": 100.0,
        }

    math_result = evaluate_knockout_math(extracted_data, jd_text)
    vector_score = compute_vector_similarity(resume_text, jd_text)

    return {
        "matched_skills": math_result["matched_skills"],
        "missing_skills": math_result["missing_skills"],
        "experience_score": math_result["experience_score"] / 100.0,
        "education_score": math_result["education_score"] / 100.0,
        "vector_score": vector_score,
        "math_score": math_result["knockout_math_score"],
    }


# ==========================================
# NODE 3: Deterministic Dual-Stage Scorer (Replaces LLM)
# ==========================================

def generate_final_score(state: ATSState):
    """
    Calculates the final ATS percentage deterministically by blending:
    - 70% Knockout Math Score (Skills 50%, Experience 30%, Education 20%)
    - 30% Vector Semantic Similarity Score
    """
    math_score = state.get("math_score", 0.0)
    vector_score = state.get("vector_score", 0.0)
    missing = state.get("missing_skills", [])
    exp_score = state.get("experience_score", 1.0)

    # 1. Blend Dual-Stage Scores (70% Knockout Math + 30% Vector Semantic Match)
    final_score = round((math_score * 0.70) + (vector_score * 0.30), 2)

    # 2. Recommendation Label
    if final_score >= 80:
        recommendation = "Strong Match"
    elif final_score >= 60:
        recommendation = "Good Match"
    elif final_score >= 40:
        recommendation = "Partial Match"
    else:
        recommendation = "Low Match"

    # 3. Actionable Feedback
    feedback = []
    if missing:
        feedback.append(f"Missing mandatory skills for this role: {', '.join(missing[:5])}.")
    if exp_score < 0.7:
        feedback.append("Your professional experience duration is below the target requirement.")
    if final_score >= 80:
        feedback.append("Strong technical alignment and semantic match for this role.")

    return {
        "final_score": final_score,
        "recommendation": recommendation,
        "feedback_suggestions": feedback
    }


# ==========================================
# GRAPH COMPILATION (Connecting the Pipeline)
# ==========================================

workflow = StateGraph(ATSState)

workflow.add_node("extractor", extract_resume_data)
workflow.add_node("evaluator", evaluate_jd_match)
workflow.add_node("scorer", generate_final_score)

workflow.set_entry_point("extractor")
workflow.add_edge("extractor", "evaluator")
workflow.add_edge("evaluator", "scorer")
workflow.add_edge("scorer", END)

ats_engine = workflow.compile()