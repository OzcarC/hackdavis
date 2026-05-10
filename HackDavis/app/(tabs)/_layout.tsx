import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { API_BASE } from "@/constants/api";
import { palette } from "@/constants/palette";
import { auth } from "../../firebase";

const ProfileTabIcon = ({ color, size }: { color: string; size: number }) => {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setPhoto(null);
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/api/users/${user.uid}`);
        if (!response.ok) {
          setPhoto(user.photoURL ?? null);
          return;
        }
        const data = (await response.json()) as { photo?: string | null };
        setPhoto(data.photo ?? user.photoURL ?? null);
      } catch {
        setPhoto(user.photoURL ?? null);
      }
    });
    return unsubscribe;
  }, []);

  if (photo) {
    return (
      <View style={[profileIconStyles.wrapper, { borderColor: color, width: size, height: size }]}>
        <Image source={{ uri: photo }} style={profileIconStyles.image} />
      </View>
    );
  }

  return <IconSymbol size={size} name="person.crop.circle.fill" color={color} />;
};

const profileIconStyles = StyleSheet.create({
  wrapper: {
    borderRadius: 999,
    borderWidth: 2,
    overflow: "hidden",
  },
  image: {
    height: "100%",
    width: "100%",
  },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.coral,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopColor: palette.border,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          title: "Login",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="map.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileTabIcon color={color} size={28} />,
        }}
      />
    </Tabs>
  );
}
