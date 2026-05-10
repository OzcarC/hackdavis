from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, OperationFailure

from app.config import get_settings
from app.database import database_lifespan, get_database
from app.models import Attendee, EventIn, EventOut, UserProfileIn, UserProfileOut, serialize_event, serialize_user_profile

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


@app.get("/debug/events-count")
async def events_count(db: AsyncIOMotorDatabase = Depends(get_database)) -> dict[str, int]:
    total = await db.events.count_documents({})
    custom = await db.events.count_documents({"source": "custom"})
    return {"total": total, "custom": custom}


@app.get("/api/users/{uid}", response_model=UserProfileOut)
async def get_user_profile(
    uid: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserProfileOut:
    profile = await db.user_profiles.find_one({"uid": uid})
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    return serialize_user_profile(profile)


@app.put("/api/users/{uid}", response_model=UserProfileOut)
async def upsert_user_profile(
    uid: str,
    profile: UserProfileIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserProfileOut:
    if uid != profile.uid:
        raise HTTPException(status_code=400, detail="Profile uid does not match route uid.")

    saved = await db.user_profiles.find_one_and_update(
        {"uid": uid},
        {"$set": profile.model_dump()},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    return serialize_user_profile(saved)


@app.get("/api/events", response_model=list[EventOut])
async def list_events(
    limit: int = Query(default=50, ge=1, le=100),
    lat: float | None = None,
    lng: float | None = None,
    radius: int = Query(default=25000, ge=1000, le=100000),
    author: str | None = None,
    attendee: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> list[EventOut]:
    return await fetch_custom_events(
        db=db,
        limit=limit,
        lat=lat,
        lng=lng,
        radius=radius,
        author=author,
        attendee=attendee,
    )


@app.post("/api/events", response_model=EventOut, status_code=201)
async def create_event(
    event: EventIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> EventOut:
    event_data = event.model_dump()
    event_data["source"] = "custom"

    try:
        result = await db.events.insert_one(event_data)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Event link already exists.") from None

    saved = await db.events.find_one({"_id": result.inserted_id})
    if saved is None:
        raise HTTPException(status_code=500, detail="Event was not saved.")

    return serialize_event(saved)


async def fetch_custom_events(
    db: AsyncIOMotorDatabase,
    limit: int,
    lat: float | None = None,
    lng: float | None = None,
    radius: int = 25000,
    author: str | None = None,
    attendee: str | None = None,
) -> list[EventOut]:
    query: dict[str, Any] = {"source": "custom"}
    sort = [("_id", -1)]

    if author is not None:
        query["author"] = author

    if attendee is not None:
        query["attendees.uid"] = attendee

    if lat is not None and lng is not None and author is None and attendee is None:
        query["location"] = {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat],
                },
                "$maxDistance": radius,
            }
        }
        sort = []

    cursor = db.events.find(query)
    if sort:
        cursor = cursor.sort(sort)

    cursor = cursor.limit(limit)
    try:
        events = await cursor.to_list(length=limit)
    except OperationFailure as error:
        if "unable to find index for $geoNear query" not in str(error):
            raise

        fallback_cursor = db.events.find({"source": "custom"}).sort("_id", -1).limit(limit)
        events = await fallback_cursor.to_list(length=limit)

    return [serialize_event(event) for event in events]

@app.post("/api/events/{event_id}/rsvp", response_model=EventOut)
async def rsvp_event(
    event_id: str,
    attendee: Attendee,
    db: AsyncIOMotorDatabase = Depends(get_database),
)->EventOut:
    try:
        event_object_id = ObjectId(event_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Event not found.") from None

    attendee_data = attendee.model_dump()
    result = await db.events.find_one_and_update(
        {
            "_id":event_object_id,
            "attendees.uid": attendee.uid,
        },
        {"$set": {"attendees.$": attendee_data}},
        return_document=ReturnDocument.AFTER,
    )

    if result is None:
        result = await db.events.find_one_and_update({
            "_id":event_object_id,
            "attendees.uid":{"$ne":attendee.uid},
            },
            {"$push":{"attendees":attendee_data}},
            return_document=ReturnDocument.AFTER,
        )

    if result is None:
        result = await db.events.find_one({"_id":event_object_id})

    if result is None:
        raise HTTPException(status_code=404, detail="Event not found.")
    
    return serialize_event(result)

@app.delete("/api/events/{event_id}/rsvp/{uid}", response_model=EventOut)
async def unrsvp_event(
    event_id : str,
    uid : str,
    db : AsyncIOMotorDatabase = Depends(get_database),
) -> EventOut:
    try:
        event_object_id = ObjectId(event_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Event not found.") from None

    result = await db.events.find_one_and_update(
        {"_id":event_object_id},
        {"$pull":{"attendees":{"uid":uid}}},
        return_document=ReturnDocument.AFTER,
    )

    if result is None:
        raise HTTPException(status_code=404, detail="Event not found.")
    
    return serialize_event(result)
