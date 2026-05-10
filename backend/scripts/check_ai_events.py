import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings


async def main() -> None:
    s = get_settings()
    db = AsyncIOMotorClient(s.mongodb_uri, tlsCAFile=certifi.where())[s.mongodb_db_name]

    total = await db.events.count_documents({})
    ai_true = await db.events.count_documents({"ai_generated": True})
    has_venue = await db.events.count_documents({"venue_id": {"$exists": True}})

    print(f"Total events: {total}")
    print(f"With ai_generated=True: {ai_true}")
    print(f"With venue_id field: {has_venue}")

    print("\nMost recent 5 events:")
    async for e in db.events.find({}).sort("_id", -1).limit(5):
        print(f"  - {e.get('title')!r} | ai={e.get('ai_generated')} | venue_id={e.get('venue_id')}")


if __name__ == "__main__":
    asyncio.run(main())