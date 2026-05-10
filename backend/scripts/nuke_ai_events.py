"""Delete all AI-generated events. Use before a clean regenerate."""

import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings


async def main() -> None:
    s = get_settings()
    client = AsyncIOMotorClient(s.mongodb_uri, tlsCAFile=certifi.where())
    db = client[s.mongodb_db_name]

    result = await db.events.delete_many({"ai_generated": True})
    print(f"Deleted {result.deleted_count} AI events")


if __name__ == "__main__":
    asyncio.run(main())