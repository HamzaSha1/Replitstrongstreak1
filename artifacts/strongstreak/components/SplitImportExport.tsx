import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import type { Split } from "@/context/WorkoutContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function normalizeSplit(raw: any): Omit<Split, "id" | "createdAt"> {
  const days = DAYS.map((dayName) => {
    const found = (raw.days ?? []).find(
      (d: any) => d.dayOfWeek?.toLowerCase() === dayName.toLowerCase()
    );
    return {
      id: generateId(),
      dayOfWeek: dayName,
      sessionType: found?.sessionType ?? "Rest",
      exercises: (found?.exercises ?? []).map((ex: any) => ({
        id: generateId(),
        name: ex.name ?? "Unknown Exercise",
        muscleGroup: ex.muscleGroup ?? "Other",
        sets: Number(ex.sets) || 3,
        reps: String(ex.reps || "10"),
        weight: Number(ex.weight) || 0,
        unit: (ex.unit === "lbs" ? "lbs" : "kg") as "kg" | "lbs",
        restSeconds: Number(ex.restSeconds) || 90,
        notes: ex.notes ?? "",
        type: (ex.type === "cardio" ? "cardio" : "strength") as "strength" | "cardio",
      })),
    };
  });

  return { name: raw.name ?? "Imported Split", days };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  splitToExport?: Split;
}

type Step = "menu" | "scanning" | "preview";

export default function SplitImportExport({ visible, onClose, splitToExport }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addSplit } = useWorkout();
  const [step, setStep] = useState<Step>("menu");
  const [previewSplit, setPreviewSplit] = useState<Omit<Split, "id" | "createdAt"> | null>(null);
  const [scanError, setScanError] = useState("");

  const reset = () => {
    setStep("menu");
    setPreviewSplit(null);
    setScanError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleExportJson = async () => {
    if (!splitToExport) return;
    try {
      const json = JSON.stringify(splitToExport, null, 2);
      const fileName = `${splitToExport.name.replace(/\s+/g, "_")}_split.json`;
      const uri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Export Split" });
      } else {
        Alert.alert("Exported", `Split saved to: ${uri}`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Export failed", e.message);
    }
  };

  const handleImportJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        Alert.alert("Invalid file", "The selected file is not valid JSON.");
        return;
      }

      const normalized = normalizeSplit(parsed);
      setPreviewSplit(normalized);
      setStep("preview");
    } catch (e: any) {
      Alert.alert("Import failed", e.message);
    }
  };

  const handleAiScan = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert("Permission required", "Camera or photo library access is needed to scan a split.");
        return;
      }
    }

    Alert.alert(
      "Scan Workout Plan",
      "Take a photo or choose from your library",
      [
        {
          text: "Camera",
          onPress: () => launchImageSource("camera"),
        },
        {
          text: "Photo Library",
          onPress: () => launchImageSource("library"),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const launchImageSource = async (source: "camera" | "library") => {
    const picker = source === "camera"
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await picker({
      mediaTypes: "images",
      base64: true,
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Error", "Could not read image data");
      return;
    }

    setStep("scanning");
    setScanError("");

    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const mimeType = asset.mimeType ?? "image/jpeg";

      const response = await fetch(`${apiBase}/api/scan-split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: asset.base64, mimeType }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error ?? `Server error ${response.status}`);
      }

      const data = await response.json();
      const normalized = normalizeSplit(data.split);
      setPreviewSplit(normalized);
      setStep("preview");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setScanError(e.message ?? "Could not parse the image");
      setStep("menu");
      Alert.alert("Scan failed", e.message ?? "Could not parse the image");
    }
  };

  const handleConfirmImport = async () => {
    if (!previewSplit) return;
    await addSplit(previewSplit);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  };

  const topPad = Platform.OS === "web" ? 20 : insets.top;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 20 }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {step !== "menu" ? (
            <TouchableOpacity onPress={() => setStep("menu")}>
              <Ionicons name="chevron-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {step === "menu" ? "Import / Export" : step === "scanning" ? "Scanning..." : "Preview Split"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* MENU */}
        {step === "menu" && (
          <View style={styles.menuContent}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Import</Text>

            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleAiScan}
              activeOpacity={0.75}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="camera" size={24} color={colors.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>AI Scan Photo</Text>
                <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                  Point your camera at a workout plan — AI will parse it automatically
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleImportJson}
              activeOpacity={0.75}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.orange + "20" }]}>
                <Ionicons name="document-text" size={24} color={colors.orange} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Import JSON File</Text>
                <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                  Import a previously exported split from a .json file
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            {splitToExport && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Export</Text>
                <TouchableOpacity
                  style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handleExportJson}
                  activeOpacity={0.75}
                >
                  <View style={[styles.optionIcon, { backgroundColor: colors.green + "20" }]}>
                    <Ionicons name="share" size={24} color={colors.green} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>Export as JSON</Text>
                    <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                      Save "{splitToExport.name}" as a file you can share or back up
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </>
            )}

            <View style={[styles.hintBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                AI scan works on handwritten notes, gym whiteboards, screenshots, or printed plans
              </Text>
            </View>
          </View>
        )}

        {/* SCANNING */}
        {step === "scanning" && (
          <View style={styles.scanningContent}>
            <View style={[styles.scanningIcon, { backgroundColor: colors.primary + "20" }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
            <Text style={[styles.scanningTitle, { color: colors.foreground }]}>Analysing your plan</Text>
            <Text style={[styles.scanningDesc, { color: colors.mutedForeground }]}>
              AI is reading your workout image and building the split…
            </Text>
          </View>
        )}

        {/* PREVIEW */}
        {step === "preview" && previewSplit && (
          <View style={styles.previewContent}>
            <View style={[styles.previewNameBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>Split name</Text>
              <Text style={[styles.previewName, { color: colors.foreground }]}>{previewSplit.name}</Text>
            </View>

            <View style={styles.previewDaysList}>
              {previewSplit.days.map((day) => (
                <View
                  key={day.dayOfWeek}
                  style={[styles.previewDayRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.previewDayInfo}>
                    <Text style={[styles.previewDayName, { color: colors.foreground }]}>{day.dayOfWeek}</Text>
                    <Text style={[styles.previewDayType, { color: colors.mutedForeground }]}>
                      {day.sessionType || "Rest"}
                      {day.exercises.length > 0 ? ` · ${day.exercises.length} exercises` : ""}
                    </Text>
                  </View>
                  {day.exercises.length > 0 && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  )}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.importConfirmBtn, { backgroundColor: colors.primary }]}
              onPress={handleConfirmImport}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color={colors.primaryForeground} />
              <Text style={[styles.importConfirmText, { color: colors.primaryForeground }]}>
                Add to My Splits
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  menuContent: { padding: 20, gap: 12 },
  sectionLabel: {
    fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionInfo: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  optionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  hintBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 4,
  },
  hintText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  scanningContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 40 },
  scanningIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  scanningTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  scanningDesc: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  previewContent: { flex: 1, padding: 20, gap: 14 },
  previewNameBox: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 4 },
  previewLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  previewName: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  previewDaysList: { gap: 6 },
  previewDayRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  previewDayInfo: { gap: 2 },
  previewDayName: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  previewDayType: { fontSize: 12, fontFamily: "Inter_400Regular" },
  importConfirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4,
  },
  importConfirmText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
