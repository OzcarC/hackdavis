import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colorForTag, palette } from '@/constants/palette';
import type { Event } from '@/types/event';

type Props = {
  event: Event;
  onPress?: (event: Event) => void;
};

export const EventCard: React.FC<Props> = ({ event, onPress }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(event)}
      style={styles.card}>
      {event.thumbnail ? (
        <Image source={{ uri: event.thumbnail }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Text style={styles.thumbPlaceholderText}>Event</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.title}>
          {event.title}
        </Text>
        {!!event.date?.when && <Text style={styles.when}>{event.date.when}</Text>}
        {!!event.address?.length && (
          <Text numberOfLines={1} style={styles.address}>
            {event.address.join(', ')}
          </Text>
        )}
        {!!event.description && (
          <Text numberOfLines={2} style={styles.desc}>
            {event.description}
          </Text>
        )}
        {!!event.tags?.length && (
          <View style={styles.cardTags}>
            {event.tags.slice(0, 3).map((tag) => {
              const tagColor = colorForTag(tag);
              return (
                <View key={tag} style={[styles.smallTagPill, { backgroundColor: tagColor }]}>
                  <Text style={styles.smallTagPillText}>{tag}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 14,
    elevation: 2,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: palette.navy,
    shadowOpacity: 0.06,
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
    fontWeight: '600',
  },
  when: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: '600',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  smallTagPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  smallTagPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
