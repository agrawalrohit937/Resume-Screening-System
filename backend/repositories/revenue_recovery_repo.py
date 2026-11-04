"""
Repository Layer — Revenue Recovery Cases & Attempts
Dual Engine (PostgreSQL via SQLAlchemy 2.0 / PostgreSQL Primary)
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
import structlog
DESCENDING = -1
from sqlalchemy import select, update, func, or_, desc

from core.config import settings
from config.db import get_pg_session_factory
from models import RevenueRecoveryCase, gen_uuid_str
from models.revenue_recovery_model import (
    RecoveryCaseModel,
    RecoveryStatus,
    RecoveryChannel,
    ActorType,
)

logger = structlog.get_logger(__name__)


def _case_to_model(row: RevenueRecoveryCase) -> RecoveryCaseModel:
    return RecoveryCaseModel(
        _id=row.id,
        id=row.id,
        case_id=row.case_id,
        user_id=row.user_id,
        user_email=row.user_email or "",
        user_name=row.user_name or "User",
        plan=row.plan or "pro",
        amount=row.amount_due_inr or 0.0,
        status=row.status or RecoveryStatus.INITIATED.value,
        strategy=row.strategy or "gentle",
        current_step=row.current_step or 0,
        attempts=row.attempts or [],
        audit_trail=row.audit_trail or [],
        created_at=row.created_at,
        updated_at=row.updated_at,
        recovered_at=row.recovered_at,
        stopped_at=row.stopped_at,
    )


class RevenueRecoveryRepository:
    def __init__(self, db: Optional[Any] = None, session_factory: Optional[Any] = None):
        self.session_factory = session_factory or get_pg_session_factory()
    async def get_by_id(self, case_id: str) -> Optional[RecoveryCaseModel]:
        """Fetch by string id or case_id."""
        if not case_id:
            return None

        async with self.session_factory() as session:
            stmt = select(RevenueRecoveryCase).where(
                or_(RevenueRecoveryCase.id == str(case_id), RevenueRecoveryCase.case_id == str(case_id))
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _case_to_model(row)
            return None

    async def get_active_case_for_user(self, user_id: str) -> Optional[RecoveryCaseModel]:
        """Find non-terminal recovery case for user."""
        if not user_id:
            return None

        terminal = [RecoveryStatus.RECOVERED.value, RecoveryStatus.STOPPED.value, RecoveryStatus.FAILED.value]
        async with self.session_factory() as session:
            stmt = (
                select(RevenueRecoveryCase)
                .where(
                    RevenueRecoveryCase.user_id == str(user_id),
                    RevenueRecoveryCase.status.notin_(terminal),
                )
                .order_by(desc(RevenueRecoveryCase.created_at))
                .limit(1)
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if row:
                return _case_to_model(row)
            return None

    async def create_case(self, case_data: Dict[str, Any]) -> RecoveryCaseModel:
        """Insert a new recovery case with unique case_id if not present."""
        now = datetime.now(timezone.utc)
        year = now.year

        async with self.session_factory() as session:
            if "case_id" not in case_data or not case_data["case_id"]:
                cnt_res = await session.execute(select(func.count()).select_from(RevenueRecoveryCase))
                cnt = cnt_res.scalar() or 0
                case_data["case_id"] = f"REC-{year}-{(cnt + 1):05d}"

            c_id = str(case_data.get("_id") or gen_uuid_str())
            audit = list(case_data.get("audit_trail") or [])
            if not audit:
                audit.append({
                    "id": gen_uuid_str(),
                    "timestamp": now.isoformat(),
                    "actor": ActorType.AI_AGENT.value,
                    "actor_name": "AI Revenue Engine",
                    "action": "CASE_INITIALIZED",
                    "details": {
                        "risk_score": case_data.get("risk_score", 0),
                        "status": case_data.get("status", RecoveryStatus.AT_RISK.value),
                        "plan": case_data.get("plan", "pro"),
                        "amount": case_data.get("amount", 299),
                    },
                    "reasoning": case_data.get("explanation") or "Case initialized by system."
                })

            row = RevenueRecoveryCase(
                id=c_id,
                case_id=case_data["case_id"],
                user_id=str(case_data.get("user_id") or ""),
                user_email=case_data.get("user_email"),
                user_name=case_data.get("user_name"),
                plan=str(case_data.get("plan") or "pro"),
                amount_due_inr=float(case_data.get("amount") or case_data.get("amount_due_inr") or 0.0),
                status=str(case_data.get("status") or RecoveryStatus.INITIATED.value),
                strategy=str(case_data.get("strategy") or "gentle"),
                current_step=int(case_data.get("current_step") or 0),
                attempts=case_data.get("attempts") or [],
                audit_trail=audit,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _case_to_model(row)

    async def update_case(self, case_id: str, updates: Dict[str, Any]) -> Optional[RecoveryCaseModel]:
        """Update case fields by ID."""
        now = datetime.now(timezone.utc)
        clean = dict(updates)
        clean["updated_at"] = now

        async with self.session_factory() as session:
            valid_cols = {c.name for c in RevenueRecoveryCase.__table__.columns}
            filtered = {k: v for k, v in clean.items() if k in valid_cols}
            if "amount" in clean and "amount_due_inr" not in filtered:
                filtered["amount_due_inr"] = float(clean["amount"])

            stmt = (
                update(RevenueRecoveryCase)
                .where(or_(RevenueRecoveryCase.id == str(case_id), RevenueRecoveryCase.case_id == str(case_id)))
                .values(**filtered)
                .returning(RevenueRecoveryCase)
            )
            res = await session.execute(stmt)
            await session.commit()
            row = res.scalar_one_or_none()
            if row:
                return _case_to_model(row)
            return None

    async def add_audit_log(
        self,
        case_id: str,
        action: str,
        actor: ActorType = ActorType.AI_AGENT,
        actor_name: str = "AI Agent",
        details: Optional[Dict[str, Any]] = None,
        reasoning: Optional[str] = None,
    ) -> bool:
        """Append an audit log entry."""
        now = datetime.now(timezone.utc)
        entry = {
            "id": gen_uuid_str(),
            "timestamp": now.isoformat(),
            "actor": actor.value if hasattr(actor, "value") else str(actor),
            "actor_name": actor_name,
            "action": action,
            "details": details or {},
            "reasoning": reasoning,
        }

        async with self.session_factory() as session:
            stmt = select(RevenueRecoveryCase).where(
                or_(RevenueRecoveryCase.id == str(case_id), RevenueRecoveryCase.case_id == str(case_id))
            )
            res = await session.execute(stmt)
            row = res.scalar_one_or_none()
            if not row:
                return False
            trail = list(row.audit_trail or [])
            trail.append(entry)
            row.audit_trail = trail
            row.updated_at = now
            await session.commit()
            return True

    async def list_cases(
        self,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        channel: Optional[str] = None,
        plan: Optional[str] = None,
        search: Optional[str] = None,
        human_review: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[RecoveryCaseModel], int]:
        """Filterable, searchable and paginated recovery cases."""
        async with self.session_factory() as session:
            filters = []
            if status:
                filters.append(RevenueRecoveryCase.status == status)
            if plan:
                filters.append(func.lower(RevenueRecoveryCase.plan) == plan.lower())
            if search and search.strip():
                term = f"%{search.strip().lower()}%"
                filters.append(
                    or_(
                        func.lower(RevenueRecoveryCase.case_id).like(term),
                        func.lower(RevenueRecoveryCase.user_name).like(term),
                        func.lower(RevenueRecoveryCase.user_email).like(term),
                    )
                )

            cnt_res = await session.execute(select(func.count()).select_from(RevenueRecoveryCase).where(*filters))
            total = cnt_res.scalar() or 0

            stmt = (
                select(RevenueRecoveryCase)
                .where(*filters)
                .order_by(desc(RevenueRecoveryCase.updated_at))
                .offset(skip)
                .limit(limit)
            )
            res = await session.execute(stmt)
            rows = res.scalars().all()
            return [_case_to_model(r) for r in rows], total
