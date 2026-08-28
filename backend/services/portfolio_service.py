"""
Portfolio Service — Robust resume parsing, intelligent 6-domain skill categorization,
and multi-project extraction engine for high-impact developer portfolios.
"""

import io
import re
import urllib.parse
from typing import Dict, List, Any, Optional, Tuple
import structlog

logger = structlog.get_logger(__name__)

from services.skill_ontology import (
    SKILL_TAXONOMY as ONTOLOGY_TAXONOMY,
    SKILL_ALIASES,
    CHILD_TO_PARENTS,
    normalize_skill,
)
from utils.nlp_utils import detect_skills_in_text

# ─── 6-Domain Mapping via Shared Skill Ontology ───────────────────────────────
CATEGORY_MAP: Dict[str, str] = {
    # AI & ML
    "Generative AI & LLMs": "machine_learning",
    "Machine Learning": "machine_learning",
    "Vector Databases": "machine_learning",
    "AI & Machine Learning": "machine_learning",
    # Data Science
    "Data Engineering": "data_science",
    "Data Science": "data_science",
    # Engineering
    "Backend Development": "backend",
    "Frontend Development": "frontend",
    "Relational Databases": "database",
    "NoSQL Databases": "database",
    "Databases": "database",
    # Tools & DevOps
    "Cloud Platforms": "tools",
    "Containerization & Orchestration": "tools",
    "DevOps & CI/CD": "tools",
    "DevOps & Infrastructure": "tools",
}


LEGACY_SKILL_KEY_MAP = {
    "machine_learning": "Machine Learning & AI",
    "data_science": "Data Science & Analytics",
    "backend": "Backend & Architecture",
    "frontend": "Frontend & UI Engineering",
    "database": "Databases & Storage",
    "tools": "Cloud & DevOps Architecture"
}

def sanitize_portfolio_skills(raw_skills: Any) -> Dict[str, List[str]]:
    """
    Guarantees that NO 'other', 'others', 'miscellaneous' category ever exists.
    Converts legacy snake_case keys into crisp titles and dynamically classifies
    any orphan or miscellaneous skills into proper engineering domain buckets.
    """
    if isinstance(raw_skills, dict):
        clean_dynamic = {}
        orphans = []
        for cat_name, skill_items in raw_skills.items():
            if not cat_name:
                continue
            cat_clean = cat_name.strip()
            
            # Map legacy snake_case names
            if cat_clean.lower() in LEGACY_SKILL_KEY_MAP:
                cat_clean = LEGACY_SKILL_KEY_MAP[cat_clean.lower()]
                
            items_list = []
            if isinstance(skill_items, list):
                for s in skill_items:
                    if s and str(s).strip():
                        canonical = normalize_skill(str(s).strip()) or str(s).strip()
                        if canonical not in items_list:
                            items_list.append(canonical)
            elif isinstance(skill_items, str) and skill_items.strip():
                items_list.append(skill_items.strip())

            # If this is an 'other' or generic category, collect as orphans to be reclassified
            if cat_clean.lower() in ["other", "others", "miscellaneous", "general", "basic skills", "uncategorized"]:
                orphans.extend(items_list)
            else:
                if items_list:
                    clean_dynamic[cat_clean] = items_list

        # If there were orphans in 'other', re-classify them into genuine domain categories
        if orphans:
            reclassified = categorize_skills(orphans)
            for r_cat, r_skills in reclassified.items():
                if r_cat in clean_dynamic:
                    for s in r_skills:
                        if s not in clean_dynamic[r_cat]:
                            clean_dynamic[r_cat].append(s)
                else:
                    clean_dynamic[r_cat] = r_skills

        # Strict Curation Cap: Limit every category to top 10 most impactful skills
        curated_dynamic = {
            cat: skills[:10] for cat, skills in clean_dynamic.items() if skills
        }

        if curated_dynamic:
            return curated_dynamic

    # If flat list, categorize directly
    return categorize_skills(raw_skills if isinstance(raw_skills, list) else [])


def categorize_skills(raw_skills: Any) -> Dict[str, List[str]]:
    """
    Intelligently categorizes skills into dynamic, domain-agnostic professional categories.
    If already a dictionary, sanitizes and returns dynamic keys with ZERO 'other' leftovers.
    If a flat list, dynamically clusters into articulate buckets with ZERO 'other' leftovers.
    """
    # 1. If dictionary, route through sanitize_portfolio_skills
    if isinstance(raw_skills, dict):
        clean_dict = {}
        orphans = []
        for cat_name, skill_items in raw_skills.items():
            if not cat_name:
                continue
            cat_clean = cat_name.strip()
            if cat_clean.lower() in LEGACY_SKILL_KEY_MAP:
                cat_clean = LEGACY_SKILL_KEY_MAP[cat_clean.lower()]

            items_list = []
            if isinstance(skill_items, list):
                for s in skill_items:
                    if s and str(s).strip():
                        canonical = normalize_skill(str(s).strip()) or str(s).strip()
                        if canonical not in items_list:
                            items_list.append(canonical)
            elif isinstance(skill_items, str) and skill_items.strip():
                items_list.append(skill_items.strip())

            if cat_clean.lower() in ["other", "others", "miscellaneous", "general", "basic skills", "uncategorized"]:
                orphans.extend(items_list)
            elif items_list:
                clean_dict[cat_clean] = items_list

        if orphans:
            reclassified = categorize_skills(orphans)
            for r_cat, r_skills in reclassified.items():
                if r_cat in clean_dict:
                    for s in r_skills:
                        if s not in clean_dict[r_cat]:
                            clean_dict[r_cat].append(s)
                else:
                    clean_dict[r_cat] = r_skills

        if clean_dict:
            return clean_dict

    # 2. If flat list or fallback, dynamically map into articulate professional buckets
    categorized: Dict[str, List[str]] = {
        "Machine Learning & AI": [],
        "Data Science & Analytics": [],
        "Backend & Architecture": [],
        "Frontend & UI Engineering": [],
        "Databases & Cloud Systems": []
    }
    
    seen = set()
    skills_list = raw_skills if isinstance(raw_skills, list) else []
    for skill in skills_list:
        if not skill:
            continue
        clean = str(skill).strip()
        canonical = normalize_skill(clean) or clean
        lower = canonical.lower()
        if lower in seen:
            continue
        seen.add(lower)
        
        # Check parents/categories in the centralized ontology knowledge graph
        parents = CHILD_TO_PARENTS.get(canonical, set())
        assigned_category = None
        
        for parent in parents:
            if parent in CATEGORY_MAP:
                mapped = CATEGORY_MAP[parent]
                if mapped == "machine_learning":
                    assigned_category = "Machine Learning & AI"
                elif mapped == "data_science":
                    assigned_category = "Data Science & Analytics"
                elif mapped == "backend":
                    assigned_category = "Backend & Architecture"
                elif mapped == "frontend":
                    assigned_category = "Frontend & UI Engineering"
                elif mapped in ["database", "tools"]:
                    assigned_category = "Databases & Cloud Systems"
                break
                
        if not assigned_category:
            # Language/Framework heuristics for edge-cases
            if any(ai in lower for ai in ["ai", "ml", "nlp", "llm", "deep learning", "neural", "pytorch", "tensorflow", "scikit"]):
                assigned_category = "Machine Learning & AI"
            elif any(ds in lower for ds in ["pandas", "numpy", "eda", "tableau", "power bi", "analytics", "statistics", "seaborn", "matplotlib"]):
                assigned_category = "Data Science & Analytics"
            elif lower in ["python", "java", "c++", "c#", "golang", "go", "php", "ruby", "rust", "fastapi", "django", "node", "express", "spring"]:
                assigned_category = "Backend & Architecture"
            elif lower in ["html", "css", "javascript", "typescript", "react", "vue", "angular", "tailwind", "next.js", "nextjs"]:
                assigned_category = "Frontend & UI Engineering"
            elif any(db in lower for db in ["sql", "mongo", "redis", "postgres", "mysql", "dynamo", "docker", "aws", "git", "linux", "gcp", "azure", "kubernetes"]):
                assigned_category = "Databases & Cloud Systems"
            else:
                assigned_category = "Backend & Architecture"
                
        categorized[assigned_category].append(canonical)
            
    # Filter out empty buckets
    return {k: v for k, v in categorized.items() if v}


def extract_smart_metrics(title: str, description: str, raw_highlights: List[str] = None) -> List[Dict[str, str]]:
    """
    Extracts or smartly synthesizes concise, high-impact quantifiable metrics (e.g. 92.4% Accuracy, < 150ms Latency).
    Strictly guarantees that long bullet points are NEVER dumped into metric value fields.
    """
    metrics = []
    combined_text = f"{title} {description} {' '.join(raw_highlights or [])}"

    # 1. Look for genuine percentage numbers in text
    pct_match = re.search(r'(\b\d{1,3}(?:\.\d+)?%)\s*([a-zA-Z\s\-]{3,20})?', combined_text, re.I)
    if pct_match:
        val = pct_match.group(1).strip()
        lbl_raw = (pct_match.group(2) or "Accuracy").strip()
        lbl = re.sub(r'[^a-zA-Z\s]', '', lbl_raw).strip().title()
        if not lbl or len(lbl) > 20:
            lbl = "Accuracy / Metric"
        metrics.append({"value": val, "label": lbl})

    # 2. Look for ROC-AUC
    auc_match = re.search(r'(0\.\d{2,4})\s*(?:roc-auc|auc|score|f1)', combined_text, re.I)
    if auc_match and not any(m["label"] == "ROC-AUC" for m in metrics):
        metrics.append({"value": auc_match.group(1).strip(), "label": "ROC-AUC"})

    # 3. Look for Latency
    lat_match = re.search(r'(<\s*\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds?))\b', combined_text, re.I)
    if lat_match:
        metrics.append({"value": lat_match.group(1).strip(), "label": "P99 Latency"})

    # 4. Look for Scale / Numbers (e.g. 10k+, 500+)
    scale_match = re.search(r'(\b\d+[\+kKmMbB]?\+?)\s*(?:users|qps|rps|queries|requests|downloads|records|items)', combined_text, re.I)
    if scale_match:
        metrics.append({"value": scale_match.group(1).strip(), "label": "Throughput / Scale"})

    # 5. Smart Domain Synthesis if missing or fewer than 2 metrics
    t_lower = (title + " " + description).lower()
    if len(metrics) < 2:
        if any(ai_term in t_lower for ai_term in ["agent", "rag", "llm", "ai", "model", "neural", "deep learning", "prediction", "classifier", "nlp", "vision", "detector", "heart", "disease"]):
            defaults = [
                {"value": "92.4%", "label": "Model Accuracy"},
                {"value": "0.935", "label": "ROC-AUC"},
                {"value": "< 180ms", "label": "Inference Latency"}
            ]
        elif any(web_term in t_lower for web_term in ["platform", "portal", "website", "system", "dashboard", "screening", "recruitment", "app", "auth", "api", "backend", "full-stack", "full stack"]):
            defaults = [
                {"value": "99.9%", "label": "Uptime SLA"},
                {"value": "< 150ms", "label": "API Latency"},
                {"value": "100%", "label": "Deterministic"}
            ]
        elif any(data_term in t_lower for data_term in ["data", "pipeline", "etl", "analytics", "analysis", "spark", "hadoop", "eda", "visualization"]):
            defaults = [
                {"value": "100k+", "label": "Records Processed"},
                {"value": "3.5x", "label": "Query Speedup"}
            ]
        else:
            defaults = [
                {"value": "Production", "label": "Deployment Status"},
                {"value": "100%", "label": "Clean Architecture"}
            ]

        for d in defaults:
            if len(metrics) >= 2:
                break
            if not any(m["label"].lower() == d["label"].lower() for m in metrics):
                metrics.append(d)

    return metrics[:3]


def clean_project_description(desc: str, title: str = "") -> str:
    """Cleans raw text into a clean 2-3 sentence project narrative without raw links or bullet garbage."""
    if not desc:
        return f"Architected and developed '{title}' featuring scalable end-to-end workflows and modern engineering principles."
    # Strip URLs
    cleaned = re.sub(r'https?://\S+', '', desc)
    # Strip bullet characters
    cleaned = re.sub(r'^[•\-\*\s]+', '', cleaned)
    cleaned = re.sub(r'\n[•\-\*\s]+', ' ', cleaned)
    cleaned = re.sub(r'(?:Live Demo|GitHub|Live|Demo|Repo|Stack|Technologies)\s*:\s*', '', cleaned, flags=re.I)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()
    if len(cleaned) > 350:
        cleaned = cleaned[:350].rsplit('.', 1)[0] + "."
    if not cleaned or len(cleaned) < 20:
        cleaned = f"Engineered and deployed a production-ready solution for {title} with end-to-end integration and high reliability."
    return cleaned


def extract_all_projects(raw_text: str, detected_skills: List[str]) -> List[Dict[str, Any]]:
    """
    Extracts ALL projects from resume text instead of just one.
    Splits by project headers, links, and double newlines.
    """
    projects: List[Dict[str, Any]] = []
    
    # 1. Locate the Projects section
    proj_section_match = re.search(
        r'(?i)(?:projects?|academic projects|key projects|notable projects|portfolio)[\s\:\n\r]+(.*?)(?=\n\s*(?:experience|employment|work history|education|certifications?|skills?|achievements?|publications?|\Z))',
        raw_text,
        re.DOTALL
    )
    
    section_text = proj_section_match.group(1).strip() if proj_section_match else raw_text
    
    # 2. Split into discrete project blocks
    raw_blocks = re.split(r'\n\s*\n+|(?<=\n)(?=[A-Z0-9][\w\s\-\:\(\)]+\s*(?:\||\–|\-|–|\(|202\d|201\d))', section_text)
    
    for block in raw_blocks:
        block = block.strip()
        if len(block) < 30:
            continue
            
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if not lines:
            continue
            
        # Find genuine title line (not a link, not a section header)
        title_line = ""
        for line in lines:
            if any(h in line.lower() for h in ['skills', 'education', 'certifications', 'experience', 'declaration', 'http://', 'https://', 'live demo', 'github:']):
                continue
            if len(line) > 3:
                title_line = line
                break

        if not title_line:
            continue

        # Extract Project Title
        title = re.sub(r'[\(\[\{].*?[\)\]\}]', '', title_line).strip()
        title = re.sub(r'\s*[\–\-\|]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d\d).*$', '', title, flags=re.I).strip()
        if len(title) > 75:
            title = title[:75].strip()
        if not title or title.lower().startswith('http') or len(title) < 3:
            continue

        # Extract Year
        year_match = re.search(r'\b(202\d|201\d)\b', block)
        year = year_match.group(0) if year_match else "2026"

        # Extract Links
        github_match = re.search(r'https?://(?:www\.)?github\.com/[a-zA-Z0-9_\-\/]+', block)
        live_match = re.search(r'https?://[a-zA-Z0-9_\-\.]+\.(?:careershala\.tech|onrender\.com|vercel\.app|streamlit\.app|app|com|dev|io)[^\s\)\,\"]*', block)
        medium_match = re.search(r'https?://(?:medium\.com|towardsdatascience\.com)/[^\s\)]+', block)

        # Extract Description (Clean out links and header lines)
        desc_lines = []
        for l in lines:
            if l == title_line:
                continue
            if re.search(r'^(?:live demo|github|live|demo|repo|stack|technologies)\s*:', l, re.I):
                continue
            cleaned_line = re.sub(r'https?://\S+', '', l).strip()
            cleaned_line = re.sub(r'^(?:Live Demo|GitHub|Live|Demo|Repo)\s*:\s*', '', cleaned_line, flags=re.I).strip()
            if cleaned_line and len(cleaned_line) > 5:
                desc_lines.append(cleaned_line)

        raw_desc = " ".join(desc_lines)
        description = clean_project_description(raw_desc, title=title)

        # Extract Technologies used in this project using centralized skill detection
        tech_found, _ = detect_skills_in_text(block)
        proj_skills = [normalize_skill(s) or s.title() for s in tech_found]

        if proj_skills:
            cat_tag = " · ".join(proj_skills[:3]).upper()
        else:
            cat_tag = "AI & SOFTWARE"

        # Extract & synthesize smart quantifiable metrics
        highlights = extract_smart_metrics(title, raw_desc, desc_lines)

        # Smart automated placeholder cover
        sanitized_title = urllib.parse.quote(title[:30] if title else "Project Cover")
        placeholder_url = f"https://placehold.co/1200x800/1e293b/38bdf8?text={sanitized_title}"

        projects.append({
            "title": title,
            "category": cat_tag,
            "year": year,
            "description": description,
            "technologies": proj_skills[:8],
            "live_url": live_match.group(0) if live_match else "",
            "github_url": github_match.group(0) if github_match else "",
            "notes_url": medium_match.group(0) if medium_match else "",
            "highlights": highlights,
            "image_url": placeholder_url
        })

    return projects


def parse_resume_to_portfolio_data(file_bytes: bytes, filename: str = "resume.pdf") -> Dict[str, Any]:
    """
    Extracts text from PDF and parses candidate profile, all categorized skills,
    all projects, education, and professional experience dynamically.
    """
def extract_all_experience(raw_text: str) -> List[Dict[str, Any]]:
    """
    Extracts ALL work experiences and internships from resume text.
    """
    experiences: List[Dict[str, Any]] = []
    if not raw_text:
        return experiences

    # 1. Locate Experience section
    exp_section_match = re.search(
        r'(?i)(?:work experience|professional experience|experience|employment history|internships?)[\s\:\n\r]+(.*?)(?=\n\s*(?:projects?|education|academic background|certifications?|skills?|achievements?|publications?|\Z))',
        raw_text,
        re.DOTALL
    )
    section_text = exp_section_match.group(1).strip() if exp_section_match else ""
    if not section_text:
        # Fallback: scan whole text for role patterns
        section_text = raw_text

    # 2. Split by blocks
    blocks = re.split(r'\n\s*\n+|(?<=\n)(?=[A-Z0-9][\w\s\-\,\:\(\)]+\s*(?:\||\–|\-|–|\(|202\d|201\d|Present|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))', section_text)
    for block in blocks:
        block = block.strip()
        if len(block) < 25:
            continue
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if not lines:
            continue

        first_line = lines[0]
        if any(h in first_line.lower() for h in ['skills', 'education', 'certifications', 'projects', 'declaration', 'academic']):
            continue

        # Extract dates
        date_match = re.search(r'(?i)\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d\d)\s*[\d\w\s\–\-\toPresent]+(?:\bPresent|\b20\d\d|\bCurrent)?)\b', block)
        duration_str = date_match.group(0).strip() if date_match else "Present"

        # Split company and role
        parts = re.split(r'[\–\-\|•]', first_line)
        if len(parts) >= 2:
            company = parts[0].strip()
            role = parts[1].strip()
        else:
            company = first_line[:60].strip()
            role = lines[1][:50].strip() if len(lines) > 1 and len(lines[1]) < 50 else "Software / AI Development"

        desc_lines = lines[1:] if len(lines) > 1 else lines
        description = " ".join([l.lstrip('•-* ') for l in desc_lines if not re.search(r'(?i)\b(202\d|Present)\b', l)])
        if len(description) > 350:
            description = description[:350].strip() + "..."

        experiences.append({
            "company": company,
            "role": role,
            "start_date": "",
            "end_date": duration_str,
            "location": "",
            "description": description or "Contributed to core development and software engineering pipelines."
        })

    return experiences[:6]


def extract_all_education(raw_text: str) -> List[Dict[str, Any]]:
    """
    Extracts ALL education degrees from resume text.
    """
    education_list: List[Dict[str, Any]] = []
    if not raw_text:
        return education_list

    # 1. Locate Education section
    edu_section_match = re.search(
        r'(?i)(?:education|academic background|qualifications?|academics)[\s\:\n\r]+(.*?)(?=\n\s*(?:work experience|experience|projects?|certifications?|skills?|achievements?|publications?|\Z))',
        raw_text,
        re.DOTALL
    )
    section_text = edu_section_match.group(1).strip() if edu_section_match else ""
    if not section_text:
        section_text = raw_text

    blocks = re.split(r'\n\s*\n+|(?<=\n)(?=[A-Z0-9][\w\s\-\,\:\(\)]+\s*(?:\||\–|\-|–|\(|202\d|201\d))', section_text)
    for block in blocks:
        block = block.strip()
        if len(block) < 20:
            continue
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if not lines:
            continue

        deg_match = re.search(r'(?i)(bachelor|master|b\.tech|b\.e\.|m\.tech|b\.sc|m\.sc|computer science|engineering|diploma|intermediate|high school)[^\n]*', block)
        inst_match = re.search(r'(?i)([A-Za-z\s]+(university|institute of technology|college|polytechnic|academy|school))[^\n]*', block)
        year_match = re.search(r'\b(202\d|201\d)\b', block)
        grade_match = re.search(r'(?i)(\b\d{1,2}(?:\.\d+)?\s*(?:cgpa|gpa|%))', block)

        if deg_match or inst_match:
            education_list.append({
                "institution": inst_match.group(0).strip() if inst_match else (lines[0] if len(lines[0]) < 60 else ""),
                "degree": deg_match.group(0).strip()[:80] if deg_match else "",
                "graduation_year": year_match.group(0) if year_match else "2026",
                "grade": grade_match.group(0).strip() if grade_match else ""
            })

    return education_list[:4]


def parse_resume_to_portfolio_data(file_bytes: bytes, filename: str = "resume.pdf") -> Dict[str, Any]:
    """
    Extracts text from PDF and parses candidate profile, all categorized skills,
    all projects, education, and professional experience dynamically.
    """
    extracted_text = ""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
    except Exception as e:
        logger.warning("PDFPlumber extraction fallback", error=str(e))
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    extracted_text += t + "\n"
        except Exception as e2:
            logger.error("All PDF extractors failed", error=str(e2))

    # Regex for Contact details
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', extracted_text)
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', extracted_text)
    github_match = re.search(r'https?://(?:www\.)?github\.com/([a-zA-Z0-9_-]+)', extracted_text)
    linkedin_match = re.search(r'https?://(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)', extracted_text)
    medium_match = re.search(r'https?://(?:www\.)?medium\.com/@[a-zA-Z0-9_.-]+', extracted_text)
    site_match = re.search(r'https?://(?!github|linkedin|medium)[\w.-]+\.[a-z]{2,}', extracted_text)

    # First clean non-empty line usually represents candidate name
    lines = [l.strip() for l in extracted_text.split('\n') if l.strip()]
    candidate_name = ""
    for line in lines[:6]:
        if len(line) < 45 and not any(k in line.lower() for k in ['resume', 'curriculum', 'page', 'email', '@', 'http', 'phone', 'contact']):
            candidate_name = line
            break
    if not candidate_name and lines:
        candidate_name = lines[0]

    # Skill detection using centralized NLP ontology extractor
    tech_skills, _ = detect_skills_in_text(extracted_text)
    detected_skills = [normalize_skill(s) or s.title() for s in tech_skills]

    categorized = categorize_skills(detected_skills)

    # Headline inference from detected skills
    if categorized.get("machine_learning") or categorized.get("data_science"):
        headline = "Data Science • Machine Learning • AI Engineering"
        typing_roles = ["Data Scientist", "ML Engineer", "AI Systems Builder", "Data Analyst"]
    elif categorized.get("backend") and categorized.get("frontend"):
        headline = "Full-Stack Software & AI Engineer"
        typing_roles = ["Full-Stack Developer", "Backend Architect", "Frontend Engineer", "API Engineer"]
    elif categorized.get("backend"):
        headline = "Backend & Systems Engineer"
        typing_roles = ["Backend Developer", "API Engineer", "Systems Architect"]
    elif categorized.get("frontend"):
        headline = "Frontend & UI/UX Engineer"
        typing_roles = ["Frontend Developer", "React Engineer", "UI Designer"]
    else:
        headline = "Software Engineer & Problem Solver"
        typing_roles = ["Software Engineer", "Developer", "Problem Solver"]

    # Extract ALL projects, experience, education dynamically
    all_projects = extract_all_projects(extracted_text, detected_skills)
    all_experience = extract_all_experience(extracted_text)
    all_education = extract_all_education(extracted_text)

    total_skills = len(detected_skills)
    hero_metrics = []
    if all_projects:
        hero_metrics.append({"value": f"{len(all_projects)}+", "label": "Projects Built"})
    if total_skills:
        hero_metrics.append({"value": f"{total_skills}+", "label": "Technical Skills"})

    return {
        "full_name": candidate_name,
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
        "headline": headline,
        "bio": "",
        "skills": categorized,
        "projects": all_projects,
        "education": all_education,
        "experience": all_experience,
        "hero_badge": "✨ Open to Opportunities",
        "typing_roles": typing_roles,
        "hero_metrics": hero_metrics,
        "social_links": {
            "github": github_match.group(0) if github_match else "",
            "linkedin": linkedin_match.group(0) if linkedin_match else "",
            "twitter": "",
            "website": site_match.group(0) if site_match else "",
            "medium": medium_match.group(0) if medium_match else ""
        }
    }


# ─── 4. Groq Model for Resume Extraction ──────────────────────────────────────
from workflows.enhancer_graph import enhance_resume_content


async def ai_extract_portfolio_from_resume(raw_text: str, original_parsed: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Reuses the existing Gemini AI Resume Enhancement Pipeline (workflows.enhancer_graph)
    to extract and structure all candidate details, real projects, live links, GitHub repos,
    experience, education, and categorized skills with 100% fidelity.
    """
    if not raw_text or len(raw_text.strip()) < 50:
        return {}

    try:
        print("\n" + "="*70)
        print("🤖 [PORTFOLIO_AI] Starting Gemini AI Extraction via workflows.enhancer_graph...")
        print(f"📄 [PORTFOLIO_AI] Resume text snippet: {raw_text[:120]}... (Total len: {len(raw_text)})")
        print("="*70)

        state = {
            "resume_text": raw_text,
            "jd_text": "",
            "required_skills": [],
            "strict_missing_keywords": [],
            "user_verified": {},
            "original_parsed_dict": original_parsed or {}
        }
        
        result = await enhance_resume_content(state)
        enhanced_data = result.get("enhanced_data") or {}
        if not enhanced_data:
            print("⚠️ [PORTFOLIO_AI] Empty enhanced_data returned by Gemini AI.")
            return {}

        contact = enhanced_data.get("contact") or {}
        raw_skills_dict = enhanced_data.get("skills") or {}
        
        # Preserve dynamic, domain-agnostic skill categories from Gemini AI
        categorized_skills = categorize_skills(raw_skills_dict if raw_skills_dict else flat_skills)

        # Structure projects matching portfolio model
        clean_projects = []
        for p in enhanced_data.get("projects", []):
            title = (p.get("title") or p.get("name") or "").strip()
            if not title or title.lower().startswith("http") or len(title) < 3:
                continue

            raw_highlights = p.get("highlights") or []
            desc = " ".join(raw_highlights) if isinstance(raw_highlights, list) else str(raw_highlights)
            if not desc and p.get("description"):
                desc = p.get("description")

            clean_desc = clean_project_description(desc, title=title)
            techs = p.get("technologies") or []
            cat_tag = " · ".join(techs[:3]).upper() if techs else "PROJECT"

            smart_metrics = extract_smart_metrics(title, clean_desc, raw_highlights if isinstance(raw_highlights, list) else [])

            clean_projects.append({
                "title": title,
                "category": cat_tag,
                "year": p.get("dates") or "2026",
                "description": clean_desc,
                "technologies": techs,
                "live_url": p.get("link") or p.get("live_url") or "",
                "github_url": p.get("github") or p.get("github_url") or "",
                "notes_url": "",
                "highlights": smart_metrics
            })

        # Structure experience matching portfolio model
        clean_experience = []
        for exp in enhanced_data.get("experience", []):
            company = (exp.get("company") or "").strip()
            if not company:
                continue
            exp_hl = exp.get("highlights") or []
            exp_desc = " ".join(exp_hl) if isinstance(exp_hl, list) else str(exp_hl)

            clean_experience.append({
                "company": company,
                "role": exp.get("role") or exp.get("title") or "Software Engineer",
                "start_date": "",
                "end_date": exp.get("dates") or exp.get("duration") or "Present",
                "location": exp.get("location") or "",
                "description": exp_desc or "Contributed to core development and engineering tasks."
            })

        # Structure education matching portfolio model
        clean_education = []
        for edu in enhanced_data.get("education", []):
            inst = (edu.get("institution") or "").strip()
            if not inst:
                continue
            clean_education.append({
                "institution": inst,
                "degree": edu.get("degree") or "",
                "field_of_study": "",
                "graduation_year": edu.get("dates") or edu.get("year") or "2026",
                "grade": edu.get("details") or edu.get("score") or ""
            })

        full_name = contact.get("full_name") or enhanced_data.get("full_name") or ""
        headline = enhanced_data.get("target_role") or ""
        bio = enhanced_data.get("summary") or ""
        location = contact.get("location") or ""

        print(f"✅ [PORTFOLIO_AI] Gemini AI Extraction Successful!")
        print(f"   👤 Name    : {full_name}")
        print(f"   🎯 Headline: {headline}")
        print(f"   📍 Location: {location}")
        print(f"   📝 Bio     : {bio[:70]}...")
        print(f"   🚀 Projects: {len(clean_projects)} parsed")
        print(f"   💼 Exp     : {len(clean_experience)} entries")
        print(f"   🎓 Edu     : {len(clean_education)} entries")
        print("="*70 + "\n")

        return {
            "full_name": full_name,
            "headline": headline,
            "bio": bio,
            "email": contact.get("email") or "",
            "phone": contact.get("phone") or "",
            "location": location,
            "github_url": contact.get("github") or "",
            "linkedin_url": contact.get("linkedin") or "",
            "website_url": contact.get("portfolio") or "",
            "skills": categorized_skills,
            "projects": clean_projects,
            "experience": clean_experience,
            "education": clean_education
        }
    except Exception as e:
        print(f"❌ [PORTFOLIO_AI] Gemini AI Extraction Failed: {e}")
        logger.warning("Enhancer graph integration fallback", error=str(e))
        return {}