import type { EventTag } from './event-tags';
import type { Event } from '@/types/event';

export const interestOptions = [
  'Chill',
  'Party',
  'Food',
  'Icebreaker',
  'Gaming',
  'Nature',
] as const;

export type Interest = (typeof interestOptions)[number];

export const interestToTags: Record<Interest, EventTag[]> = {
  Chill: ['Study', 'Community', 'Workshop', 'Food'],
  Party: ['Music', 'Social'],
  Food: ['Food'],
  Icebreaker: ['Networking', 'Career', 'Community', 'Social'],
  Gaming: ['Gaming', 'Hackathon', 'Social'],
  Nature: ['Outdoor', 'Sports', 'Volunteer'],
};

export const tagsForInterests = (interests: Interest[]): Set<EventTag> => {
  const tags = new Set<EventTag>();
  interests.forEach((interest) => {
    interestToTags[interest].forEach((tag) => tags.add(tag));
  });
  return tags;
};

export const filterEventsByInterests = (events: Event[], interests: Interest[]): Event[] => {
  if (interests.length === 0) {
    return events;
  }
  const matchingTags = tagsForInterests(interests);
  return events.filter((event) =>
    event.tags?.some((tag) => matchingTags.has(tag as EventTag))
  );
};
