import { StyleSheet, Text, View } from "react-native";

export default function MapView() {
  return (
    <View style={styles.container}>
      <Text>Map is not supported on this platform</Text>
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
