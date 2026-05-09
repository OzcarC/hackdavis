from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


@asynccontextmanager
async def database_lifespan(app: Any) -> AsyncIterator[None]:
    global client, database

    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    database = client[settings.mongodb_db_name]

    await database.command("ping")
    await database.events.create_index("link", unique=True, sparse=True)

    try:
        yield
    finally:
        client.close()
        client = None
        database = None


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("Database is not connected.")

    return database
