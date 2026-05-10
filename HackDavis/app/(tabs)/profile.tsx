import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { API_BASE } from '@/constants/api';
import { flatButton, palette } from '@/constants/palette';
import { auth } from '../../firebase';

type UserProfile = {
  id: string;
  uid: string;
  email?: string | null;
  display_name?: string | null;
  bio?: string | null;
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
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hostedEvents, setHostedEvents] = useState<Event[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);

  const user = auth.currentUser;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const response = await fetch(`${API_BASE}/api/users/${user.uid}`);
        if (response.status === 404) { setProfile(null); return; }
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = (await response.json()) as UserProfile;
        setProfile(data);
        setEditName(data.display_name ?? '');
        setEditBio(data.bio ?? '');
      } catch (error) {
        console.error(error);
        Alert.alert('Profile unavailable', 'Could not load your profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const fetchProfileEvents = useCallback(async () => {
    if (!user) {
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);
    try {
      const [hostedResponse, attendingResponse] = await Promise.all([
        fetch(`${API_BASE}/api/events?author=${user.uid}`),
        fetch(`${API_BASE}/api/events?attendee=${user.uid}`),
      ]);

      if (!hostedResponse.ok) throw new Error(`Hosted status ${hostedResponse.status}`);
      if (!attendingResponse.ok) throw new Error(`Attending status ${attendingResponse.status}`);

      const hosted = (await hostedResponse.json()) as Event[];
      const attending = (await attendingResponse.json()) as Event[];
      setHostedEvents(hosted);
      setAttendingEvents(attending.filter((event) => event.author !== user.uid));
    } catch (error) {
      console.error('Could not load profile events:', error);
    } finally {
      setEventsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfileEvents();
    }, [fetchProfileEvents])
  );

  const chooseProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, aspect: [1, 1], base64: true, mediaTypes: ['images'], quality: 0.45,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return asset.base64
      ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
      : asset.uri;
  };

  const pickProfilePhoto = async () => {
    if (!user) { Alert.alert('Not signed in', 'Log in before adding a profile photo.'); return; }
    const photo = await chooseProfilePhoto();
    if (!photo) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email, display_name: profile?.display_name, bio: profile?.bio, photo }),
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const saved = (await response.json()) as UserProfile;
      setProfile(saved);
    } catch (error) {
      console.error(error);
      Alert.alert('Could not save photo', 'Check that the backend is running, then try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickEditPhoto = async () => {
    const photo = await chooseProfilePhoto();
    if (photo) setEditPhoto(photo);
  };

  const openEditProfile = () => {
    setEditName(profile?.display_name ?? '');
    setEditBio(profile?.bio ?? '');
    setEditPhoto(profile?.photo ?? null);
    setEditOpen(true);
  };

  const saveProfileEdits = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/users/${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          display_name: editName.trim() || null,
          bio: editBio.trim() || null,
          photo: editPhoto,
        }),
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const saved = (await response.json()) as UserProfile;
      setProfile(saved);
      setEditOpen(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Could not save', 'Check that the backend is running, then try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile?.display_name || user?.displayName || user?.email?.split('@')[0] || 'You';
  const editDisplayName = editName.trim() || displayName;
  const editInitials = editDisplayName.charAt(0).toUpperCase();
  const initials = displayName.charAt(0).toUpperCase();
  const totalEvents = hostedEvents.length + attendingEvents.length;

  const renderEventCard = (item: Event) => (
    <View style={styles.eventCard}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.eventThumb} />
      ) : (
        <View style={styles.eventThumbPlaceholder}>
          <Text style={styles.eventThumbPlaceholderText}>📅</Text>
        </View>
      )}
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
        {!!item.date?.when && (
          <Text style={styles.eventWhen}>{item.date.when}</Text>
        )}
        {!!item.address?.length && (
          <Text style={styles.eventAddress} numberOfLines={1}>{item.address.join(', ')}</Text>
        )}
        {!!item.tags?.length && (
          <View style={styles.eventTags}>
            {item.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={palette.coral} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Edit profile modal */}
      <Modal animationType="slide" onRequestClose={() => setEditOpen(false)} visible={editOpen} presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              accessibilityLabel="Close edit profile"
              activeOpacity={0.8}
              onPress={() => setEditOpen(false)}
              style={styles.modalIconButton}
            >
              <MaterialIcons color={palette.textPrimary} name="close" size={22} />
            </TouchableOpacity>
            <View style={styles.modalTitleGroup}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Text style={styles.modalSubtitle}>Update how people see you at events.</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Save profile"
              activeOpacity={0.85}
              disabled={saving}
              onPress={saveProfileEdits}
              style={[styles.modalSaveButton, saving && styles.modalSaveButtonDisabled]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialIcons color="#FFFFFF" name="check" size={22} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            <View style={styles.editHero}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={saving}
                onPress={pickEditPhoto}
                style={styles.editAvatarButton}
              >
                {editPhoto ? (
                  <Image source={{ uri: editPhoto }} style={styles.editAvatar} />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Text style={styles.editAvatarInitials}>{editInitials}</Text>
                  </View>
                )}
                <View style={styles.editCameraBadge}>
                  <MaterialIcons color="#FFFFFF" name="photo-camera" size={18} />
                </View>
              </TouchableOpacity>
              <Text style={styles.editHeroName} numberOfLines={1}>{editDisplayName}</Text>
              <Text style={styles.editHeroEmail} numberOfLines={1}>{user?.email}</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={saving}
                onPress={pickEditPhoto}
                style={styles.photoActionButton}
              >
                <MaterialIcons color={palette.coral} name="add-a-photo" size={18} />
                <Text style={styles.photoActionText}>
                  {editPhoto ? 'Change photo' : 'Add photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={palette.textSubtle}
                style={styles.input}
                value={editName}
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Bio</Text>
                <Text style={styles.helperText}>{editBio.length}/160</Text>
              </View>
              <TextInput
                maxLength={160}
                multiline
                onChangeText={setEditBio}
                placeholder="Share what kinds of events you like."
                placeholderTextColor={palette.textSubtle}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={editBio}
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={saving}
                onPress={saveProfileEdits}
                style={[styles.saveProfileButton, saving && styles.saveProfileButtonDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons color="#FFFFFF" name="check" size={20} />
                    <Text style={styles.saveProfileButtonText}>Save changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <FlatList
        data={hostedEvents}
        keyExtractor={(item, i) => item.id ?? String(i)}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <>
            {/* Avatar + actions row */}
            <View style={styles.avatarRow}>
              <TouchableOpacity onPress={pickProfilePhoto} activeOpacity={0.85} disabled={saving}>
                <View style={styles.avatarWrapper}>
                  {profile?.photo ? (
                    <Image source={{ uri: profile.photo }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    <MaterialIcons color={palette.coral} name="photo-camera" size={16} />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={openEditProfile} style={styles.editButton} activeOpacity={0.85}>
                <MaterialIcons color={palette.textPrimary} name="edit" size={16} />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Name + bio */}
            <View style={styles.nameSection}>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              {!!profile?.bio && (
                <Text style={styles.bio}>{profile.bio}</Text>
              )}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{hostedEvents.length}</Text>
                <Text style={styles.statLabel}>Hosting</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{attendingEvents.length}</Text>
                <Text style={styles.statLabel}>Attending</Text>
              </View>
            </View>

            {/* Divider + section title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hosting</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          eventsLoading ? (
            <ActivityIndicator color={palette.coral} style={{ marginTop: 32 }} />
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🗓️</Text>
              <Text style={styles.emptyTitle}>No hosted events yet</Text>
              <Text style={styles.emptyText}>Events you create will show up here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => renderEventCard(item)}
        ListFooterComponent={
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Attending</Text>
            </View>
            {eventsLoading ? (
              totalEvents > 0 ? (
                <ActivityIndicator color="#6366F1" style={{ marginTop: 16 }} />
              ) : null
            ) : attendingEvents.length > 0 ? (
              attendingEvents.map((event, index) => (
                <View key={event.id ?? `attending-${index}`}>
                  {renderEventCard(event)}
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🗓️</Text>
                <Text style={styles.emptyTitle}>No RSVPs yet</Text>
                <Text style={styles.emptyText}>Events you RSVP to will show up here.</Text>
              </View>
            )}
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.bg, flex: 1 },
  loader: { marginTop: 40 },

  listContainer: { paddingBottom: 32 },

  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: palette.bg,
    backgroundColor: palette.border,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: palette.bg,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#FFFFFF', fontSize: 34, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  editButton: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: palette.card,
  },
  editButtonText: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },

  // Name / bio
  nameSection: { paddingHorizontal: 16, gap: 3, marginBottom: 16 },
  displayName: { color: palette.textPrimary, fontSize: 22, fontWeight: '700' },
  email: { color: palette.textSubtle, fontSize: 13 },
  bio: { color: palette.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 6 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  statItem: { alignItems: 'center', marginRight: 28 },
  statNumber: { color: palette.textPrimary, fontSize: 20, fontWeight: '700' },
  statLabel: { color: palette.textMuted, fontSize: 12, marginTop: 1 },

  // Section header
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: '700' },

  // Event cards
  eventCard: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  eventThumb: { width: 88, backgroundColor: palette.border, alignSelf: 'stretch' },
  eventThumbPlaceholder: {
    width: 88,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
  },
  eventThumbPlaceholderText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  eventInfo: { flex: 1, padding: 12, gap: 3 },
  eventTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  eventWhen: { color: palette.coral, fontSize: 12, fontWeight: '600' },
  eventAddress: { color: palette.textMuted, fontSize: 12 },
  eventTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  tagPill: {
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  tagPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: 'center' },

  // Edit modal
  modalSafe: { backgroundColor: palette.bg, flex: 1 },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 30,
  },
  modalIconButton: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  modalTitleGroup: { flex: 1 },
  modalTitle: { color: palette.textPrimary, fontSize: 20, fontWeight: '800' },
  modalSubtitle: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
  modalSaveButton: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
    ...flatButton('coral'),
  },
  modalSaveButtonDisabled: { opacity: 0.65 },
  form: { gap: 16, paddingBottom: 28, paddingHorizontal: 16 },
  editHero: {
    paddingTop: 20,
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  editAvatarButton: { marginBottom: 12, position: 'relative' },
  editAvatar: {
    backgroundColor: palette.border,
    borderColor: palette.bg,
    borderRadius: 48,
    borderWidth: 3,
    height: 96,
    width: 96,
  },
  editAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderColor: palette.bg,
    borderRadius: 48,
    borderWidth: 3,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  editAvatarInitials: { color: '#FFFFFF', fontSize: 36, fontWeight: '800' },
  editCameraBadge: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderColor: palette.card,
    borderRadius: 17,
    borderWidth: 3,
    bottom: 0,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 34,
  },
  editHeroName: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    maxWidth: '100%',
  },
  editHeroEmail: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 3,
    maxWidth: '100%',
  },
  photoActionButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  photoActionText: { color: palette.coral, fontSize: 13, fontWeight: '800' },
  fieldGroup: { gap: 6 },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  helperText: { color: palette.textSubtle, fontSize: 12, fontWeight: '600' },
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
  textArea: { minHeight: 110 },
  formActions: { paddingTop: 4 },
  saveProfileButton: {
    alignItems: 'center',
    backgroundColor: palette.coral,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    ...flatButton('coral'),
  },
  saveProfileButtonDisabled: { opacity: 0.65 },
  saveProfileButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
