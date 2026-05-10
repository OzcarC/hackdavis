from typing import Any

from pydantic import BaseModel, ConfigDict, Field

class Attendee(BaseModel):
    uid: str
    display_name: str | None = None
    photo: str | None = None

class EventDate(BaseModel):
    start_date: str | None = None
    when: str | None = None


class EventLocation(BaseModel):
    type: str = "Point"
    coordinates: list[float]


class EventIn(BaseModel):
    title: str
    date: EventDate | None = None
    address: list[str] = Field(default_factory=list)
    link: str | None = None
    thumbnail: str | None = None
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    location: EventLocation | None = None
    source: str = "custom"
    author: str | None = None
    attendees: list[Attendee] = Field(default_factory=list)


class EventOut(EventIn):
    id: str

    model_config = ConfigDict(populate_by_name=True)


class UserProfileIn(BaseModel):
    uid: str
    email: str | None = None
    display_name: str | None = None
    bio: str | None = None
    photo: str | None = None


class UserProfileOut(UserProfileIn):
    id: str


def serialize_event(event: dict[str, Any]) -> EventOut:
    return EventOut(
        id=str(event["_id"]),
        title=event["title"],
        date=event.get("date"),
        address=event.get("address", []),
        link=event.get("link"),
        thumbnail=event.get("thumbnail"),
        description=event.get("description"),
        tags=event.get("tags", []),
        location=event.get("location"),
        source=event.get("source", "custom"),
        author=event.get("author"),
        attendees=event.get("attendees", []),
    )


def serialize_user_profile(profile: dict[str, Any]) -> UserProfileOut:
    return UserProfileOut(
        id=str(profile["_id"]),
        uid=profile["uid"],
        email=profile.get("email"),
        display_name=profile.get("display_name"),
        bio=profile.get("bio"),
        photo=profile.get("photo"),
    )
