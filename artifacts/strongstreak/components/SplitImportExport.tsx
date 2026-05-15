import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, Alert, Platform, ScrollView,
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
import type { Split, WorkoutLog, SetLog } from "@/context/WorkoutContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function normalizeSplit(raw: any): Omit<Split, "id" | "createdAt"> {
  const days = DAYS.map((dayName) => {
    const found = (raw.days ?? []).find((d: any) => {
      const dow = d.dayOfWeek ?? d.day_of_week ?? "";
      return dow.toLowerCase() === dayName.toLowerCase();
    });
    return {
      id: generateId(),
      dayOfWeek: dayName,
      sessionType: found?.sessionType ?? found?.session_type ?? "Rest",
      exercises: (found?.exercises ?? []).map((ex: any) => ({
        id: generateId(),
        name: ex.name ?? "Unknown Exercise",
        muscleGroup: ex.muscleGroup ?? ex.muscle_group ?? "Other",
        sets: Number(ex.sets ?? ex.target_sets) || 3,
        reps: String(ex.reps ?? ex.target_reps ?? "10"),
        weight: Number(ex.weight) || 0,
        unit: (ex.unit === "lbs" ? "lbs" : "kg") as "kg" | "lbs",
        restSeconds: Number(ex.restSeconds ?? ex.rest_seconds) || 90,
        notes: ex.notes ?? "",
        type: ((ex.type ?? ex.exercise_type) === "cardio" ? "cardio" : "strength") as "strength" | "cardio",
      })),
    };
  });

  return { name: raw.name ?? raw.split_name ?? "Imported Split", days };
}

function parseSessionType(splitDayName: string): { dayLabel: string; sessionType: string } {
  if (!splitDayName) return { dayLabel: "Workout", sessionType: "Other" };
  const parts = splitDayName.split(/\s*[—–-]\s*/);
  const dayLabel = parts[0]?.trim() || splitDayName;
  const raw = parts[1]?.trim() ?? "";

  const lower = raw.toLowerCase();
  if (lower.includes("push")) return { dayLabel, sessionType: "Push" };
  if (lower.includes("pull")) return { dayLabel, sessionType: "Pull" };
  if (lower.includes("leg")) return { dayLabel, sessionType: "Legs" };
  if (lower.includes("upper")) return { dayLabel, sessionType: "Upper" };
  if (lower.includes("lower")) return { dayLabel, sessionType: "Lower" };
  if (lower.includes("full")) return { dayLabel, sessionType: "Full Body" };
  if (lower.includes("cardio")) return { dayLabel, sessionType: "Cardio" };
  if (lower.includes("rest")) return { dayLabel, sessionType: "Rest" };
  return { dayLabel, sessionType: raw || "Other" };
}

function convertHistoryToLogs(raw: any): Omit<WorkoutLog, "userId">[] {
  const entries: any[] = raw.workout_history ?? [];
  const valid = entries.filter(
    (e) => e.finished_at && Array.isArray(e.sets) && e.sets.length > 0
  );

  return valid.map((entry) => {
    const { dayLabel, sessionType } = parseSessionType(entry.split_day_name ?? "");
    const startedAt = entry.started_at ?? entry.finished_at;
    const finishedAt = entry.finished_at;

    const setLogs: SetLog[] = entry.sets
      .filter((s: any) => s.completed !== false)
      .map((s: any, idx: number) => ({
        id: generateId(),
        exerciseId: "imported",
        exerciseName: s.exercise_name ?? "Unknown",
        muscleGroup: "Other",
        setNumber: s.set_number ?? idx + 1,
        reps: Number(s.reps) || 0,
        weight: Number(s.weight_kg) || 0,
        unit: "kg" as const,
        completed: true,
        timestamp: finishedAt,
        type: (s.set_type === "dropset" ? "dropset" : "normal") as "normal" | "dropset",
        rir: s.rir != null ? Number(s.rir) : null,
        rpe: s.rpe != null ? Number(s.rpe) : null,
      }));

    const durationMinutes =
      startedAt && finishedAt
        ? Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000)
        : undefined;

    return {
      id: generateId(),
      splitId: "imported",
      splitName: "Imported History",
      splitDayId: "imported",
      dayLabel,
      sessionType,
      startedAt,
      finishedAt,
      durationMinutes,
      setLogs,
      notes: "",
      exerciseNotes: {},
      schemaVersion: 2,
    } satisfies Omit<WorkoutLog, "userId">;
  });
}

interface Props {
  visible: boolean;
  onClose: () => void;
  splitToExport?: Split;
}

type Step = "menu" | "scanning" | "preview" | "history-preview" | "importing";

export default function SplitImportExport({ visible, onClose, splitToExport }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addSplit, bulkImportWorkoutLogs } = useWorkout();
  const [step, setStep] = useState<Step>("menu");
  const [previewSplit, setPreviewSplit] = useState<Omit<Split, "id" | "createdAt"> | null>(null);
  const [historyLogs, setHistoryLogs] = useState<Omit<WorkoutLog, "userId">[]>([]);

  const reset = () => {
    setStep("menu");
    setPreviewSplit(null);
    setHistoryLogs([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const openMenu = () => {
    setStep("menu");
    setPreviewSplit(null);
    setHistoryLogs([]);
  };

  const handleExportJson = async () => {
    if (!splitToExport) return;
    try {
      const json = JSON.stringify(splitToExport, null, 2);
      const fileName = `${splitToExport.name.replace(/\s+/g, "_")}_split.json`;

      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const uri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Export Split" });
        } else {
          Alert.alert("Exported", `Split saved to: ${uri}`);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Export failed", e.message);
    }
  };

  const readFileContentWeb = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json,text/plain";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error("No file selected"));
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      };
      input.oncancel = () => reject(new Error("cancelled"));
      input.click();
    });

  const readJsonFile = async (): Promise<any | null> => {
    let content: string;
    if (Platform.OS === "web") {
      try {
        content = await readFileContentWeb();
      } catch (e: any) {
        if (e.message === "cancelled") return null;
        Alert.alert("Import failed", e.message);
        return null;
      }
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return null;
      const file = result.assets[0];
      const fetchResp = await fetch(file.uri);
      content = await fetchResp.text();
    }

    try {
      return JSON.parse(content);
    } catch {
      Alert.alert("Invalid file", "The selected file is not valid JSON.");
      return null;
    }
  };

  const handleImportJson = async () => {
    try {
      const parsed = await readJsonFile();
      if (!parsed) return;

      if (parsed.workout_history && Array.isArray(parsed.workout_history)) {
        const logs = convertHistoryToLogs(parsed);
        if (logs.length === 0) {
          Alert.alert("Nothing to import", "No completed workout sessions were found in this file.");
          return;
        }
        setHistoryLogs(logs);
        setStep("history-preview");
        return;
      }

      const normalized = normalizeSplit(parsed);
      setPreviewSplit(normalized);
      setStep("preview");
    } catch (e: any) {
      Alert.alert("Import failed", e.message);
    }
  };

  const handleImportHistory = async () => {
    if (historyLogs.length === 0) return;
    setStep("importing");
    try {
      const count = await bulkImportWorkoutLogs(historyLogs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Import complete",
        `${count} workout session${count !== 1 ? "s" : ""} imported successfully.`,
        [{ text: "Done", onPress: handleClose }]
      );
    } catch (e: any) {
      setStep("history-preview");
      Alert.alert("Import failed", e.message ?? "Could not write to Firestore.");
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
        { text: "Camera", onPress: () => launchImageSource("camera") },
        { text: "Photo Library", onPress: () => launchImageSource("library") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const launchImageSource = async (source: "camera" | "library") => {
    const picker = source === "camera"
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await picker({ mediaTypes: "images", base64: true, quality: 0.7 });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Error", "Could not read image data");
      return;
    }

    setStep("scanning");

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

  const sessionCounts = historyLogs.reduce<Record<string, number>>((acc, log) => {
    const t = log.sessionType || "Other";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 20 }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {step !== "menu" ? (
            <TouchableOpacity onPress={step === "importing" ? undefined : openMenu} disabled={step === "importing"}>
              <Ionicons name="chevron-back" size={24} color={step === "importing" ? colors.mutedForeground : colors.foreground} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Import / Export</Text>
          <View style={{ width: 24 }} />
        </View>

        {step === "menu" && (
          <View style={styles.menuContent}>
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
                <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>Scan a workout photo and turn it into a split</Text>
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
                <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>Open a split or workout history export</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            {splitToExport && (
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
                  <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>Save your current split as a file</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === "scanning" && (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.centeredTitle, { color: colors.foreground }]}>Scanning image...</Text>
          </View>
        )}

        {step === "importing" && (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.centeredTitle, { color: colors.foreground }]}>Importing workouts...</Text>
            <Text style={[styles.centeredSub, { color: colors.mutedForeground }]}>
              Writing {historyLogs.length} sessions to your history
            </Text>
          </View>
        )}

        {step === "preview" && previewSplit && (
          <View style={styles.previewContent}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>{previewSplit.name}</Text>
            <Text style={[styles.previewMeta, { color: colors.mutedForeground }]}>Review the imported split before adding it</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={handleConfirmImport}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color={colors.primaryForeground} />
              <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>Add to My Splits</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "history-preview" && (
          <ScrollView style={styles.historyPreview} contentContainerStyle={styles.historyPreviewContent}>
            <View style={[styles.historyBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="time-outline" size={32} color={colors.primary} />
              <Text style={[styles.historyCount, { color: colors.foreground }]}>
                {historyLogs.length} workout session{historyLogs.length !== 1 ? "s" : ""} found
              </Text>
              <Text style={[styles.historySubtitle, { color: colors.mutedForeground }]}>
                From your Base44 export — weights, reps, and RPE/RIR preserved
              </Text>
            </View>

            {Object.entries(sessionCounts).map(([type, count]) => (
              <View key={type} style={[styles.sessionTypeRow, { borderColor: colors.border }]}>
                <Text style={[styles.sessionTypeLabel, { color: colors.mutedForeground }]}>{type}</Text>
                <Text style={[styles.sessionTypeCount, { color: colors.foreground }]}>
                  {count} session{count !== 1 ? "s" : ""}
                </Text>
              </View>
            ))}

            <Text style={[styles.historyNote, { color: colors.mutedForeground }]}>
              These sessions will be added to your History tab. Your current splits are not changed.
            </Text>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={handleImportHistory}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={colors.primaryForeground} />
              <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>
                Import {historyLogs.length} Sessions
              </Text>
            </TouchableOpacity>
          </ScrollView>
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
  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optionInfo: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  optionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  centeredContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 40 },
  centeredTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  centeredSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  previewContent: { flex: 1, padding: 20, gap: 14 },
  previewTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  previewMeta: { fontSize: 14, fontFamily: "Inter_400Regular" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 10,
  },
  confirmBtnText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  historyPreview: { flex: 1 },
  historyPreviewContent: { padding: 20, gap: 12 },
  historyBanner: {
    borderRadius: 16, borderWidth: 1, padding: 20,
    alignItems: "center", gap: 8, marginBottom: 4,
  },
  historyCount: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center" },
  historySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  sessionTypeRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sessionTypeLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sessionTypeCount: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  historyNote: {
    fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18,
    marginTop: 8, textAlign: "center",
  },
});
