import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE } from "@/constants/api";
import { colorForTag, flatButton, palette } from "@/constants/palette";
import { auth } from "../../firebase";

type Attendee = {
  uid: string;
  display_name?: string | null;
  photo?: string | null;
};

type UserProfile = {
  uid: string;
  email?: string | null;
  display_name?: string | null;
  photo?: string | null;
};

type Event = {
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
  author?: string | null;
  attendees?: Attendee[];
};

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRsvp, setSavingRsvp] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReasonModalOpen, setCancelReasonModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rsvpCooldown, setRsvpCooldown] = useState(0);

  const user = auth.currentUser;

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/events/${id}`);
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        const data = (await response.json()) as Event;
        setEvent(data);
      } catch (error) {
        console.error(error);
        Alert.alert("Event unavailable", "Could not load this event.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/users/${user.uid}`);
        if (response.status === 404) {
          setProfile(null);
          return;
        }
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        const data = (await response.json()) as UserProfile;
        setProfile(data);
      } catch (error) {
        console.error(error);
        setProfile(null);
      }
    };

    fetchProfile();
  }, [user]);

  const isAttending = event?.attendees?.some(
    (attendee) => attendee.uid === user?.uid
  );
  const isAuthor = !!user && !!event?.author && event.author === user.uid;

  const handleCancelEvent = () => {
    setCancelReasonModalOpen(true);
  };

  const submitCancellation = async () => {
    if (!event?.id || !user || !cancelReason.trim()) {
      Alert.alert("Required", "Please provide a reason for cancellation.");
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/events/${event.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            reason: cancelReason.trim(),
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      setCancelReasonModalOpen(false);
      Alert.alert("Event cancelled", "You've cancelled this event.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Could not cancel", "Try again in a moment.");
      setCancelling(false);
    }
  };

  const toggleRsvp = async () => {
    if (!event?.id || !user) {
      Alert.alert("Not signed in", "Log in before RSVPing to an event.");
      return;
    }

    if (isAttending) {
      Alert.prompt(
        "Why are you cancelling your RSVP?",
        "Let the organizer know...",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Cancel RSVP",
            style: "destructive",
            onPress: async (reason) => {
              setSavingRsvp(true);
              try {
                const response = await fetch(
                  `${API_BASE}/api/events/${event.id}/rsvp/${user.uid}`,
                  { method: "DELETE" }
                );

                if (!response.ok) {
                  throw new Error(`Status ${response.status}`);
                }

                const updated = (await response.json()) as Event;
                setEvent(updated);
                setRsvpCooldown(10);
                const interval = setInterval(() => {
                  setRsvpCooldown((prev) => {
                    if (prev <= 1) {
                      clearInterval(interval);
                      return 0;
                    }
                    return prev - 1;
                  });
                }, 1000);
              } catch (error) {
                console.error(error);
                Alert.alert("RSVP failed", "Please try again in a moment.");
              } finally {
                setSavingRsvp(false);
              }
            },
          },
        ]
      );
      return;
    }

    setSavingRsvp(true);
    try {
      const response = await fetch(`${API_BASE}/api/events/${event.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          display_name:
            profile?.display_name ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "Anonymous",
          photo: profile?.photo ?? user.photoURL,
        }),
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const updated = (await response.json()) as Event;
      setEvent(updated);
    } catch (error) {
      console.error(error);
      Alert.alert("RSVP failed", "Please try again in a moment.");
    } finally {
      setSavingRsvp(false);
    }
  };

  const openEventLink = async () => {
    if (!event?.link) {
      return;
    }

    const canOpen = await Linking.canOpenURL(event.link);
    if (canOpen) {
      await Linking.openURL(event.link);
    }
  };

  return (
    <Stack.Screen options={{ headerShown: false }}>
      <SafeAreaView style={styles.safe}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.coral} size="large" />
        </View>
      ) : event ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.titleRow}>
              <View style={[styles.titleStripe, { backgroundColor: palette.navy }]} />
              <Text style={styles.pageTitle}>{event.title}</Text>
            </View>
            {event.thumbnail ? (
            <Image source={{ uri: event.thumbnail }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroFallbackText}>Event</Text>
            </View>
          )}

          <View style={styles.body}>
            {!!event.date?.when && (
              <Text style={styles.when}>{event.date.when}</Text>
            )}
            {!!event.address?.length && (
              <Text style={styles.address}>{event.address.join(", ")}</Text>
            )}

            {!!event.tags?.length && (
              <View style={styles.tagRow}>
                {event.tags.map((tag) => (
                  <View
                    key={tag}
                    style={[styles.tagPill, { backgroundColor: colorForTag(tag) }]}
                  >
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.description}>
              {event.description || "No description has been added for this event."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {event.attendees?.length ?? 0} Going
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={savingRsvp}
              onPress={toggleRsvp}
              style={[styles.rsvpButton, isAttending && styles.rsvpButtonActive]}
            >
              <Text
                style={[
                  styles.rsvpButtonText,
                  isAttending && styles.rsvpButtonTextActive,
                ]}
              >
                {savingRsvp ? "Saving..." : isAttending ? "I'm going" : "RSVP"}
              </Text>
            </TouchableOpacity>

            {!!event.attendees?.length && (
              <View style={styles.attendeeList}>
                {event.attendees.map((attendee) => (
                  <View key={attendee.uid} style={styles.attendeeRow}>
                    {attendee.photo ? (
                      <Image
                        source={{ uri: attendee.photo }}
                        style={styles.attendeeAvatar}
                      />
                    ) : (
                      <View style={styles.attendeeAvatarFallback}>
                        <Text style={styles.attendeeInitial}>
                          {(attendee.display_name ?? "?").charAt(0)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.attendeeName}>
                      {attendee.display_name ?? "Anonymous"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {!!event.link && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openEventLink}
              style={styles.linkButton}
            >
              <Text style={styles.linkButtonText}>Open event link</Text>
            </TouchableOpacity>
          )}

          {isAuthor && (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={cancelling}
              onPress={handleCancelEvent}
              style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
            >
              <Text style={styles.cancelButtonText}>
                {cancelling ? "Cancelling..." : "Cancel event"}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

          {cancelReasonModalOpen && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Why are you cancelling?</Text>
                <TextInput
                  multiline
                  numberOfLines={4}
                  placeholder="Let attendees know why..."
                  placeholderTextColor={palette.textMuted}
                  style={styles.reasonInput}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setCancelReasonModalOpen(false);
                      setCancelReason("");
                    }}
                    style={styles.modalCancel}
                  >
                    <Text style={styles.modalCancelText}>Keep it</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={cancelling || !cancelReason.trim()}
                    onPress={submitCancellation}
                    style={[styles.modalSubmit, (!cancelReason.trim() || cancelling) && styles.modalSubmitDisabled]}
                  >
                    <Text style={styles.modalSubmitText}>
                      {cancelling ? "Cancelling..." : "Cancel event"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Event not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.notFoundBackButton}>
            <Text style={styles.notFoundBackButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
    </Stack.Screen>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  titleStripe: {
    width: 5,
    borderRadius: 3,
    height: 32,
  },
  pageTitle: {
    color: palette.navy,
    fontSize: 28,
    fontWeight: "700",
    flex: 1,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  content: {
    gap: 18,
    padding: 16,
    paddingBottom: 36,
  },
  heroImage: {
    backgroundColor: palette.border,
    borderRadius: 14,
    height: 230,
    width: "100%",
  },
  heroFallback: {
    alignItems: "center",
    backgroundColor: palette.coral,
    borderRadius: 14,
    height: 230,
    justifyContent: "center",
    width: "100%",
  },
  heroFallbackText: {
    color: palette.card,
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    gap: 8,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
  },
  when: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: "700",
  },
  address: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  tagPill: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    color: palette.card,
    fontSize: 12,
    fontWeight: "700",
  },
  description: {
    color: palette.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  rsvpButton: {
    alignItems: "center",
    backgroundColor: palette.coral,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
    ...flatButton('coral'),
  },
  rsvpButtonActive: {
    backgroundColor: palette.navy,
    ...flatButton('navy'),
  },
  rsvpButtonText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: "700",
  },
  rsvpButtonTextActive: {
    color: palette.card,
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
  attendeeAvatarFallback: {
    alignItems: "center",
    backgroundColor: palette.border,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  attendeeInitial: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: "700",
  },
  attendeeName: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
  linkButton: {
    alignItems: "center",
    backgroundColor: palette.navy,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 48,
  },
  linkButtonText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.coral,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 48,
    ...flatButton('coral'),
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 10,
  },
  modalContent: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  reasonInput: {
    backgroundColor: palette.bg,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    color: palette.textPrimary,
    padding: 12,
    fontSize: 15,
    maxHeight: 120,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    alignItems: "center",
    backgroundColor: palette.bg,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
  },
  modalCancelText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  modalSubmit: {
    flex: 1,
    alignItems: "center",
    backgroundColor: palette.coral,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
  },
  modalSubmitDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  notFoundBackButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  notFoundBackButtonText: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: "700",
  },
});
