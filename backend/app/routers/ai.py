from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.generator import weekly_run
from app.database import get_database


router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/regenerate")
async def regenerate(
    background: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict[str, Any]:
    """Trigger a full weekly run.

    Runs in the background so the HTTP request returns immediately. The
    client should poll `/api/ai/last-run` (or just refresh the events list)
    to see new events appear as they're inserted.
    """
    background.add_task(_run_and_log, db)
    return {"status": "started", "message": "Generating events in the background."}


@router.post("/regenerate/venue/{venue_id}")
async def regenerate_for_venue(
    venue_id: str,
    background: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict[str, Any]:
    """Regenerate AI events for a single venue."""
    try:
        object_id = ObjectId(venue_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Venue not found.") from None

    venue = await db.venues.find_one({"_id": object_id})
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found.")

    background.add_task(_run_and_log, db, {"_id": object_id})
    return {
        "status": "started",
        "venue": venue.get("name"),
        "message": "Generating events for this venue in the background.",
    }


@router.get("/last-run")
async def last_run(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict[str, Any]:
    """Most recent run summary - used by the regenerate UI to show progress."""
    doc = await db.ai_runs.find_one(
        {"_kind": "weekly_run"},
        sort=[("_id", -1)],
    )
    if doc is None:
        return {"status": "never", "message": "No runs yet."}

    doc["_id"] = str(doc["_id"])
    return doc


async def _run_and_log(
    db: AsyncIOMotorDatabase,
    venue_filter: dict | None = None,
) -> None:
    """Wrapper that runs the generator and logs success/failure to console.

    BackgroundTasks doesn't surface exceptions, so we log them here.
    """
    try:
        summary = await weekly_run(db, venue_filter=venue_filter)
        print(f"AI run complete: {summary}")
    except Exception as e:
        # Log the error to the run record so the regenerate UI can display it
        await db.ai_runs.insert_one(
            {
                "_kind": "weekly_run",
                "error": str(e),
                "venue_filter": str(venue_filter) if venue_filter else None,
            }
        )
        print(f"AI run FAILED: {e}")
        raise