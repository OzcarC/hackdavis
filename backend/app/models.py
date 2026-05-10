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
    venue_id: str | None = None
    ai_generated: bool = False
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
    account_type: str | None = None    
    bio: str | None = None
    photo: str | None = None
    personality_type: str | None = None
    interests: list[str] = Field(default_factory=list)
    preferred_tags: list[str] = Field(default_factory=list)
    availability: list[str] = Field(default_factory=list)
    home_location: str | None = None
    free_time_activities: list[str] = Field(default_factory=list)
    onboarding_answers: dict[str, Any] = Field(default_factory=dict)
    onboarding_completed: bool = False


class UserProfileOut(UserProfileIn):
    id: str

class VenueAvailability(BaseModel):
    day_of_week: int  # 0=Sun, 1=Mon, ... 6=Sat
    start: str        # "HH:MM" 24-hour
    end: str          # "HH:MM" 24-hour


class VenueIn(BaseModel):
    owner_uid: str | None = None
    name: str
    description: str | None = None
    address: str
    location: EventLocation | None = None
    event_types: list[str] = Field(default_factory=list)
    photo: str | None = None
    availability: list[VenueAvailability] = Field(default_factory=list)
    active: bool = True


class VenueOut(VenueIn):
    id: str
    created_at: str | None = None

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
        tags=event.get("tags", []),
        location=event.get("location"),
        source=event.get("source", "custom"),
        author=event.get("author"),
        attendees=event.get("attendees", []),
        venue_id=event.get("venue_id"),         # NEW
        ai_generated=event.get("ai_generated", False),  # NEW
    )


def serialize_user_profile(profile: dict[str, Any]) -> UserProfileOut:
    return UserProfileOut(
        id=str(profile["_id"]),
        uid=profile["uid"],
        email=profile.get("email"),
        display_name=profile.get("display_name"),
        bio=profile.get("bio"),
        photo=profile.get("photo"),
        account_type=profile.get("account_type", "user"),        
        personality_type=profile.get("personality_type"),
        interests=profile.get("interests", []),
        preferred_tags=profile.get("preferred_tags", []),
        availability=profile.get("availability", []),
        home_location=profile.get("home_location"),
        free_time_activities=profile.get("free_time_activities", []),
        onboarding_answers=profile.get("onboarding_answers", {}),
        onboarding_completed=profile.get("onboarding_completed", False),
    )

def serialize_venue(venue: dict[str, Any]) -> VenueOut:
    return VenueOut(
        id=str(venue["_id"]),
        owner_uid=venue.get("owner_uid"),
        name=venue["name"],
        description=venue.get("description"),
        address=venue["address"],
        location=venue.get("location"),
        event_types=venue.get("event_types", []),
        photo=venue.get("photo"),
        availability=venue.get("availability", []),
        active=venue.get("active", True),
        created_at=venue["created_at"].isoformat() if venue.get("created_at") else None,
    )