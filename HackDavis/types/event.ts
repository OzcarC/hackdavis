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
  location?: {
    type: 'Point';
    coordinates: number[];
  } | null;
};
