"""Embed all seeded events with sentence-transformers and save vectors to Mongo.

Run once after seeding events. Run again any time you add new seed events.
The embedding model (~80MB) downloads automatically on first use and is cached
in C:\\Users\\<you>\\.cache\\huggingface\\.

Run from the backend folder with venv active:
    python -m scripts.embed_seeds
"""

import asyncio

import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from sentence_transformers import SentenceTransformer

from app.config import get_settings


# Small, fast, accurate-enough model. 384-dim vectors. ~80MB.
MODEL_NAME = "all-MiniLM-L6-v2"


def event_to_text(event: dict) -> str:
    """Turn a stored event document into a single string for embedding.

    We combine the fields that carry the most semantic signal: title,
    description, and tags. Address and time are deliberately excluded -
    those don't define what the event IS, just where/when.
    """
    parts: list[str] = []

    title = event.get("title")
    if title:
        parts.append(title)

    description = event.get("description")
    if description:
        parts.append(description)

    tags = event.get("tags") or []
    if tags:
        parts.append("Tags: " + ", ".join(tags))

    return ". ".join(parts)


async def main() -> None:
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client[settings.mongodb_db_name]

    print(f"Loading embedding model '{MODEL_NAME}'...")
    print("  (first run downloads ~80MB - subsequent runs are instant)")
    model = SentenceTransformer(MODEL_NAME)
    print(f"  Loaded. Embedding dimension: {model.get_sentence_embedding_dimension()}")

    # Pull every seeded event. We could also embed user-created events, but
    # for the AI generator we only want the curated seed corpus as style
    # anchors.
    cursor = db.events.find({"seeded": True})
    events = await cursor.to_list(length=None)
    print(f"Found {len(events)} seeded events to embed.")

    if not events:
        print("Nothing to embed. Did you run `python -m seeds.seed_events`?")
        return

    texts = [event_to_text(event) for event in events]
    # Encode in one batch - fast and avoids reloading the model per event.
    print("Encoding...")
    vectors = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)
    # `normalize_embeddings=True` gives unit vectors so we can use dot product
    # as cosine similarity later (cheaper than computing norms each time).

    print("Writing vectors back to Mongo...")
    updated = 0
    for event, vector in zip(events, vectors):
        await db.events.update_one(
            {"_id": event["_id"]},
            {
                "$set": {
                    "embedding": vector.tolist(),
                    "embedding_model": MODEL_NAME,
                }
            },
        )
        updated += 1

    print(f"Done. Embedded {updated} events.")
    print(
        "Each event now has fields: embedding (list of 384 floats), "
        "embedding_model (string)."
    )


if __name__ == "__main__":
    asyncio.run(main())