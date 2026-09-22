"""
FastAPI Multi-Tenant Enforcement Middleware for CareerPilot ATS.

Phase 5:
Extracts tenant_id and roles from JWT access tokens (header or cookie),
enforces cross-tenant boundary locks, binds tenant context to async execution context,
and provides root PLATFORM_ADMIN exemption.
"""

from __future__ import annotations

from typing import Optional
import structlog
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from core.security import decode_token, verify_token_type
from services.multi_tenancy.tenant_context import (
    clear_tenant_id,
    get_current_tenant_id,
    is_platform_admin,
    set_current_tenant_id,
    set_platform_admin,
)

logger = structlog.get_logger(__name__)


class TenantMiddleware(BaseHTTPMiddleware):
    """
    HTTP Middleware that strictly enforces B2B multi-tenant data isolation.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        token: Optional[str] = None

        # 1. Extract Bearer token from header
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

        # 2. Fallback to access_token cookie
        if not token:
            token = request.cookies.get("access_token")

        active_tenant = "default"
        is_root_admin = False

        path = request.url.path
        PUBLIC_ALLOWLIST = (
            "/api/v1/auth/",
            "/auth/",
            "/health",
            "/api/v1/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico",
            "/api/v1/careers/",
            "/careers/",
            "/api/v1/certificates/verify/",
            "/api/v1/public/",
            "/public/",
        )
        is_auth_or_public_route = any(path == p or path.startswith(p) for p in PUBLIC_ALLOWLIST)

        if token:
            try:
                payload = decode_token(token)
                if payload and verify_token_type(payload, "access"):
                    raw_roles = payload.get("roles") or []
                    if isinstance(raw_roles, list):
                        role_names = [r.lower() for r in raw_roles]
                    else:
                        role_names = [str(raw_roles).lower()]
                    
                    single_role = str(payload.get("role", "")).lower()
                    if single_role and single_role not in role_names:
                        role_names.append(single_role)

                    if "platform_admin" in role_names or "admin" in role_names:
                        is_root_admin = True

                    token_tenant = (payload.get("tenant_id") or "default").strip()

                    # Handle optional X-Tenant-ID header
                    header_tenant = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID")
                    if header_tenant:
                        header_tenant = header_tenant.strip()
                        # Platform admin can explicitly switch tenant context via header
                        if is_root_admin:
                            active_tenant = header_tenant
                        # Strict check: any mismatch between header and token tenant is forbidden
                        elif header_tenant != token_tenant:
                            logger.warning(
                                "security_violation_tenant_spoofing",
                                requested_tenant=header_tenant,
                                token_tenant=token_tenant,
                                path=path,
                                client_ip=getattr(request.client, "host", "unknown"),
                            )
                            return JSONResponse(
                                status_code=403,
                                content={
                                    "detail": f"Tenant header spoofing forbidden: requested '{header_tenant}' does not match token '{token_tenant}'."
                                },
                            )
                        else:
                            active_tenant = token_tenant
                    else:
                        active_tenant = token_tenant
            except Exception as e:
                logger.debug("Tenant extraction from token skipped", error=str(e))
        else:
            header_tenant = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID")
            if is_auth_or_public_route:
                active_tenant = header_tenant.strip() if (header_tenant and path.startswith("/api/v1/careers/")) else "default"
            else:
                # Unauthenticated requests to non-public routes cannot claim tenants via header
                active_tenant = "default"

        set_current_tenant_id(active_tenant)
        set_platform_admin(is_root_admin)

        request.state.tenant_id = active_tenant
        request.state.is_platform_admin = is_root_admin

        try:
            response = await call_next(request)
            response.headers["X-Tenant-ID"] = active_tenant
            return response
        finally:
            clear_tenant_id()
