import sys
sys.path.insert(0, '.')
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings

async def cleanup_executive_roles():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.MONGO_DB_NAME]
    users_coll = db["users"]

    users = await users_coll.find({}, {"email": 1, "role": 1, "roles": 1, "tenant_id": 1}).to_list(100)
    print(f"Total users found: {len(users)}")
    updated_count = 0
    for user in users:
        roles = user.get("roles") or [user.get("role")]
        roles_set = [str(r).lower() for r in roles]
        print(f"User: {user.get('email')} -> role: {user.get('role')}, roles: {user.get('roles')}")
        if "executive" in roles_set or "exec" in roles_set or "employer" in roles_set:
            if user.get("roles") != ["executive"] or user.get("role") != "executive":
                await users_coll.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"roles": ["executive"], "role": "executive"}}
                )
                print(f"  -> Cleaned user {user.get('email')} to roles: ['executive']")
                updated_count += 1

    print(f"Cleanup complete. Updated {updated_count} executive users.")
    client.close()

if __name__ == "__main__":
    asyncio.run(cleanup_executive_roles())
