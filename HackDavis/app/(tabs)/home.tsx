import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { EventDetailsModal } from '@/components/ui/event-details-modal';
import { fallbackEvents } from '@/constants/fallback-events';
import { filterEventsByInterests, type Interest } from '@/constants/interests';
import { flatButton, palette } from '@/constants/palette';
import { useEvents } from '@/hooks/use-events';
import type { Event } from '@/types/event';

const userInterests: Interest[] = ['Chill', 'Gaming', 'Food'];

const FOR_YOU_LIMIT = 5;
const HAPPENING_LIMIT = 6;

export default function HomeScreen() {
  const router = useRouter();
  const { events, loading, location } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const displayEvents = events.length > 0 ? events : fallbackEvents;
  const forYouAll = filterEventsByInterests(displayEvents, userInterests);
  const forYouTop = forYouAll.slice(0, FOR_YOU_LIMIT);
  const happeningTop = displayEvents.slice(0, HAPPENING_LIMIT);
  const hasMoreHappening = displayEvents.length > HAPPENING_LIMIT;

  const goToEvents = () => router.push('/(tabs)/events');
  const openEventModal = (event: Event) => setSelectedEvent(event);
  const closeEventModal = () => setSelectedEvent(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hey there</Text>
          <Text style={styles.location}>Events around {location}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={palette.coral} style={styles.loader} />
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={[styles.sectionStripe, { backgroundColor: palette.coral }]} />
                <View style={styles.sectionBody}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>For You</Text>
                    <Text style={styles.sectionSubtitle}>
                      Based on {userInterests.join(' · ')}
                    </Text>
                  </View>

                  {forYouTop.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>No matches yet</Text>
                      <Text style={styles.emptyText}>
                        No events match your interests right now. Browse all events below.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.cardStack}>
                      {forYouTop.map((event, index) => (
                        <EventCard
                          key={event.id ?? event.link ?? `for-you-${index}`}
                          event={event}
                          onPress={openEventModal}
                        />
                      ))}

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={goToEvents}
                        style={styles.viewMoreButton}>
                        <Text style={styles.viewMoreButtonText}>View more for you</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={[styles.sectionStripe, { backgroundColor: palette.peach }]} />
                <View style={styles.sectionBody}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      Happening in {location.split(',')[0]}
                    </Text>
                    <Text style={styles.sectionSubtitle}>All events near you</Text>
                  </View>

                  <View style={styles.cardStack}>
                    {happeningTop.map((event, index) => (
                      <EventCard
                        key={event.id ?? event.link ?? `area-${index}`}
                        event={event}
                        onPress={openEventModal}
                      />
                    ))}

                    {hasMoreHappening && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={goToEvents}
                        style={styles.viewAllButton}>
                        <Text style={styles.viewAllButtonText}>
                          View all {displayEvents.length} events
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <EventDetailsModal
        event={selectedEvent}
        visible={!!selectedEvent}
        onClose={closeEventModal}
        onEventUpdate={(updated) => setSelectedEvent(updated)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  scroll: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  greeting: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  location: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  loader: {
    marginTop: 40,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionStripe: {
    width: 5,
    borderRadius: 3,
  },
  sectionBody: {
    flex: 1,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  cardStack: {
    gap: 12,
  },
  viewMoreButton: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 8,
    ...flatButton('coral'),
  },
  viewMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  viewAllButton: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.peach,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 8,
    ...flatButton('peach'),
  },
  viewAllButtonText: {
    color: palette.peach,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
