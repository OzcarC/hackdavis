"""Prompt templates for the AI event generator.

Keep these readable and focused - they're the part you'll iterate on most
during demo prep. If outputs feel off, the fix is almost always here, not
in the code.
"""

from __future__ import annotations

import json


SYSTEM_PROMPT = """You are an events curator for a college-town events app in Davis, California.
Your job is to invent realistic, appealing event ideas that fit a specific venue, date, and audience.

Rules you must follow:
- Output strictly valid JSON. No markdown, no commentary, no code fences.
- Match the tone and detail level of the example events provided.
- Use the venue's name in the event description so it feels grounded.
- Pick a realistic start time within the venue's available window.
- Keep titles short (3-7 words). Keep descriptions 1-2 sentences, plain language.
- Tags must be a subset of the venue's allowed event_types.
- Do NOT repeat any of the example event titles. Invent something new.
- Avoid generic words like "Event", "Gathering", "Meetup" alone in titles."""


def build_user_prompt(
    venue: dict,
    target_date_label: str,
    target_event_type: str,
    audience_summary: str,
    seed_examples: list[dict],
    available_window: str,
) -> str:
    """Compose the user-message half of the prompt.

    venue: a venue document (name, description, address, event_types, ...)
    target_date_label: human-readable date, e.g. "Wednesday, May 14"
    target_event_type: ONE tag from venue.event_types we're generating for
    audience_summary: short phrase like "students who like Music and Social events"
    seed_examples: list of similar seed event documents (the "style anchors")
    available_window: e.g. "18:00 to 22:00"
    """
    examples_block = format_seed_examples(seed_examples)

    return f"""Generate ONE event for the following venue and slot.

VENUE
- Name: {venue.get("name")}
- Address: {venue.get("address")}
- About: {venue.get("description") or "(no description)"}
- Allowed event types: {", ".join(venue.get("event_types", []))}

SLOT
- Date: {target_date_label}
- Available time window: {available_window}
- Target event type for this slot: {target_event_type}

AUDIENCE
{audience_summary}

EXAMPLE EVENTS (in the style we like - imitate the tone, do not copy):
{examples_block}

OUTPUT
Return a single JSON object with these exact fields:
{{
  "title": "string, 3-7 words",
  "description": "string, 1-2 sentences",
  "start_time": "HH:MM in 24-hour format, within the available window",
  "duration_minutes": integer between 60 and 150,
  "tags": ["{target_event_type}", "optionally one more from the venue's allowed list"]
}}

Output ONLY the JSON. Nothing before, nothing after."""


def format_seed_examples(seed_examples: list[dict]) -> str:
    """Render seed events as a compact bulleted list for the prompt.

    We strip the embedding/IDs/timestamps and just show the human-readable
    fields the LLM should imitate.
    """
    if not seed_examples:
        return "(no examples available - use your best judgment)"

    lines: list[str] = []
    for i, event in enumerate(seed_examples, start=1):
        title = event.get("title", "")
        description = event.get("description") or ""
        tags = event.get("tags") or []
        lines.append(
            f"{i}. \"{title}\" - {description} [tags: {', '.join(tags)}]"
        )
    return "\n".join(lines)


def build_audience_summary(profiles: list[dict]) -> str:
    """Aggregate user quiz signal into a short prose blurb for the prompt.

    Pulls the most common interests, preferred_tags, free_time_activities,
    and personality types across all users in the area.
    """
    if not profiles:
        return "General college-town audience: students, young professionals, and locals."

    from collections import Counter

    interests = Counter()
    tags = Counter()
    activities = Counter()
    personalities = Counter()

    for p in profiles:
        for v in p.get("interests", []):
            interests[v] += 1
        for v in p.get("preferred_tags", []):
            tags[v] += 1
        for v in p.get("free_time_activities", []):
            activities[v] += 1
        if pt := p.get("personality_type"):
            personalities[pt] += 1

    parts: list[str] = []
    if interests:
        top = ", ".join(name for name, _ in interests.most_common(3))
        parts.append(f"top interests: {top}")
    if tags:
        top = ", ".join(name for name, _ in tags.most_common(3))
        parts.append(f"preferred event tags: {top}")
    if activities:
        top = ", ".join(name for name, _ in activities.most_common(3))
        parts.append(f"common free-time activities: {top}")
    if personalities:
        dominant = personalities.most_common(1)[0][0]
        parts.append(f"mostly {dominant.lower()}s")

    return f"Local audience profile - {'; '.join(parts)}."


def parse_llm_output(raw: str) -> dict:
    """Parse the JSON the model returned, with light recovery.

    The qwen2.5 model usually outputs clean JSON, but occasionally wraps
    it in ```json ... ``` fences or adds a stray sentence. Strip those.
    """
    text = raw.strip()
    # Strip leading/trailing markdown fences if the model added them
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        # Remove a leading "json" language tag
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    # Find the first { and last } in case there's leading prose
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        text = text[first : last + 1]

    return json.loads(text)