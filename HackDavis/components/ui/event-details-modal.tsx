import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE } from "@/constants/api";
import {
  colorForTag,
  flatButton,
  flatOutline,
  palette,
} from "@/constants/palette";
import type { Event } from "@/types/event";
import { auth } from "../../firebase";

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

export function EventDetailsModal({
  event,
  visible,
  onClose,
  onEventUpdate,
}: Props) {
  const [currentEvent, setCurrentEvent] = useState<Event | null>(event);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rsvpSaving, setRsvpSaving] = useState(false);

  const user = auth.currentUser;
  const currentUid = user?.uid;
  const isAttending = !!currentEvent?.attendees?.some(
    (a) => a.uid === currentUid
  );

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

  useEffect(() => {
    if (!visible || !event?.id) return;

    let cancelled = false;

    const fetchEvent = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/events/${event.id}`);
        if (!cancelled && res.ok) {
          const freshEvent = await res.json();
          setCurrentEvent(freshEvent);
          onEventUpdate?.(freshEvent);
        }
      } catch (e) {
        console.error("Failed to refresh event", e);
      }
    };

    fetchEvent();

    return () => {
      cancelled = true;
    };
  }, [visible, event?.id]);

  useEffect(() => {
    if (!visible || !event?.id) return;

    const interval = setInterval(async () => {
      const res = await fetch(`${API_BASE}/api/events/${event.id}`);
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        onEventUpdate?.(updated);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [visible, event?.id]);

  const handleRsvp = async () => {
    if (!currentUid || !currentEvent?.id) return;

    setRsvpSaving(true);
    const displayName =
      profile?.display_name ||
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Anonymous";

    try {
      if (isAttending) {
        const res = await fetch(
          `${API_BASE}/api/events/${currentEvent.id}/rsvp/${currentUid}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          const updated = (await res.json()) as Event;
          setCurrentEvent(updated);
          onEventUpdate?.(updated);
        }
      } else {
        const res = await fetch(
          `${API_BASE}/api/events/${currentEvent.id}/rsvp`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: currentUid,
              display_name: displayName,
              photo: profile?.photo ?? user?.photoURL,
            }),
          }
        );
        if (res.ok) {
          const updated = (await res.json()) as Event;
          setCurrentEvent(updated);
          onEventUpdate?.(updated);
        }
      }
    } finally {
      setRsvpSaving(false);
    }
  };

  const openEventLink = async () => {
    if (!currentEvent?.link) return;
    if (await Linking.canOpenURL(currentEvent.link)) {
      await Linking.openURL(currentEvent.link);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
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
              {!!currentEvent.date?.when && (
                <Text style={styles.detailWhen}>{currentEvent.date.when}</Text>
              )}
              <Text style={styles.detailTitle}>{currentEvent.title}</Text>
              {!!currentEvent.address?.length && (
                <Text style={styles.detailAddress}>
                  {currentEvent.address.join(", ")}
                </Text>
              )}
              {!!currentEvent.tags?.length && (
                <View style={styles.detailTags}>
                  {currentEvent.tags.map((tag) => (
                    <View
                      key={tag}
                      style={[
                        styles.tagPill,
                        { backgroundColor: colorForTag(tag) },
                      ]}
                    >
                      <Text style={styles.tagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.detailDescription}>
                {currentEvent.description ||
                  "No description has been added for this event."}
              </Text>
            </View>

            <View style={styles.attendeesSection}>
              <View>
                <Text style={styles.attendeesSectionTitle}>
                  {currentEvent.attendees?.length ?? 0} Going
                </Text>
                <Text style={styles.attendeesSectionSubtitle}>
                  RSVP to keep your profile events in sync.
                </Text>
              </View>

              <TouchableOpacity
                disabled={rsvpSaving || !currentUid || !currentEvent.id}
                onPress={handleRsvp}
                style={[
                  styles.rsvpButton,
                  isAttending && styles.rsvpButtonActive,
                  (rsvpSaving || !currentUid || !currentEvent.id) &&
                    styles.rsvpButtonDisabled,
                ]}
                activeOpacity={0.85}
              >
                {rsvpSaving ? (
                  <ActivityIndicator
                    color={isAttending ? "#FFFFFF" : palette.coral}
                  />
                ) : (
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      isAttending && styles.rsvpButtonTextActive,
                    ]}
                  >
                    {isAttending ? "✓ I'm going" : "RSVP"}
                  </Text>
                )}
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
                            {a.display_name?.[0] ?? "?"}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.attendeeName}>
                        {a.display_name ?? "Anonymous"}
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
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  detailContent: {
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  detailImage: {
    backgroundColor: palette.border,
    borderRadius: 16,
    height: 220,
    width: "100%",
  },
  detailImagePlaceholder: {
    alignItems: "center",
    backgroundColor: palette.coral,
    borderRadius: 16,
    height: 220,
    justifyContent: "center",
    width: "100%",
  },
  detailImagePlaceholderText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  detailBody: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  detailTitle: {
    color: palette.textPrimary,
    fontSize: 25,
    fontWeight: "800",
  },
  detailWhen: {
    alignSelf: "flex-start",
    color: palette.coral,
    fontSize: 13,
    fontWeight: "800",
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  tagPill: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  attendeesSection: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  attendeesSectionTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  attendeesSectionSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  rsvpButton: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.coral,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: "center",
    ...flatOutline,
  },
  rsvpButtonActive: {
    backgroundColor: palette.coral,
    ...flatButton("coral"),
  },
  rsvpButtonDisabled: {
    opacity: 0.65,
  },
  rsvpButtonText: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: "800",
  },
  rsvpButtonTextActive: {
    color: "#fff",
  },
  attendeeList: {
    gap: 10,
  },
  attendeeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  attendeeAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  attendeeAvatarPlaceholder: {
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  attendeeAvatarText: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: "700",
  },
  attendeeName: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
  detailLinkButton: {
    alignItems: "center",
    backgroundColor: palette.coral,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
    ...flatButton("coral"),
  },
  detailLinkButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  detailCloseButton: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: "center",
    ...flatOutline,
  },
  detailCloseButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
});
