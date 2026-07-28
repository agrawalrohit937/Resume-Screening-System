"""
Unit tests for Deterministic NLP Extractor Module.
"""

import pytest
from services.nlp_extractor import (
    extract_skills_deterministic,
    extract_education_level,
    extract_resume_data_deterministic,
)


def test_extract_skills_deterministic():
    sample_text = """
    Jane Doe - Senior Full Stack Engineer
    Email: jane.doe@example.com | Phone: +1-555-0199
    Experience:
    - Built scalable microservices using Python, FastAPI, and PostgreSQL.
    - Implemented vector search using Pinecone DB and LangChain for RAG pipelines.
    - Frontend developed with React, NextJS, and Tailwind CSS.
    - Deployed workloads to AWS using Docker containers and GitHub Actions CI/CD.
    """
    
    extracted = extract_skills_deterministic(sample_text)
    
    # Assert canonical skill normalization
    assert "Python" in extracted
    assert "FastAPI" in extracted
    assert "PostgreSQL" in extracted
    assert "Pinecone" in extracted
    assert "LangChain" in extracted
    assert "Retrieval-Augmented Generation" in extracted or "LangChain" in extracted
    assert "React" in extracted
    assert "Next.js" in extracted  # Normalized from NextJS
    assert "Tailwind" in extracted
    assert "AWS" in extracted
    assert "Docker" in extracted
    assert "CI/CD" in extracted


def test_extract_skills_word_boundary_edge_cases():
    sample_text = """
    Proficient in C++, C#, .NET, Node.js, and Go.
    Also experienced with HTML5 and CSS3.
    """
    extracted = extract_skills_deterministic(sample_text)
    
    assert "C++" in extracted
    assert "C#" in extracted
    assert ".NET" in extracted
    assert "Node.js" in extracted
    assert "Go" in extracted
    assert "HTML" in extracted
    assert "CSS" in extracted


def test_extract_education_level():
    assert extract_education_level("Bachelor of Technology in Computer Science") == "Bachelor's Degree"
    assert extract_education_level("Master of Science (M.S.) in AI") == "Master's Degree"
    assert extract_education_level("Ph.D. in Computer Vision") == "Ph.D / Doctorate"
    assert extract_education_level("Diploma in Software Engineering") == "Diploma / Associate"


def test_extract_resume_data_deterministic():
    sample_resume = """
    John Smith
    john@gmail.com | 555-123-4567
    5+ years of experience as Software Architect.
    Education: B.Tech in CS from State University.
    Skills: Python, Docker, Kubernetes, Pinecone, PyTorch.
    """
    
    result = extract_resume_data_deterministic(sample_resume)
    
    assert "Python" in result["skills"]
    assert "Pinecone" in result["skills"]
    assert "Vector Databases" in result["implicit_concepts"]
    assert "AI & Machine Learning" in result["implicit_concepts"]
    assert result["total_experience_years"] == 5.0
    assert result["education_level"] == "Bachelor's Degree"
    assert result["contact_info"]["email"] == "john@gmail.com"
