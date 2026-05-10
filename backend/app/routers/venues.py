from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.database import get_database
from app.models import VenueIn, VenueOut, serialize_venue


router = APIRouter(prefix="/api/venues", tags=["venues"])


async def require_business_account(
    uid: str,
    db: AsyncIOMotorDatabase,
) -> dict[str, Any]:
    """Look up the user and confirm they're a business account."""
    profile = await db.user_profiles.find_one({"uid": uid})
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")
    if profile.get("account_type") != "business":
        raise HTTPException(
            status_code=403,
            detail="Business account required to manage venues.",
        )
    return profile


def parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Venue not found.") from None


@router.get("", response_model=list[VenueOut])
async def list_venues(
    owner_uid: str | None = None,
    include_inactive: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> list[VenueOut]:
    query: dict[str, Any] = {}
    if owner_uid is not None:
        query["owner_uid"] = owner_uid
    if not include_inactive:
        query["active"] = True

    cursor = db.venues.find(query).sort("_id", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [serialize_venue(doc) for doc in docs]


@router.get("/{venue_id}", response_model=VenueOut)
async def get_venue(
    venue_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> VenueOut:
    object_id = parse_object_id(venue_id)
    doc = await db.venues.find_one({"_id": object_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Venue not found.")
    return serialize_venue(doc)


@router.post("", response_model=VenueOut, status_code=201)
async def create_venue(
    venue: VenueIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> VenueOut:
    if not venue.owner_uid:
        raise HTTPException(
            status_code=400,
            detail="owner_uid is required to create a venue.",
        )

    await require_business_account(venue.owner_uid, db)

    venue_data = venue.model_dump()
    venue_data["created_at"] = datetime.utcnow()
    # Default active=True if the caller forgot it
    venue_data.setdefault("active", True)

    result = await db.venues.insert_one(venue_data)
    saved = await db.venues.find_one({"_id": result.inserted_id})
    if saved is None:
        raise HTTPException(status_code=500, detail="Venue was not saved.")

    return serialize_venue(saved)


@router.put("/{venue_id}", response_model=VenueOut)
async def update_venue(
    venue_id: str,
    venue: VenueIn,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> VenueOut:
    object_id = parse_object_id(venue_id)

    existing = await db.venues.find_one({"_id": object_id})
    if existing is None:
        raise HTTPException(status_code=404, detail="Venue not found.")

    if not venue.owner_uid or existing.get("owner_uid") != venue.owner_uid:
        raise HTTPException(
            status_code=403,
            detail="Only the venue owner can update this venue.",
        )

    await require_business_account(venue.owner_uid, db)

    update_data = venue.model_dump(exclude_unset=True)
    # Don't let the owner_uid be reassigned through update
    update_data.pop("owner_uid", None)

    saved = await db.venues.find_one_and_update(
        {"_id": object_id},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER,
    )
    return serialize_venue(saved)


@router.delete("/{venue_id}", status_code=204)
async def delete_venue(
    venue_id: str,
    uid: str = Query(..., description="UID of the requesting user (must be owner)."),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> None:
    """Soft-delete: flips active=False rather than removing the document.

    Keeps historical events that reference this venue intact.
    """
    object_id = parse_object_id(venue_id)

    existing = await db.venues.find_one({"_id": object_id})
    if existing is None:
        raise HTTPException(status_code=404, detail="Venue not found.")

    if existing.get("owner_uid") != uid:
        raise HTTPException(
            status_code=403,
            detail="Only the venue owner can delete this venue.",
        )

    await db.venues.update_one(
        {"_id": object_id},
        {"$set": {"active": False}},
    )