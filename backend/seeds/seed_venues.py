"""Seed 5 fake Davis venues for the AI generator to pull from.

All venues are owned by OWNER_UID. The hackathon demo flow:
  1. Sign in as the owner (a@gmail.com -> "Andrew")
  2. Already a business account
  3. These 5 venues appear in their dashboard once the UI exists
  4. The weekly AI generator targets these venues' open slots

Run from the backend folder with venv active:
    python -m seeds.seed_venues
"""

from datetime import datetime

import certifi
from pymongo import MongoClient

from app.config import get_settings


# Owner of all seeded venues. Swap this if you want a different account
# to "own" the demo venues.
OWNER_UID = "KNwBErl1P3fMNGzrbjhXwOThL3X2"


def point(longitude: float, latitude: float) -> dict:
    return {"type": "Point", "coordinates": [longitude, latitude]}


def availability(day_of_week: int, start: str, end: str) -> dict:
    """day_of_week: 0=Sun, 1=Mon, ... 6=Sat"""
    return {"day_of_week": day_of_week, "start": start, "end": end}


def venue(
    name: str,
    description: str,
    address: str,
    longitude: float,
    latitude: float,
    event_types: list[str],
    avail: list[dict],
    photo: str | None = None,
) -> dict:
    return {
        "owner_uid": OWNER_UID,
        "name": name,
        "description": description,
        "address": address,
        "location": point(longitude, latitude),
        "event_types": event_types,
        "photo": photo,
        "availability": avail,
        "active": True,
        "created_at": datetime.utcnow(),
        "seeded": True,
    }


# 5 invented Davis venues, tight focus on Food / Social / Music to keep the
# AI's outputs feeling cohesive. Coordinates are real Davis spots so the
# events show up correctly in the location-aware feed.
venues = [
    venue(
        name="The Cornerstone Cafe",
        description=(
            "Cozy downtown coffee bar with a back patio. Hosts low-key "
            "weeknight events, study meetups, and Sunday acoustic sets."
        ),
        address="201 G St, Davis, CA",
        longitude=-121.7411,
        latitude=38.5446,
        event_types=["Food", "Social", "Study", "Music"],
        avail=[
            availability(1, "17:00", "21:00"),  # Mon evenings
            availability(3, "17:00", "21:00"),  # Wed evenings
            availability(0, "10:00", "14:00"),  # Sun late mornings
        ],
        photo="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=900",
    ),
    venue(
        name="Olive & Oak Kitchen",
        description=(
            "Mediterranean small-plates restaurant with a long communal "
            "table. Great for tasting events, food meetups, and "
            "neighborhood mixers."
        ),
        address="630 G St, Davis, CA",
        longitude=-121.7398,
        latitude=38.5462,
        event_types=["Food", "Social", "Community"],
        avail=[
            availability(2, "18:00", "22:00"),  # Tue dinners
            availability(4, "18:00", "22:00"),  # Thu dinners
            availability(6, "12:00", "15:00"),  # Sat lunches
        ],
        photo="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900",
    ),
    venue(
        name="North Davis Sound Room",
        description=(
            "Small live-music venue and listening room. Hosts open mics, "
            "singer-songwriter nights, and album-release shows in a "
            "200-seat space."
        ),
        address="1411 W Covell Blvd, Davis, CA",
        longitude=-121.7619,
        latitude=38.5614,
        event_types=["Music", "Social", "Community"],
        avail=[
            availability(4, "19:00", "23:00"),  # Thu shows
            availability(5, "19:00", "23:30"),  # Fri shows
            availability(6, "19:00", "23:30"),  # Sat shows
        ],
        photo="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900",
    ),
    venue(
        name="Riverside Picnic Co.",
        description=(
            "Outdoor picnic-style space along the Putah Creek path. Hosts "
            "casual community meals, sunset hangouts, and farmers-market "
            "follow-up events."
        ),
        address="Putah Creek Lodge, UC Davis, Davis, CA",
        longitude=-121.7588,
        latitude=38.5331,
        event_types=["Food", "Community", "Social", "Outdoors"],
        avail=[
            availability(5, "17:00", "20:00"),  # Fri picnics
            availability(6, "11:00", "15:00"),  # Sat lunches
            availability(0, "11:00", "15:00"),  # Sun lunches
        ],
        photo="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900",
    ),
    venue(
        name="The Quad Common Room",
        description=(
            "Reservable lounge near the Memorial Union. Used for board "
            "game socials, low-pressure mixers, and student-club hangouts."
        ),
        address="UC Davis Memorial Union, Davis, CA",
        longitude=-121.7491,
        latitude=38.5418,
        event_types=["Social", "Community", "Games", "Study"],
        avail=[
            availability(1, "18:00", "22:00"),  # Mon nights
            availability(3, "18:00", "22:00"),  # Wed nights
            availability(5, "18:00", "23:00"),  # Fri nights
        ],
        photo="https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=900",
    ),
]


def main() -> None:
    settings = get_settings()
    client = MongoClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client[settings.mongodb_db_name]

    for seed_venue in venues:
        # Upsert keyed on (name, owner_uid, seeded) so re-running won't
        # create duplicates and won't overwrite a real business's venue.
        db.venues.update_one(
            {
                "name": seed_venue["name"],
                "owner_uid": seed_venue["owner_uid"],
                "seeded": True,
            },
            {"$set": seed_venue},
            upsert=True,
        )

    print(
        f"Seeded {len(venues)} venues into {settings.mongodb_db_name}.venues "
        f"(owner_uid={OWNER_UID})"
    )


if __name__ == "__main__":
    main()