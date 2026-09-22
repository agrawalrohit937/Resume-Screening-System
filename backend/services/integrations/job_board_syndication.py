"""
Job Board Syndication Service — Indeed XML Feed & LinkedIn Jobs JSON Feed.

Provides:
- Indeed XML Specification compliant feed generation for automated job posting scrapers.
- LinkedIn Jobs / Google for Jobs schema.org JSON-LD feed generation.
- Syndication filters and formatters.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from xml.etree import ElementTree as ET

from models.job import JobModel, WorkMode


def generate_indeed_xml_feed(
    jobs: List[JobModel],
    publisher_name: str = "CareerShala ATS",
    base_url: str = "https://careershala.ai",
) -> str:
    """
    Generates an Indeed-compliant XML feed for active jobs.
    Spec: https://support.indeed.com/hc/en-us/articles/202687720-XML-Feed-Specification
    """
    root = ET.Element("source")

    publisher_el = ET.SubElement(root, "publisher")
    publisher_el.text = publisher_name

    publisher_url_el = ET.SubElement(root, "publisherurl")
    publisher_url_el.text = base_url

    last_build_date = ET.SubElement(root, "lastBuildDate")
    last_build_date.text = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    descriptions: Dict[str, str] = {}

    for idx, job in enumerate(jobs):
        if getattr(job, "status", "open") != "open":
            continue

        job_el = ET.SubElement(root, "job")

        title_el = ET.SubElement(job_el, "title")
        title_el.text = getattr(job, "title", "Untitled Job")

        date_el = ET.SubElement(job_el, "date")
        created_at = getattr(job, "created_at", None) or datetime.now(timezone.utc)
        if isinstance(created_at, str):
            date_el.text = created_at
        else:
            date_el.text = created_at.strftime("%a, %d %b %Y %H:%M:%S GMT")

        ref_el = ET.SubElement(job_el, "referencenumber")
        ref_el.text = str(getattr(job, "id", "") or getattr(job, "requisition_id", "REQ-001"))

        url_el = ET.SubElement(job_el, "url")
        url_el.text = f"{base_url.rstrip('/')}/jobs/{getattr(job, 'id', '0')}"

        company_el = ET.SubElement(job_el, "company")
        company_el.text = getattr(job, "company_name", publisher_name)

        city_el = ET.SubElement(job_el, "city")
        location = getattr(job, "location", "Remote")
        loc_parts = location.split(",")
        city_el.text = loc_parts[0].strip() if loc_parts else "Remote"

        state_el = ET.SubElement(job_el, "state")
        state_el.text = loc_parts[1].strip() if len(loc_parts) > 1 else ""

        country_el = ET.SubElement(job_el, "country")
        country_el.text = "IN" if "india" in location.lower() or "bengaluru" in location.lower() else "US"

        desc_el = ET.SubElement(job_el, "description")
        raw_desc = getattr(job, "jd_text_raw", "") or getattr(job, "description", "")
        placeholder = f"__CS_CDATA_DESC_{idx}__"
        descriptions[placeholder] = f"<![CDATA[{raw_desc}]]>"
        desc_el.text = placeholder

        salary_range = getattr(job, "salary_range", None)
        if salary_range:
            salary_el = ET.SubElement(job_el, "salary")
            salary_el.text = salary_range

        work_mode = getattr(job, "work_mode", None)
        if work_mode == WorkMode.REMOTE.value if hasattr(WorkMode, "REMOTE") else work_mode == "remote":
            remotetype_el = ET.SubElement(job_el, "remotetype")
            remotetype_el.text = "FULLY_REMOTE"

    xml_str = ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")
    for placeholder, cdata_val in descriptions.items():
        xml_str = xml_str.replace(placeholder, cdata_val)
    return xml_str


def generate_linkedin_jobs_json_feed(
    jobs: List[JobModel],
    base_url: str = "https://careershala.ai",
) -> List[Dict[str, Any]]:
    """
    Generates schema.org/JobPosting JSON-LD payloads for LinkedIn Jobs & Google for Jobs.
    """
    feed = []
    for job in jobs:
        if getattr(job, "status", "open") != "open":
            continue

        job_id = str(getattr(job, "id", "") or "job_001")
        job_url = f"{base_url.rstrip('/')}/jobs/{job_id}"
        company_name = getattr(job, "company_name", "CareerShala Enterprise")
        raw_desc = getattr(job, "jd_text_raw", "") or getattr(job, "description", "")

        posting: Dict[str, Any] = {
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            "title": getattr(job, "title", "Position"),
            "description": raw_desc,
            "identifier": {
                "@type": "PropertyValue",
                "name": company_name,
                "value": job_id,
            },
            "datePosted": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "employmentType": "FULL_TIME",
            "hiringOrganization": {
                "@type": "Organization",
                "name": company_name,
                "sameAs": getattr(job, "company_website", base_url),
                "logo": getattr(job, "company_logo", f"{base_url}/static/logo.png"),
            },
            "directApply": True,
            "url": job_url,
        }

        work_mode = getattr(job, "work_mode", "")
        location = getattr(job, "location", "Remote")

        if work_mode in (WorkMode.REMOTE.value if hasattr(WorkMode, "REMOTE") else "remote", "remote"):
            posting["jobLocationType"] = "TELECOMMUTE"
            posting["applicantLocationRequirements"] = {"@type": "Country", "name": "Global"}
        else:
            posting["jobLocation"] = {
                "@type": "Place",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": location,
                },
            }

        salary_range = getattr(job, "salary_range", None)
        if salary_range:
            posting["baseSalary"] = {
                "@type": "MonetaryAmount",
                "currency": "INR" if "₹" in salary_range or "lpa" in salary_range.lower() else "USD",
                "value": {
                    "@type": "QuantitativeValue",
                    "value": salary_range,
                    "unitText": "YEAR",
                },
            }

        feed.append(posting)

    return feed
