"""Run the AI weekly generator manually.

    python -m scripts.run_generator
"""

import asyncio
import json

import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from app.ai.generator import weekly_run
from app.config import get_settings


async def main() -> None:
    s = get_settings()
    client = AsyncIOMotorClient(s.mongodb_uri, tlsCAFile=certifi.where())
    db = client[s.mongodb_db_name]

    summary = await weekly_run(db)

    print("\n=== summary ===")
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())