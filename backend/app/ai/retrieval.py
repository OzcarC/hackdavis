"""Embedding similarity helpers for the AI generator.

Loads the same sentence-transformer model used in `embed_seeds.py` and
provides a function to find the top-N seeded events most similar to a
given query string. Used by the generator to pick "style anchors" - real
events that the LLM should imitate when inventing new ones.
"""

from __future__ import annotations

import numpy as np
from motor.motor_asyncio import AsyncIOMotorDatabase
from sentence_transformers import SentenceTransformer


# Match `embed_seeds.py` exactly. If you change one, change both.
MODEL_NAME = "all-MiniLM-L6-v2"

# Lazy global - loading the model takes ~1 second, so we share it across calls.
_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_query(text: str) -> np.ndarray:
    """Embed a single query string into a unit vector."""
    model = get_model()
    vector = model.encode([text], normalize_embeddings=True)[0]
    return np.asarray(vector, dtype=np.float32)


async def find_similar_events(
    db: AsyncIOMotorDatabase,
    query_text: str,
    k: int = 5,
    must_have_tags: list[str] | None = None,
) -> list[dict]:
    """Return the top-k seeded events most similar to query_text.

    `must_have_tags` is a soft filter - we only consider events that share
    at least one tag with the list. If no events match, falls back to the
    full seeded pool so the LLM still has examples.

    Returns full event documents, with each one decorated with a
    `_similarity` field (float between -1 and 1) for debugging.
    """
    base_query: dict = {
        "seeded": True,
        "embedding": {"$exists": True},
    }
    if must_have_tags:
        base_query["tags"] = {"$in": must_have_tags}

    cursor = db.events.find(base_query)
    candidates = await cursor.to_list(length=None)

    # Fallback: if tag filter eliminated everything, retry without it
    if not candidates and must_have_tags:
        cursor = db.events.find({"seeded": True, "embedding": {"$exists": True}})
        candidates = await cursor.to_list(length=None)

    if not candidates:
        return []

    query_vec = embed_query(query_text)

    # Stack candidate embeddings into a single matrix for one big dot product.
    # All embeddings are unit vectors (we used normalize_embeddings=True
    # during seeding), so dot product == cosine similarity.
    matrix = np.array(
        [c["embedding"] for c in candidates], dtype=np.float32
    )  # shape (N, 384)
    sims = matrix @ query_vec  # shape (N,)

    # Sort descending, take top-k
    ranked_indices = np.argsort(-sims)[:k]
    results: list[dict] = []
    for idx in ranked_indices:
        event = candidates[int(idx)]
        event["_similarity"] = float(sims[int(idx)])
        results.append(event)

    return results