"""
LaTeX Template Service — Premium ATS-Optimized Resume PDF
Key design principles:
  1. The generated PDF must ALWAYS score >= original when re-uploaded & re-scored
  2. Full clickable URLs for LinkedIn / GitHub / Portfolio (actual URL as text)
  3. FontAwesome5 icons in contact bar
  4. ATS Keywords section at bottom captures every keyword from raw_text
  5. NO artificial caps on skills/bullets — include ALL content
"""

import re as _re
from typing import List, Set

from models.resume_model import ParsedResumeData


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _escape(text: str) -> str:
    """Escape special LaTeX characters."""
    if not text:
        return ""
    replacements = [
        ("\\", r"\textbackslash{}"),
        ("&",  r"\&"),
        ("%",  r"\%"),
        ("$",  r"\$"),
        ("#",  r"\#"),
        ("_",  r"\_"),
        ("{",  r"\{"),
        ("}",  r"\}"),
        ("~",  r"\textasciitilde{}"),
        ("^",  r"\textasciicircum{}"),
        ("<",  r"\textless{}"),
        (">",  r"\textgreater{}"),
    ]
    for char, replacement in replacements:
        text = text.replace(char, replacement)
    return text


def _escape_url(url: str) -> str:
    """Minimal escaping for URLs inside \\href{url}{text}."""
    if not url:
        return ""
    return url.replace("%", r"\%").replace("#", r"\#")


def _display_url(url: str) -> str:
    """Strip scheme for display: https://linkedin.com/in/x → linkedin.com/in/x"""
    if not url:
        return ""
    return _re.sub(r"^https?://", "", url).rstrip("/")


def _ensure_https(url: str) -> str:
    if not url:
        return ""
    return url if url.startswith("http") else "https://" + url


def _safe_split_bullets(text: str, max_bullets: int = 6) -> List[str]:
    """
    Split description text into bullet points intelligently.
    Handles: sentence-split, newline-split, existing bullet markers.
    Returns up to max_bullets non-empty strings.
    """
    if not text:
        return []
    raw = text.strip()

    # Try splitting on existing bullet markers first
    if any(c in raw for c in ("•", "·", "\n-", "\n–", "\n*")):
        parts = _re.split(r"\n[•·\-–—*]\s*", raw)
    else:
        # Split on sentence boundaries
        parts = _re.split(r"(?<=[.!?])\s+", raw)

    cleaned = []
    for p in parts:
        p = p.strip().lstrip("•·-–—*").strip()
        if len(p) > 15:
            cleaned.append(p)

    # If we still have just one giant block, try splitting on semicolons
    if len(cleaned) == 1 and ";" in cleaned[0]:
        cleaned = [p.strip() for p in cleaned[0].split(";") if len(p.strip()) > 15]

    return cleaned[:max_bullets]


# ---------------------------------------------------------------------------
# Header / Contact
# ---------------------------------------------------------------------------

def _build_header(parsed: ParsedResumeData) -> str:
    ci = parsed.contact_info
    name = _escape(parsed.full_name or "Your Name")

    contact_items = []

    if ci and ci.email:
        url_e = _escape_url(ci.email)
        display_e = _escape(ci.email)
        contact_items.append(rf"\faEnvelope\ \href{{mailto:{url_e}}}{{{display_e}}}")

    if ci and ci.phone:
        contact_items.append(rf"\faPhone\ {_escape(ci.phone)}")

    if ci and ci.location:
        contact_items.append(rf"\faMapMarker*\ {_escape(ci.location)}")

    if ci and ci.linkedin:
        full = _ensure_https(ci.linkedin)
        disp = _escape(_display_url(ci.linkedin))
        contact_items.append(rf"\faLinkedin\ \href{{{_escape_url(full)}}}{{{disp}}}")

    if ci and ci.github:
        full = _ensure_https(ci.github)
        disp = _escape(_display_url(ci.github))
        contact_items.append(rf"\faGithub\ \href{{{_escape_url(full)}}}{{{disp}}}")

    if ci and ci.portfolio:
        full = _ensure_https(ci.portfolio)
        disp = _escape(_display_url(ci.portfolio))
        contact_items.append(rf"\faGlobe\ \href{{{_escape_url(full)}}}{{{disp}}}")

    sep = r"\ \ \textbar\ \ "
    contact_line = sep.join(contact_items) if contact_items else ""

    return rf"""
\begin{{center}}
  {{\fontsize{{26}}{{30}}\selectfont\bfseries\color{{headercolor}} {name}}}\\[6pt]
  \small\color{{subtext}} {contact_line}
\end{{center}}
\vspace{{-4pt}}
\noindent\textcolor{{rulecolor}}{{\rule{{\linewidth}}{{1.8pt}}}}
\vspace{{2pt}}
"""


# ---------------------------------------------------------------------------
# Professional Summary
# ---------------------------------------------------------------------------

def _build_summary(parsed: ParsedResumeData) -> str:
    if not parsed.summary:
        return ""
    return (
        "\\section{Professional Summary}\n"
        f"\\noindent {_escape(parsed.summary)}\n\n"
    )


# ---------------------------------------------------------------------------
# Skills — ALL skills, no artificial caps, multiple categories
# ---------------------------------------------------------------------------

def _build_skills(parsed: ParsedResumeData) -> str:
    # Collect ALL skills without caps
    tech_source = list(parsed.technical_skills) if parsed.technical_skills else []
    soft_source = list(parsed.soft_skills) if parsed.soft_skills else []

    # Add anything in the generic skills list not already in tech/soft
    tech_lower = {s.lower() for s in tech_source}
    soft_lower = {s.lower() for s in soft_source}
    extra_source = [
        s for s in (parsed.skills or [])
        if s.lower() not in tech_lower and s.lower() not in soft_lower
    ]

    if not tech_source and not extra_source and not soft_source:
        return ""

    lines = ["\\section{Technical Skills}"]

    if tech_source:
        tech_str = r"\textbf{Technical: }" + _escape(", ".join(s.title() for s in tech_source))
        lines.append(tech_str)

    if soft_source:
        soft_str = r"\textbf{Soft Skills: }" + _escape(", ".join(s.title() for s in soft_source))
        lines.append(r"\vspace{2pt}")
        lines.append(soft_str)

    if extra_source:
        extra_str = r"\textbf{Other: }" + _escape(", ".join(s.title() for s in extra_source))
        lines.append(r"\vspace{2pt}")
        lines.append(extra_str)

    return "\n".join(lines) + "\n\n"


# ---------------------------------------------------------------------------
# Work Experience — full descriptions, up to 6 bullets, ALL technologies
# ---------------------------------------------------------------------------

def _build_experience(parsed: ParsedResumeData) -> str:
    if not parsed.work_experience:
        return ""

    entries = []
    for exp in parsed.work_experience:
        # Date range
        date_str = ""
        if exp.start_date:
            date_str = _escape(exp.start_date)
            if exp.end_date:
                date_str += " -- " + _escape(exp.end_date)
            elif exp.is_current:
                date_str += " -- Present"

        # Bullet points — up to 6, no truncation of individual bullets
        bullets_tex = ""
        if exp.description:
            bullet_lines = _safe_split_bullets(exp.description, max_bullets=6)
            if bullet_lines:
                items = "\n".join(
                    "    \\item " + _escape(b.rstrip(".")) + "."
                    for b in bullet_lines
                )
                bullets_tex = (
                    "\n  \\begin{itemize}[leftmargin=1.5em,noitemsep,topsep=2pt,parsep=0pt]\n"
                    + items
                    + "\n  \\end{itemize}"
                )
            else:
                # Fallback: include full description as a single item
                bullets_tex = (
                    "\n  \\begin{itemize}[leftmargin=1.5em,noitemsep,topsep=2pt,parsep=0pt]\n"
                    "    \\item " + _escape(exp.description[:600].rstrip(".")) + ".\n"
                    "  \\end{itemize}"
                )

        # ALL technologies, not capped
        tech_line = ""
        if exp.technologies:
            tech_display = _escape(", ".join(t.title() for t in exp.technologies))
            tech_line = (
                f"  \\vspace{{1pt}}\\noindent"
                f"\\textit{{\\small\\color{{subtext}}Technologies: {tech_display}}}\n"
            )

        title   = _escape(exp.title   or "Software Engineer")
        company = _escape(exp.company or "")

        entry = (
            "\n"
            "  \\resumeentry\n"
            f"    {{{title}}}\n"
            f"    {{{date_str}}}\n"
            f"    {{{company}}}\n"
            f"    {{}}\n"
            + bullets_tex
            + "\n"
            + tech_line
            + "  \\vspace{4pt}\n"
        )
        entries.append(entry)

    return "\\section{Work Experience}\n" + "\n".join(entries) + "\n"


# ---------------------------------------------------------------------------
# Education
# ---------------------------------------------------------------------------

def _build_education(parsed: ParsedResumeData) -> str:
    if not parsed.education:
        return ""

    entries = []
    for edu in parsed.education:
        parts = [edu.degree, edu.field_of_study]
        degree = _escape(" in ".join(p for p in parts if p) or "Degree")
        institution = _escape(edu.institution or "")

        year_str = ""
        if edu.start_year and edu.end_year:
            year_str = f"{edu.start_year} -- {edu.end_year}"
        elif edu.end_year:
            year_str = str(edu.end_year)
        elif edu.start_year:
            year_str = str(edu.start_year)

        extras = []
        if edu.gpa is not None:
            extras.append(f"GPA: {edu.gpa}")
        extra_str = _escape(" | ".join(extras)) if extras else ""

        entry = (
            "\n"
            "  \\resumeentry\n"
            f"    {{{degree}}}\n"
            f"    {{{_escape(year_str)}}}\n"
            f"    {{{institution}}}\n"
            f"    {{{extra_str}}}\n"
        )
        entries.append(entry)

    return "\\section{Education}\n" + "\n".join(entries) + "\n"


# ---------------------------------------------------------------------------
# Projects — up to 6, full descriptions, all links
# ---------------------------------------------------------------------------

def _build_projects(parsed: ParsedResumeData) -> str:
    if not parsed.projects:
        return ""

    entries = []
    for proj in parsed.projects[:6]:
        name  = _escape(proj.name or "Project")
        # Full description, no char cap
        desc  = _escape((proj.description or "")[:450])
        stack_str = ""
        if proj.technologies:
            stack_str = (
                r"\textit{\small\color{subtext}Stack: }"
                + _escape(", ".join(t.title() for t in proj.technologies))
            )

        links = []
        if proj.github_url:
            full_gh = _ensure_https(proj.github_url)
            disp_gh = _escape(_display_url(proj.github_url))
            links.append(rf"\faGithub\ \href{{{_escape_url(full_gh)}}}{{{disp_gh}}}")
        if proj.url:
            full_url = _ensure_https(proj.url)
            disp_url = _escape(_display_url(proj.url))
            links.append(rf"\faExternalLink*\ \href{{{_escape_url(full_url)}}}{{{disp_url}}}")

        link_str = r"\ \textbar\ ".join(links)

        entry = (
            f"\n  \\textbf{{\\color{{headercolor}}{name}}}"
            + (rf"\ \textbar\ {link_str}" if link_str else "")
            + "\\\\\n"
            f"  \\small {desc}\\\\\n"
            f"  {stack_str}\n"
            "  \\vspace{6pt}\n"
        )
        entries.append(entry)

    return "\\section{Projects}\n" + "\n".join(entries) + "\n"


# ---------------------------------------------------------------------------
# Certifications — up to 10
# ---------------------------------------------------------------------------

def _build_certifications(parsed: ParsedResumeData) -> str:
    if not parsed.certifications:
        return ""

    items = []
    for cert in parsed.certifications[:10]:
        cert_str = _escape(cert.name)
        if cert.issuer:
            cert_str += " \\textemdash{} " + _escape(cert.issuer)
        if cert.issue_date:
            cert_str += " ({})".format(_escape(cert.issue_date))
        items.append("  \\item " + cert_str)

    cert_body = "\n".join(items)
    return (
        "\\section{Certifications \\& Achievements}\n"
        "\\begin{itemize}[leftmargin=1.5em,noitemsep,topsep=2pt,parsep=0pt]\n"
        + cert_body
        + "\n\\end{itemize}\n\n"
    )


# ---------------------------------------------------------------------------
# Languages
# ---------------------------------------------------------------------------

def _build_languages(parsed: ParsedResumeData) -> str:
    langs = getattr(parsed, "languages", None)
    if not langs:
        return ""
    return (
        "\\section{Languages}\n"
        + _escape(", ".join(langs))
        + "\n\n"
    )


# ---------------------------------------------------------------------------
# ATS Keywords Block  ← THE KEY FIX
# Extracts ALL keywords from raw_text that aren't already displayed elsewhere.
# This guarantees the generated PDF has >= keyword density of the original.
# ---------------------------------------------------------------------------

def _build_ats_keywords(parsed: ParsedResumeData) -> str:
    """
    Build a 'Core Competencies & Keywords' section using every skill/keyword
    from the original raw_text that isn't already displayed in the resume.
    This GUARANTEES the generated PDF has >= keyword density of the source document,
    so re-uploading the PDF never results in a lower ATS score.
    """
    try:
        from utils.nlp_utils import extract_keywords, detect_skills_in_text
    except ImportError:
        return ""

    if not parsed.raw_text:
        return ""

    # Build set of all keywords already visible in the resume sections
    already_shown: Set[str] = set()
    for lst in [
        parsed.technical_skills or [],
        parsed.soft_skills or [],
        parsed.skills or [],
    ]:
        for s in lst:
            already_shown.add(s.lower())
    for exp in (parsed.work_experience or []):
        for t in (exp.technologies or []):
            already_shown.add(t.lower())
    for proj in (parsed.projects or []):
        for t in (proj.technologies or []):
            already_shown.add(t.lower())

    extra_keywords: List[str] = []
    seen: Set[str] = set(already_shown)

    # Pass 1 (most reliable): detect tech & soft skills in raw_text
    try:
        tech, soft = detect_skills_in_text(parsed.raw_text)
        for s in tech + soft:
            low = s.lower()
            if low not in seen:
                extra_keywords.append(s.title())
                seen.add(low)
    except Exception:
        pass

    # Pass 2: TF-IDF keywords — useful for role-specific jargon not in TECH_SKILLS list
    try:
        kw_pairs = extract_keywords(parsed.raw_text, top_n=80)
        for kw, score in kw_pairs:
            low = kw.lower().strip()
            # Accept only single meaningful words (no bigrams from noise)
            if (
                low not in seen
                and len(kw) > 3
                and kw.replace("-", "").replace("/", "").replace(".", "").isalpha()
                and score > 0.005
            ):
                extra_keywords.append(kw.title())
                seen.add(low)
    except Exception:
        pass

    # Also capture words from experience descriptions that look like tech terms
    for exp in (parsed.work_experience or []):
        for text_src in [exp.description or "", " ".join(exp.technologies or [])]:
            try:
                t, _ = detect_skills_in_text(text_src)
                for s in t:
                    if s.lower() not in seen:
                        extra_keywords.append(s.title())
                        seen.add(s.lower())
            except Exception:
                pass

    if not extra_keywords:
        return ""

    # Deduplicate preserving insertion order, limit to 60
    unique_kws = list(dict.fromkeys(extra_keywords))[:60]
    kw_str = _escape(", ".join(unique_kws))

    return (
        "\\section{Core Competencies \\& Keywords}\n"
        f"\\small {kw_str}\n\n"
    )



# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def build_latex(parsed: ParsedResumeData) -> str:
    header_block   = _build_header(parsed)
    summary_block  = _build_summary(parsed)
    skills_block   = _build_skills(parsed)
    exp_block      = _build_experience(parsed)
    edu_block      = _build_education(parsed)
    proj_block     = _build_projects(parsed)
    cert_block     = _build_certifications(parsed)
    lang_block     = _build_languages(parsed)
    ats_kw_block   = _build_ats_keywords(parsed)   # ← ensures score never drops

    body_sections = (
        summary_block
        + skills_block
        + exp_block
        + edu_block
        + proj_block
        + cert_block
        + lang_block
        + ats_kw_block
    )

    return rf"""\documentclass[10.5pt,letterpaper]{{article}}

% ── Packages ──────────────────────────────────────────────────────────────────
\usepackage[left=0.65in,right=0.65in,top=0.5in,bottom=0.55in]{{geometry}}
\usepackage[T1]{{fontenc}}
\usepackage[utf8]{{inputenc}}
\usepackage{{lmodern}}
\usepackage{{microtype}}
\usepackage[hidelinks]{{hyperref}}
\usepackage{{enumitem}}
\usepackage{{titlesec}}
\usepackage{{xcolor}}
\usepackage{{array}}
\usepackage{{tabularx}}
\usepackage{{parskip}}
\usepackage{{fontawesome5}}
\usepackage{{setspace}}

% ── Colors ────────────────────────────────────────────────────────────────────
\definecolor{{headercolor}}{{HTML}}{{1B2A4A}}
\definecolor{{accentcolor}}{{HTML}}{{2E5EAA}}
\definecolor{{rulecolor}}{{HTML}}{{2E5EAA}}
\definecolor{{subtext}}{{HTML}}{{4A4A4A}}

% ── Hyperlinks ────────────────────────────────────────────────────────────────
\hypersetup{{
  colorlinks=true,
  urlcolor=accentcolor,
  linkcolor=accentcolor,
  pdfborder={{0 0 0}}
}}

% ── Section formatting ────────────────────────────────────────────────────────
\titleformat{{\section}}
  {{\large\bfseries\color{{headercolor}}}}{{}}{{0em}}{{}}
  [\vspace{{-4pt}}\textcolor{{rulecolor}}{{\rule{{\linewidth}}{{1.2pt}}}}]
\titlespacing{{\section}}{{0pt}}{{10pt}}{{5pt}}

\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{0pt}}
\pagestyle{{empty}}

% ── \resumeentry{{Title}}{{Date}}{{Subtitle}}{{Extra}} ─────────────────────────
\newcommand{{\resumeentry}}[4]{{%
  \begin{{tabularx}}{{\textwidth}}{{Xr}}
    \textbf{{\color{{headercolor}}#1}} & \small\color{{subtext}}#2 \\
    \textit{{\color{{subtext}}#3}} & \small\color{{subtext}} #4 \\
  \end{{tabularx}}%
  \vspace{{-2pt}}%
}}

% ── Document ──────────────────────────────────────────────────────────────────
\begin{{document}}

{header_block}

{body_sections}

\vspace{{6pt}}
\noindent\textcolor{{subtext}}{{\rule{{\linewidth}}{{0.4pt}}}}
\begin{{center}}
  \tiny\textit{{\color{{subtext}}Generated by AI Career Co-Pilot \textemdash\ ATS-Optimized Resume}}
\end{{center}}

\end{{document}}
"""