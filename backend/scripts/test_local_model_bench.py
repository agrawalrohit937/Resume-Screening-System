"""
Standalone Benchmark Script for NuExtract-1.5-smol Q4_K_M GGUF.
Tests local CPU inference latency, peak RAM, JSON validity, and entity extraction on 5 real resumes.
DOES NOT MODIFY PRODUCTION CODE.
"""

import asyncio
import ctypes
from ctypes import wintypes
import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from huggingface_hub import hf_hub_download
from llama_cpp import Llama

# ─── RAM Measurement via Windows API ──────────────────────────────────────────
class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
    _fields_ = [
        ("cb", wintypes.DWORD),
        ("PageFaultCount", wintypes.DWORD),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def get_current_process_memory_mb() -> float:
    """Returns current process Working Set (RAM) in Megabytes."""
    try:
        counters = PROCESS_MEMORY_COUNTERS_EX()
        counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS_EX)
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        if ctypes.windll.psapi.GetProcessMemoryInfo(
            handle, ctypes.byref(counters), counters.cb
        ):
            return round(counters.WorkingSetSize / (1024 * 1024), 2)
    except Exception:
        pass
    return 0.0


# ─── Interval Union for Non-Overlapping Experience ────────────────────────────
def calculate_experience_from_intervals(work_experience: List[Dict[str, Any]]) -> float:
    """
    Computes total years of experience using union of date intervals [start, end].
    Prevents double-counting overlapping tenures (e.g. freelance/consulting alongside full-time).
    """
    intervals: List[Tuple[float, float]] = []
    current_year = 2026.83  # Oct 2026

    year_pat = re.compile(r"\b(19\d{2}|20\d{2})\b")
    month_names = {
        "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5,
        "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11
    }

    def parse_date_to_float(date_str: Optional[str], default_is_present: bool = False) -> Optional[float]:
        if not date_str:
            return current_year if default_is_present else None
        d_lower = date_str.lower().strip()
        if any(w in d_lower for w in ["present", "current", "now", "ongoing"]):
            return current_year
        m_year = year_pat.search(d_lower)
        if not m_year:
            return None
        year = float(m_year.group(1))
        month = 0.0
        for m_str, m_idx in month_names.items():
            if m_str in d_lower:
                month = m_idx / 12.0
                break
        return year + month

    for exp in work_experience:
        if not isinstance(exp, dict):
            continue
        start = parse_date_to_float(exp.get("start_date"))
        end = parse_date_to_float(exp.get("end_date"), default_is_present=bool(exp.get("is_current")))
        if start and end and end >= start and (end - start) < 50:
            intervals.append((start, end))

    if not intervals:
        return 0.0

    # Sort intervals and merge overlapping/adjacent intervals
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for cur_start, cur_end in intervals[1:]:
        last_start, last_end = merged[-1]
        if cur_start <= last_end:
            # Overlapping intervals: take the maximum end
            merged[-1] = (last_start, max(last_end, cur_end))
        else:
            merged.append((cur_start, cur_end))

    total_years = sum(end - start for start, end in merged)
    return round(total_years, 1)


# ─── NuExtract Prompt Template ────────────────────────────────────────────────
EXTRACTION_TEMPLATE = {
    "full_name": "",
    "summary": "",
    "work_experience": [
        {
            "company": "",
            "title": "",
            "start_date": "",
            "end_date": "",
            "is_current": False,
            "description": "",
            "technologies": []
        }
    ],
    "education": [
        {
            "institution": "",
            "degree": "",
            "field_of_study": "",
            "start_year": None,
            "end_year": None,
            "gpa": None
        }
    ],
    "projects": [
        {
            "name": "",
            "description": "",
            "technologies": [],
            "url": "",
            "github_url": ""
        }
    ],
    "certifications": [
        {
            "name": "",
            "issuer": "",
            "issue_date": "",
            "credential_id": ""
        }
    ],
    "skills": []
}


def build_nuextract_prompt(resume_text: str) -> str:
    template_str = json.dumps(EXTRACTION_TEMPLATE, indent=2)
    # Bounded text input to fit comfortably in 4096 context window
    truncated_text = resume_text[:3500]
    return f"""<|input|>
### Template:
{template_str}

### Text:
{truncated_text}

<|output|>"""


# ─── Load Exactly 5 Representative Resumes ────────────────────────────────────
async def load_5_sample_resumes() -> List[Dict[str, Any]]:
    """Loads 5 existing resumes from MongoDB or sample fallback."""
    from config.db import connect_db, get_database, disconnect_db

    samples = []
    try:
        await connect_db()
        db = get_database()
        cursor = db["resumes"].find(
            {},
            {"filename": 1, "raw_text": 1, "parsed_data.raw_text": 1, "parsed_data.full_name": 1}
        )
        docs = await cursor.to_list(length=20)
        await disconnect_db()

        # Select 5 unique, non-empty resumes of varying lengths
        seen_lengths = set()
        for doc in docs:
            txt = (doc.get("raw_text") or (doc.get("parsed_data") or {}).get("raw_text") or "").strip()
            if len(txt) > 500 and len(txt) not in seen_lengths:
                seen_lengths.add(len(txt))
                samples.append({
                    "id": str(doc.get("_id", len(samples) + 1)),
                    "filename": doc.get("filename", f"sample_{len(samples)+1}.pdf"),
                    "text": txt,
                    "length": len(txt),
                })
            if len(samples) == 5:
                break
    except Exception as e:
        print(f"Warning loading from DB: {e}. Using bundled test resumes.")

    # Fallback to test resumes if fewer than 5 found
    if len(samples) < 5:
        dummy_resumes = [
            ("sample_swe.txt", """John Doe\njohn.doe@example.com | (555) 234-5678 | San Francisco, CA\nhttps://github.com/johndoe\n\nSUMMARY\nSenior Backend Engineer with 5 years experience building distributed systems in Python, Go, and AWS.\n\nEXPERIENCE\nStripe — Staff Infrastructure Engineer\nJan 2022 - Present\n- Built payment idempotency layers using Redis and PostgreSQL.\n\nTwilio — Senior Software Engineer\nJun 2019 - Dec 2021\n- Developed high-throughput SMS dispatch APIs with Python and Docker.\n\nEDUCATION\nStanford University\nB.S. in Computer Science\n2015 - 2019 | GPA: 3.8\n\nPROJECTS\nDistributedQueue\n- High performance task queue in Go and Redis.\n\nCERTIFICATIONS\nAWS Certified Solutions Architect — Amazon Web Services (2021)\n\nSKILLS\nPython, Go, Docker, Kubernetes, PostgreSQL, Redis, AWS, Distributed Systems"""),
            ("sample_nurse.txt", """Sarah Jenkins, RN, BSN\nsarah.jenkins@hospital.org | (555) 987-6543 | Chicago, IL\n\nPROFESSIONAL SUMMARY\nCompassionate Registered Nurse with 4 years of clinical experience in Emergency Department and ICU.\n\nCLINICAL EXPERIENCE\nNorthwestern Memorial Hospital — Emergency Department Staff Nurse\nMar 2021 - Present\n- Triage level 1 trauma patients, administer emergency IV meds, vital signs monitoring.\n\nMercy Hospital — Clinical Nurse Intern\nJan 2020 - Feb 2021\n- Assisted in patient care, phlebotomy, and wound dressing.\n\nEDUCATION\nRush University College of Nursing\nBachelor of Science in Nursing (BSN)\n2016 - 2020\n\nCERTIFICATIONS & LICENSURE\nIllinois Registered Nurse License (RN) — Illinois Board of Nursing (2020)\nAdvanced Cardiovascular Life Support (ACLS) — American Heart Association (2021)\nBasic Life Support (BLS) — AHA (2020)\n\nCLINICAL SKILLS\nPatient Care, Triage, Phlebotomy, Vital Signs, ACLS, BLS, ICU Care, Epic EHR"""),
            ("sample_accountant.txt", """David Miller, CPA\ndavid.miller@auditfirm.com | (555) 432-1098 | Dallas, TX\n\nSUMMARY\nCertified Public Accountant with 6 years experience in statutory audit, GAAP compliance, and financial reporting.\n\nWORK HISTORY\nDeloitte — Senior Audit Associate\nSep 2020 - Present\n- Conducted SEC 10-K statutory audits and internal controls compliance for Fortune 500 tech clients.\n\nBDO USA — Audit Associate\nAug 2018 - Aug 2020\n- Reconciled general ledgers, performed balance sheet audits, and prepared tax returns.\n\nEDUCATION\nUniversity of Texas at Austin\nMaster in Professional Accounting (MPA)\n2017 - 2018\nBachelor of Business Administration (BBA) in Finance\n2013 - 2017\n\nCERTIFICATIONS\nCertified Public Accountant (CPA) — Texas State Board of Public Accountancy (2019)\n\nKEY COMPETENCIES\nGAAP, Statutory Audit, Internal Audit, General Ledger, Balance Sheet, Financial Modeling, Excel"""),
            ("sample_legal.txt", """Elena Vance, Esq.\nelena.vance@legalcorp.com | (555) 321-7654 | Washington, DC\n\nPROFESSIONAL PROFILE\nCorporate Attorney with 3 years experience advising technology companies on commercial contracts, NDA review, and data privacy regulatory compliance.\n\nLEGAL EXPERIENCE\nWilson Sonsini Goodrich & Rosati — Corporate Associate\nNov 2022 - Present\n- Drafted and negotiated SaaS commercial contracts, vendor agreements, and NDAs.\n\nFTC Bureau of Competition — Legal Fellow\nOct 2021 - Oct 2022\n- Conducted antitrust inquiries and regulatory compliance reviews.\n\nEDUCATION\nGeorgetown University Law Center\nJuris Doctor (J.D.)\n2018 - 2021\n\nADMISSIONS & CERTIFICATIONS\nDistrict of Columbia Bar Member (2021)\nCIPP/US Certified Information Privacy Professional — IAPP (2022)\n\nAREAS OF EXPERTISE\nCorporate Law, Contract Review, Contract Drafting, NDA Review, Regulatory Compliance, SaaS Agreements"""),
            ("sample_fresher.txt", """Rohan Sharma\nrohan.sharma@gmail.com | +91 98765 43210 | Bangalore, India\nhttps://github.com/rohansharma\n\nCAREER OBJECTIVE\nEnthusiastic Fresher and 2024 Computer Science graduate seeking an entry-level Software Engineer role.\n\nINTERNSHIP EXPERIENCE\nInnoTech Solutions — Software Engineering Intern\nJan 2024 - Jun 2024\n- Built full-stack web applications using React, FastAPI, and PostgreSQL.\n\nEDUCATION\nNational Institute of Technology Karnataka, Surathkal\nBachelor of Technology (B.Tech) in Computer Science & Engineering\n2020 - 2024 | CGPA: 8.4/10\n\nACADEMIC PROJECTS\nAI Resume Screener\n- Developed ATS resume screening backend using Python and vector embeddings.\n- https://github.com/rohansharma/ai-resume-screener\n\nTECHNICAL SKILLS\nPython, FastAPI, React, JavaScript, PostgreSQL, Docker, Git, Data Structures, Algorithms""")
        ]
        while len(samples) < 5:
            idx = len(samples)
            fn, t = dummy_resumes[idx]
            samples.append({
                "id": f"bundled_{idx+1}",
                "filename": fn,
                "text": t,
                "length": len(t),
            })

    return samples[:5]


# ─── Main Benchmark Routine ───────────────────────────────────────────────────
def run_benchmark():
    print("=" * 80)
    print("CAREERPILOT LOCAL MODEL BENCHMARK: NuExtract-1.5-smol (Q4_K_M GGUF)")
    print("=" * 80)

    # 1. Download / Locate GGUF Model
    print("\n[Step 1] Locating GGUF Model weights...")
    t0_dl = time.time()
    model_path = hf_hub_download(
        repo_id="bartowski/NuExtract-1.5-smol-GGUF",
        filename="NuExtract-1.5-smol-Q4_K_M.gguf"
    )
    model_size_mb = round(os.path.getsize(model_path) / (1024 * 1024), 2)
    print(f"Model File: {model_path}")
    print(f"Model Download Size: {model_size_mb} MB")

    # 2. Check Initial Memory
    ram_before_load = get_current_process_memory_mb()
    print(f"Initial Process RAM: {ram_before_load} MB")

    # 3. Load Model with llama.cpp
    print("\n[Step 2] Initializing llama_cpp runtime on CPU...")
    t0_load = time.time()
    llm = Llama(
        model_path=model_path,
        n_ctx=4096,
        n_threads=os.cpu_count() or 4,
        verbose=False,
    )
    load_time_sec = round(time.time() - t0_load, 3)
    ram_after_load = get_current_process_memory_mb()
    model_ram_mb = round(ram_after_load - ram_before_load, 2)
    print(f"Model Load Time: {load_time_sec}s")
    print(f"Post-Load Process RAM: {ram_after_load} MB (Model Weight Overhead: ~{model_ram_mb} MB)")

    # 4. Load 5 Test Resumes
    print("\n[Step 3] Loading exactly 5 representative resumes...")
    samples = asyncio.run(load_5_sample_resumes())
    print(f"Loaded {len(samples)} resumes for evaluation.")

    results = []
    peak_ram_overall = ram_after_load

    # 5. Evaluate Each Resume
    print("\n[Step 4] Running Inference on 5 Resumes...")
    for idx, sample in enumerate(samples, 1):
        fn = sample["filename"]
        text = sample["text"]
        t_len = len(text)
        print(f"\n--- Testing Resume {idx}/5: {fn} (Length: {t_len} chars) ---")

        prompt = build_nuextract_prompt(text)

        t0_inf = time.time()
        output = llm(
            prompt,
            max_tokens=1500,
            temperature=0.0,
            stop=["<|output|>", "<|end-output|>", "### Input:", "### Text:"],
            echo=False,
        )
        inf_time = round(time.time() - t0_inf, 3)
        cur_ram = get_current_process_memory_mb()
        peak_ram_overall = max(peak_ram_overall, cur_ram)

        raw_pred = output["choices"][0]["text"].strip()

        # Parse JSON
        is_valid_json = False
        parsed_json: Dict[str, Any] = {}
        error_msg = None

        # Clean code fences if present
        clean_pred = re.sub(r"^```(?:json)?\s*", "", raw_pred)
        clean_pred = re.sub(r"\s*```$", "", clean_pred).strip()

        try:
            parsed_json = json.loads(clean_pred)
            is_valid_json = True
        except Exception as e:
            error_msg = str(e)
            # Try finding first { and last }
            m = re.search(r"\{.*\}", clean_pred, re.DOTALL)
            if m:
                try:
                    parsed_json = json.loads(m.group(0))
                    is_valid_json = True
                    error_msg = None
                except Exception as e2:
                    error_msg = str(e2)

        # Field Extraction Analysis
        extracted_name = parsed_json.get("full_name") or "MISSING"
        work_exp = parsed_json.get("work_experience") or []
        edu = parsed_json.get("education") or []
        skills = parsed_json.get("skills") or []
        projects = parsed_json.get("projects") or []
        certs = parsed_json.get("certifications") or []

        # Calculate Interval Union Experience
        total_tenure_years = calculate_experience_from_intervals(work_exp)

        obs = {
            "index": idx,
            "filename": fn,
            "text_length": t_len,
            "inference_time_sec": inf_time,
            "tokens_generated": output["usage"]["completion_tokens"],
            "tokens_prompt": output["usage"]["prompt_tokens"],
            "tokens_per_sec": round(
                output["usage"]["completion_tokens"] / max(0.001, inf_time), 1
            ),
            "ram_mb": cur_ram,
            "valid_json": is_valid_json,
            "json_error": error_msg,
            "name": extracted_name,
            "work_exp_count": len(work_exp),
            "edu_count": len(edu),
            "skills_count": len(skills),
            "projects_count": len(projects),
            "certs_count": len(certs),
            "calculated_tenure_years": total_tenure_years,
        }
        results.append(obs)

        print(f"  > Inference Time: {inf_time}s ({obs['tokens_per_sec']} tokens/s)")
        print(f"  > Valid JSON: {is_valid_json} {'(Syntax Error: ' + str(error_msg) + ')' if error_msg else ''}")
        print(f"  > Extracted Name: {extracted_name}")
        print(f"  > Work Roles: {len(work_exp)} | Education: {len(edu)} | Skills: {len(skills)}")
        print(f"  > Non-overlapping Tenure (Interval Union): {total_tenure_years} yrs")

    # 6. Print Benchmark Summary Table
    print("\n" + "=" * 80)
    print("BENCHMARK EVALUATION SUMMARY TABLE")
    print("=" * 80)
    print(f"{'#':<3} | {'Resume Filename':<28} | {'Time (s)':<8} | {'Tok/s':<6} | {'JSON?':<6} | {'Name':<18} | {'Exp':<4} | {'Edu':<4} | {'Skills':<6}")
    print("-" * 88)
    for r in results:
        name_trunc = str(r["name"])[:16]
        fn_trunc = str(r["filename"])[:26]
        print(f"{r['index']:<3} | {fn_trunc:<28} | {r['inference_time_sec']:<8} | {r['tokens_per_sec']:<6} | {str(r['valid_json']):<6} | {name_trunc:<18} | {r['work_exp_count']:<4} | {r['edu_count']:<4} | {r['skills_count']:<6}")

    avg_time = round(sum(r["inference_time_sec"] for r in results) / len(results), 2)
    valid_json_count = sum(1 for r in results if r["valid_json"])

    print("-" * 88)
    print(f"Model Load Time   : {load_time_sec}s")
    print(f"Average Inf Time  : {avg_time}s / resume")
    print(f"Peak Process RAM  : {peak_ram_overall} MB")
    print(f"Valid JSON Output : {valid_json_count} / {len(results)}")
    print("=" * 80)


if __name__ == "__main__":
    run_benchmark()
