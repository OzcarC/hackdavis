import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE } from '@/constants/api';

type Event = {
  id?: string;
  title: string;
  date?: {
    start_date?: string | null;
    when?: string | null;
  } | null;
  address?: string[];
  link: string;
  thumbnail?: string | null;
  description?: string | null;
};

const filters = [
  { label: 'Today', value: 'date:today' },
  { label: 'This week', value: 'date:week' },
  { label: 'This month', value: 'date:month' },
  { label: 'Online', value: 'event_type:Virtual-Event' },
];

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('date:week');

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          query: 'events near me',
          location: 'New York, NY',
          date: filter,
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
  }, [filter]);

  const openEvent = async (link: string) => {
    const canOpen = await Linking.canOpenURL(link);

    if (canOpen) {
      await Linking.openURL(link);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>Events</Text>
        <Text style={styles.subheading}>Find nearby events from Google Events.</Text>
      </View>

      <View style={styles.chips}>
        {filters.map((item) => (
          <TouchableOpacity
            activeOpacity={0.8}
            key={item.value}
            onPress={() => setFilter(item.value)}
            style={[styles.chip, filter === item.value && styles.chipActive]}>
            <Text style={[styles.chipText, filter === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#6366F1" style={styles.loader} />
      ) : error ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>Unable to load events</Text>
          <Text style={styles.messageText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={events}
          keyExtractor={(item, index) => item.id ?? item.link ?? String(index)}
          ListEmptyComponent={
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>No events found</Text>
              <Text style={styles.messageText}>Try another date filter.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openEvent(item.link)}
              style={styles.card}>
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Text style={styles.thumbPlaceholderText}>Event</Text>
                </View>
              )}

              <View style={styles.info}>
                <Text numberOfLines={2} style={styles.title}>
                  {item.title}
                </Text>
                {!!item.date?.when && <Text style={styles.when}>{item.date.when}</Text>}
                {!!item.address?.length && (
                  <Text numberOfLines={1} style={styles.address}>
                    {item.address.join(', ')}
                  </Text>
                )}
                {!!item.description && (
                  <Text numberOfLines={2} style={styles.desc}>
                    {item.description}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#F9FAFB',
    flex: 1,
  },
  header: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heading: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
  },
  subheading: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  chip: {
    backgroundColor: '#fff',
    borderColor: '#E5E7EB',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  chipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  loader: {
    marginTop: 40,
  },
  list: {
    gap: 12,
    padding: 16,
    paddingTop: 0,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#F3F4F6',
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  thumb: {
    backgroundColor: '#E5E7EB',
    height: 90,
    width: 90,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    height: 90,
    justifyContent: 'center',
    width: 90,
  },
  thumbPlaceholderText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 3,
    padding: 12,
  },
  title: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  when: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '500',
  },
  address: {
    color: '#6B7280',
    fontSize: 12,
  },
  desc: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  messageBox: {
    margin: 16,
    paddingVertical: 28,
  },
  messageTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  messageText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
});
