import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { API_BASE } from '@/constants/api';
import type { Event } from '@/types/event';

export const FALLBACK_LOCATION = 'Davis, CA';
export const FALLBACK_COORDS = {
  latitude: 38.5449,
  longitude: -121.7405,
};

type Coords = {
  latitude: number;
  longitude: number;
};

type Options = {
  dateFilter?: string;
  radiusMeters?: number;
};

type Result = {
  events: Event[];
  loading: boolean;
  error: string | null;
  location: string;
  coordinates: Coords;
  locationLoading: boolean;
  reload: () => void;
};

export const useEvents = ({ dateFilter = 'date:week', radiusMeters = 25000 }: Options = {}): Result => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [coordinates, setCoordinates] = useState<Coords>(FALLBACK_COORDS);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const resolveUserLocation = async () => {
      setLocationLoading(true);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          setLocation(FALLBACK_LOCATION);
          setCoordinates(FALLBACK_COORDS);
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoordinates({
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
        });

        const [place] = await Location.reverseGeocodeAsync(currentPosition.coords);
        const city = place?.city ?? place?.subregion ?? place?.district;
        const region = place?.region;

        if (city && region) {
          setLocation(`${city}, ${region}`);
        } else {
          setLocation(FALLBACK_LOCATION);
        }
      } catch (locationError) {
        console.error(locationError);
        setLocation(FALLBACK_LOCATION);
        setCoordinates(FALLBACK_COORDS);
      } finally {
        setLocationLoading(false);
      }
    };

    resolveUserLocation();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      if (locationLoading) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          query: 'events near me',
          location,
          lat: String(coordinates.latitude),
          lng: String(coordinates.longitude),
          radius: String(radiusMeters),
          date: dateFilter,
        });
        const eventsUrl = `${API_BASE}/api/events?${params.toString()}`;
        console.log(`Fetching events from ${eventsUrl}`);

        const response = await fetch(eventsUrl);

        if (!response.ok) {
          throw new Error(`Events request failed with status ${response.status}`);
        }

        const data = (await response.json()) as Event[];
        setEvents(data);
      } catch (eventError) {
        console.error(eventError);
        setError(`Could not load events from ${API_BASE}. Check that the backend is running.`);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [coordinates.latitude, coordinates.longitude, location, dateFilter, radiusMeters, locationLoading, reloadToken]);

  return {
    events,
    loading,
    error,
    location,
    coordinates,
    locationLoading,
    reload: () => setReloadToken((token) => token + 1),
  };
};
