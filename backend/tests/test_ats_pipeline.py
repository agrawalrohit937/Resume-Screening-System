"""
End-to-End Pipeline Unit Tests for the Enterprise ATS Evaluation Engine.
Tests all 4 phases: Skill Ontology, NLP Extractor, Dual-Stage Scoring, and Graph Engine.
"""

import pytest
from workflows.ats_graph import ats_engine
from services.skill_ontology import expand_skills, normalize_skill, evaluate_skill_fulfillment
from services.nlp_extractor import extract_resume_data_deterministic
from services.strict_ats_service import run_strict_ats_check, compute_vector_similarity


@pytest.mark.asyncio
async def test_full_ats_pipeline_end_to_end():
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
    
    # 1. Test Node 1: Deterministic Extraction
    extraction_output = extract_resume_data_deterministic(sample_resume)
    assert "Python" in extraction_output["skills"]
    assert "Pinecone" in extraction_output["skills"]
    assert "FastAPI" in extraction_output["skills"]
    assert "Vector Databases" in extraction_output["implicit_concepts"]
    assert extraction_output["total_experience_years"] == 6.0
    assert extraction_output["education_level"] == "Master's Degree"
    
    # 2. Test Full LangGraph Pipeline Execution (Nodes 1, 2, 3)
    graph_result = await ats_engine.ainvoke({
        "resume_text": sample_resume,
        "jd_text": sample_jd,
    })
    
    assert "final_score" in graph_result
    assert graph_result["final_score"] >= 60.0  # Good or Strong Match
    assert graph_result["recommendation"] in ("Good Match", "Strong Match")
    assert "Python" in graph_result["matched_skills"] or "Vector Databases" in graph_result["matched_skills"]
    
    # 3. Test Orchestrated Strict Check
    strict_check = run_strict_ats_check(
        raw_text=sample_resume,
        extracted_data=extraction_output,
        jd_text=sample_jd,
        skill_universe=graph_result["matched_skills"] + graph_result["missing_skills"]
    )
    
    assert strict_check["knockout"]["is_knockout"] is False
    assert strict_check["vector_score"] > 40.0
    assert strict_check["final_score"] >= 75.0


@pytest.mark.asyncio
async def test_pipeline_knockout_flagging():
    weak_resume = """
    Junior High School Graduate with beginner knowledge of HTML and CSS.
    No professional software engineering experience.
    """
    
    strict_jd = """
    Requires 8+ years of experience as Principal Distributed Systems Architect.
    Must have Ph.D. in Computer Science and expertise in Rust, C++, Kubernetes.
    """
    
    extraction_output = extract_resume_data_deterministic(weak_resume)
    
    graph_result = await ats_engine.ainvoke({
        "resume_text": weak_resume,
        "jd_text": strict_jd,
    })
    
    assert graph_result["final_score"] < 40.0
    assert graph_result["recommendation"] == "Low Match"
    
    strict_check = run_strict_ats_check(
        raw_text=weak_resume,
        extracted_data=extraction_output,
        jd_text=strict_jd,
        skill_universe=graph_result["matched_skills"] + graph_result["missing_skills"]
    )
    
    assert strict_check["knockout"]["is_knockout"] is True
    assert len(strict_check["knockout"]["reasons"]) > 0
