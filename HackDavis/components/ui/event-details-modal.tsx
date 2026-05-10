import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE } from '@/constants/api';
import { colorForTag, flatButton, flatOutline, palette } from '@/constants/palette';
import { auth } from '../../firebase';

type Attendee = {
  uid: string;
  display_name?: string | null;
  photo?: string | null;
};

type Event = {
  id?: string;
  title: string;
  date?: { start_date?: string | null; when?: string | null } | null;
  address?: string[];
  link?: string | null;
  thumbnail?: string | null;
  description?: string | null;
  tags?: string[];
  author?: string | null;
  attendees?: Attendee[];
};

type UserProfile = {
  uid: string;
  email?: string | null;
  display_name?: string | null;
  photo?: string | null;
};

type Props = {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  onEventUpdate?: (event: Event) => void;
};

export function EventDetailsModal({ event, visible, onClose, onEventUpdate }: Props) {
  const [currentEvent, setCurrentEvent] = useState<Event | null>(event);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const user = auth.currentUser;
  const currentUid = user?.uid;
  const isAttending = !!currentEvent?.attendees?.some((a) => a.uid === currentUid);

  // Sync incoming prop -> local copy when a new event is opened
  useEffect(() => {
    setCurrentEvent(event);
  }, [event?.id]);

  // Load profile for RSVP display name / photo
  useEffect(() => {
    if (!user || !visible) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/users/${user.uid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, visible]);

  const handleRsvp = async () => {
    if (!currentUid || !currentEvent?.id) return;

    const displayName =
      profile?.display_name ||
      user?.displayName ||
      user?.email?.split('@')[0] ||
      'Anonymous';

    if (isAttending) {
      const res = await fetch(
        `${API_BASE}/api/events/${currentEvent.id}/rsvp/${currentUid}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        const updated = (await res.json()) as Event;
        setCurrentEvent(updated);
        onEventUpdate?.(updated);
      }
    } else {
      const res = await fetch(`${API_BASE}/api/events/${currentEvent.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUid,
          display_name: displayName,
          photo: profile?.photo ?? user?.photoURL,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Event;
        setCurrentEvent(updated);
        onEventUpdate?.(updated);
      }
    }
  };

  const openEventLink = async () => {
    if (!currentEvent?.link) return;
    if (await Linking.canOpenURL(currentEvent.link)) {
      await Linking.openURL(currentEvent.link);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      visible={visible}
    >
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Event Details</Text>
        </View>

        {currentEvent && (
          <ScrollView contentContainerStyle={styles.detailContent}>
            {currentEvent.thumbnail ? (
              <Image
                source={{ uri: currentEvent.thumbnail }}
                style={styles.detailImage}
              />
            ) : (
              <View style={styles.detailImagePlaceholder}>
                <Text style={styles.detailImagePlaceholderText}>Event</Text>
              </View>
            )}

            <View style={styles.detailBody}>
              <Text style={styles.detailTitle}>{currentEvent.title}</Text>
              {!!currentEvent.date?.when && (
                <Text style={styles.detailWhen}>{currentEvent.date.when}</Text>
              )}
              {!!currentEvent.address?.length && (
                <Text style={styles.detailAddress}>
                  {currentEvent.address.join(', ')}
                </Text>
              )}
              {!!currentEvent.tags?.length && (
                <View style={styles.detailTags}>
                  {currentEvent.tags.map((tag) => (
                    <View
                      key={tag}
                      style={[styles.tagPill, { backgroundColor: colorForTag(tag) }]}
                    >
                      <Text style={styles.tagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.detailDescription}>
                {currentEvent.description ||
                  'No description has been added for this event.'}
              </Text>
            </View>

            {/* Attendees section */}
            <View style={styles.attendeesSection}>
              <Text style={styles.attendeesSectionTitle}>
                {currentEvent.attendees?.length ?? 0} Going
              </Text>

              <TouchableOpacity
                onPress={handleRsvp}
                style={[
                  styles.rsvpButton,
                  isAttending && styles.rsvpButtonActive,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.rsvpButtonText,
                    isAttending && styles.rsvpButtonTextActive,
                  ]}
                >
                  {isAttending ? "✓ I'm going" : 'RSVP'}
                </Text>
              </TouchableOpacity>

              {!!currentEvent.attendees?.length && (
                <View style={styles.attendeeList}>
                  {currentEvent.attendees.map((a) => (
                    <View key={a.uid} style={styles.attendeeRow}>
                      {a.photo ? (
                        <Image
                          source={{ uri: a.photo }}
                          style={styles.attendeeAvatar}
                        />
                      ) : (
                        <View style={styles.attendeeAvatarPlaceholder}>
                          <Text style={styles.attendeeAvatarText}>
                            {a.display_name?.[0] ?? '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.attendeeName}>
                        {a.display_name ?? 'Anonymous'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {!!currentEvent.link && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openEventLink}
                style={styles.detailLinkButton}
              >
                <Text style={styles.detailLinkButtonText}>Open event link</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClose}
              style={styles.detailCloseButton}
            >
              <Text style={styles.detailCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafe: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  detailContent: {
    padding: 16,
    gap: 16,
  },
  detailImage: {
    backgroundColor: palette.border,
    borderRadius: 14,
    height: 220,
    width: '100%',
  },
  detailImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 14,
    height: 220,
    justifyContent: 'center',
    width: '100%',
  },
  detailImagePlaceholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailBody: {
    gap: 8,
  },
  detailTitle: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  detailWhen: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: '700',
  },
  detailAddress: {
    color: palette.textMuted,
    fontSize: 14,
  },
  detailDescription: {
    color: palette.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  detailTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagPill: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  attendeesSection: {
    gap: 12,
  },
  attendeesSectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  rsvpButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#6366F1',
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: 'center',
  },
  rsvpButtonActive: {
    backgroundColor: '#6366F1',
  },
  rsvpButtonText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '700',
  },
  rsvpButtonTextActive: {
    color: '#fff',
  },
  attendeeList: {
    gap: 10,
  },
  attendeeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  attendeeAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  attendeeAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  attendeeAvatarText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '700',
  },
  attendeeName: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  detailLinkButton: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    ...flatButton('coral'),
  },
  detailLinkButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  detailCloseButton: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: 'center',
    ...flatOutline,
  },
  detailCloseButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});