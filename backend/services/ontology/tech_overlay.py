"""
High-Priority Curated Tech Taxonomy & Aliases Overlay.
Preserves specialized modern tech definitions (LangGraph, Qdrant, React, PyTorch, etc.)
that open taxonomies like ESCO lag on.
"""

from typing import Dict, List, Set
import re

# ─── 1. ALIAS MAPPING ─────────────────────────────────────────────────────────
SKILL_ALIASES: Dict[str, str] = {
    # Frontend & Web
    "react.js": "React",
    "reactjs": "React",
    "vue.js": "Vue",
    "vuejs": "Vue",
    "angular.js": "Angular",
    "angularjs": "Angular",
    "next.js": "Next.js",
    "nextjs": "Next.js",
    "nuxt.js": "Nuxt.js",
    "nuxtjs": "Nuxt.js",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "express.js": "Express",
    "expressjs": "Express",
    "nest.js": "NestJS",
    "nestjs": "NestJS",
    "js": "JavaScript",
    "ts": "TypeScript",
    "html5": "HTML",
    "css3": "CSS",
    "tailwind css": "Tailwind",
    "tailwindcss": "Tailwind",
    
    # Backend & Frameworks
    "fast api": "FastAPI",
    "spring boot": "Spring Boot",
    "django framework": "Django",
    "flask framework": "Flask",
    "asp.net": ".NET",
    "dotnet": ".NET",
    ".net": ".NET",
    
    # AI / ML & Vector DBs
    "pinecone db": "Pinecone",
    "chromadb": "ChromaDB",
    "chroma": "ChromaDB",
    "faiss": "FAISS",
    "qdrant": "Qdrant",
    "milvus": "Milvus",
    "weaviate": "Weaviate",
    "langchain": "LangChain",
    "llamaindex": "LlamaIndex",
    "llama-index": "LlamaIndex",
    "scikit learn": "Scikit-Learn",
    "sklearn": "Scikit-Learn",
    "tf": "TensorFlow",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "huggingface": "Hugging Face",
    "hugging face": "Hugging Face",
    "openai api": "OpenAI",
    "chatgpt": "OpenAI",
    "llm": "Large Language Models",
    "llms": "Large Language Models",
    "large language model": "Large Language Models",
    "rag": "Retrieval-Augmented Generation",
    "retrieval augmented generation": "Retrieval-Augmented Generation",

    # Cloud & DevOps
    "amazon web services": "AWS",
    "aws cloud": "AWS",
    "google cloud": "GCP",
    "google cloud platform": "GCP",
    "microsoft azure": "Azure",
    "k8s": "Kubernetes",
    "docker containers": "Docker",
    "github action": "GitHub Actions",
    "ci / cd": "CI/CD",
    "cicd": "CI/CD",
    
    # Databases
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "postgressql": "PostgreSQL",
    "postgre sql": "PostgreSQL",
    "postgres sql": "PostgreSQL",
    "postgre": "PostgreSQL",
    "postgre-sql": "PostgreSQL",
    "postgres-sql": "PostgreSQL",
    "psql": "PostgreSQL",
    "pgsql": "PostgreSQL",
    "pg": "PostgreSQL",
    "mongo": "MongoDB",
    "mongodb": "MongoDB",
    "elastic search": "Elasticsearch",
    "es": "Elasticsearch",
    "ms sql": "SQL Server",
    "mssql": "SQL Server",

    # Computer Science Fundamentals & Relevant Coursework
    "dsa": "Data Structures & Algorithms",
    "data structures": "Data Structures & Algorithms",
    "data structures and algorithms": "Data Structures & Algorithms",
    "data structures & algorithms": "Data Structures & Algorithms",
    "data structure": "Data Structures & Algorithms",
    "algorithms": "Algorithms",
    "algo": "Algorithms",
    "dbms": "DBMS",
    "database management system": "DBMS",
    "database management systems": "DBMS",
    "operating systems": "Operating Systems",
    "operating system": "Operating Systems",
    "os": "Operating Systems",
    "computer networks": "Computer Networks",
    "computer networking": "Computer Networks",
    "networking": "Computer Networks",
    "cn": "Computer Networks",
    "object oriented programming": "Object-Oriented Programming",
    "object-oriented programming": "Object-Oriented Programming",
    "oop": "Object-Oriented Programming",
    "oops": "Object-Oriented Programming",
    "system design": "System Design",
    "low level design": "LLD",
    "high level design": "HLD",
    "lld": "LLD",
    "hld": "HLD",
    
    # Programming Languages
    "python": "Python",
    "py": "Python",
    "python3": "Python",
    "python 3": "Python",
    "python-3": "Python",
    "golang": "Go",
    "cpp": "C++",
    "c sharp": "C#",
    "c#": "C#",
    "rust": "Rust",
    "graphql": "GraphQL",
    "kafka": "Apache Kafka",
}

# ─── 2. HIERARCHICAL TAXONOMY / KNOWLEDGE GRAPH ────────────────────────────────
SKILL_TAXONOMY: Dict[str, Dict[str, List[str]]] = {
    "Computer Science Fundamentals": {
        "parents": ["Software Engineering"],
        "children": [
            "Data Structures & Algorithms",
            "Algorithms",
            "DBMS",
            "Operating Systems",
            "Computer Networks",
            "Object-Oriented Programming",
            "System Design",
            "LLD",
            "HLD",
        ]
    },
    "Vector Databases": {
        "parents": ["AI & Machine Learning", "Databases"],
        "children": ["Pinecone", "ChromaDB", "FAISS", "Qdrant", "Milvus", "Weaviate"]
    },
    "Generative AI & LLMs": {
        "parents": ["AI & Machine Learning"],
        "children": ["LangChain", "LlamaIndex", "Large Language Models", "OpenAI", "Hugging Face", "Retrieval-Augmented Generation"]
    },
    "Machine Learning": {
        "parents": ["AI & Machine Learning", "Data Science"],
        "children": ["PyTorch", "TensorFlow", "Scikit-Learn", "Keras", "XGBoost", "Deep Learning", "NLP"]
    },
    "Frontend Development": {
        "parents": ["Web Development", "Software Engineering"],
        "children": ["React", "Vue", "Angular", "Next.js", "Nuxt.js", "Svelte", "HTML", "CSS", "Tailwind", "TypeScript", "JavaScript"]
    },
    "Backend Development": {
        "parents": ["Web Development", "Software Engineering"],
        "children": ["FastAPI", "Django", "Flask", "Node.js", "Express", "NestJS", "Spring Boot", "Go", "Java", "Python"]
    },
    "Cloud Platforms": {
        "parents": ["DevOps & Infrastructure"],
        "children": ["AWS", "Azure", "GCP", "DigitalOcean", "Heroku"]
    },
    "Containerization & Orchestration": {
        "parents": ["DevOps & Infrastructure"],
        "children": ["Docker", "Kubernetes"]
    },
    "DevOps & CI/CD": {
        "parents": ["Software Engineering"],
        "children": ["CI/CD", "GitHub Actions", "Jenkins", "Terraform", "Ansible", "Docker", "Kubernetes"]
    },
    "Relational Databases": {
        "parents": ["Databases"],
        "children": ["PostgreSQL", "MySQL", "SQL Server", "SQLite", "Oracle", "SQL"]
    },
    "NoSQL Databases": {
        "parents": ["Databases"],
        "children": ["MongoDB", "Redis", "Elasticsearch", "Cassandra", "DynamoDB"]
    },
    "Data Engineering": {
        "parents": ["Software Engineering", "Data Science"],
        "children": ["Apache Spark", "Apache Kafka", "Airflow", "Snowflake", "Databricks", "ETL"]
    },
    "Programming Languages": {
        "parents": ["Software Engineering"],
        "children": ["Python", "JavaScript", "TypeScript", "Go", "Java", "C++", "C#", "SQL"]
    }
}

CHILD_TO_PARENTS: Dict[str, Set[str]] = {}
PARENT_TO_CHILDREN: Dict[str, Set[str]] = {}
EXCLUDED_BRIDGING_PARENTS: Set[str] = {"Software Engineering"}

_VERSION_SUFFIX_PATTERN = re.compile(r"(\s+v?\d+(\.\d+)*|\s*\b\d+(\.\d+)*\b)$", re.IGNORECASE)

def _strip_version(skill_name: str) -> str:
    return _VERSION_SUFFIX_PATTERN.sub("", skill_name).strip()

def _build_inverse_index():
    for category, meta in SKILL_TAXONOMY.items():
        if category not in CHILD_TO_PARENTS:
            CHILD_TO_PARENTS[category] = set()
        parents = meta.get("parents", [])
        CHILD_TO_PARENTS[category].update(parents)
        children = meta.get("children", [])
        for child in children:
            if child not in CHILD_TO_PARENTS:
                CHILD_TO_PARENTS[child] = set()
            CHILD_TO_PARENTS[child].add(category)
            for p in parents:
                CHILD_TO_PARENTS[child].add(p)

    for child, parents in CHILD_TO_PARENTS.items():
        for p in parents:
            if p not in PARENT_TO_CHILDREN:
                PARENT_TO_CHILDREN[p] = set()
            PARENT_TO_CHILDREN[p].add(child)

    for p, ch in PARENT_TO_CHILDREN.items():
        if len(ch) > 40:
            EXCLUDED_BRIDGING_PARENTS.add(p)

_build_inverse_index()
