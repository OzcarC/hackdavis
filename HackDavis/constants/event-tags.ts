export const eventTagOptions = [
  'Career',
  'Community',
  'Food',
  'Gaming',
  'Hackathon',
  'Music',
  'Networking',
  'Outdoor',
  'Social',
  'Sports',
  'Study',
  'Volunteer',
  'Workshop',
] as const;

export type EventTag = (typeof eventTagOptions)[number];
