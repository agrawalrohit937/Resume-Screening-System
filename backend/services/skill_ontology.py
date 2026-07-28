"""
Skill Ontology & Knowledge Graph Module for Enterprise ATS Evaluation.
Provides hierarchical skill relationships, alias normalization, taxonomy expansion,
and semantic domain equivalence matching.
"""

from typing import Dict, List, Set, Tuple, Optional
import re
import structlog

logger = structlog.get_logger(__name__)

# ─── 1. ALIAS MAPPING ─────────────────────────────────────────────────────────
# Maps common variations, typos, and alternate names to canonical skill names.
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
    "mongo": "MongoDB",
    "mongodb": "MongoDB",
    "elastic search": "Elasticsearch",
    "es": "Elasticsearch",
    "ms sql": "SQL Server",
    "mssql": "SQL Server",
    
    # Programming Languages
    "py": "Python",
    "python3": "Python",
    "golang": "Go",
    "cpp": "C++",
    "c sharp": "C#",
    "c#": "C#",
}

# ─── 2. HIERARCHICAL TAXONOMY / KNOWLEDGE GRAPH ────────────────────────────────
# Maps canonical skills to parent categories, domain concepts, and related verticals.
SKILL_TAXONOMY: Dict[str, Dict[str, List[str]]] = {
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
        "children": ["Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "Scala"]
    }
}

# Inverse index mapping each child skill to its direct category and top-level domains.
CHILD_TO_PARENTS: Dict[str, Set[str]] = {}

def _build_inverse_index():
    for cat_name, details in SKILL_TAXONOMY.items():
        if cat_name not in CHILD_TO_PARENTS:
            CHILD_TO_PARENTS[cat_name] = set()
        CHILD_TO_PARENTS[cat_name].update(details.get("parents", []))
        
        for child in details.get("children", []):
            if child not in CHILD_TO_PARENTS:
                CHILD_TO_PARENTS[child] = set()
            CHILD_TO_PARENTS[child].add(cat_name)
            for p in details.get("parents", []):
                CHILD_TO_PARENTS[child].add(p)

_build_inverse_index()

# ─── 3. PUBLIC UTILITY FUNCTIONS ──────────────────────────────────────────────

def normalize_skill(raw_skill: str) -> str:
    """
    Normalizes raw skill string (e.g. 'nodejs', 'react.js', 'aws cloud')
    to canonical skill representation.
    """
    if not raw_skill or not isinstance(raw_skill, str):
        return ""
    
    cleaned = raw_skill.strip().lower()
    
    # 1. Check direct alias lookup
    if cleaned in SKILL_ALIASES:
        return SKILL_ALIASES[cleaned]
    
    # 2. Check canonical casing from CHILD_TO_PARENTS or SKILL_TAXONOMY
    for canonical in CHILD_TO_PARENTS.keys():
        if canonical.lower() == cleaned:
            return canonical
            
    for category in SKILL_TAXONOMY.keys():
        if category.lower() == cleaned:
            return category
            
    # 3. Capitalize words if unknown
    return raw_skill.strip().title()


def expand_skills(raw_skills: List[str]) -> Dict[str, Set[str]]:
    """
    Takes a raw list of extracted skills and expands them using the ontology graph.
    Returns a dict with:
      - 'explicit_skills': Set of canonical skills found directly.
      - 'implicit_concepts': Set of parent categories & domains inferred from explicit skills.
      - 'all_expanded_skills': Combined set of explicit + implicit skills.
    
    Example:
      Input: ["React", "Pinecone"]
      Output: {
        'explicit_skills': {"React", "Pinecone"},
        'implicit_concepts': {"Frontend Development", "Web Development", "Software Engineering", "Vector Databases", "AI & Machine Learning", "Databases"},
        'all_expanded_skills': {"React", "Pinecone", "Frontend Development", ...}
      }
    """
    explicit = set()
    implicit = set()
    
    for raw in raw_skills:
        canonical = normalize_skill(raw)
        if canonical:
            explicit.add(canonical)
            # Add inferred parents/domains
            parents = CHILD_TO_PARENTS.get(canonical, set())
            implicit.update(parents)
            
    all_expanded = explicit.union(implicit)
    
    return {
        "explicit_skills": explicit,
        "implicit_concepts": implicit,
        "all_expanded_skills": all_expanded
    }


def get_all_known_skills() -> Set[str]:
    """
    Returns a comprehensive set of all known canonical skills and alias strings
    for deterministic NLP pattern matching.
    """
    known = set()
    known.update(SKILL_ALIASES.keys())
    for canonical in CHILD_TO_PARENTS.keys():
        known.add(canonical.lower())
    for category in SKILL_TAXONOMY.keys():
        known.add(category.lower())
    return known


def evaluate_skill_fulfillment(required_skill: str, candidate_skills: List[str]) -> Tuple[bool, str]:
    """
    Determines if a candidate satisfies a required skill either:
    1. Directly / via Alias (Full Match)
    2. Via Subcategory / Domain equivalence (e.g. Pinecone satisfies Vector Databases requirement)
    
    Returns: (is_fulfilled, match_type: 'EXACT', 'ALIAS', 'TAXONOMY_PARENT', 'TAXONOMY_EQUIVALENT', 'NONE')
    """
    req_canonical = normalize_skill(required_skill)
    cand_expansion = expand_skills(candidate_skills)
    
    # 1. Exact canonical match
    if req_canonical in cand_expansion["explicit_skills"]:
        return True, "EXACT"
        
    # 2. Check if req_canonical is a Category and candidate has a child belonging to that Category
    # e.g., Req: "Vector Databases", Candidate has "Pinecone"
    if req_canonical in SKILL_TAXONOMY:
        category_children = set(SKILL_TAXONOMY[req_canonical].get("children", []))
        if any(normalize_skill(c) in cand_expansion["explicit_skills"] for c in category_children):
            return True, "TAXONOMY_PARENT"
            
    # 3. Check if Candidate skills share the exact category as Required Skill
    # e.g., Req: "Pinecone", Candidate has "ChromaDB" (both belong to "Vector Databases")
    req_parents = CHILD_TO_PARENTS.get(req_canonical, set())
    cand_implicit = cand_expansion["implicit_concepts"]
    if req_parents and any(p in cand_implicit for p in req_parents if p not in ["Software Engineering"]):
        return True, "TAXONOMY_EQUIVALENT"

    return False, "NONE"
