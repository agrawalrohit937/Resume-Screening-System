"""
Explain Routes — Explainable AI for ATS scores
"""

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_result_repo
from models.user_model import UserModel
from repositories.result_repo import ResultRepository
from utils.validators import validate_object_id

router = APIRouter()


@router.get("/{result_id}")
async def explain_score(
    result_id: str,
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Get full Explainable AI breakdown for an ATS result."""
    validate_object_id(result_id, "result_id")
    result = await result_repo.get_result_by_id(result_id)
    if not result or result.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found.")

    from utils.validators import score_to_grade
    bert_val = getattr(result, "bert_score", result.final_score / 100.0 if result.final_score > 1.0 else result.final_score)
    tfidf_val = getattr(result, "tfidf_score", result.final_score / 100.0 if result.final_score > 1.0 else result.final_score)
    skills_val = getattr(result, "skills_score", len(result.matched_skills) / max(len(result.matched_skills) + len(result.missing_skills), 1))
    kw_match_rate = getattr(result, "keyword_match_rate", len(result.matched_keywords) / max(len(result.matched_keywords) + len(result.missing_keywords), 1))

    return {
        "result_id": result_id,
        "final_score": result.final_score,
        "grade": score_to_grade(result.final_score),
        "recommendation": result.recommendation,
        "overall_assessment": result.overall_assessment,
        "score_components": {
            "bert_semantic_similarity": {
                "score": bert_val,
                "weight": "60%",
                "description": "Measures contextual and semantic alignment between resume and JD using LLM embeddings.",
            },
            "tfidf_keyword_match": {
                "score": tfidf_val,
                "weight": "40%",
                "description": "Measures literal keyword overlap.",
            },
            "experience_relevance": {
                "score": result.experience_score,
                "description": "How well your experience aligns with role requirements.",
            },
            "education_match": {
                "score": result.education_score,
                "description": "Degree level vs. job requirements.",
            },
            "skills_coverage": {
                "score": skills_val,
                "description": f"{len(result.matched_skills)} of {len(result.matched_skills)+len(result.missing_skills)} required skills matched.",
            },
        },
        "keyword_analysis": {
            "matched": result.matched_keywords,
            "missing": result.missing_keywords,
            "match_rate": kw_match_rate,
        },
        "section_explanations": getattr(result, "explanation", []),
        "strengths": result.strengths,
        "weaknesses": result.weaknesses,
        "improvement_roadmap": result.improvement_suggestions,
        "red_flags": getattr(result, "red_flags", []),
    }


@router.get("/compare-models/{result_id}")
async def compare_models(
    result_id: str,
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Model Evaluation — Compare BERT vs TF-IDF scores for a result."""
    validate_object_id(result_id, "result_id")
    result = await result_repo.get_result_by_id(result_id)
    if not result or result.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found.")

    bert_val = getattr(result, "bert_score", result.final_score / 100.0 if result.final_score > 1.0 else result.final_score)
    tfidf_val = getattr(result, "tfidf_score", result.final_score / 100.0 if result.final_score > 1.0 else result.final_score)
    model_vers = getattr(result, "model_versions", {})

    bert_recommendation = "strong_match" if bert_val >= 0.8 else "good_match" if bert_val >= 0.65 else "partial_match" if bert_val >= 0.45 else "poor_match"
    tfidf_recommendation = "strong_match" if tfidf_val >= 0.8 else "good_match" if tfidf_val >= 0.65 else "partial_match" if tfidf_val >= 0.45 else "poor_match"

    return {
        "result_id": result_id,
        "model_comparison": {
            "bert": {
                "model": model_vers.get("bert", "Groq-LLM-Evaluator"),
                "score": bert_val,
                "recommendation": bert_recommendation,
                "strengths": ["Captures semantic meaning", "Context-aware", "Handles synonyms"],
                "limitations": ["Slower inference", "May miss exact keyword requirements"],
            },
            "tfidf": {
                "model": model_vers.get("tfidf", "Strict-Keyword-Matcher"),
                "score": tfidf_val,
                "recommendation": tfidf_recommendation,
                "strengths": ["Fast", "Exact keyword matching", "Interpretable"],
                "limitations": ["No semantic understanding", "Misses context"],
            },
            "hybrid_final": {
                "score": result.final_score,
                "formula": "LangGraph AI + Deterministic Keyword Matcher",
                "recommendation": result.recommendation,
            },
        },
        "agreement": bert_recommendation == tfidf_recommendation,
        "score_delta": round(abs(bert_val - tfidf_val), 4),
    }

