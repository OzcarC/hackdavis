"""The weekly AI event generator.

Pipeline (called once a week, or manually via /api/ai/regenerate):
  1. Find all active venues
  2. For each venue, expand its weekly availability into concrete date+window slots
     for the upcoming Mon-Sun window
  3. Pull aggregate user interests (for the audience prompt)
  4. For each venue, pick up to 2 distinct event_types from its allowed list,
     prioritized by popularity in user quiz answers
  5. For each (venue, event_type) pair: skip if a future-dated AI event for that
     slot already exists, otherwise retrieve similar seed events, prompt Ollama,
     parse the JSON, and insert a new event
  6. Write a run-record doc to db.ai_runs for the regenerate UI
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any

import ollama
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.prompts import (
    SYSTEM_PROMPT,
    build_audience_summary,
    build_user_prompt,
    parse_llm_output,
)
from app.ai.retrieval import find_similar_events


OLLAMA_MODEL = "qwen2.5:3b"
EVENTS_PER_VENUE = 2
MAX_RETRIES = 2  # one retry per slot if the LLM returns garbage


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


def python_weekday_to_app(python_weekday: int) -> int:
    """Python's date.weekday(): Mon=0..Sun=6.
    Our schema's day_of_week: Sun=0..Sat=6.
    """
    return (python_weekday + 1) % 7


def upcoming_week_dates(today: datetime | None = None) -> list[datetime]:
    """Return the next Mon-Sun as a list of datetimes (date-only, midnight)."""
    if today is None:
        today = datetime.utcnow()
    # Days until next Monday
    days_ahead = (7 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # always look at NEXT week, never current
    next_monday = (today + timedelta(days=days_ahead)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return [next_monday + timedelta(days=i) for i in range(7)]


def format_date_label(d: datetime) -> str:
    """e.g. 'Wednesday, May 14' - cross-platform (no %-d / %#d)."""
    weekday = d.strftime("%A")
    month = d.strftime("%b")
    return f"{weekday}, {month} {d.day}"


def format_when(date: datetime, start_hhmm: str) -> str:
    """e.g. 'Wed, May 14, 6:30 PM' - matches your seed event format."""
    hh, mm = start_hhmm.split(":")
    h12 = int(hh) % 12 or 12
    suffix = "AM" if int(hh) < 12 else "PM"
    return f"{SHORT_WEEKDAYS[python_weekday_to_app(date.weekday())]}, {date.strftime('%b')} {date.day}, {h12}:{mm} {suffix}"


# ---------------------------------------------------------------------------
# Slot computation
# ---------------------------------------------------------------------------

def expand_slots(venue: dict, week_dates: list[datetime]) -> list[dict]:
    """Cross venue.availability with the upcoming week's dates.

    Returns a list of dicts: {date, day_label, start, end}
    """
    slots: list[dict] = []
    availability = venue.get("availability") or []
    for d in week_dates:
        app_dow = python_weekday_to_app(d.weekday())
        for window in availability:
            if window.get("day_of_week") == app_dow:
                slots.append(
                    {
                        "date": d,
                        "day_label": format_date_label(d),
                        "start": window.get("start"),
                        "end": window.get("end"),
                    }
                )
    return slots


def pick_event_types(venue: dict, popular_tags: list[str], n: int) -> list[str]:
    """Pick up to n distinct event_types from this venue, prioritized by user popularity.

    Falls back to the venue's natural order if there's no overlap with popular tags.
    """
    venue_types = venue.get("event_types") or []
    if not venue_types:
        return []

    # Tags from venue that are also popular, in popularity order
    overlapping = [t for t in popular_tags if t in venue_types]
    rest = [t for t in venue_types if t not in overlapping]
    ordered = overlapping + rest
    # De-dupe, preserve order
    seen = set()
    result = []
    for t in ordered:
        if t not in seen:
            seen.add(t)
            result.append(t)
        if len(result) >= n:
            break
    return result


# ---------------------------------------------------------------------------
# Existence check
# ---------------------------------------------------------------------------

async def has_existing_ai_event(
    db: AsyncIOMotorDatabase,
    venue_id: str,
    date: datetime,
    event_type: str,
) -> bool:
    """Skip-if-exists: an AI event for this (venue, date, type) already there?"""
    day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    existing = await db.events.find_one(
        {
            "ai_generated": True,
            "venue_id": venue_id,
            "tags": event_type,
            "date.start_date": {
                "$gte": day_start.isoformat(),
                "$lt": day_end.isoformat(),
            },
        }
    )
    return existing is not None


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def call_ollama(user_prompt: str) -> str:
    """Call Ollama via its Python client. Synchronous - we run this in a
    thread executor from the async pipeline.
    """
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        options={
            "temperature": 0.8,  # some creativity, not chaos
            "num_predict": 400,  # plenty for a JSON object
        },
        format="json",  # qwen2.5 supports forced JSON output
    )
    return response["message"]["content"]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_llm_event(parsed: dict, venue: dict, slot: dict, target_type: str) -> None:
    """Raise ValueError if the parsed LLM output is unusable."""
    title = parsed.get("title")
    if not title or not isinstance(title, str) or len(title) < 3:
        raise ValueError(f"Bad title: {title!r}")

    desc = parsed.get("description")
    if not desc or not isinstance(desc, str):
        raise ValueError(f"Bad description: {desc!r}")

    start = parsed.get("start_time")
    if not start or ":" not in str(start):
        raise ValueError(f"Bad start_time: {start!r}")
    # Quick sanity: start within window
    try:
        sh, sm = (int(x) for x in start.split(":"))
        wh, wm = (int(x) for x in slot["start"].split(":"))
        eh, em = (int(x) for x in slot["end"].split(":"))
        start_min = sh * 60 + sm
        win_start = wh * 60 + wm
        win_end = eh * 60 + em
        if not (win_start <= start_min <= win_end - 30):
            raise ValueError(
                f"start_time {start} outside window {slot['start']}-{slot['end']}"
            )
    except (ValueError, TypeError) as e:
        raise ValueError(f"Could not parse times: {e}")

    duration = parsed.get("duration_minutes")
    if not isinstance(duration, int) or not (30 <= duration <= 240):
        raise ValueError(f"Bad duration: {duration!r}")

    tags = parsed.get("tags")
    if not isinstance(tags, list) or not tags:
        raise ValueError(f"Bad tags: {tags!r}")
    if target_type not in tags:
        raise ValueError(f"target_type {target_type!r} not in tags {tags}")
    allowed = set(venue.get("event_types") or [])
    bad = [t for t in tags if t not in allowed]
    if bad:
        raise ValueError(f"Tags not in venue.event_types: {bad}")


# ---------------------------------------------------------------------------
# Insertion
# ---------------------------------------------------------------------------

def build_event_doc(parsed: dict, venue: dict, slot: dict) -> dict:
    """Turn the validated LLM output into a db.events document."""
    date: datetime = slot["date"]
    sh, sm = (int(x) for x in parsed["start_time"].split(":"))
    start_dt = date.replace(hour=sh, minute=sm)

    return {
        "title": parsed["title"].strip(),
        "description": parsed["description"].strip(),
        "date": {
            "start_date": start_dt.isoformat(),
            "when": format_when(date, parsed["start_time"]),
        },
        "address": [venue["address"]],
        "tags": parsed["tags"],
        "location": venue.get("location"),
        "thumbnail": venue.get("photo"),
        "source": "custom",
        "ai_generated": True,
        "venue_id": str(venue["_id"]),
        "venue_name": venue.get("name"),
        "author": None,
        "attendees": [],
        "created_at": datetime.utcnow(),
        "ai_meta": {
            "model": OLLAMA_MODEL,
            "generated_at": datetime.utcnow().isoformat(),
            "duration_minutes": parsed.get("duration_minutes"),
        },
    }


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def weekly_run(
    db: AsyncIOMotorDatabase,
    *,
    venue_filter: dict | None = None,
    today: datetime | None = None,
) -> dict:
    """Run the generator. Returns a summary dict.

    venue_filter: optional extra Mongo filter applied to active venues
        (e.g. {"_id": ObjectId(venue_id)} for per-venue regenerate).
    """
    summary: dict[str, Any] = {
        "started_at": datetime.utcnow().isoformat(),
        "venues_considered": 0,
        "slots_attempted": 0,
        "events_created": 0,
        "skipped_existing": 0,
        "failures": [],
    }

    week_dates = upcoming_week_dates(today=today)
    print(f"Generating for week of {week_dates[0].date()} to {week_dates[-1].date()}")

    # Audience aggregation - one pass over all profiles
    profile_cursor = db.user_profiles.find({})
    profiles = await profile_cursor.to_list(length=None)
    audience_summary = build_audience_summary(profiles)
    print(f"Audience: {audience_summary}")

    # Most popular preferred_tags across users (used to pick which event_type
    # to generate for each venue when there's a choice).
    from collections import Counter
    tag_counter = Counter()
    for p in profiles:
        for t in p.get("preferred_tags", []):
            tag_counter[t] += 1
    popular_tags = [t for t, _ in tag_counter.most_common()]

    # Venues
    venue_query = {"active": True}
    if venue_filter:
        venue_query.update(venue_filter)
    venues = await db.venues.find(venue_query).to_list(length=None)
    summary["venues_considered"] = len(venues)
    print(f"Considering {len(venues)} active venues")

    loop = asyncio.get_event_loop()

    for venue in venues:
        venue_name = venue.get("name", "?")
        slots = expand_slots(venue, week_dates)
        if not slots:
            print(f"  [{venue_name}] no open slots this week - skipping")
            continue

        types_to_generate = pick_event_types(venue, popular_tags, n=EVENTS_PER_VENUE)
        if not types_to_generate:
            print(f"  [{venue_name}] no event_types defined - skipping")
            continue

        # Walk through types; for each, find the next slot that doesn't
        # already have an AI event of that type.
        slot_index = 0
        for target_type in types_to_generate:
            if slot_index >= len(slots):
                break
            slot = slots[slot_index]

            already = await has_existing_ai_event(
                db, str(venue["_id"]), slot["date"], target_type
            )
            if already:
                print(
                    f"  [{venue_name}] skip - existing AI event for "
                    f"{target_type} on {slot['day_label']}"
                )
                summary["skipped_existing"] += 1
                slot_index += 1
                continue

            summary["slots_attempted"] += 1

            # Retrieval: similar seed events for this (venue type + audience flavor)
            audience_flavor_query = (
                f"{target_type} event for {audience_summary}"
            )
            seed_examples = await find_similar_events(
                db,
                query_text=audience_flavor_query,
                k=5,
                must_have_tags=[target_type],
            )

            user_prompt = build_user_prompt(
                venue=venue,
                target_date_label=slot["day_label"],
                target_event_type=target_type,
                audience_summary=audience_summary,
                seed_examples=seed_examples,
                available_window=f"{slot['start']} to {slot['end']}",
            )

            success = False
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    print(
                        f"  [{venue_name}] generating {target_type} for "
                        f"{slot['day_label']} (attempt {attempt})"
                    )
                    raw = await loop.run_in_executor(None, call_ollama, user_prompt)
                    parsed = parse_llm_output(raw)
                    validate_llm_event(parsed, venue, slot, target_type)
                    doc = build_event_doc(parsed, venue, slot)
                    result = await db.events.insert_one(doc)
                    print(
                        f"    OK: '{parsed['title']}' "
                        f"@ {parsed['start_time']} -> {result.inserted_id}"
                    )
                    summary["events_created"] += 1
                    success = True
                    break
                except Exception as e:
                    print(f"    fail (attempt {attempt}): {e}")
                    if attempt == MAX_RETRIES:
                        summary["failures"].append(
                            {
                                "venue": venue_name,
                                "type": target_type,
                                "date": slot["day_label"],
                                "error": str(e),
                            }
                        )

            slot_index += 1

    summary["finished_at"] = datetime.utcnow().isoformat()
    # Persist a run record for the regenerate UI / debugging
    await db.ai_runs.insert_one({**summary, "_kind": "weekly_run"})
    return summary