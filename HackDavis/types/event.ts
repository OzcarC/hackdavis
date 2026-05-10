export type Attendee = {
  uid: string;
  display_name?: string | null;
  photo?: string | null;
};

export type Event = {
  id?: string;
  title: string;
  date?: {
    start_date?: string | null;
    when?: string | null;
  } | null;
  address?: string[];
  link?: string | null;
  thumbnail?: string | null;
  description?: string | null;
  tags?: string[];
  source?: string;
  author?: string | null;
  location?: {
    type: 'Point';
    coordinates: number[];
  } | null;
  attendees?: Attendee[];
};
