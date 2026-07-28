"""
Repository for the AI Apply Assistant module.

Mirrors resume_repo.py's method naming and shape 1:1 (create, get_by_id,
list_by_user, update, delete) so this doesn't introduce a second data-access
convention into the codebase.

ASSUMPTION FLAG: the import below assumes a shared get_database() in
backend/config/db.py, per the README. If your actual helper has a
different name/path, this is the one line to fix.
"""

from datetime import datetime, timezone
from typing import Optional, Tuple, List
from bson import ObjectId

from config.db import get_database
from models.application_model import (
    APPLICATION_COLLECTION,
    ApplicationStatus,
    new_application_document,
    is_valid_transition,
)


class ApplicationRepository:
    def __init__(self, db=None):
        self._db = db

    @property
    def db(self):
        if self._db is not None:
            return self._db
        return get_database()

    @property
    def collection(self):
        return self.db[APPLICATION_COLLECTION]

    async def create(
        self,
        *,
        user_id: str,
        resume_id: str,
        company_name: str,
        job_title: str,
        hr_email: str,
        job_description: str,
    ) -> dict:
        doc = new_application_document(
            user_id=user_id,
            resume_id=resume_id,
            company_name=company_name,
            job_title=job_title,
            hr_email=hr_email,
            job_description=job_description,
        )
        result = await self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def get_by_id(self, application_id: str, user_id: str) -> Optional[dict]:
        return await self.collection.find_one({
            "_id": ObjectId(application_id),
            "user_id": ObjectId(user_id),
        })

    async def list_by_user(self, user_id: str, page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        query = {"user_id": ObjectId(user_id)}
        total = await self.collection.count_documents(query)
        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = await cursor.to_list(length=page_size)
        return items, total

    async def save_generated_draft(
        self,
        application_id: str,
        *,
        jd_analysis: dict,
        ats_result_ref: dict,
        generated_draft: dict,
        needs_manual_review: bool,
    ) -> Optional[dict]:
        """Called once by the service after the LangGraph run completes."""
        update = {
            "jd_analysis": jd_analysis,
            "ats_result_ref": ats_result_ref,
            "generated_draft": generated_draft,
            "needs_manual_review": needs_manual_review,
            "status": ApplicationStatus.READY_FOR_REVIEW.value,
            "updated_at": datetime.now(timezone.utc),
        }
        await self.collection.update_one({"_id": ObjectId(application_id)}, {"$set": update})
        return await self.collection.find_one({"_id": ObjectId(application_id)})

    async def save_edited_draft(self, application_id: str, user_id: str, edits: dict) -> Optional[dict]:
        edits = {k: v for k, v in edits.items() if v is not None}
        if not edits:
            return await self.get_by_id(application_id, user_id)

        update = {
            "edited_draft": {**edits, "edited_at": datetime.now(timezone.utc)},
            "updated_at": datetime.now(timezone.utc),
        }
        await self.collection.update_one(
            {"_id": ObjectId(application_id), "user_id": ObjectId(user_id)},
            {"$set": update},
        )
        return await self.get_by_id(application_id, user_id)

    async def update_status(
        self,
        application_id: str,
        current_status: str,
        target_status: str,
        **extra_fields,
    ) -> bool:
        """
        Enforces the status state machine from application_model.py.
        Returns False (writes nothing) if the transition is invalid - the
        service layer should turn that into a 409, never proceed anyway.
        """
        if not is_valid_transition(current_status, target_status):
            return False

        update = {"status": target_status, "updated_at": datetime.now(timezone.utc), **extra_fields}
        result = await self.collection.update_one(
            {"_id": ObjectId(application_id), "status": current_status},
            {"$set": update},
        )
        return result.modified_count == 1

    async def delete(self, application_id: str, user_id: str) -> bool:
        result = await self.collection.delete_one({
            "_id": ObjectId(application_id),
            "user_id": ObjectId(user_id),
        })
        return result.deleted_count == 1
