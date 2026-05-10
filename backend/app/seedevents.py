from datetime import datetime

import certifi
from pymongo import MongoClient

from app.config import get_settings


def point(longitude: float, latitude: float) -> dict:
    return {
        "type": "Point",
        "coordinates": [longitude, latitude],
    }


def event(
    title: str,
    description: str,
    address: str,
    when: str,
    tags: list[str],
    longitude: float,
    latitude: float,
    thumbnail: str | None = None,
) -> dict:
    return {
        "title": title,
        "description": description,
        "date": {
            "start_date": when,
            "when": when,
        },
        "address": [address],
        "link": None,
        "thumbnail": thumbnail,
        "tags": tags,
        "location": point(longitude, latitude),
        "source": "custom",
        "seeded": True,
        "created_at": datetime.utcnow(),
    }


events = [
    event(
        "Resume Review Night",
        "Get feedback on your resume before career fair season.",
        "UC Davis Student Community Center, Davis, CA",
        "Fri, May 15, 6:00 PM",
        ["Career", "Workshop"],
        -121.7490,
        38.5420,
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900",
    ),
    event(
        "Startup Networking Mixer",
        "Meet students and local tech professionals.",
        "Downtown Davis, Davis, CA",
        "Sun, May 17, 5:30 PM",
        ["Networking", "Career"],
        -121.7405,
        38.5449,
        "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=900",
    ),
    event(
        "Food Truck Friday",
        "Local food trucks and music.",
        "Central Park, Davis, CA",
        "Fri, May 22, 6:00 PM",
        ["Food", "Social", "Music"],
        -121.7401,
        38.5456,
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900",
    ),
    event(
        "Spring Hackathon",
        "A 24 hour coding competition.",
        "Engineering Building, UC Davis, Davis, CA",
        "Sat, May 30, 9:00 AM",
        ["Hackathon", "Career"],
        -121.7544,
        38.5356,
        "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900",
    ),
    event(
        "Open Mic Night",
        "Music, poetry, and comedy performances.",
        "Davis Coffee House, Davis, CA",
        "Tue, Jun 2, 7:00 PM",
        ["Music", "Social"],
        -121.7408,
        38.5442,
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900",
    ),
    event(
        "Finals Study Group",
        "Group study with snacks.",
        "Shields Library, Davis, CA",
        "Fri, Jun 5, 3:00 PM",
        ["Study", "Food"],
        -121.7494,
        38.5393,
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900",
    ),
    event(
        "Campus Soccer Meetup",
        "Casual soccer game.",
        "UC Davis Rec Field, Davis, CA",
        "Sun, Jun 7, 4:00 PM",
        ["Sports", "Social"],
        -121.7600,
        38.5414,
        "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=900",
    ),
    event(
        "Women in Tech Panel",
        "Panel discussion with engineers and designers.",
        "UC Davis Conference Center, Davis, CA",
        "Wed, Jun 10, 6:00 PM",
        ["Career", "Networking"],
        -121.7529,
        38.5411,
        "https://images.unsplash.com/photo-1559223607-a43c990c692c?w=900",
    ),
    event(
        "Photography Walk",
        "Downtown photo walk for all skill levels.",
        "Downtown Davis, Davis, CA",
        "Sun, Jun 14, 5:00 PM",
        ["Community", "Social"],
        -121.7405,
        38.5449,
        "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=900",
    ),
    event(
        "AI & Machine Learning Talk",
        "Discussion on AI careers and trends.",
        "Engineering Hall, UC Davis, Davis, CA",
        "Thu, Jun 18, 6:00 PM",
        ["Career", "Workshop", "Study"],
        -121.7544,
        38.5356,
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=900",
    ),
]

events.extend(
    [
        event(
            "Davis Farmers Market Picnic",
            "Bring a blanket and meet neighbors for local produce, snacks, and live music in the park.",
            "Central Park, Davis, CA",
            "Sat, Jun 20, 10:00 AM",
            ["Community", "Food", "Social"],
            -121.7401,
            38.5456,
            "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900",
        ),
        event(
            "Arboretum Cleanup Crew",
            "Volunteer with students and residents to pick up litter, clear paths, and keep the Arboretum welcoming.",
            "UC Davis Arboretum, Davis, CA",
            "Sat, Jun 20, 9:00 AM",
            ["Community", "Volunteer", "Outdoors"],
            -121.7518,
            38.5382,
            "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=900",
        ),
        event(
            "Downtown Board Game Social",
            "Casual board games and card games for all experience levels. Come solo or bring a group.",
            "Davis Cards & Games, Davis, CA",
            "Sat, Jun 20, 2:00 PM",
            ["Community", "Social", "Games"],
            -121.7409,
            38.5444,
            "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=900",
        ),
        event(
            "Bike Repair Pop-Up",
            "Learn basic tune-ups, flat fixes, and chain care from local bike volunteers.",
            "Davis Bike Collective, Davis, CA",
            "Sat, Jun 20, 1:00 PM",
            ["Community", "Workshop", "Outdoors"],
            -121.7379,
            38.5472,
            "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=900",
        ),
        event(
            "Community Garden Workday",
            "Help plant, water, weed, and share gardening tips with Davis neighbors.",
            "Davis Community Gardens, Davis, CA",
            "Sun, Jun 21, 9:30 AM",
            ["Community", "Volunteer", "Outdoors"],
            -121.7470,
            38.5514,
            "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900",
        ),
        event(
            "Student Art Swap",
            "Trade prints, stickers, zines, and small handmade pieces with local student artists.",
            "UC Davis Craft Center, Davis, CA",
            "Sun, Jun 21, 12:00 PM",
            ["Community", "Art", "Social"],
            -121.7533,
            38.5426,
            "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900",
        ),
        event(
            "Sunset Yoga on the Quad",
            "Beginner-friendly outdoor yoga session with stretching, breathing, and a relaxed community pace.",
            "UC Davis Quad, Davis, CA",
            "Sun, Jun 21, 6:30 PM",
            ["Community", "Wellness", "Outdoors"],
            -121.7496,
            38.5398,
            "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900",
        ),
        event(
            "Neighborhood Potluck",
            "Share a dish, meet new people, and enjoy an easy evening meal with the Davis community.",
            "Davis Senior Center, Davis, CA",
            "Mon, Jun 22, 6:00 PM",
            ["Community", "Food", "Social"],
            -121.7487,
            38.5493,
            "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900",
        ),
        event(
            "Open Jam Session",
            "Bring an instrument or just listen while local musicians trade songs and improvise together.",
            "Davis Music Store, Davis, CA",
            "Tue, Jun 23, 7:00 PM",
            ["Community", "Music", "Social"],
            -121.7404,
            38.5441,
            "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=900",
        ),
        event(
            "Mutual Aid Supply Drive",
            "Drop off shelf-stable food, hygiene items, and school supplies for local mutual aid distribution.",
            "Davis Community Church, Davis, CA",
            "Wed, Jun 24, 5:30 PM",
            ["Community", "Volunteer"],
            -121.7421,
            38.5447,
            "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=900",
        ),
    ]
)

events.extend(
    [
        event(
            "Midtown Coffee Networking",
            "Meet students, founders, and local professionals for low-pressure networking over coffee.",
            "Temple Coffee Roasters, 2200 K St, Sacramento, CA",
            "Thu, Jun 25, 8:30 AM",
            ["Networking", "Career", "Social"],
            -121.4767,
            38.5753,
            "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=900",
        ),
        event(
            "Capitol Park Volunteer Morning",
            "Help with light cleanup, planting support, and park beautification near the Capitol grounds.",
            "Capitol Park, Sacramento, CA",
            "Sat, Jun 27, 9:00 AM",
            ["Community", "Volunteer", "Outdoors"],
            -121.4934,
            38.5767,
            "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=900",
        ),
        event(
            "Old Sacramento Photo Walk",
            "Explore historic streets, riverfront views, and golden-hour photography spots with other creatives.",
            "Old Sacramento Waterfront, Sacramento, CA",
            "Sat, Jun 27, 6:30 PM",
            ["Community", "Social", "Art"],
            -121.5051,
            38.5846,
            "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=900",
        ),
        event(
            "Sacramento Coding Study Hall",
            "Bring a laptop and work through side projects, interview prep, or class assignments with peers.",
            "Sacramento Central Library, Sacramento, CA",
            "Sun, Jun 28, 1:00 PM",
            ["Study", "Workshop", "Career"],
            -121.4953,
            38.5816,
            "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900",
        ),
        event(
            "Riverfront Run Club",
            "Casual all-paces run along the Sacramento River followed by snacks and conversation.",
            "Crocker Park, Sacramento, CA",
            "Mon, Jun 29, 6:00 PM",
            ["Sports", "Social", "Outdoors"],
            -121.5062,
            38.5774,
            "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=900",
        ),
        event(
            "Sacramento Food Hall Meetup",
            "Grab dinner, try new vendors, and meet people interested in local food and events.",
            "The Bank, 629 J St, Sacramento, CA",
            "Tue, Jun 30, 6:30 PM",
            ["Food", "Social", "Community"],
            -121.4969,
            38.5818,
            "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900",
        ),
        event(
            "Health Tech Lightning Talks",
            "Short talks from students and builders working on healthcare, data, and civic technology.",
            "Urban Hive, Sacramento, CA",
            "Wed, Jul 1, 6:00 PM",
            ["Career", "Networking", "Workshop"],
            -121.4930,
            38.5787,
            "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=900",
        ),
        event(
            "McKinley Park Picnic",
            "Bring a blanket and meet new people for a relaxed community picnic in East Sacramento.",
            "McKinley Park, Sacramento, CA",
            "Thu, Jul 2, 5:30 PM",
            ["Community", "Food", "Social"],
            -121.4604,
            38.5792,
            "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900",
        ),
        event(
            "Board Game Night Sacramento",
            "Play strategy games, party games, and card games with a beginner-friendly group.",
            "There and Back Cafe, Sacramento, CA",
            "Fri, Jul 3, 7:00 PM",
            ["Social", "Community", "Games"],
            -121.4949,
            38.5814,
            "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=900",
        ),
        event(
            "Second Saturday Art Meetup",
            "Walk through galleries, pop-ups, and street art stops with other students and creatives.",
            "Midtown Sacramento, Sacramento, CA",
            "Sat, Jul 11, 5:00 PM",
            ["Art", "Community", "Social"],
            -121.4789,
            38.5709,
            "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900",
        ),
    ]
)

legacy_community_event_titles = {
    "Davis Farmers Market Picnic": "Community Event 11",
    "Arboretum Cleanup Crew": "Community Event 12",
    "Downtown Board Game Social": "Community Event 13",
    "Bike Repair Pop-Up": "Community Event 14",
    "Community Garden Workday": "Community Event 15",
    "Student Art Swap": "Community Event 16",
    "Sunset Yoga on the Quad": "Community Event 17",
    "Neighborhood Potluck": "Community Event 18",
    "Open Jam Session": "Community Event 19",
    "Mutual Aid Supply Drive": "Community Event 20",
}


def main() -> None:
    settings = get_settings()
    client = MongoClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client[settings.mongodb_db_name]

    for seed_event in events:
        query = {"title": seed_event["title"], "seeded": True}
        legacy_title = legacy_community_event_titles.get(seed_event["title"])
        if legacy_title is not None:
            query = {
                "seeded": True,
                "$or": [
                    {"title": seed_event["title"]},
                    {"title": legacy_title},
                ],
            }

        db.events.update_one(
            query,
            {"$set": seed_event},
            upsert=True,
        )

    print(f"Seeded {len(events)} events into {settings.mongodb_db_name}.events")


if __name__ == "__main__":
    main()
