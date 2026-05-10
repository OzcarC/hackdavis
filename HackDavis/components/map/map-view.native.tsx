import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import MapView, { Callout, Marker, Region } from "react-native-maps";

import { EventDetailsModal } from "@/components/ui/event-details-modal";
import type { Event } from "@/types/event";
import { API_BASE } from "../../constants/api";
import { flatButton, palette } from "../../constants/palette";
import { useEventsContext } from "@/context/events-context";

const TAG_BG = "#EEF2FF";
const TAG_TEXT = "#4F46E5";

const FALLBACK_REGION = {
  latitude: 38.5449,
  longitude: -121.7405,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

const TAG_COLORS: Record<string, string> = {
  Art: "#D946EF",
  Career: "#2563EB",
  Community: "#16A34A",
  Food: "#EA580C",
  Games: "#7C2D12",
  Hackathon: "#7C3AED",
  Music: "#DB2777",
  Networking: "#0891B2",
  Outdoors: "#15803D",
  Social: "#F59E0B",
  Sports: "#DC2626",
  Study: "#4F46E5",
  Volunteer: "#059669",
  Wellness: "#0D9488",
  Workshop: "#9333EA",
};

const markerColor = (event: Event) => {
  const firstTag = event.tags?.[0];
  return firstTag ? TAG_COLORS[firstTag] ?? palette.navy : palette.navy;
};

const TAG_EMOJIS: Record<string, string> = {
  Art: "🎨",
  Career: "💼",
  Community: "🏘️",
  Food: "🍽️",
  Games: "🎲",
  Hackathon: "💻",
  Music: "🎵",
  Networking: "🤝",
  Outdoors: "🌳",
  Social: "🎉",
  Sports: "⚽",
  Study: "📚",
  Volunteer: "🤲",
  Wellness: "🧘",
  Workshop: "🛠️",
};

const markerEmoji = (event: Event) => {
  const tag = event.tags?.find((eventTag) => TAG_EMOJIS[eventTag]);
  return tag ? TAG_EMOJIS[tag] : "📍";
};

const eventCoordinate = (event: Event) => {
  const [longitude, latitude] = event.location?.coordinates ?? [];

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
};

export default function MapScreen() {
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const { events, setEvents, updateEvent } = useEventsContext();
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailsEvent, setDetailsEvent] = useState<Event | null>(null);
  const nearbyEventLabel = eventsError
    ? eventsError
    : eventsLoading
    ? "Loading nearby events"
    : `${events.length} event${events.length === 1 ? "" : "s"} near you`;

  useEffect(() => {
    (async () => {
      try {
        // request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setInitialRegion(FALLBACK_REGION);
          return;
        }

        // get current position
        const location = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          8000,
          "Location lookup timed out."
        );
        setInitialRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch (error) {
        console.error(error);
        setInitialRegion(FALLBACK_REGION);
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialRegion) {
      return;
    }

    const fetchEvents = async () => {
      setEventsLoading(true);
      setEventsError(null);

      try {
        const params = new URLSearchParams({
          lat: String(initialRegion.latitude),
          lng: String(initialRegion.longitude),
          radius: "25000",
        });
        const response = await withTimeout(
          fetch(`${API_BASE}/api/events?${params.toString()}`),
          15000,
          "Events request timed out."
        );

        if (!response.ok) {
          throw new Error(
            `Events request failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as Event[];
        setEvents(data.filter((event) => eventCoordinate(event) !== null));
      } catch (error) {
        console.error(error);
        setEventsError("Could not load events.");
      } finally {
        setEventsLoading(false);
      }
    };

    fetchEvents();
  }, [initialRegion]);

  // show spinner while location loads
  if (!initialRegion) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.coral} size="large" />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        provider={Platform.OS === "android" ? "google" : undefined}
      >
        {events.map((event, index) => {
          const coordinate = eventCoordinate(event);

          if (!coordinate) {
            return null;
          }

          return (
            <Marker
              anchor={{ x: 0.5, y: 1 }}
              calloutAnchor={{ x: 0.5, y: 0 }}
              coordinate={coordinate}
              key={event.id ?? `${event.title}-${index}`}
              onPress={() => {
                if (Platform.OS === "android") {
                  setSelectedEvent(event);
                }
              }}
              tracksViewChanges={Platform.OS === "android"}
            >
              <View collapsable={false} style={styles.markerContainer}>
                <View
                  style={[
                    styles.markerBubble,
                    { borderColor: markerColor(event) },
                  ]}
                >
                  <Text style={styles.markerEmoji}>{markerEmoji(event)}</Text>
                </View>
                <View
                  style={[
                    styles.markerTail,
                    { borderTopColor: markerColor(event) },
                  ]}
                />
              </View>
              {Platform.OS !== "android" && (
                <Callout
                  onPress={() => setDetailsEvent(event)}
                  tooltip={false}
                  style={styles.calloutWrapper}
                >
                  <View collapsable={false} style={styles.callout}>
                    {event.thumbnail ? (
                      <Image
                        source={{ uri: event.thumbnail }}
                        style={styles.calloutImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.calloutImageFallback,
                          { backgroundColor: markerColor(event) },
                        ]}
                      >
                        <Text style={styles.calloutImageFallbackText}>
                          {markerEmoji(event)}
                        </Text>
                      </View>
                    )}
                    <Text numberOfLines={2} style={styles.calloutTitle}>
                      {event.title}
                    </Text>
                    {!!event.date?.when && (
                      <Text numberOfLines={1} style={styles.calloutText}>
                        {event.date.when}
                      </Text>
                    )}
                    {!!event.address?.length && (
                      <Text numberOfLines={2} style={styles.calloutText}>
                        {event.address.join(", ")}
                      </Text>
                    )}
                    {!!event.description && (
                      <Text numberOfLines={2} style={styles.calloutDescription}>
                        {event.description}
                      </Text>
                    )}
                    {!!event.tags?.length && (
                      <View style={styles.tagRow}>
                        {event.tags.slice(0, 2).map((tag) => (
                          <View key={tag} style={styles.tagPill}>
                            <Text style={styles.tagPillText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </Callout>
              )}
            </Marker>
          );
        })}
      </MapView>
      <View pointerEvents="none" style={styles.statusBadge}>
        {eventsLoading && (
          <ActivityIndicator color={palette.card} size="small" />
        )}
        <Text style={styles.statusBadgeText}>{nearbyEventLabel}</Text>
      </View>
      {Platform.OS === "android" && selectedEvent && (
        <View style={styles.androidPreview}>
          <TouchableOpacity
            accessibilityLabel="Close event preview"
            activeOpacity={0.75}
            onPress={() => setSelectedEvent(null)}
            style={styles.previewCloseButton}
          >
            <Text style={styles.previewCloseText}>×</Text>
          </TouchableOpacity>
          <View style={styles.previewContent}>
            {selectedEvent.thumbnail ? (
              <Image
                source={{ uri: selectedEvent.thumbnail }}
                style={styles.previewImage}
              />
            ) : (
              <View
                style={[
                  styles.previewImageFallback,
                  { backgroundColor: markerColor(selectedEvent) },
                ]}
              >
                <Text style={styles.previewImageFallbackText}>
                  {markerEmoji(selectedEvent)}
                </Text>
              </View>
            )}
            <View style={styles.previewBody}>
              <Text numberOfLines={2} style={styles.previewTitle}>
                {selectedEvent.title}
              </Text>
              {!!selectedEvent.date?.when && (
                <Text numberOfLines={1} style={styles.previewMeta}>
                  {selectedEvent.date.when}
                </Text>
              )}
              {!!selectedEvent.address?.length && (
                <Text numberOfLines={2} style={styles.previewMeta}>
                  {selectedEvent.address.join(", ")}
                </Text>
              )}
              {!!selectedEvent.description && (
                <Text numberOfLines={2} style={styles.previewDescription}>
                  {selectedEvent.description}
                </Text>
              )}
            </View>
          </View>
          {!!selectedEvent.tags?.length && (
            <View style={styles.previewTagRow}>
              {selectedEvent.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!selectedEvent.id}
            onPress={() => setDetailsEvent(selectedEvent)}
            style={styles.previewDetailsButton}
          >
            <Text style={styles.previewDetailsText}>View details</Text>
          </TouchableOpacity>
        </View>
      )}
      <EventDetailsModal
        event={detailsEvent}
        visible={detailsEvent !== null}
        onClose={() => setDetailsEvent(null)}
        onEventUpdate={(updated) => {
          setDetailsEvent(updated);
          setSelectedEvent(updated);
          updateEvent(updated);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { width: "100%", height: "100%" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: palette.bg,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  markerContainer: {
    alignItems: "center",
    height: 64,
    justifyContent: "flex-start",
    overflow: "visible",
    paddingTop: 4,
    width: 36,
  },
  markerBubble: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 2,
    elevation: 3,
    height: 40,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    width: 40,
  },
  markerEmoji: {
    includeFontPadding: false,
    fontSize: 19,
    lineHeight: 23,
    textAlign: "center",
  },
  markerTail: {
    alignSelf: "center",
    borderLeftColor: "transparent",
    borderLeftWidth: 5,
    borderRightColor: "transparent",
    borderRightWidth: 5,
    borderTopWidth: 7,
    height: 0,
    marginTop: -1,
    width: 0,
  },
  calloutWrapper: {
    width: 240,
  },
  callout: {
    width: 240,
    padding: 10,
  },
  calloutImage: {
    backgroundColor: palette.border,
    borderRadius: 8,
    height: 92,
    marginBottom: 8,
    width: "100%",
  },
  calloutImageFallback: {
    alignItems: "center",
    borderRadius: 8,
    height: 92,
    justifyContent: "center",
    marginBottom: 8,
    width: "100%",
  },
  calloutImageFallbackText: {
    color: palette.card,
    fontSize: 30,
    fontWeight: "700",
  },
  calloutText: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  calloutTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  calloutDescription: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tagPill: {
    backgroundColor: TAG_BG,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagPillText: {
    color: TAG_TEXT,
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(40, 57, 86, 0.86)",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: "absolute",
    top: 50,
  },
  statusBadgeText: {
    color: palette.card,
    fontSize: 16,
    fontWeight: "600",
  },
  androidPreview: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    bottom: 18,
    elevation: 8,
    left: 14,
    padding: 12,
    position: "absolute",
    right: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  previewCloseButton: {
    alignItems: "center",
    backgroundColor: "rgba(40, 57, 86, 0.72)",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    top: 8,
    width: 28,
    zIndex: 2,
  },
  previewCloseText: {
    color: palette.card,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
  previewContent: {
    flexDirection: "row",
    gap: 12,
  },
  previewImage: {
    backgroundColor: palette.border,
    borderRadius: 10,
    height: 96,
    width: 96,
  },
  previewImageFallback: {
    alignItems: "center",
    borderRadius: 10,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  previewImageFallbackText: {
    color: palette.card,
    fontSize: 34,
    fontWeight: "700",
  },
  previewBody: {
    flex: 1,
    paddingRight: 20,
  },
  previewTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  previewMeta: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  previewDescription: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  previewTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  previewDetailsButton: {
    alignItems: "center",
    backgroundColor: palette.coral,
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 44,
    ...flatButton("coral"),
  },
  previewDetailsText: {
    color: palette.card,
    fontSize: 14,
    fontWeight: "700",
  },
});
