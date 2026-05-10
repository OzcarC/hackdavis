import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings


async def main() -> None:
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client[settings.mongodb_db_name]

    missing_count = await db.user_profiles.count_documents(
        {"account_type": {"$exists": False}}
    )
    print(f"Found {missing_count} profiles without account_type")

    if missing_count == 0:
        print("Nothing to do.")
        return

    result = await db.user_profiles.update_many(
        {"account_type": {"$exists": False}},
        {"$set": {"account_type": "user"}},
    )
    print(f"Updated {result.modified_count} profiles to account_type='user'")


if __name__ == "__main__":
    asyncio.run(main())