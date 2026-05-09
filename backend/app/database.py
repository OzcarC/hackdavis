from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import OperationFailure

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

    try:
        await database.events.drop_index("link_1")
    except OperationFailure:
        pass

    try:
        await database.events.drop_index("location_2dsphere")
    except OperationFailure:
        pass

    await database.events.create_index(
        "link",
        unique=True,
        partialFilterExpression={"link": {"$type": "string"}},
    )
    await database.events.create_index(
        [("location", "2dsphere")],
        name="location_2dsphere",
        partialFilterExpression={"source": "custom", "location": {"$exists": True}},
    )
    await database.user_profiles.create_index("uid", unique=True)

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
