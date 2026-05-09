import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE } from '@/constants/api';

const FALLBACK_LOCATION = 'Davis, CA';

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
  source?: string;
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
  const [locationLoading, setLocationLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('date:week');
  const [eventLocation, setEventLocation] = useState(FALLBACK_LOCATION);
  const [createOpen, setCreateOpen] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newWhen, setNewWhen] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newThumbnail, setNewThumbnail] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    const resolveUserLocation = async () => {
      setLocationLoading(true);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          setEventLocation(FALLBACK_LOCATION);
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [place] = await Location.reverseGeocodeAsync(currentPosition.coords);
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
          location: eventLocation,
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
  }, [eventLocation, filter, locationLoading]);

  const resetCreateForm = () => {
    setNewTitle('');
    setNewWhen('');
    setNewAddress('');
    setNewDescription('');
    setNewThumbnail(null);
  };

  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Photo access needed', 'Allow photo access to add an event thumbnail.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
      mediaTypes: ['images'],
      quality: 0.45,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    setNewThumbnail(
      asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri
    );
  };

  const createEvent = async () => {
    if (!newTitle.trim() || !newWhen.trim() || !newAddress.trim()) {
      Alert.alert('Missing fields', 'Please add a title, time, and address.');
      return;
    }

    setSavingEvent(true);

    try {
      const response = await fetch(`${API_BASE}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          date: {
            start_date: newWhen.trim(),
            when: newWhen.trim(),
          },
          address: [newAddress.trim()],
          description: newDescription.trim() || null,
          thumbnail: newThumbnail,
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
      Alert.alert('Could not save event', 'Check that the backend is running, then try again.');
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.heading}>Events</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setCreateOpen(true)}
            style={styles.addButton}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subheading}>Showing events around {eventLocation}.</Text>
      </View>

      <Modal animationType="slide" onRequestClose={() => setCreateOpen(false)} visible={createOpen}>
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
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={newTitle}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>When</Text>
              <TextInput
                onChangeText={setNewWhen}
                placeholder="Sat, May 16, 2:00 PM"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                value={newWhen}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                onChangeText={setNewAddress}
                placeholder="1 Shields Ave, Davis, CA"
                placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={newDescription}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Thumbnail</Text>
              <TouchableOpacity activeOpacity={0.85} onPress={pickThumbnail} style={styles.photoButton}>
                <Text style={styles.photoButtonText}>
                  {newThumbnail ? 'Change thumbnail photo' : 'Add thumbnail photo'}
                </Text>
              </TouchableOpacity>
              {newThumbnail && <Image source={{ uri: newThumbnail }} style={styles.photoPreview} />}
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                disabled={savingEvent}
                onPress={createEvent}
                style={[styles.createButton, savingEvent && styles.createButtonDisabled]}>
                <Text style={styles.createButtonText}>{savingEvent ? 'Creating' : 'Create'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={savingEvent}
                onPress={() => setCreateOpen(false)}
                style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
        visible={selectedEvent !== null}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Event Details</Text>
          </View>

          {selectedEvent && (
            <ScrollView contentContainerStyle={styles.detailContent}>
              {selectedEvent.thumbnail ? (
                <Image source={{ uri: selectedEvent.thumbnail }} style={styles.detailImage} />
              ) : (
                <View style={styles.detailImagePlaceholder}>
                  <Text style={styles.detailImagePlaceholderText}>Event</Text>
                </View>
              )}

              <View style={styles.detailBody}>
                <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
                {!!selectedEvent.date?.when && (
                  <Text style={styles.detailWhen}>{selectedEvent.date.when}</Text>
                )}
                {!!selectedEvent.address?.length && (
                  <Text style={styles.detailAddress}>{selectedEvent.address.join(', ')}</Text>
                )}
                <Text style={styles.detailDescription}>
                  {selectedEvent.description || 'No description has been added for this event.'}
                </Text>
              </View>

              {!!selectedEvent.link && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openEvent(selectedEvent.link)}
                  style={styles.detailLinkButton}>
                  <Text style={styles.detailLinkButtonText}>Open event link</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedEvent(null)}
                style={styles.detailCloseButton}>
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
              onPress={() => setSelectedEvent(item)}
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
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  subheading: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  modalSafe: {
    backgroundColor: '#F9FAFB',
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  form: {
    gap: 16,
    padding: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1.5,
    color: '#111827',
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 110,
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  photoButtonText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '700',
  },
  photoPreview: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    height: 150,
    width: '100%',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
  detailContent: {
    padding: 16,
    gap: 16,
  },
  detailImage: {
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    height: 220,
    width: '100%',
  },
  detailImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    height: 220,
    justifyContent: 'center',
    width: '100%',
  },
  detailImagePlaceholderText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '700',
  },
  detailBody: {
    gap: 8,
  },
  detailTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
  },
  detailWhen: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '700',
  },
  detailAddress: {
    color: '#6B7280',
    fontSize: 14,
  },
  detailDescription: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  detailLinkButton: {
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  detailLinkButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  detailCloseButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: 'center',
  },
  detailCloseButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
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
