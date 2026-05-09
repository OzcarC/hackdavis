import MapView, { Region } from "react-native-maps";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import * as Location from "expo-location";

export default function MapScreen() {
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    (async () => {
      // request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setRegion({
          latitude: 37.7749,
          longitude: -122.4194,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        return;
      }

      // get current position
      const location = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    })();
  }, []);

  // show spinner while location loads
  if (!region) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <MapView
      style={styles.map}
      region={region}
      onRegionChangeComplete={setRegion}
      showsUserLocation={true}
      showsMyLocationButton={true}
      provider="google"
    ></MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", height: "100%" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
