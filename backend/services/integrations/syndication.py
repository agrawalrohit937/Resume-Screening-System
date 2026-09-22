"""Job-Board Syndication: Indeed XML Feed & Google for Jobs Schema.org.
CareerPilot ATS v2.0.0 - Enterprise ATS Ecosystem.
"""

from datetime import datetime, timezone
import html
from typing import Dict, List, Any, Optional
from xml.etree import ElementTree as ET

from models.job import JobModel, WorkMode


def generate_indeed_xml_feed(
    jobs: List[JobModel],
    publisher_name: str = "CareerPilot ATS",
    base_url: str = "https://careerpilot.ai"
) -> str:
    """Generates an Indeed-compliant XML feed for active jobs.
    
    Specification: https://support.indeed.com/hc/en-us/articles/202687720-XML-Feed-Specification
    """
    root = ET.Element("source")
    
    publisher_el = ET.SubElement(root, "publisher")
    publisher_el.text = publisher_name
    
    publisher_url_el = ET.SubElement(root, "publisherurl")
    publisher_url_el.text = base_url
    
    last_build_date = ET.SubElement(root, "lastBuildDate")
    last_build_date.text = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

    for job in jobs:
        if job.status != "open":
            continue

        job_el = ET.SubElement(root, "job")
        
        title_el = ET.SubElement(job_el, "title")
        title_el.text = job.title

        date_el = ET.SubElement(job_el, "date")
        date_el.text = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

        ref_el = ET.SubElement(job_el, "referencenumber")
        ref_el.text = str(job.id or "unknown")

        url_el = ET.SubElement(job_el, "url")
        url_el.text = f"{base_url.rstrip('/')}/jobs/{job.id}"

        company_el = ET.SubElement(job_el, "company")
        company_el.text = job.company_name

        city_el = ET.SubElement(job_el, "city")
        # Extract city or fallback
        loc_parts = job.location.split(",")
        city_el.text = loc_parts[0].strip() if loc_parts else "Remote"

        state_el = ET.SubElement(job_el, "state")
        state_el.text = loc_parts[1].strip() if len(loc_parts) > 1 else ""

        country_el = ET.SubElement(job_el, "country")
        country_el.text = "US"

        desc_el = ET.SubElement(job_el, "description")
        desc_el.text = f"<![CDATA[{job.jd_text_raw}]]>"

        if job.salary_range:
            salary_el = ET.SubElement(job_el, "salary")
            salary_el.text = job.salary_range

        if job.work_mode == WorkMode.REMOTE.value:
            remotetype_el = ET.SubElement(job_el, "remotetype")
            remotetype_el.text = "FULLY_REMOTE"

    xml_str = ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")
    # Unescape CDATA tag
    xml_str = xml_str.replace("&lt;![CDATA[", "<![CDATA[").replace("]]&gt;", "]]>")
    return xml_str


def generate_google_job_posting_ld_json(
    job: JobModel,
    base_url: str = "https://careerpilot.ai"
) -> Dict[str, Any]:
    """Generates schema.org/JobPosting JSON-LD metadata for Google for Jobs indexing.
    
    Specification: https://developers.google.com/search/docs/appearance/structured-data/job-posting
    """
    job_url = f"{base_url.rstrip('/')}/jobs/{job.id}"
    
    ld_json: Dict[str, Any] = {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": job.title,
        "description": job.jd_text_raw,
        "identifier": {
            "@type": "PropertyValue",
            "name": job.company_name,
            "value": str(job.id or "CP-JOB-001")
        },
        "datePosted": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
            "@type": "Organization",
            "name": job.company_name,
            "sameAs": job.company_website or base_url,
            "logo": job.company_logo or f"{base_url}/static/default-logo.png"
        },
        "directApply": True,
        "url": job_url
    }

    if job.work_mode == WorkMode.REMOTE.value:
        ld_json["jobLocationType"] = "TELECOMMUTE"
        ld_json["applicantLocationRequirements"] = {
            "@type": "Country",
            "name": "US"
        }
    else:
        ld_json["jobLocation"] = {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": job.location,
                "addressCountry": "US"
            }
        }

    if job.salary_range:
        ld_json["baseSalary"] = {
            "@type": "MonetaryAmount",
            "currency": "USD",
            "value": {
                "@type": "QuantitativeValue",
                "value": job.salary_range,
                "unitText": "YEAR"
            }
        }

    return ld_json
