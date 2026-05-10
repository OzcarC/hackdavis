import { View, Text, StyleSheet } from "react-native";

export default function MapView() {
  return (
    <View style={styles.container}>
      <Text>Map is not supported on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});