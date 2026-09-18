#!/usr/bin/env python3
"""
Atlas Vector Search Index Migration Script.
Idempotently creates or validates vector search indexes on MongoDB Atlas.

Target:
- Collection: 'jobs'
- Index Name: 'jd_vector_index'
- Vector Field: 'jd_embedding_bge' (768 dimensions, cosine similarity)
- Filter Fields: 'status', 'work_mode', 'country', 'city_normalized', 'min_years', 'occupation_family'

Usage:
    # Dry run (prints index JSON without touching DB)
    python backend/migrations/001_create_vector_indexes.py --dry-run

    # Execute against configured MongoDB Atlas instance
    python backend/migrations/001_create_vector_indexes.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict

from pymongo import MongoClient
from pymongo.errors import OperationFailure, PyMongoError
from pymongo.operations import SearchIndexModel


INDEX_NAME = "jd_vector_index"
COLLECTION_NAME = "jobs"

VECTOR_INDEX_SPEC: Dict[str, Any] = {
    "fields": [
        {
            "type": "vector",
            "path": "jd_embedding_bge",
            "numDimensions": 768,
            "similarity": "cosine",
        },
        {
            "type": "filter",
            "path": "status",
        },
        {
            "type": "filter",
            "path": "work_mode",
        },
        {
            "type": "filter",
            "path": "country",
        },
        {
            "type": "filter",
            "path": "city_normalized",
        },
        {
            "type": "filter",
            "path": "min_years",
        },
        {
            "type": "filter",
            "path": "occupation_family",
        },
    ]
}


def get_full_index_payload() -> Dict[str, Any]:
    return {
        "collection": COLLECTION_NAME,
        "name": INDEX_NAME,
        "type": "vectorSearch",
        "definition": VECTOR_INDEX_SPEC,
    }


def run_migration(dry_run: bool = False, mongodb_url: str | None = None, database_name: str | None = None) -> int:
    payload = get_full_index_payload()

    if dry_run:
        print("[DRY RUN] Atlas Search Index Definition:")
        print(json.dumps(payload, indent=2))
        print("\n[DRY RUN] No database operations were performed.")
        return 0

    uri = mongodb_url or os.getenv("MONGODB_URL") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
    db_name = database_name or os.getenv("DATABASE_NAME", "careerpilot")

    print(f"Connecting to MongoDB at {uri.split('@')[-1]} (db: {db_name})...")
    client: MongoClient = MongoClient(uri, serverSelectionTimeoutMS=5000)

    try:
        db = client[db_name]
        collection = db[COLLECTION_NAME]

        # 1. Check existing search indexes (PyMongo 4.5+)
        print(f"Checking existing search indexes on '{COLLECTION_NAME}'...")
        try:
            existing_indexes = list(collection.list_search_indexes())
            for idx in existing_indexes:
                if idx.get("name") == INDEX_NAME:
                    print(f"[OK] Vector search index '{INDEX_NAME}' already exists. Status: {idx.get('status', 'ACTIVE')}")
                    return 0
        except OperationFailure as of:
            err_msg = str(of).lower()
            if "unrecognized command" in err_msg or "not supported" in err_msg or "atlas search" in err_msg:
                print(f"[WARN] Atlas Search commands not supported on this MongoDB server ({of}).")
                print("      Note: Atlas Search indexes require a MongoDB Atlas cluster (M10+ or Atlas Free Tier).")
                print("      Vector search index definition for Atlas UI:")
                print(json.dumps(payload["definition"], indent=2))
                return 0
            raise

        # 2. Create the index
        print(f"Creating vector search index '{INDEX_NAME}' on '{COLLECTION_NAME}'...")
        search_model = SearchIndexModel(
            definition=VECTOR_INDEX_SPEC,
            name=INDEX_NAME,
            type="vectorSearch",
        )
        result_name = collection.create_search_index(model=search_model)
        print(f"[SUCCESS] Vector search index created with name: {result_name}")
        print("Note: Atlas Search indexes build asynchronously in the background. It may take 1-2 minutes to become QUERYABLE.")
        return 0

    except OperationFailure as of:
        print(f"[ERROR] MongoDB Operation Failure: {of}")
        return 1
    except PyMongoError as pe:
        print(f"[ERROR] PyMongo Error: {pe}")
        return 1
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create Atlas Vector Search Indexes for CareerPilot")
    parser.add_argument("--dry-run", action="store_true", help="Print index definitions as JSON without modifying database")
    parser.add_argument("--url", default=None, help="MongoDB connection URI (overrides MONGODB_URL env)")
    parser.add_argument("--db", default=None, help="Database name (overrides DATABASE_NAME env)")
    args = parser.parse_args()

    sys.exit(run_migration(dry_run=args.dry_run, mongodb_url=args.url, database_name=args.db))


if __name__ == "__main__":
    main()
