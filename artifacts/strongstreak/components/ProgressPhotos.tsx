import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WeightEntry } from "@/context/WorkoutContext";

const { width } = Dimensions.get("window");
const THUMB = (width - 48) / 3;

interface Props {
  entries: WeightEntry[];
  onAddPhoto: (entryId: string, photoUri: string) => void;
  onDeleteEntry: (entryId: string) => void;
}

export function ProgressPhotos({ entries, onAddPhoto, onDeleteEntry }: Props) {
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const photoEntries = entries.filter((e) => e.photoUri);

  const pickPhoto = async (entryId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      onAddPhoto(entryId, result.assets[0].uri);
    }
  };

  const handleLongPress = (entryId: string) => {
    Alert.alert("Delete entry", "Remove this weight entry and photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDeleteEntry(entryId) },
    ]);
  };

  const handlePhotoTap = (uri: string) => {
    if (compareMode) {
      if (!compareA) { setCompareA(uri); return; }
      if (!compareB && uri !== compareA) { setCompareB(uri); return; }
    }
    setLightboxUri(uri);
  };

  const resetCompare = () => {
    setCompareA(null);
    setCompareB(null);
    setCompareMode(false);
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Progress Photos ({photoEntries.length})</Text>
        {photoEntries.length >= 2 && (
          <TouchableOpacity
            style={[styles.compareBtn, compareMode && styles.compareBtnActive]}
            onPress={() => {
              if (compareMode) resetCompare();
              else setCompareMode(true);
            }}
          >
            <Text style={styles.compareBtnText}>
              {compareMode ? "Cancel" : "Compare"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {compareMode && (
        <Text style={styles.compareHint}>
          {!compareA ? "Tap first photo to compare" : !compareB ? "Tap second photo" : ""}
        </Text>
      )}

      <FlatList
        data={photoEntries}
        numColumns={3}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.thumb,
              (compareA === item.photoUri || compareB === item.photoUri) && styles.thumbSelected,
            ]}
            onPress={() => handlePhotoTap(item.photoUri!)}
            onLongPress={() => handleLongPress(item.id)}
          >
            <Image source={{ uri: item.photoUri }} style={styles.thumbImg} />
            <View style={styles.thumbLabel}>
              <Text style={styles.thumbDate}>{item.date}</Text>
              <Text style={styles.thumbWeight}>{item.weight}{item.unit}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={styles.lightboxBg} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          {lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImg} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Side-by-side comparison */}
      <Modal visible={!!(compareA && compareB)} transparent animationType="slide" onRequestClose={resetCompare}>
        <View style={styles.compareBg}>
          <TouchableOpacity style={styles.closeBtn} onPress={resetCompare}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
          <View style={styles.compareRow}>
            {compareA && (
              <Image source={{ uri: compareA }} style={styles.compareImg} resizeMode="cover" />
            )}
            {compareB && (
              <Image source={{ uri: compareB }} style={styles.compareImg} resizeMode="cover" />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  compareBtn: { backgroundColor: "#333", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  compareBtnActive: { backgroundColor: "#FF4500" },
  compareBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  compareHint: { color: "#FF4500", fontSize: 13, marginBottom: 8 },
  thumb: { width: THUMB, height: THUMB, margin: 2, borderRadius: 8, overflow: "hidden" },
  thumbSelected: { borderWidth: 3, borderColor: "#FF4500" },
  thumbImg: { width: "100%", height: "100%" },
  thumbLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 4,
  },
  thumbDate: { color: "#fff", fontSize: 9 },
  thumbWeight: { color: "#FF4500", fontSize: 10, fontWeight: "700" },
  lightboxBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  lightboxImg: { width: "100%", height: "90%" },
  compareBg: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 10 },
  closeBtnText: { color: "#fff", fontSize: 16 },
  compareRow: { flexDirection: "row", flex: 1 },
  compareImg: { flex: 1, height: "100%" },
});
