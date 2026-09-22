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
import structlog

logger = structlog.get_logger(__name__)


INDEX_NAME = "jd_vector_index"
COLLECTION_NAME = "jobs"

VECTOR_INDEX_SPEC: Dict[str, Any] = {
    "fields": [
        {
            "type": "vector",
            "path": "jd_embedding_bge",
            "numDimensions": 1024,
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
        logger.info("DRY RUN Atlas Search Index Definition", payload=payload)
        return 0

    uri = mongodb_url or os.getenv("MONGODB_URL") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
    db_name = database_name or os.getenv("DATABASE_NAME", "careerpilot")

    logger.info("Connecting to MongoDB for vector migration", host=uri.split("@")[-1], db=db_name)
    client: MongoClient = MongoClient(uri, serverSelectionTimeoutMS=5000)

    try:
        db = client[db_name]
        collection = db[COLLECTION_NAME]

        # 1. Check existing search indexes (PyMongo 4.5+)
        logger.info("Checking existing search indexes", collection=COLLECTION_NAME)
        try:
            existing_indexes = list(collection.list_search_indexes())
            for idx in existing_indexes:
                if idx.get("name") == INDEX_NAME:
                    logger.info("Vector search index already exists", index_name=INDEX_NAME, status=idx.get("status", "ACTIVE"))
                    return 0
        except OperationFailure as of:
            err_msg = str(of).lower()
            if "unrecognized command" in err_msg or "not supported" in err_msg or "atlas search" in err_msg:
                logger.warning("Atlas Search commands not supported on this MongoDB server", error=str(of))
                return 0
            raise

        # 2. Create the index
        logger.info("Creating vector search index", index_name=INDEX_NAME, collection=COLLECTION_NAME)
        search_model = SearchIndexModel(
            definition=VECTOR_INDEX_SPEC,
            name=INDEX_NAME,
            type="vectorSearch",
        )
        result_name = collection.create_search_index(model=search_model)
        logger.info("Vector search index created successfully", result_name=result_name)
        return 0

    except OperationFailure as of:
        logger.error("MongoDB Operation Failure during vector index migration", error=str(of))
        return 1
    except PyMongoError as pe:
        logger.error("PyMongo Error during vector index migration", error=str(pe))
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
