"""Enterprise SSO (SAML 2.0 / OIDC) and SCIM 2.0 API Routes.
CareerPilot ATS v2.0.0 - Enterprise Authentication.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Form, HTTPException, Query, status
from pydantic import BaseModel

from api.deps import get_database
from models.enterprise_auth import (
    SAMLConfiguration,
    SCIMUserPayload,
    SCIMUserResponse,
)
from services.enterprise_auth.sso_service import EnterpriseSSOService
from services.enterprise_auth.scim_service import SCIMService

router = APIRouter()


class SAMLLoginResponse(BaseModel):
    idp_sso_url: str
    saml_request_url: str


class SAMLACSResponse(BaseModel):
    user_id: str
    email: str
    role: str
    access_token: str
    token_type: str = "bearer"


@router.get("/saml/login", response_model=SAMLLoginResponse)
async def initiate_saml_login_route(
    tenant_id: str = Query("default", description="Enterprise tenant identifier"),
):
    """Generates a SAML 2.0 AuthN request URL for IdP redirect."""
    service = EnterpriseSSOService()
    saml_url = service.generate_authn_request_url(tenant_id=tenant_id)
    return SAMLLoginResponse(
        idp_sso_url="https://idp.okta.com/app/sso/saml",
        saml_request_url=saml_url,
    )


@router.post("/saml/acs", response_model=SAMLACSResponse)
async def saml_acs_route(
    SAMLResponse: str = Form(..., description="Base64-encoded SAML Response"),
    db: Any = Depends(get_database),
):
    """Assertion Consumer Service (ACS) endpoint parsing SAML assertion with JIT provisioning."""
    service = EnterpriseSSOService()
    try:
        return await service.process_saml_response(SAMLResponse, db=db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/scim/v2/Users", response_model=Dict[str, Any])
async def scim_list_users_route(
    startIndex: int = Query(1, ge=1),
    count: int = Query(100, ge=1, le=1000),
    tenant_id: str = Query("default"),
    db: Any = Depends(get_database),
):
    """SCIM 2.0 endpoint for listing provisioned enterprise users."""
    service = SCIMService(db)
    return await service.list_users(tenant_id=tenant_id, start_index=startIndex, count=count)


@router.post("/scim/v2/Users", response_model=SCIMUserResponse, status_code=status.HTTP_201_CREATED)
async def scim_create_user_route(
    payload: SCIMUserPayload,
    tenant_id: str = Query("default"),
    db: Any = Depends(get_database),
):
    """SCIM 2.0 endpoint for provisioning an enterprise user."""
    service = SCIMService(db)
    try:
        return await service.create_user(payload, tenant_id=tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/scim/v2/Users/{user_id}", response_model=SCIMUserResponse)
async def scim_get_user_route(
    user_id: str,
    tenant_id: str = Query("default"),
    db: Any = Depends(get_database),
):
    """SCIM 2.0 endpoint for retrieving a user by ID."""
    service = SCIMService(db)
    user = await service.get_user(user_id, tenant_id=tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/scim/v2/Users/{user_id}", response_model=SCIMUserResponse)
async def scim_update_user_route(
    user_id: str,
    payload: SCIMUserPayload,
    tenant_id: str = Query("default"),
    db: Any = Depends(get_database),
):
    """SCIM 2.0 endpoint for updating an enterprise user."""
    service = SCIMService(db)
    user = await service.update_user(user_id, payload, tenant_id=tenant_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
