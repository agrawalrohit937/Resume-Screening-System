"""
Enterprise Authentication & SCIM Provisioning Models.

Phase 5, Task 5.2:
SAML 2.0, OIDC SSO configurations, and SCIM 2.0 provisioning schemas.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


class SAMLConfiguration(BaseModel):
    tenant_id: str
    idp_entity_id: str
    idp_sso_url: str
    idp_x509_cert: str
    sp_entity_id: str = "https://careershaala.com/saml/metadata"
    acs_url: str = "https://careershaala.com/api/v1/auth/sso/saml/acs"
    enabled: bool = True
    attribute_mapping: Dict[str, str] = Field(default_factory=lambda: {
        "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        "full_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
        "role": "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
    })
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OIDCConfiguration(BaseModel):
    tenant_id: str
    issuer_url: str
    client_id: str
    client_secret: str
    discovery_url: Optional[str] = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SCIMName(BaseModel):
    formatted: Optional[str] = None
    familyName: Optional[str] = None
    givenName: Optional[str] = None


class SCIMEmail(BaseModel):
    value: EmailStr
    type: str = "work"
    primary: bool = True


class SCIMUserPayload(BaseModel):
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:User"]
    userName: str
    name: Optional[SCIMName] = None
    displayName: Optional[str] = None
    emails: List[SCIMEmail] = []
    active: bool = True
    roles: List[str] = ["recruiter"]
    tenant_id: str = "default"


class SCIMUserResponse(BaseModel):
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:User"]
    id: str
    userName: str
    name: Optional[SCIMName] = None
    emails: List[SCIMEmail] = []
    active: bool = True
    roles: List[str] = []
    meta: Dict[str, Any] = Field(default_factory=dict)
