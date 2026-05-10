// components/AddressAutocomplete.tsx
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { StyleSheet, View } from "react-native";
import { palette } from "@/constants/palette";
type Props = {
  onAddressSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
};

export default function AddressAutocomplete({
  onAddressSelect,
  placeholder,
}: Props) {
  return (
    <View style={{ zIndex: 1000 }}>
      <GooglePlacesAutocomplete
        placeholder={placeholder ?? "1 Shields Ave, Davis, CA"}
        minLength={2}
        debounce={200}
        // remove listViewDisplayed="auto" entirely
        keyboardShouldPersistTaps="handled"
        onPress={(data, details) => {
          if (!details) return;
          const { lat, lng } = details.geometry.location;
          onAddressSelect(data.description, lat, lng);
        }}
        onFail={(error) => console.error("Places error:", error)}
        onNotFound={() => console.log("Places: no results")}
        query={{
          key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          language: "en",
        }}
        fetchDetails={true}
        enablePoweredByContainer={false}
        keepResultsAfterBlur={true} // ← change to true
        styles={{
          textInput: styles.input,
          listView: styles.listView,
          row: styles.row,
          description: styles.description,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    color: palette.textPrimary,
    fontSize: 15,
    height: 48,
    paddingHorizontal: 14,
  },
  listView: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  description: {
    color: palette.textPrimary,
    fontSize: 14,
  },
});
