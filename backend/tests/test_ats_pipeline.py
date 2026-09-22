"""
End-to-End Pipeline Unit Tests for the Enterprise ATS Evaluation Engine.
Tests all phases: Skill Ontology, NLP Extractor, and Unified Scoring Engine.
"""

import pytest
from services.skill_ontology import expand_skills, normalize_skill, evaluate_skill_fulfillment
from services.nlp_extractor import extract_resume_data_deterministic
from services.scoring_engine import score_resume


def test_full_ats_pipeline_end_to_end():
    sample_resume = """
    Alex Johnson - Lead Software Engineer
    Email: alex.johnson@tech.io | Phone: +1-555-0199
    Summary: 6+ years of experience building high-scale distributed applications.
    Education: Master of Science (M.S.) in Computer Science.
    
    Technical Experience:
    - Designed vector search pipelines using Pinecone, ChromaDB, and LangChain for RAG LLM apps.
    - Built RESTful microservices with Python, FastAPI, and PostgreSQL.
    - Containerized workloads using Docker, Kubernetes, and deployed on AWS.
    - Automated CI/CD pipelines with GitHub Actions.
    """
    
    sample_jd = """
    We are seeking a Senior AI/Backend Engineer with at least 5 years of experience.
    Must have experience with Vector Databases (Pinecone/ChromaDB), Python, FastAPI, PostgreSQL, and AWS.
    Master's or Bachelor's degree in CS required.
    """
    
    # 1. Test Deterministic Extraction
    extraction_output = extract_resume_data_deterministic(sample_resume)
    assert "Python" in extraction_output["skills"]
    assert "Pinecone" in extraction_output["skills"]
    assert "FastAPI" in extraction_output["skills"]
    assert "Vector Databases" in extraction_output["implicit_concepts"]
    assert extraction_output["total_experience_years"] == 6.0
    assert extraction_output["education_level"] == "Master's Degree"
    
    # 2. Test Unified Scoring Engine Execution
    scored = score_resume(
        resume=extraction_output,
        jd=sample_jd,
        mode="candidate",
    )
    
    assert "final_score" in scored
    assert scored["final_score"] >= 60.0  # Good or Strong Match
    assert scored["recommendation"] in ("Good Match", "Strong Match")
    assert "Python" in scored["matched_skills"] or "Vector Databases" in scored["matched_skills"]
    assert scored["is_knockout"] is False


def test_pipeline_knockout_flagging():
    weak_resume = """
    Junior High School Graduate with beginner knowledge of HTML and CSS.
    No professional software engineering experience.
    """
    
    strict_jd = """
    Requires 8+ years of experience as Principal Distributed Systems Architect.
    Must have Ph.D. in Computer Science and expertise in Rust, C++, Kubernetes.
    """
    
    extraction_output = extract_resume_data_deterministic(weak_resume)
    
    scored = score_resume(
        resume=extraction_output,
        jd=strict_jd,
        mode="candidate",
    )
    
    assert scored["final_score"] < 50.0
    assert scored["is_knockout"] is True
    assert len(scored["knockout_reasons"]) > 0
