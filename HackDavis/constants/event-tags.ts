export const eventTagOptions = [
  'Art',
  'Career',
  'Community',
  'Fitness',
  'Food',
  'Gaming',
  'Hackathon',
  'Health',
  'Music',
  'Networking',
  'Outdoor',
  'Photography',
  'Professional',
  'Social',
  'Sports',
  'Study',
  'Tech',
  'Volunteer',
  'Wellness',
  'Workshop',
] as const;

export type EventTag = (typeof eventTagOptions)[number];
