from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EventDate(BaseModel):
    start_date: str | None = None
    when: str | None = None


class EventIn(BaseModel):
    title: str
    date: EventDate | None = None
    address: list[str] = Field(default_factory=list)
    link: str | None = None
    thumbnail: str | None = None
    description: str | None = None
    source: str = "custom"


class EventOut(EventIn):
    id: str

    model_config = ConfigDict(populate_by_name=True)


def serialize_event(event: dict[str, Any]) -> EventOut:
    return EventOut(
        id=str(event["_id"]),
        title=event["title"],
        date=event.get("date"),
        address=event.get("address", []),
        link=event.get("link"),
        thumbnail=event.get("thumbnail"),
        description=event.get("description"),
        source=event.get("source", "custom"),
    )
