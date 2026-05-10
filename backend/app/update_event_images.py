import certifi
from pymongo import MongoClient

from app.config import get_settings
from app.seedevents import events


EVENT_IMAGES = {
    seed_event["title"]: seed_event["thumbnail"]
    for seed_event in events
    if seed_event.get("thumbnail")
}


def main() -> None:
    settings = get_settings()
    client = MongoClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client[settings.mongodb_db_name]

    updated = 0
    for title, thumbnail in EVENT_IMAGES.items():
        result = db.events.update_one(
            {"title": title, "seeded": True},
            {"$set": {"thumbnail": thumbnail}},
        )
        updated += result.modified_count
        print(f"{title}: matched={result.matched_count}, modified={result.modified_count}")

    print(f"Updated {updated} seeded event thumbnails.")


if __name__ == "__main__":
    main()
