import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings


async def main() -> None:
    s = get_settings()
    db = AsyncIOMotorClient(s.mongodb_uri, tlsCAFile=certifi.where())[s.mongodb_db_name]

    total = await db.events.count_documents({"seeded": True})
    embedded = await db.events.count_documents({"seeded": True, "embedding": {"$exists": True}})
    sample = await db.events.find_one({"seeded": True, "embedding": {"$exists": True}})

    print(f"Total seeded events: {total}")
    print(f"Events with embedding: {embedded}")
    if sample:
        print(f"Sample embedding length: {len(sample['embedding'])}")
        print(f"Sample title: {sample.get('title')}")


if __name__ == "__main__":
    asyncio.run(main())