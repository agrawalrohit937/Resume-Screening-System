"""
Hierarchical Location Graph Service for Universal Recruiter Matching.
Provides alias resolution (Bangalore = Bengaluru = BLR ⊂ Bengaluru Metro),
GeoNames-style entity normalization, haversine commute feasibility,
remote eligibility, and timezone overlap computation.
"""

import math
import re
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger(__name__)


class NormalizedLocation(BaseModel):
    """Normalized geographical location entity."""
    raw: str
    city: str
    metro: Optional[str] = None
    admin1: Optional[str] = None  # State / Province
    country_iso2: str = "IN"
    lat: Optional[float] = None
    lon: Optional[float] = None
    timezone: str = "Asia/Kolkata"
    is_remote: bool = False


# Seed Location Knowledge Graph with major global & Indian tech/commercial hubs
LOCATION_GRAPH_NODES: Dict[str, Dict[str, Any]] = {
    # India
    "bengaluru": {
        "city": "Bengaluru",
        "metro": "Bengaluru Urban",
        "admin1": "Karnataka",
        "country_iso2": "IN",
        "lat": 12.9716,
        "lon": 77.5946,
        "timezone": "Asia/Kolkata",
        "aliases": ["bangalore", "blr", "whitefield", "electronic city", "koramangala", "indiranagar", "marathahalli"]
    },
    "mumbai": {
        "city": "Mumbai",
        "metro": "Mumbai Metropolitan Region (MMR)",
        "admin1": "Maharashtra",
        "country_iso2": "IN",
        "lat": 19.0760,
        "lon": 72.8777,
        "timezone": "Asia/Kolkata",
        "aliases": ["bombay", "bom", "navi mumbai", "thane", "andheri", "bkc", "bandra", "powai"]
    },
    "delhi ncr": {
        "city": "Delhi NCR",
        "metro": "National Capital Region",
        "admin1": "Delhi",
        "country_iso2": "IN",
        "lat": 28.6139,
        "lon": 77.2090,
        "timezone": "Asia/Kolkata",
        "aliases": ["delhi", "new delhi", "ncr", "gurugram", "gurgaon", "noida", "greater noida", "faridabad", "ghaziabad"]
    },
    "hyderabad": {
        "city": "Hyderabad",
        "metro": "Hyderabad Urban",
        "admin1": "Telangana",
        "country_iso2": "IN",
        "lat": 17.3850,
        "lon": 78.4867,
        "timezone": "Asia/Kolkata",
        "aliases": ["hyd", "cyberabad", "hitec city", "gachibowli", "secunderabad"]
    },
    "pune": {
        "city": "Pune",
        "metro": "Pune Metropolitan Area",
        "admin1": "Maharashtra",
        "country_iso2": "IN",
        "lat": 18.5204,
        "lon": 73.8567,
        "timezone": "Asia/Kolkata",
        "aliases": ["pnq", "hinjewadi", "magarpatta", "vimannagar", "pimpri-chinchwad"]
    },
    "chennai": {
        "city": "Chennai",
        "metro": "Chennai Metropolitan Area",
        "admin1": "Tamil Nadu",
        "country_iso2": "IN",
        "lat": 13.0827,
        "lon": 80.2707,
        "timezone": "Asia/Kolkata",
        "aliases": ["madras", "maa", "omr", "t nagar", "velachery"]
    },
    # United States
    "san francisco": {
        "city": "San Francisco",
        "metro": "San Francisco Bay Area",
        "admin1": "California",
        "country_iso2": "US",
        "lat": 37.7749,
        "lon": -122.4194,
        "timezone": "America/Los_Angeles",
        "aliases": ["sf", "bay area", "silicon valley", "sfo", "palo alto", "san jose", "mountain view", "sunnyvale"]
    },
    "new york": {
        "city": "New York",
        "metro": "New York Metropolitan Area",
        "admin1": "New York",
        "country_iso2": "US",
        "lat": 40.7128,
        "lon": -74.0060,
        "timezone": "America/New_York",
        "aliases": ["nyc", "new york city", "manhattan", "brooklyn", "queens"]
    },
    # United Kingdom
    "london": {
        "city": "London",
        "metro": "Greater London",
        "admin1": "England",
        "country_iso2": "GB",
        "lat": 51.5074,
        "lon": -0.1278,
        "timezone": "Europe/London",
        "aliases": ["lon", "central london", "city of london", "canary wharf"]
    },
    # Singapore
    "singapore": {
        "city": "Singapore",
        "metro": "Singapore",
        "admin1": "Central Region",
        "country_iso2": "SG",
        "lat": 1.3521,
        "lon": 103.8198,
        "timezone": "Asia/Singapore",
        "aliases": ["sg", "singapore city", "jurong", "changi"]
    },
    # UAE
    "dubai": {
        "city": "Dubai",
        "metro": "Dubai",
        "admin1": "Dubai",
        "country_iso2": "AE",
        "lat": 25.2048,
        "lon": 55.2708,
        "timezone": "Asia/Dubai",
        "aliases": ["dxb", "uae", "jlt", "difc", "downtown dubai"]
    }
}

# Alias Lookup Table (clean_alias -> node_key)
_ALIAS_LOOKUP: Dict[str, str] = {}
for node_key, node in LOCATION_GRAPH_NODES.items():
    _ALIAS_LOOKUP[node_key] = node_key
    _ALIAS_LOOKUP[node["city"].lower()] = node_key
    for alias in node.get("aliases", []):
        _ALIAS_LOOKUP[alias.lower()] = node_key


def normalize_location(raw_location: str) -> NormalizedLocation:
    """
    Resolves a raw location string into a structured NormalizedLocation entity.
    Handles 'Remote', 'Anywhere', 'WFH', and geographical aliases.
    """
    if not raw_location or not isinstance(raw_location, str):
        return NormalizedLocation(raw="", city="Remote", is_remote=True, country_iso2="")

    raw_clean = raw_location.strip()
    clean_lower = raw_clean.lower()

    # Remote detection
    if re.search(r"\b(remote|wfh|work from home|anywhere|virtual|telecommute)\b", clean_lower):
        return NormalizedLocation(
            raw=raw_clean,
            city="Remote",
            is_remote=True,
            country_iso2="",
            timezone="UTC"
        )

    # Clean punctuation
    cleaned_tokens = [t.strip() for t in re.split(r"[,/|;]+", clean_lower) if t.strip()]

    for token in cleaned_tokens:
        if token in _ALIAS_LOOKUP:
            node = LOCATION_GRAPH_NODES[_ALIAS_LOOKUP[token]]
            return NormalizedLocation(
                raw=raw_clean,
                city=node["city"],
                metro=node["metro"],
                admin1=node["admin1"],
                country_iso2=node["country_iso2"],
                lat=node["lat"],
                lon=node["lon"],
                timezone=node["timezone"],
                is_remote=False,
            )

    # Substring search in alias lookup
    for alias, node_key in _ALIAS_LOOKUP.items():
        if re.search(r"\b" + re.escape(alias) + r"\b", clean_lower):
            node = LOCATION_GRAPH_NODES[node_key]
            return NormalizedLocation(
                raw=raw_clean,
                city=node["city"],
                metro=node["metro"],
                admin1=node["admin1"],
                country_iso2=node["country_iso2"],
                lat=node["lat"],
                lon=node["lon"],
                timezone=node["timezone"],
                is_remote=False,
            )

    # Fallback to general representation
    return NormalizedLocation(
        raw=raw_clean,
        city=raw_clean.title(),
        is_remote=False,
        country_iso2="IN" if any(c in clean_lower for c in ("india", "karnataka", "maharashtra", "delhi")) else "US"
    )


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in kilometers."""
    radius_earth = 6371.0  # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(radius_earth * c, 2)


def commute_feasible(
    candidate_location: str,
    job_location: str,
    radius_km: float = 45.0,
) -> Tuple[bool, float, str]:
    """
    Determines if a daily commute is feasible between candidate and job.
    Returns: (is_feasible, distance_km, explanation)
    """
    cand = normalize_location(candidate_location)
    job = normalize_location(job_location)

    if job.is_remote or cand.is_remote:
        return True, 0.0, "Remote eligible (no physical commute required)"

    # Same metro area -> feasible
    if cand.metro and job.metro and cand.metro.lower() == job.metro.lower():
        return True, 15.0, f"Same metropolitan area: {cand.metro}"

    # Lat/Lon distance check
    if cand.lat and cand.lon and job.lat and job.lon:
        dist = haversine_distance_km(cand.lat, cand.lon, job.lat, job.lon)
        if dist <= radius_km:
            return True, dist, f"Within commute radius ({dist:.1f} km <= {radius_km:.0f} km)"
        return False, dist, f"Exceeds daily commute radius ({dist:.1f} km > {radius_km:.0f} km)"

    # Same city fallback
    if cand.city.lower() == job.city.lower():
        return True, 10.0, f"Same city: {cand.city}"

    return False, 999.0, f"Different geographical locations: {cand.city} vs {job.city}"


def timezone_overlap_hours(cand_tz: str, job_tz: str, work_hours_per_day: float = 8.0) -> float:
    """
    Calculates operational overlap hours between candidate and job timezones.
    """
    # Simple offset approximations for major zones
    offsets = {
        "utc": 0.0,
        "asia/kolkata": 5.5,
        "asia/singapore": 8.0,
        "asia/dubai": 4.0,
        "europe/london": 0.0,
        "america/new_york": -5.0,
        "america/los_angeles": -8.0,
    }
    cand_offset = offsets.get(cand_tz.lower(), 5.5)
    job_offset = offsets.get(job_tz.lower(), 5.5)
    tz_diff = abs(cand_offset - job_offset)
    overlap = max(0.0, work_hours_per_day - tz_diff)
    return round(overlap, 1)
