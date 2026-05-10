import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase";
import { API_BASE } from "@/constants/api";
import { colorForTag, flatButton, flatOutline, palette } from '@/constants/palette';

const FALLBACK_LOCATION = "Davis, CA";
const FALLBACK_COORDS = {
  latitude: 38.5449,
  longitude: -121.7405,
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
  source?: string;
  author?: string | null;
  location?: {
    type: "Point";
    coordinates: number[];
  } | null;
  attendees?: Attendee[];
};

const eventTagOptions = [
  "Career",
  "Community",
  "Food",
  "Hackathon",
  "Music",
  "Networking",
  "Social",
  "Sports",
  "Study",
  "Volunteer",
  "Workshop",
];

const filters = [
  { label: "Today", value: "date:today" },
  { label: "This week", value: "date:week" },
  { label: "This month", value: "date:month" },
  { label: "Online", value: "event_type:Virtual-Event" },
];

const pad2 = (value: number) => String(value).padStart(2, "0");

const dateInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const defaultEventDate = () => dateInputValue(new Date());

const calendarMonthValue = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const calendarDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);

const calendarDaysForMonth = (date: Date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();
  const days: (Date | null)[] = Array.from(
    { length: firstDay.getDay() },
    () => null
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(date.getFullYear(), date.getMonth(), day));
  }

  return days;
};

type Meridiem = "AM" | "PM";

const parseEventDateTime = (
  dateValue: string,
  timeValue: string,
  meridiem: Meridiem
) => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hour12 = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (hour12 < 1 || hour12 > 12 || minutes > 59) {
    return null;
  }

  const hours =
    meridiem === "AM" ? hour12 % 12 : hour12 === 12 ? 12 : hour12 + 12;
  const parsed = new Date(year, monthIndex, day, hours, minutes);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const formatEventWhen = (date: Date) => {
  const datePart = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${datePart} · ${timePart}`;
};

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("date:week");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [eventLocation, setEventLocation] = useState(FALLBACK_LOCATION);
  const [eventCoordinates, setEventCoordinates] = useState(FALLBACK_COORDS);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationSearching, setLocationSearching] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(defaultEventDate);
  const [newTime, setNewTime] = useState("6:00");
  const [newMeridiem, setNewMeridiem] = useState<Meridiem>("PM");
  const [calendarMonth, setCalendarMonth] = useState(() =>
    calendarMonthValue(new Date())
  );
  const [newAddress, setNewAddress] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newThumbnail, setNewThumbnail] = useState<string | null>(null);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(
    null
  );

  const currentUser = auth.currentUser;
  const calendarDays = calendarDaysForMonth(calendarMonth);

  useEffect(() => {
    const fetchCurrentProfile = async () => {
      if (!currentUser) {
        setCurrentProfile(null);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/users/${currentUser.uid}`);
        if (response.status === 404) {
          setCurrentProfile(null);
          return;
        }
        if (!response.ok) {
          throw new Error(`Profile request failed with status ${response.status}`);
        }

        const data = (await response.json()) as UserProfile;
        setCurrentProfile(data);
      } catch (profileError) {
        console.error(profileError);
        setCurrentProfile(null);
      }
    };

    fetchCurrentProfile();
  }, [currentUser]);

  useEffect(() => {
    const resolveUserLocation = async () => {
      setLocationLoading(true);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          setEventLocation(FALLBACK_LOCATION);
          setEventCoordinates(FALLBACK_COORDS);
          return;
        }

        const currentPosition = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          8000,
          "Location lookup timed out."
        );
        setEventCoordinates({
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
        });

        const [place] = await withTimeout(
          Location.reverseGeocodeAsync(currentPosition.coords),
          8000,
          "Reverse geocoding timed out."
        );
        const city = place?.city ?? place?.subregion ?? place?.district;
        const region = place?.region;

        if (city && region) {
          setEventLocation(`${city}, ${region}`);
        } else {
          setEventLocation(FALLBACK_LOCATION);
        }
      } catch (locationError) {
        console.error(locationError);
        setEventLocation(FALLBACK_LOCATION);
        setEventCoordinates(FALLBACK_COORDS);
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
          lat: String(eventCoordinates.latitude),
          lng: String(eventCoordinates.longitude),
          radius: "25000",
        });
        const eventsUrl = `${API_BASE}/api/events?${params.toString()}`;
        console.log(`Fetching events from ${eventsUrl}`);

        const response = await withTimeout(
          fetch(eventsUrl),
          15000,
          "Events request timed out."
        );

        if (!response.ok) {
          throw new Error(
            `Events request failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as Event[];
        setEvents(data);
      } catch (eventError) {
        console.error(eventError);
        setError(
          `Could not load events from ${API_BASE}. Check that the backend is running.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [
    eventCoordinates.latitude,
    eventCoordinates.longitude,
    eventLocation,
    filter,
    locationLoading,
    refreshKey,
  ]);

  const resetCreateForm = () => {
    const defaultDate = new Date();

    setNewTitle("");
    setNewDate(dateInputValue(defaultDate));
    setNewTime("6:00");
    setNewMeridiem("PM");
    setCalendarMonth(calendarMonthValue(defaultDate));
    setNewAddress("");
    setNewDescription("");
    setNewThumbnail(null);
    setNewTags([]);
  };

  const toggleNewTag = (tag: string) => {
    setNewTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag]
    );
  };

  const searchEventsLocation = async () => {
    const query = locationSearch.trim();

    if (!query) {
      Alert.alert("Missing location", "Enter a city or address to search.");
      return;
    }

    setLocationSearching(true);
    setError(null);

    try {
      const geocodedLocations = await withTimeout(
        Location.geocodeAsync(query),
        8000,
        "Location search timed out."
      );
      const result = geocodedLocations[0];

      if (!result) {
        Alert.alert("Location not found", "Try a more specific city or address.");
        return;
      }

      setEventCoordinates({
        latitude: result.latitude,
        longitude: result.longitude,
      });
      setEventLocation(query);
      setSelectedTag(null);
      setRefreshKey((key) => key + 1);
    } catch (searchError) {
      console.error(searchError);
      Alert.alert("Search failed", "Could not find events around that location.");
    } finally {
      setLocationSearching(false);
    }
  };

  const setQuickDate = (offsetDays: number) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + offsetDays);
    setNewDate(dateInputValue(nextDate));
    setCalendarMonth(calendarMonthValue(nextDate));
  };

  const moveCalendarMonth = (offsetMonths: number) => {
    setCalendarMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + offsetMonths,
          1
        )
    );
  };

  const selectCalendarDate = (date: Date) => {
    setNewDate(dateInputValue(date));
    setCalendarMonth(calendarMonthValue(date));
  };

  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert(
        "Photo access needed",
        "Allow photo access to add an event thumbnail."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
      mediaTypes: ["images"],
      quality: 0.45,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    setNewThumbnail(
      asset.base64
        ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
        : asset.uri
    );
  };

  const createEvent = async () => {
    const eventDateTime = parseEventDateTime(newDate, newTime, newMeridiem);

    if (!newTitle.trim() || !eventDateTime || !newAddress.trim()) {
      Alert.alert("Missing fields", "Please add a title, time, and address.");
      return;
    }

    setSavingEvent(true);

    try {
      const geocodedAddresses = await Location.geocodeAsync(newAddress.trim());
      const eventCoords = geocodedAddresses[0];

      if (!eventCoords) {
        Alert.alert(
          "Address not found",
          "Please enter a more specific address."
        );
        return;
      }

      const response = await fetch(`${API_BASE}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          date: {
            start_date: eventDateTime.toISOString(),
            when: formatEventWhen(eventDateTime),
          },
          address: [newAddress.trim()],
          description: newDescription.trim() || null,
          thumbnail: newThumbnail,
          tags: newTags,
          author: currentUser?.uid ?? null,
          location: {
            type: "Point",
            coordinates: [eventCoords.longitude, eventCoords.latitude],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Create event failed with status ${response.status}`);
      }

      const createdEvent = (await response.json()) as Event;
      setEvents((currentEvents) => [createdEvent, ...currentEvents]);
      resetCreateForm();
      setCreateOpen(false);
    } catch (createError) {
      console.error(createError);
      Alert.alert(
        "Could not save event",
        "Check that the backend is running, then try again."
      );
    } finally {
      setSavingEvent(false);
    }
  };

  const openEvent = async (link?: string | null) => {
    if (!link) {
      return;
    }

    const canOpen = await Linking.canOpenURL(link);

    if (canOpen) {
      await Linking.openURL(link);
    }
  };

  const visibleEvents = selectedTag
    ? events.filter((event) => event.tags?.includes(selectedTag))
    : events;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.heading}>Events</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setCreateOpen(true)}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subheading}>
          Showing events around {eventLocation}.
        </Text>
      </View>

      <View style={styles.locationSearch}>
        <TextInput
          autoCapitalize="words"
          onChangeText={setLocationSearch}
          onSubmitEditing={searchEventsLocation}
          placeholder="Search city or address"
          placeholderTextColor={palette.textSubtle}
          returnKeyType="search"
          style={styles.locationSearchInput}
          value={locationSearch}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={locationSearching}
          onPress={searchEventsLocation}
          style={[
            styles.locationSearchButton,
            locationSearching && styles.locationSearchButtonDisabled,
          ]}
        >
          {locationSearching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.locationSearchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setCreateOpen(false)}
        visible={createOpen}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Event</Text>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                onChangeText={setNewTitle}
                placeholder="HackDavis meetup"
                placeholderTextColor={palette.textSubtle}
                style={styles.input}
                value={newTitle}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>When</Text>
              <View style={styles.dateTimeRow}>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setNewDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.textSubtle}
                  style={[styles.input, styles.dateInput]}
                  value={newDate}
                />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setNewTime}
                  placeholder="6:00"
                  placeholderTextColor={palette.textSubtle}
                  style={[styles.input, styles.timeInput]}
                  value={newTime}
                />
                <View style={styles.meridiemToggle}>
                  {(["AM", "PM"] as Meridiem[]).map((value) => {
                    const selected = newMeridiem === value;

                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        key={value}
                        onPress={() => setNewMeridiem(value)}
                        style={[
                          styles.meridiemOption,
                          selected && styles.meridiemOptionSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.meridiemText,
                            selected && styles.meridiemTextSelected,
                          ]}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setQuickDate(0)}
                  style={styles.quickDateButton}
                >
                  <Text style={styles.quickDateText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setQuickDate(1)}
                  style={styles.quickDateButton}
                >
                  <Text style={styles.quickDateText}>Tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setQuickDate(7)}
                  style={styles.quickDateButton}
                >
                  <Text style={styles.quickDateText}>Next week</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.calendar}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    accessibilityLabel="Previous month"
                    activeOpacity={0.8}
                    onPress={() => moveCalendarMonth(-1)}
                    style={styles.calendarNavButton}
                  >
                    <Text style={styles.calendarNavText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.calendarMonth}>
                    {monthLabel(calendarMonth)}
                  </Text>
                  <TouchableOpacity
                    accessibilityLabel="Next month"
                    activeOpacity={0.8}
                    onPress={() => moveCalendarMonth(1)}
                    style={styles.calendarNavButton}
                  >
                    <Text style={styles.calendarNavText}>›</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.calendarGrid}>
                  {calendarDayLabels.map((dayLabel) => (
                    <Text key={dayLabel} style={styles.calendarDayLabel}>
                      {dayLabel}
                    </Text>
                  ))}
                  {calendarDays.map((date, index) => {
                    const selected =
                      date !== null && dateInputValue(date) === newDate;

                    return date ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        key={date.toISOString()}
                        onPress={() => selectCalendarDate(date)}
                        style={[
                          styles.calendarDay,
                          selected && styles.calendarDaySelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            selected && styles.calendarDayTextSelected,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View
                        key={`empty-${index}`}
                        style={styles.calendarDay}
                      />
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[styles.fieldGroup, styles.addressFieldGroup]}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                onChangeText={setNewAddress}
                placeholder="1 Shields Ave, Davis, CA"
                placeholderTextColor={palette.textSubtle}
                style={styles.input}
                value={newAddress}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                multiline
                onChangeText={setNewDescription}
                placeholder="Add a short description"
                placeholderTextColor={palette.textSubtle}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={newDescription}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Thumbnail</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={pickThumbnail}
                style={styles.photoButton}
              >
                <Text style={styles.photoButtonText}>
                  {newThumbnail
                    ? "Change thumbnail photo"
                    : "Add thumbnail photo"}
                </Text>
              </TouchableOpacity>
              {newThumbnail && (
                <Image
                  source={{ uri: newThumbnail }}
                  style={styles.photoPreview}
                />
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Tags</Text>
              <View style={styles.tagPicker}>
                {eventTagOptions.map((tag) => {
                  const selected = newTags.includes(tag);

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      key={tag}
                      onPress={() => toggleNewTag(tag)}
                      style={[
                        styles.tagOption,
                        selected && styles.tagOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagOptionText,
                          selected && styles.tagOptionTextSelected,
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                disabled={savingEvent}
                onPress={createEvent}
                style={[
                  styles.createButton,
                  savingEvent && styles.createButtonDisabled,
                ]}
              >
                <Text style={styles.createButtonText}>
                  {savingEvent ? "Creating" : "Create"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={savingEvent}
                onPress={() => setCreateOpen(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
        visible={selectedEvent !== null}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Event Details</Text>
          </View>

          {selectedEvent && (
            <ScrollView contentContainerStyle={styles.detailContent}>
              {selectedEvent.thumbnail ? (
                <Image
                  source={{ uri: selectedEvent.thumbnail }}
                  style={styles.detailImage}
                />
              ) : (
                <View style={styles.detailImagePlaceholder}>
                  <Text style={styles.detailImagePlaceholderText}>Event</Text>
                </View>
              )}

              <View style={styles.detailBody}>
                <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
                {!!selectedEvent.date?.when && (
                  <Text style={styles.detailWhen}>
                    {selectedEvent.date.when}
                  </Text>
                )}
                {!!selectedEvent.address?.length && (
                  <Text style={styles.detailAddress}>
                    {selectedEvent.address.join(", ")}
                  </Text>
                )}
                {!!selectedEvent.tags?.length && (
                  <View style={styles.detailTags}>
                    {selectedEvent.tags.map((tag) => (
                      <View
                        key={tag}
                        style={[styles.tagPill, { backgroundColor: colorForTag(tag) }]}>
                        <Text style={styles.tagPillText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.detailDescription}>
                  {selectedEvent.description ||
                    "No description has been added for this event."}
                </Text>
              </View>

              {/* Attendees section */}
              <View style={styles.attendeesSection}>
                <Text style={styles.attendeesSectionTitle}>
                  {selectedEvent.attendees?.length ?? 0} Going
                </Text>

                {/* RSVP button */}
                {(() => {
                  const currentUid = currentUser?.uid;
                  const isAttending = selectedEvent.attendees?.some(
                    (a) => a.uid === currentUid
                  );

                  const handleRsvp = async () => {
                    if (!currentUid || !selectedEvent.id) return;
                    const displayName =
                      currentProfile?.display_name ||
                      currentUser?.displayName ||
                      currentUser?.email?.split("@")[0] ||
                      "Anonymous";

                    if (isAttending) {
                      const res = await fetch(
                        `${API_BASE}/api/events/${selectedEvent.id}/rsvp/${currentUid}`,
                        {
                          method: "DELETE",
                        }
                      );
                      if (res.ok) {
                        const updated = (await res.json()) as Event;
                        setSelectedEvent(updated);
                        setEvents((prev) =>
                          prev.map((e) => (e.id === updated.id ? updated : e))
                        );
                      }
                    } else {
                      const res = await fetch(
                        `${API_BASE}/api/events/${selectedEvent.id}/rsvp`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            uid: currentUid,
                            display_name: displayName,
                            photo: currentProfile?.photo ?? currentUser?.photoURL,
                          }),
                        }
                      );
                      if (res.ok) {
                        const updated = (await res.json()) as Event;
                        setSelectedEvent(updated);
                        setEvents((prev) =>
                          prev.map((e) => (e.id === updated.id ? updated : e))
                        );
                      }
                    }
                  };

                  return (
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
                        {isAttending ? "✓ I'm going" : "RSVP"}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                {/* Attendee list */}
                {!!selectedEvent.attendees?.length && (
                  <View style={styles.attendeeList}>
                    {selectedEvent.attendees.map((a) => (
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

              {!!selectedEvent.link && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openEvent(selectedEvent.link)}
                  style={styles.detailLinkButton}
                >
                  <Text style={styles.detailLinkButtonText}>
                    Open event link
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedEvent(null)}
                style={styles.detailCloseButton}
              >
                <Text style={styles.detailCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <View style={styles.chips}>
        {filters.map((item) => (
          <TouchableOpacity
            activeOpacity={0.8}
            key={item.value}
            onPress={() => setFilter(item.value)}
            style={[styles.chip, filter === item.value && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                filter === item.value && styles.chipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.tagFilterContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagFilterRow}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedTag(null)}
          style={[
            styles.filterTag,
            selectedTag === null && styles.filterTagActive,
          ]}
        >
          <Text
            style={[
              styles.filterTagText,
              selectedTag === null && styles.filterTagTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {eventTagOptions.map((tag) => (
          <TouchableOpacity
            activeOpacity={0.8}
            key={tag}
            onPress={() => setSelectedTag(tag)}
            style={[
              styles.filterTag,
              selectedTag === tag && styles.filterTagActive,
            ]}
          >
            <Text
              style={[
                styles.filterTagText,
                selectedTag === tag && styles.filterTagTextActive,
              ]}
            >
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={palette.coral} style={styles.loader} />
      ) : error ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>Unable to load events</Text>
          <Text style={styles.messageText}>{error}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setRefreshKey((key) => key + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={visibleEvents}
          keyExtractor={(item, index) => item.id ?? item.link ?? String(index)}
          ListEmptyComponent={
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>No events found</Text>
              <Text style={styles.messageText}>
                Try another date or tag filter.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedEvent(item)}
              style={styles.card}
            >
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
                {!!item.date?.when && (
                  <Text style={styles.when}>{item.date.when}</Text>
                )}
                {!!item.address?.length && (
                  <Text numberOfLines={1} style={styles.address}>
                    {item.address.join(", ")}
                  </Text>
                )}
                {!!item.description && (
                  <Text numberOfLines={2} style={styles.desc}>
                    {item.description}
                  </Text>
                )}
                {!!item.tags?.length && (
                  <View style={styles.cardTags}>
                    {item.tags.slice(0, 3).map((tag) => (
                      <View
                        key={tag}
                        style={[styles.smallTagPill, { backgroundColor: colorForTag(tag) }]}>
                        <Text style={styles.smallTagPillText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
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
  attendeesSection: {
    gap: 12,
  },
  attendeesSectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  rsvpButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#6366F1",
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: "center",
  },
  rsvpButtonActive: {
    backgroundColor: "#6366F1",
  },
  rsvpButtonText: {
    color: "#6366F1",
    fontSize: 15,
    fontWeight: "700",
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
    color: "#6366F1",
    fontSize: 13,
    fontWeight: "700",
  },
  attendeeName: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "500",
  },
  safe: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  header: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: "700",
  },
  addButton: {
    backgroundColor: palette.coral,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...flatButton('coral'),
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  subheading: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  locationSearch: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  locationSearchInput: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    color: palette.textPrimary,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  locationSearchButton: {
    alignItems: "center",
    backgroundColor: palette.navy,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
    ...flatButton("navy"),
  },
  locationSearchButtonDisabled: {
    opacity: 0.6,
  },
  locationSearchButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalSafe: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  form: {
    gap: 16,
    padding: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  addressFieldGroup: {
    marginTop: -6,
  },
  label: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    color: palette.textPrimary,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateInput: {
    flex: 1,
  },
  timeInput: {
    width: 78,
  },
  meridiemToggle: {
    backgroundColor: palette.border,
    borderRadius: 12,
    flexDirection: "row",
    padding: 4,
  },
  meridiemOption: {
    alignItems: "center",
    borderRadius: 9,
    justifyContent: "center",
    minHeight: 40,
    width: 48,
  },
  meridiemOptionSelected: {
    backgroundColor: palette.coral,
  },
  meridiemText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  meridiemTextSelected: {
    color: "#fff",
  },
  quickDateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  quickDateButton: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickDateText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  calendar: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarNavButton: {
    alignItems: "center",
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  calendarNavText: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 26,
  },
  calendarMonth: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDayLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    width: `${100 / 7}%`,
  },
  calendarDay: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    marginTop: 4,
    width: `${100 / 7}%`,
  },
  calendarDaySelected: {
    backgroundColor: palette.coral,
    borderRadius: 18,
  },
  calendarDayText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  calendarDayTextSelected: {
    color: "#fff",
  },
  textArea: {
    minHeight: 110,
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    ...flatOutline,
  },
  photoButtonText: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: "700",
  },
  photoPreview: {
    backgroundColor: palette.border,
    borderRadius: 12,
    height: 150,
    width: "100%",
  },
  tagPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagOption: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagOptionSelected: {
    backgroundColor: palette.coral,
    borderColor: palette.coral,
  },
  tagOptionText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  tagOptionTextSelected: {
    color: "#fff",
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 12,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    ...flatButton('coral'),
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    ...flatOutline,
  },
  cancelButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  detailContent: {
    padding: 16,
    gap: 16,
  },
  detailImage: {
    backgroundColor: palette.border,
    borderRadius: 14,
    height: 220,
    width: "100%",
  },
  detailImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 14,
    height: 220,
    justifyContent: "center",
    width: "100%",
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
    fontWeight: "700",
  },
  detailWhen: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: "700",
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: "700",
  },
  detailLinkButton: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
    ...flatButton('coral'),
  },
  detailLinkButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  detailCloseButton: {
    alignItems: 'center',
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
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  chip: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  chipActive: {
    backgroundColor: palette.coral,
    borderColor: palette.coral,
  },
  chipText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  chipTextActive: {
    color: "#fff",
  },
  tagFilterRow: {
    flexGrow: 0,
    minHeight: 58,
  },
  tagFilterContent: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 2,
  },
  filterTag: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  filterTagActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  filterTagText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  filterTagTextActive: {
    color: "#fff",
  },
  loader: {
    marginTop: 40,
  },
  list: {
    gap: 12,
    padding: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  thumb: {
    backgroundColor: palette.border,
    alignSelf: 'stretch',
    minHeight: 112,
    width: 90,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 112,
    width: 90,
  },
  thumbPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
    gap: 3,
    padding: 12,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  when: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "500",
  },
  address: {
    color: palette.textMuted,
    fontSize: 12,
  },
  desc: {
    color: palette.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  cardTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 4,
  },
  smallTagPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  smallTagPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: "700",
  },
  messageBox: {
    margin: 16,
    paddingVertical: 28,
  },
  messageTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  messageText: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.navy,
    borderRadius: 12,
    marginTop: 16,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    ...flatButton('navy'),
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
