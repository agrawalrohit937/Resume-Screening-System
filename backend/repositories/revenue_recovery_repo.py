"""
Repository Layer — Revenue Recovery Cases & Attempts
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING, ASCENDING

from models.revenue_recovery_model import (
    RecoveryCaseModel,
    RecoveryStatus,
    RiskLevel,
    RecoveryChannel,
    AuditLogEntry,
    ActorType,
)


class RevenueRecoveryRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.recovery_cases
        self.attempts_col = db.recovery_attempts

    async def get_by_id(self, case_id: str) -> Optional[RecoveryCaseModel]:
        """Fetch by MongoDB _id or string case_id."""
        query = {"case_id": case_id}
        if ObjectId.is_valid(case_id):
            query = {"$or": [{"_id": ObjectId(case_id)}, {"case_id": case_id}]}
        doc = await self.collection.find_one(query)
        if not doc:
            return None
        doc["_id"] = str(doc["_id"])
        return RecoveryCaseModel(**doc)

    async def get_active_case_for_user(self, user_id: str) -> Optional[RecoveryCaseModel]:
        """Find non-terminal recovery case for user."""
        doc = await self.collection.find_one({
            "user_id": str(user_id),
            "status": {"$nin": [RecoveryStatus.RECOVERED.value, RecoveryStatus.STOPPED.value, RecoveryStatus.FAILED.value]}
        }, sort=[("created_at", DESCENDING)])
        if not doc:
            return None
        doc["_id"] = str(doc["_id"])
        return RecoveryCaseModel(**doc)

    async def create_case(self, case_data: Dict[str, Any]) -> RecoveryCaseModel:
        """Insert a new recovery case with unique case_id if not present."""
        if "case_id" not in case_data or not case_data["case_id"]:
            count = await self.collection.count_documents({})
            year = datetime.now(timezone.utc).year
            case_data["case_id"] = f"REC-{year}-{(count + 1):05d}"

        case_data.setdefault("created_at", datetime.now(timezone.utc))
        case_data.setdefault("updated_at", datetime.now(timezone.utc))
        case_data.setdefault("audit_trail", [])

        # Ensure initial audit log
        if not case_data["audit_trail"]:
            entry = {
                "id": str(ObjectId()),
                "timestamp": datetime.now(timezone.utc),
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
            }
            case_data["audit_trail"].append(entry)

        res = await self.collection.insert_one(case_data)
        case_data["_id"] = str(res.inserted_id)
        return RecoveryCaseModel(**case_data)

    async def update_case(self, case_id: str, updates: Dict[str, Any]) -> Optional[RecoveryCaseModel]:
        """Update case fields by ID."""
        updates["updated_at"] = datetime.now(timezone.utc)
        query = {"case_id": case_id}
        if ObjectId.is_valid(case_id):
            query = {"$or": [{"_id": ObjectId(case_id)}, {"case_id": case_id}]}

        res = await self.collection.find_one_and_update(
            query,
            {"$set": updates},
            return_document=True
        )
        if not res:
            return None
        res["_id"] = str(res["_id"])
        return RecoveryCaseModel(**res)

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
        entry = {
            "id": str(ObjectId()),
            "timestamp": datetime.now(timezone.utc),
            "actor": actor.value if hasattr(actor, "value") else str(actor),
            "actor_name": actor_name,
            "action": action,
            "details": details or {},
            "reasoning": reasoning,
        }
        query = {"case_id": case_id}
        if ObjectId.is_valid(case_id):
            query = {"$or": [{"_id": ObjectId(case_id)}, {"case_id": case_id}]}

        res = await self.collection.update_one(
            query,
            {
                "$push": {"audit_trail": entry},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        return res.modified_count > 0

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
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if risk_level:
            query["risk_level"] = risk_level
        if channel:
            query["selected_channel"] = channel
        if plan:
            query["plan"] = plan.lower()
        if human_review is not None:
            query["human_review_required"] = human_review

        if search and search.strip():
            s = search.strip()
            query["$or"] = [
                {"case_id": {"$regex": s, "$options": "i"}},
                {"user_name": {"$regex": s, "$options": "i"}},
                {"user_email": {"$regex": s, "$options": "i"}},
                {"failure_reason": {"$regex": s, "$options": "i"}},
            ]

        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("updated_at", DESCENDING).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)

        models = []
        for d in docs:
            d["_id"] = str(d["_id"])
            models.append(RecoveryCaseModel(**d))

        return models, total

    async def get_overview_analytics(self) -> Dict[str, Any]:
        """Aggregate platform revenue recovery metrics and chart time-series."""
        total_cases = await self.collection.count_documents({})
        
        # Aggregate amounts by status
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "total_amount": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        status_aggs = await self.collection.aggregate(pipeline).to_list(length=100)
        status_map = {item["_id"]: item for item in status_aggs if item.get("_id")}

        recovered_revenue = status_map.get(RecoveryStatus.RECOVERED.value, {}).get("total_amount", 0.0)
        recovered_count = status_map.get(RecoveryStatus.RECOVERED.value, {}).get("count", 0)

        failed_revenue = (
            status_map.get(RecoveryStatus.PAYMENT_FAILED.value, {}).get("total_amount", 0.0)
            + status_map.get(RecoveryStatus.RECOVERY_ACTIVE.value, {}).get("total_amount", 0.0)
            + status_map.get(RecoveryStatus.CONTACTED.value, {}).get("total_amount", 0.0)
            + status_map.get(RecoveryStatus.RETRY_SCHEDULED.value, {}).get("total_amount", 0.0)
            + status_map.get(RecoveryStatus.ESCALATED.value, {}).get("total_amount", 0.0)
            + status_map.get(RecoveryStatus.FAILED.value, {}).get("total_amount", 0.0)
        )
        at_risk_revenue = status_map.get(RecoveryStatus.AT_RISK.value, {}).get("total_amount", 0.0)

        active_recoveries = (
            status_map.get(RecoveryStatus.RECOVERY_ACTIVE.value, {}).get("count", 0)
            + status_map.get(RecoveryStatus.CONTACTED.value, {}).get("count", 0)
            + status_map.get(RecoveryStatus.RETRY_SCHEDULED.value, {}).get("count", 0)
        )
        human_escalations = await self.collection.count_documents({"human_review_required": True})

        total_targeted = recovered_revenue + failed_revenue
        recovery_rate = round((recovered_revenue / total_targeted * 100), 1) if total_targeted > 0 else 0.0

        # Channel breakdown
        channel_pipe = [
            {
                "$match": {
                    "selected_channel": {"$in": [RecoveryChannel.EMAIL.value, RecoveryChannel.IN_APP.value, RecoveryChannel.VOICE.value]}
                }
            },
            {
                "$group": {
                    "_id": "$selected_channel",
                    "count": {"$sum": 1},
                    "recovered_amount": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", RecoveryStatus.RECOVERED.value]}, "$amount", 0]
                        }
                    },
                    "total_amount": {"$sum": "$amount"}
                }
            }
        ]
        channel_aggs = await self.collection.aggregate(channel_pipe).to_list(length=10)
        channel_data = []
        for c in channel_aggs:
            channel_data.append({
                "channel": c["_id"],
                "count": c["count"],
                "recovered_amount": c["recovered_amount"],
                "total_amount": c["total_amount"],
                "rate": round((c["recovered_amount"] / c["total_amount"] * 100), 1) if c["total_amount"] > 0 else 0
            })

        # Risk distribution
        risk_pipe = [
            {"$group": {"_id": "$risk_level", "count": {"$sum": 1}, "amount": {"$sum": "$amount"}}}
        ]
        risk_aggs = await self.collection.aggregate(risk_pipe).to_list(length=10)
        risk_distribution = {item["_id"]: item["count"] for item in risk_aggs if item.get("_id")}

        # Funnel stage counts
        funnel = {
            "failed_payments": await self.collection.count_documents({"status": {"$ne": RecoveryStatus.AT_RISK.value}}),
            "contacted": await self.collection.count_documents({"status": {"$in": [
                RecoveryStatus.CONTACTED.value, RecoveryStatus.RETRY_SCHEDULED.value,
                RecoveryStatus.RECOVERED.value, RecoveryStatus.ESCALATED.value, RecoveryStatus.STOPPED.value
            ]}}),
            "retried": await self.collection.count_documents({"attempt_count": {"$gte": 1}}),
            "recovered": recovered_count,
        }

        # Time series data (last 7 days)
        now = datetime.now(timezone.utc)
        time_series = []
        for i in range(6, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            day_label = day_start.strftime("%b %d")

            rec_day_pipe = [
                {
                    "$match": {
                        "status": RecoveryStatus.RECOVERED.value,
                        "updated_at": {"$gte": day_start, "$lt": day_end}
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            rec_day_res = await self.collection.aggregate(rec_day_pipe).to_list(length=1)
            day_recovered = rec_day_res[0]["total"] if rec_day_res else 0.0

            fail_day_pipe = [
                {
                    "$match": {
                        "created_at": {"$gte": day_start, "$lt": day_end}
                    }
                },
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            fail_day_res = await self.collection.aggregate(fail_day_pipe).to_list(length=1)
            day_failed = fail_day_res[0]["total"] if fail_day_res else 0.0

            time_series.append({
                "date": day_label,
                "recovered": day_recovered,
                "at_risk": day_failed,
            })

        return {
            "kpis": {
                "at_risk_revenue": at_risk_revenue,
                "failed_revenue": failed_revenue,
                "recovered_revenue": recovered_revenue,
                "recovery_rate": recovery_rate,
                "active_recoveries": active_recoveries,
                "human_escalations": human_escalations,
                "total_cases": total_cases,
            },
            "channel_performance": channel_data,
            "risk_distribution": risk_distribution,
            "funnel": funnel,
            "time_series": time_series,
        }
