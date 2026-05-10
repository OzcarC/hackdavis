# scripts/event_breakdown.py
import asyncio, certifi
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings


async def main() -> None:
    s = get_settings()
    db = AsyncIOMotorClient(s.mongodb_uri, tlsCAFile=certifi.where())[s.mongodb_db_name]

    print("By source:")
    async for d in db.events.aggregate([
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]):
        print(f"  {d['_id']!r}: {d['count']}")

    print("\nSeeded vs not:")
    seeded = await db.events.count_documents({"seeded": True})
    not_seeded = await db.events.count_documents({"seeded": {"$ne": True}})
    print(f"  seeded: {seeded}, not: {not_seeded}")


if __name__ == "__main__":
    asyncio.run(main())