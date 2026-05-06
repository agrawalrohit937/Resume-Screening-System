"""
LaTeX Template Service — Converts parsed resume data into a LaTeX document string.
Matched to ParsedResumeData / ResumeModel from models/resume_model.py
"""

from models.resume_model import ParsedResumeData


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _escape(text: str) -> str:
    """Escape special LaTeX characters for body text / display strings."""
    if not text:
        return ""
    # Order matters: backslash must come first
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
    ]
    for char, replacement in replacements:
        text = text.replace(char, replacement)
    return text


def _escape_url(url: str) -> str:
    """
    Minimal escaping for URLs inside \href{...}{...}.
    Only % and # need escaping in the URL argument; underscores and & are
    valid URL characters and must NOT be escaped there.
    """
    if not url:
        return ""
    return url.replace("%", r"\%").replace("#", r"\#")


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _build_summary(parsed: ParsedResumeData) -> str:
    if not parsed.summary:
        return ""
    return (
        "\\section{Professional Summary}\n"
        + _escape(parsed.summary)
        + "\n\n"
    )


def _build_skills(parsed: ParsedResumeData) -> str:
    # Use technical_skills list; fall back to generic skills list
    tech_source = parsed.technical_skills if parsed.technical_skills else parsed.skills
    if not tech_source:
        return ""

    tech = ", ".join(_escape(s.title()) for s in tech_source[:20])
    lines = ["\\section{Technical Skills}", f"\\textbf{{Technical: }}{tech}"]

    if parsed.soft_skills:
        soft = ", ".join(_escape(s.title()) for s in parsed.soft_skills[:10])
        lines.append(f"\\textit{{Soft Skills: }}{soft}")

    return "\n".join(lines) + "\n\n"


def _build_experience(parsed: ParsedResumeData) -> str:
    if not parsed.work_experience:
        return ""

    entries = []
    for exp in parsed.work_experience:
        # Date range ─────────────────────────────────────────────────────────
        date_str = ""
        if exp.start_date:
            date_str = _escape(exp.start_date)
            if exp.end_date:
                date_str += " -- " + _escape(exp.end_date)
            elif exp.is_current:
                date_str += " -- Present"

        # Bullet points from description ──────────────────────────────────────
        bullets_tex = ""
        if exp.description:
            raw_bullets = [
                b.strip()
                for b in exp.description.split(".")
                if b.strip() and len(b.strip()) > 20
            ]
            if raw_bullets:
                items = "\n".join(
                    "    \\item " + _escape(b) + "." for b in raw_bullets[:4]
                )
                bullets_tex = (
                    "\n  \\begin{itemize}[leftmargin=*,noitemsep,topsep=2pt]\n"
                    + items
                    + "\n  \\end{itemize}"
                )

        # Technologies line ───────────────────────────────────────────────────
        tech_line = ""
        if exp.technologies:
            tech_display = _escape(", ".join(exp.technologies[:8]))
            tech_line = f"  \\textit{{Technologies: }}{tech_display}\n"

        title   = _escape(exp.title   or "Role")
        company = _escape(exp.company or "")

        entry = (
            "\n"
            f"  \\resumeentry\n"
            f"    {{{title}}}\n"
            f"    {{{date_str}}}\n"
            f"    {{{company}}}\n"
            f"    {{}}\n"
            + bullets_tex
            + "\n  \\smallskip\n"
            + tech_line
        )
        entries.append(entry)

    return "\\section{Work Experience}\n" + "\n".join(entries) + "\n"


def _build_education(parsed: ParsedResumeData) -> str:
    if not parsed.education:
        return ""

    entries = []
    for edu in parsed.education:
        parts = [edu.degree, edu.field_of_study]
        degree = _escape(" ".join(p for p in parts if p) or "Degree")
        institution = _escape(edu.institution or "")

        # Years — model stores them as Optional[int]
        year_str = ""
        if edu.start_year and edu.end_year:
            year_str = f"{edu.start_year} -- {edu.end_year}"
        elif edu.end_year:
            year_str = str(edu.end_year)

        gpa_line = ""
        if edu.gpa is not None:
            gpa_line = f"\\textit{{GPA: {edu.gpa}}}"

        entry = (
            "\n"
            "  \\resumeentry\n"
            f"    {{{degree}}}\n"
            f"    {{{_escape(year_str)}}}\n"
            f"    {{{institution}}}\n"
            f"    {{{gpa_line}}}\n"
        )
        entries.append(entry)

    return "\\section{Education}\n" + "\n".join(entries) + "\n"


def _build_projects(parsed: ParsedResumeData) -> str:
    if not parsed.projects:
        return ""

    entries = []
    for proj in parsed.projects[:5]:
        name  = _escape(proj.name or "Project")
        desc  = _escape((proj.description or "")[:250])
        stack = ""
        if proj.technologies:
            stack = "\\textit{Stack: }" + _escape(", ".join(proj.technologies[:6]))

        entry = (
            f"\n  \\textbf{{{name}}} \\\\\n"
            f"  {desc} \\\\\n"
            f"  {stack}\n"
            "  \\vspace{4pt}\n"
        )
        entries.append(entry)

    return "\\section{Projects}\n" + "\n".join(entries) + "\n"


def _build_certifications(parsed: ParsedResumeData) -> str:
    if not parsed.certifications:
        return ""

    items = []
    for cert in parsed.certifications[:6]:
        cert_str = _escape(cert.name)
        if cert.issuer:
            cert_str += " \\textemdash{} " + _escape(cert.issuer)
        if cert.issue_date:
            cert_str += " (" + _escape(cert.issue_date) + ")"
        items.append("  \\item " + cert_str)

    cert_body = "\n".join(items)
    return (
        "\\section{Certifications}\n"
        "\\begin{itemize}[leftmargin=*,noitemsep,topsep=2pt]\n"
        + cert_body
        + "\n\\end{itemize}\n\n"
    )


def _build_languages(parsed: ParsedResumeData) -> str:
    # ParsedResumeData has a languages: List[str] field — render it if present
    if not parsed.languages:
        return ""
    lang_str = ", ".join(_escape(l) for l in parsed.languages)
    return (
        "\\section{Languages}\n"
        + lang_str
        + "\n\n"
    )


# ---------------------------------------------------------------------------
# Contact line builder
# ---------------------------------------------------------------------------

def _build_contact_line(parsed: ParsedResumeData) -> str:
    ci = parsed.contact_info
    parts = []

    if ci.email:
        # URL part: keep raw (only escape % and #); display part: escape fully
        url_part = _escape_url(ci.email)
        display  = _escape(ci.email)
        parts.append(f"\\href{{mailto:{url_part}}}{{{display}}}")

    if ci.phone:
        parts.append(_escape(ci.phone))

    if ci.location:
        parts.append(_escape(ci.location))

    if ci.linkedin:
        url = ci.linkedin if ci.linkedin.startswith("http") else "https://" + ci.linkedin
        parts.append(f"\\href{{{_escape_url(url)}}}{{LinkedIn}}")

    if ci.github:
        url = ci.github if ci.github.startswith("http") else "https://" + ci.github
        parts.append(f"\\href{{{_escape_url(url)}}}{{GitHub}}")

    if ci.portfolio:
        url = ci.portfolio if ci.portfolio.startswith("http") else "https://" + ci.portfolio
        parts.append(f"\\href{{{_escape_url(url)}}}{{Portfolio}}")

    return r" $\vert$ ".join(parts)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def build_latex(parsed: ParsedResumeData) -> str:
    name         = _escape(parsed.full_name or "Your Name")
    contact_line = _build_contact_line(parsed)

    summary_block  = _build_summary(parsed)
    skills_block   = _build_skills(parsed)
    exp_block      = _build_experience(parsed)
    edu_block      = _build_education(parsed)
    proj_block     = _build_projects(parsed)
    cert_block     = _build_certifications(parsed)
    lang_block     = _build_languages(parsed)

    body_sections = (
        summary_block
        + skills_block
        + exp_block
        + edu_block
        + proj_block
        + cert_block
        + lang_block
    )

    return rf"""\documentclass[10pt,letterpaper]{{article}}

% ── Packages ──────────────────────────────────────────────────────────────────
\usepackage[left=0.75in,right=0.75in,top=0.6in,bottom=0.6in]{{geometry}}
\usepackage[T1]{{fontenc}}
\usepackage[utf8]{{inputenc}}
\usepackage{{lmodern}}
\usepackage{{microtype}}
\usepackage{{hyperref}}
\usepackage{{enumitem}}
\usepackage{{titlesec}}
\usepackage{{xcolor}}
\usepackage{{array}}
\usepackage{{tabularx}}
\usepackage{{parskip}}

% ── Colors ────────────────────────────────────────────────────────────────────
\definecolor{{primary}}{{HTML}}{{1A1A2E}}
\definecolor{{subtext}}{{HTML}}{{555555}}

% ── Hyperlinks ────────────────────────────────────────────────────────────────
\hypersetup{{
  colorlinks=true,
  urlcolor=primary,
  linkcolor=primary,
  pdfborder={{0 0 0}}
}}

% ── Section formatting ────────────────────────────────────────────────────────
\titleformat{{\section}}
  {{\large\bfseries\color{{primary}}}}{{}}{{0em}}{{}}[\titlerule]
\titlespacing{{\section}}{{0pt}}{{8pt}}{{4pt}}

\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{2pt}}
\pagestyle{{empty}}

% ── \resumeentry{{Title}}{{Date}}{{Subtitle}}{{Extra}} ─────────────────────────
\newcommand{{\resumeentry}}[4]{{%
  \begin{{tabularx}}{{\textwidth}}{{Xr}}
    \textbf{{\color{{primary}}#1}} & \small\color{{subtext}}#2 \\
    \textit{{\color{{subtext}}#3}} & \small #4 \\
  \end{{tabularx}}%
}}

% ── Document ──────────────────────────────────────────────────────────────────
\begin{{document}}

\begin{{center}}
  {{\Huge\bfseries\color{{primary}} {name}}} \\[4pt]
  \small {contact_line}
\end{{center}}

\vspace{{4pt}}
\noindent\textcolor{{primary}}{{\rule{{\linewidth}}{{1.5pt}}}}
\vspace{{4pt}}

{body_sections}

\vspace{{8pt}}
\noindent\textcolor{{subtext}}{{\rule{{\linewidth}}{{0.4pt}}}}
\begin{{center}}
  \tiny\textit{{\color{{subtext}}Generated by AI Career Co-Pilot}}
\end{{center}}

\end{{document}}
"""