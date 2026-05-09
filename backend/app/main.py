from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import ValidationError
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config import Settings, get_settings
from app.database import database_lifespan, get_database
from app.models import EventIn, EventOut, serialize_event

app = FastAPI(title="HackDavis API", lifespan=database_lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health(db: AsyncIOMotorDatabase = Depends(get_database)) -> dict[str, str]:
    await db.command("ping")
    return {"status": "ok", "database": "connected"}


@app.get("/api/events", response_model=list[EventOut])
async def list_events(
    limit: int = Query(default=50, ge=1, le=100),
    query: str | None = None,
    location: str | None = None,
    date: str = "date:week",
    refresh: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_database),
    app_settings: Settings = Depends(get_settings),
) -> list[EventOut]:
    should_import = refresh or bool(query or location)
    if should_import:
        if not query or not location:
            raise HTTPException(
                status_code=400,
                detail="query and location are required when importing events.",
            )

        return await fetch_and_store_serpapi_events(
            db=db,
            app_settings=app_settings,
            query=query,
            location=location,
            date=date,
        )

    cursor = db.events.find().sort("_id", -1).limit(limit)
    events = await cursor.to_list(length=limit)
    return [serialize_event(event) for event in events]


@app.post("/api/events", response_model=EventOut, status_code=201)
async def create_event(
    event: EventIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> EventOut:
    try:
        result = await db.events.insert_one(event.model_dump())
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Event link already exists.") from None

    saved = await db.events.find_one({"_id": result.inserted_id})
    if saved is None:
        raise HTTPException(status_code=500, detail="Event was not saved.")

    return serialize_event(saved)


@app.post("/api/events/import/serpapi", response_model=list[EventOut])
async def import_serpapi_events(
    query: str = "events near me",
    location: str = "New York, NY",
    date: str = "date:week",
    db: AsyncIOMotorDatabase = Depends(get_database),
    app_settings: Settings = Depends(get_settings),
) -> list[EventOut]:
    return await fetch_and_store_serpapi_events(
        db=db,
        app_settings=app_settings,
        query=query,
        location=location,
        date=date,
    )


async def fetch_and_store_serpapi_events(
    db: AsyncIOMotorDatabase,
    app_settings: Settings,
    query: str,
    location: str,
    date: str,
) -> list[EventOut]:
    if not app_settings.serpapi_key:
        raise HTTPException(status_code=500, detail="SERPAPI_KEY is not configured.")

    params = {
        "engine": "google_events",
        "q": query,
        "location": location,
        "hl": "en",
        "gl": "us",
        "htichips": date,
        "api_key": app_settings.serpapi_key,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://serpapi.com/search.json", params=params)
        response.raise_for_status()
        data: dict[str, Any] = response.json()

    imported: list[EventOut] = []
    for raw_event in data.get("events_results", []):
        try:
            event = EventIn.model_validate(raw_event).model_dump()
        except ValidationError:
            continue

        saved = await db.events.find_one_and_update(
            {"link": event["link"]},
            {"$set": event},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        imported.append(serialize_event(saved))

    return imported
