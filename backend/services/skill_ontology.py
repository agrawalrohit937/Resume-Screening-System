"""
Skill Ontology & Knowledge Graph Module for Enterprise ATS Evaluation.
Provides hierarchical skill relationships, alias normalization, taxonomy expansion,
and semantic domain equivalence matching.
"""

from typing import Dict, List, Set, Tuple, Optional, Any
import re
import structlog

from services.scoring.constants import SkillMatch, get_skill_credit_table

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
        "children": ["Python", "JavaScript", "TypeScript", "Go", "Java", "C++", "C#", "SQL"]
    }
}

# Inverted mapping: Canonical Skill -> Set of Parent Concept Names
CHILD_TO_PARENTS: Dict[str, Set[str]] = {}
PARENT_TO_CHILDREN: Dict[str, Set[str]] = {}
EXCLUDED_BRIDGING_PARENTS: Set[str] = {"Software Engineering"}

_VERSION_SUFFIX_PATTERN = re.compile(r"(\s+v?\d+(\.\d+)*|\s*\b\d+(\.\d+)*\b)$", re.IGNORECASE)

def _strip_version(skill_name: str) -> str:
    """Strips trailing version identifiers, e.g., 'React 17' -> 'React', 'Python 3.10' -> 'Python'."""
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

    # Invert mapping to count descendants per parent concept
    for child, parents in CHILD_TO_PARENTS.items():
        for p in parents:
            if p not in PARENT_TO_CHILDREN:
                PARENT_TO_CHILDREN[p] = set()
            PARENT_TO_CHILDREN[p].add(child)

    # Automatically exclude ultra-generic parents with > 40 children from bridging
    for p, ch in PARENT_TO_CHILDREN.items():
        if len(ch) > 40:
            EXCLUDED_BRIDGING_PARENTS.add(p)

_build_inverse_index()

# ─── 3. PUBLIC UTILITY FUNCTIONS ──────────────────────────────────────────────

def normalize_skill(raw_skill: str) -> str:
    """
    Normalizes raw skill string (e.g. 'nodejs', 'react.js', 'aws cloud', 'python', 'postgressql')
    to canonical skill representation.
    """
    if not raw_skill or not isinstance(raw_skill, str):
        return ""
    
    cleaned = re.sub(r"\s+", " ", raw_skill.strip().lower())
    
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


def canonicalize_skills(skills: Optional[List[str]]) -> List[str]:
    """
    Normalizes and deduplicates a list of skill strings preserving order.
    Case-insensitive deduplication using canonical names.
    e.g. ['python', 'Python', 'PYTHON'] -> ['Python']
         ['python', 'postgresql', 'PostgreSQL'] -> ['Python', 'PostgreSQL']
    """
    if not skills:
        return []
    seen = set()
    canonical_list = []
    for s in skills:
        if not s or not isinstance(s, str):
            continue
        canon = normalize_skill(s.strip())
        if canon and canon.lower() not in seen:
            seen.add(canon.lower())
            canonical_list.append(canon)
    return canonical_list


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


def evaluate_skill_fulfillment(required_skill: str, candidate_skills: List[str]) -> SkillMatch:
    """
    Determines if a candidate satisfies a required skill using graded credit:
    1. EXACT / ALIAS / VERSION_VARIANT (credit: 1.00, bucket: matched)
    2. TAXONOMY_PARENT (credit: 0.90, bucket: matched)
    3. TAXONOMY_SIBLING (credit: 0.40, bucket: transferable)
    4. NONE (credit: 0.00, bucket: missing)

    Returns a SkillMatch instance that also supports tuple unpacking (is_fulfilled, match_type)
    for backward compatibility with legacy consumers.

    Complexity:
      Time: O(N_skills) where N_skills is number of candidate skills.
      Space: O(N_skills) for concept expansion.
    """
    credit_table = get_skill_credit_table()
    if not required_skill or not isinstance(required_skill, str):
        none_info = credit_table.get("NONE", {"credit": 0.0, "bucket": "missing"})
        return SkillMatch(
            required="",
            credit=none_info["credit"],
            match_type="NONE",
            evidence=[],
            bucket=none_info["bucket"],
        )

    req_canonical = normalize_skill(required_skill)
    cand_expansion = expand_skills(candidate_skills)

    # 1. Exact canonical or alias match
    if req_canonical in cand_expansion["explicit_skills"]:
        req_clean = re.sub(r"\s+", " ", required_skill.strip().lower())
        is_alias = req_clean in SKILL_ALIASES or any(
            re.sub(r"\s+", " ", (c or "").strip().lower()) in SKILL_ALIASES for c in candidate_skills
        )
        match_type = "ALIAS" if is_alias and req_clean != req_canonical.lower() else "EXACT"
        info = credit_table.get(match_type, credit_table.get("EXACT", {"credit": 1.00, "bucket": "matched"}))
        evidence = [c for c in candidate_skills if normalize_skill(c) == req_canonical]
        return SkillMatch(
            required=req_canonical,
            credit=info["credit"],
            match_type=match_type,
            evidence=evidence or [req_canonical],
            bucket=info["bucket"],
        )

    # 2. Version Variant match (e.g. React 17 vs React, Python 3.10 vs Python)
    req_stripped = _strip_version(required_skill).lower()
    for c in candidate_skills:
        if not c or not isinstance(c, str):
            continue
        c_clean = c.strip()
        c_stripped = _strip_version(c_clean).lower()
        c_canonical = normalize_skill(c_clean)
        c_canonical_stripped = _strip_version(c_canonical).lower()
        if (
            (req_stripped and req_stripped == c_stripped)
            or (req_stripped and req_stripped == c_canonical.lower())
            or (c_canonical_stripped and req_canonical.lower() == c_canonical_stripped)
            or (_strip_version(req_canonical).lower() == c_canonical_stripped)
        ):
            info = credit_table.get("VERSION_VARIANT", {"credit": 1.00, "bucket": "matched"})
            return SkillMatch(
                required=req_canonical,
                credit=info["credit"],
                match_type="VERSION_VARIANT",
                evidence=[c_clean],
                bucket=info["bucket"],
            )

    # 3. Check if req_canonical is a Category and candidate has a child belonging to that Category (TAXONOMY_PARENT)
    # e.g., Req: "Vector Databases", Candidate has "Pinecone"
    if req_canonical in SKILL_TAXONOMY:
        category_children = set(SKILL_TAXONOMY[req_canonical].get("children", []))
        matching_children = [c for c in candidate_skills if normalize_skill(c) in category_children]
        if matching_children:
            info = credit_table.get("TAXONOMY_PARENT", {"credit": 0.90, "bucket": "matched"})
            return SkillMatch(
                required=req_canonical,
                credit=info["credit"],
                match_type="TAXONOMY_PARENT",
                evidence=matching_children,
                bucket=info["bucket"],
            )

    # 4. Check if Candidate skills share the exact category as Required Skill (TAXONOMY_SIBLING)
    # e.g., Req: "Pinecone", Candidate has "ChromaDB" (both belong to "Vector Databases")
    req_parents = CHILD_TO_PARENTS.get(req_canonical, set())
    eligible_parents = req_parents - EXCLUDED_BRIDGING_PARENTS
    if eligible_parents:
        matching_siblings = [
            c for c in candidate_skills
            if any(p in CHILD_TO_PARENTS.get(normalize_skill(c), set()) for p in eligible_parents)
        ]
        if matching_siblings:
            info = credit_table.get("TAXONOMY_SIBLING", {"credit": 0.40, "bucket": "transferable"})
            return SkillMatch(
                required=req_canonical,
                credit=info["credit"],
                match_type="TAXONOMY_SIBLING",
                evidence=matching_siblings,
                bucket=info["bucket"],
            )

    info = credit_table.get("NONE", {"credit": 0.0, "bucket": "missing"})
    return SkillMatch(
        required=req_canonical,
        credit=info["credit"],
        match_type="NONE",
        evidence=[],
        bucket=info["bucket"],
    )
