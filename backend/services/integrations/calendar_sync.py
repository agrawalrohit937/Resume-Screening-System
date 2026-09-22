"""
Calendar Synchronization Service & RFC 5545 iCalendar (.ics) Generator.

Provides:
- RFC 5545 compliant .ics file generation for interview calendar invites.
- Google Calendar API integration adapter stub.
- Microsoft Outlook / Graph API calendar integration adapter stub.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import structlog

logger = structlog.get_logger(__name__)


def generate_interview_ics(
    summary: str,
    start_time: datetime,
    end_time: Optional[datetime] = None,
    duration_minutes: int = 45,
    description: Optional[str] = None,
    location: Optional[str] = None,
    organizer_name: str = "CareerShala Hiring Team",
    organizer_email: str = "interviews@careershala.ai",
    attendee_name: Optional[str] = None,
    attendee_email: Optional[str] = None,
    uid: Optional[str] = None,
) -> str:
    """
    Generates a standard RFC 5545 iCalendar (.ics) format string for interview invitations.
    Compatible with Google Calendar, Apple Calendar, and Microsoft Outlook.
    """
    event_uid = uid or f"cs-interview-{uuid.uuid4().hex[:12]}@careershala.ai"
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    # Format Start and End datetimes in UTC
    if start_time.tzinfo is None:
        start_utc = start_time.replace(tzinfo=timezone.utc)
    else:
        start_utc = start_time.astimezone(timezone.utc)

    if end_time is not None:
        if end_time.tzinfo is None:
            end_utc = end_time.replace(tzinfo=timezone.utc)
        else:
            end_utc = end_time.astimezone(timezone.utc)
    else:
        end_utc = start_utc + timedelta(minutes=duration_minutes)

    dtstart_str = start_utc.strftime("%Y%m%dT%H%M%SZ")
    dtend_str = end_utc.strftime("%Y%m%dT%H%M%SZ")

    desc_escaped = (description or f"Technical Interview: {summary}").replace("\n", "\\n").replace(",", "\\,")
    loc_escaped = (location or "Virtual Video Room (CareerShala Live)").replace(",", "\\,")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CareerShala//ATS Interview Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{event_uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart_str}",
        f"DTEND:{dtend_str}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{desc_escaped}",
        f"LOCATION:{loc_escaped}",
        f"ORGANIZER;CN={organizer_name}:mailto:{organizer_email}",
    ]

    if attendee_email:
        att_name = attendee_name or "Candidate"
        lines.append(f"ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN={att_name}:mailto:{attendee_email}")

    lines.extend([
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        f"DESCRIPTION:Reminder: {summary}",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ])

    return "\r\n".join(lines) + "\r\n"


class GoogleCalendarAdapter:
    """Google Calendar REST API Adapter stub for direct OAuth sync."""

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token

    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Returns OAuth2 consent screen URL for Google Calendar scope."""
        base = "https://accounts.google.com/o/oauth2/v2/auth"
        scope = "https://www.googleapis.com/auth/calendar.events"
        return f"{base}?client_id=careershala_google_client&redirect_uri={redirect_uri}&response_type=code&scope={scope}&state={state}&access_type=offline"

    async def create_event(
        self,
        summary: str,
        start_time: datetime,
        duration_minutes: int = 45,
        attendee_email: Optional[str] = None,
        meet_link: bool = True,
    ) -> Dict[str, Any]:
        """Creates Google Calendar event with Google Meet link."""
        end_time = start_time + timedelta(minutes=duration_minutes)
        event_id = f"gcal_{uuid.uuid4().hex[:10]}"
        logger.info("Google Calendar: Created interview event", event_id=event_id, summary=summary)
        return {
            "success": True,
            "provider": "google_calendar",
            "event_id": event_id,
            "html_link": f"https://calendar.google.com/event?eid={event_id}",
            "conference_url": f"https://meet.google.com/cs-{uuid.uuid4().hex[:3]}-{uuid.uuid4().hex[:4]}" if meet_link else None,
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
        }


class OutlookCalendarAdapter:
    """Microsoft Graph API Calendar Adapter stub for Outlook/Office 365 sync."""

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token

    def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Returns Microsoft identity platform OAuth2 authorize URL."""
        base = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
        scope = "Calendars.ReadWrite offline_access"
        return f"{base}?client_id=careershala_ms_client&redirect_uri={redirect_uri}&response_type=code&scope={scope}&state={state}"

    async def create_event(
        self,
        summary: str,
        start_time: datetime,
        duration_minutes: int = 45,
        attendee_email: Optional[str] = None,
        teams_link: bool = True,
    ) -> Dict[str, Any]:
        """Creates Outlook event with Microsoft Teams link."""
        end_time = start_time + timedelta(minutes=duration_minutes)
        event_id = f"ms_outlook_{uuid.uuid4().hex[:10]}"
        logger.info("Outlook Calendar: Created interview event", event_id=event_id, summary=summary)
        return {
            "success": True,
            "provider": "outlook_calendar",
            "event_id": event_id,
            "web_link": f"https://outlook.office.com/calendar/item/{event_id}",
            "teams_url": f"https://teams.microsoft.com/l/meetup-join/{event_id}" if teams_link else None,
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
        }
