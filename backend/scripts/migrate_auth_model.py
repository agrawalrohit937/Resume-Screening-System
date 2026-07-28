"""
Migration script: Upgrade users from single auth_method to multi-provider auth model.

This script:
1. Iterates all users in the MongoDB users collection.
2. For users with auth_method set but no auth_methods array:
   - Sets auth_methods = [auth_method]
   - Sets last_login_method = auth_method
   - Builds linked_accounts.<auth_method> entry from available fields
   - Preserves google_picture in linked_accounts.google.picture
   - Preserves all existing data (DEPRECATED fields like auth_method, provider, google_picture)
3. For users that already have auth_methods, skips them (idempotent).
4. Uses bulk operations for performance.

Can be run multiple times — completely idempotent.
"""

import asyncio
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Add backend dir to path so imports work
sys.path.insert(0, ".")

import structlog
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne

from core.config import settings
from core.logging import setup_logging

logger = structlog.get_logger(__name__)


def build_linked_account(
    auth_method: str,
    user_doc: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Build a linked_accounts.<provider> entry from the existing user document fields."""
    now = datetime.now(timezone.utc)

    entry: Dict[str, Any] = {
        "linked_at": now,
        "last_login": now,
    }

    if auth_method == "google":
        google_picture = user_doc.get("google_picture")
        if google_picture:
            entry["picture"] = google_picture
        # Google sub is not stored separately in the old schema, so we leave provider_id blank

    elif auth_method == "github":
        github_username = user_doc.get("github_username")
        if github_username:
            entry["username"] = github_username
            entry["provider_id"] = github_username  # best guess from old data

    elif auth_method == "linkedin":
        linkedin_url = user_doc.get("linkedin_url")
        if linkedin_url:
            entry["url"] = linkedin_url

    elif auth_method == "password":
        pass  # password accounts have no provider-specific metadata from the old schema

    return entry


def needs_migration(user_doc: Dict[str, Any]) -> bool:
    """Check if a user document needs the auth model migration."""
    # Skip if already migrated (has auth_methods array)
    if user_doc.get("auth_methods"):
        return False
    # Must have auth_method to migrate
    if not user_doc.get("auth_method"):
        return False
    return True


def build_migration_update(user_doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Build the update operations for a single user document migration."""
    if not needs_migration(user_doc):
        return None

    auth_method = user_doc["auth_method"]
    now = datetime.now(timezone.utc)

    linked_accounts = user_doc.get("linked_accounts") or {}
    linked_account_entry = build_linked_account(auth_method, user_doc)

    if linked_account_entry:
        linked_accounts[auth_method] = linked_account_entry

    update: Dict[str, Any] = {
        "$set": {
            "auth_methods": [auth_method],
            "last_login_method": auth_method,
            "linked_accounts": linked_accounts,
            "updated_at": now,
        }
    }

    return update


async def migrate_all_users(mongo_uri: str, db_name: str, dry_run: bool = True):
    """Run the migration for all users.

    Args:
        mongo_uri: MongoDB connection string.
        db_name: Database name.
        dry_run: If True, only log what would be changed without writing.
    """
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    collection = db.users

    total = await collection.count_documents({})
    logger.info("Starting auth model migration", total_users=total, dry_run=dry_run)

    cursor = collection.find(
        {"$and": [
            {"auth_method": {"$exists": True, "$ne": None}},
            {"auth_methods": {"$exists": False}},
        ]}
    )

    operations = []
    migrated_count = 0
    skipped_count = 0

    async for user_doc in cursor:
        user_id = str(user_doc["_id"])
        email = user_doc.get("email", "unknown")

        update = build_migration_update(user_doc)
        if update is None:
            skipped_count += 1
            continue

        if dry_run:
            logger.info(
                "Would migrate user",
                user_id=user_id,
                email=email,
                auth_method=user_doc.get("auth_method"),
                update=update,
            )
        else:
            operations.append(
                UpdateOne({"_id": user_doc["_id"]}, update)
            )

        migrated_count += 1

        # Flush in batches of 500 to avoid oversized bulk writes
        if len(operations) >= 500:
            if not dry_run:
                result = await collection.bulk_write(operations)
                logger.info(
                    "Batch write complete",
                    matched=result.matched_count,
                    modified=result.modified_count,
                )
            operations = []

    # Flush remaining
    if operations:
        if not dry_run:
            result = await collection.bulk_write(operations)
            logger.info(
                "Final batch write complete",
                matched=result.matched_count,
                modified=result.modified_count,
            )

    logger.info(
        "Migration complete",
        total=total,
        migrated=migrated_count,
        skipped=skipped_count,
        dry_run=dry_run,
    )

    if dry_run:
        print("\n" + "=" * 60)
        print(f"DRY RUN: {migrated_count} users would be migrated.")
        print(f"Run with --apply flag to execute the migration.")
        print("=" * 60)

    client.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate users from single auth_method to multi-provider auth model."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually apply the migration (default is dry-run).",
    )
    parser.add_argument(
        "--mongo-uri",
        type=str,
        default=settings.MONGO_URI,
        help="MongoDB URI (defaults to settings.MONGO_URI).",
    )
    parser.add_argument(
        "--db-name",
        type=str,
        default=settings.MONGO_DB_NAME,
        help="Database name (defaults to settings.MONGO_DB_NAME).",
    )

    args = parser.parse_args()

    setup_logging()

    asyncio.run(
        migrate_all_users(
            mongo_uri=args.mongo_uri,
            db_name=args.db_name,
            dry_run=not args.apply,
        )
    )

