import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Modal, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import * as Haptics from "expo-haptics";
import { format, parseISO } from "date-fns";

function MiniChart({ entries }: { entries: any[] }) {
  const colors = useColors();
  if (entries.length < 2) return null;

  const values = entries.map((e) => e.weight);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 280;
  const height = 80;
  const padLeft = 4;
  const padRight = 4;
  const padTop = 8;
  const padBottom = 8;

  const points = entries.map((entry, i) => {
    const x = padLeft + (i / (entries.length - 1)) * (width - padLeft - padRight);
    const y = padTop + ((max - entry.weight) / range) * (height - padTop - padBottom);
    return { x, y, weight: entry.weight };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const { default: Svg, Path, Circle, Defs, LinearGradient: LG, Stop } = require("react-native-svg");

  return (
    <View style={{ alignItems: "center", marginVertical: 12 }}>
      <Svg width={width} height={height}>
        <Path
          d={pathD}
          stroke={colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.primary} />
        ))}
      </Svg>
    </View>
  );
}

function WeightCard({ entry, onDelete }: { entry: any; onDelete: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.weightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View>
        <Text style={[styles.weightValue, { color: colors.foreground }]}>{entry.weight} {entry.unit}</Text>
        <Text style={[styles.weightDate, { color: colors.mutedForeground }]}>{format(parseISO(entry.date), "EEE, MMM d yyyy")}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

function LogWeightModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addWeightEntry, weightUnit } = useWorkout();
  const [weight, setWeight] = useState("");

  const handleSave = async () => {
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addWeightEntry({
      date: new Date().toISOString(),
      weight: val,
      unit: weightUnit,
    });
    setWeight("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: (insets.top || 20) + 20 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Weight</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveText, { color: weight.trim() ? colors.primary : colors.mutedForeground }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weightInputContainer}>
          <TextInput
            style={[styles.weightInput, { color: colors.foreground }]}
            placeholder="0.0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
            autoFocus
          />
          <Text style={[styles.weightUnit, { color: colors.mutedForeground }]}>{weightUnit}</Text>
        </View>
      </View>
    </Modal>
  );
}

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { weightEntries, deleteWeightEntry, weightUnit, setWeightUnit, workoutLogs } = useWorkout();
  const [logModalVisible, setLogModalVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const recentEntries = weightEntries.slice(0, 10);
  const firstWeight = weightEntries[weightEntries.length - 1]?.weight;
  const lastWeight = weightEntries[0]?.weight;
  const change = firstWeight && lastWeight ? (lastWeight - firstWeight).toFixed(1) : null;

  const handleDelete = (id: string) => {
    Alert.alert("Delete entry", "Remove this weight entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWeightEntry(id) },
    ]);
  };

  const chartEntries = [...weightEntries].reverse().slice(-20);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Progress</Text>
        <View style={styles.headerRight}>
          <View style={[styles.unitToggle, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            {(["kg", "lbs"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.unitOption, weightUnit === u && { backgroundColor: colors.primary }]}
                onPress={() => setWeightUnit(u)}
              >
                <Text style={[styles.unitText, { color: weightUnit === u ? colors.primaryForeground : colors.mutedForeground }]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.logBtn, { backgroundColor: colors.primary }]}
            onPress={() => setLogModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {weightEntries.length >= 2 && (
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{lastWeight} {weightUnit}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Current</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: parseFloat(change ?? "0") < 0 ? colors.success : parseFloat(change ?? "0") > 0 ? "#EF4444" : colors.foreground }]}>
                  {parseFloat(change ?? "0") > 0 ? "+" : ""}{change} {weightUnit}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Change</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{firstWeight} {weightUnit}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Starting</Text>
              </View>
            </View>

            <View style={[styles.chartContainer, { borderTopColor: colors.border }]}>
              <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>Weight trend</Text>
              <WeightChartFallback entries={chartEntries} colors={colors} />
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Recent entries</Text>

        {weightEntries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="scale-outline" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No weight logged yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Start tracking your body weight
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setLogModalVisible(true)}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Log Weight</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentEntries.map((entry) => (
            <WeightCard key={entry.id} entry={entry} onDelete={() => handleDelete(entry.id)} />
          ))
        )}
      </ScrollView>

      <LogWeightModal visible={logModalVisible} onClose={() => setLogModalVisible(false)} />
    </View>
  );
}

function WeightChartFallback({ entries, colors }: { entries: any[]; colors: any }) {
  if (entries.length < 2) return null;
  const values = entries.map((e) => e.weight);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <View style={{ height: 60, flexDirection: "row", alignItems: "flex-end", gap: 3, paddingTop: 8 }}>
      {entries.map((entry, i) => {
        const barHeight = 8 + ((entry.weight - min) / range) * 44;
        return (
          <View key={i} style={{ flex: 1, height: barHeight, backgroundColor: colors.primary + "60", borderRadius: 3 }} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  unitToggle: { flexDirection: "row", borderRadius: 100, borderWidth: 1, overflow: "hidden" },
  unitOption: { paddingHorizontal: 12, paddingVertical: 6 },
  unitText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  logBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, gap: 10 },
  statsCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", padding: 16, gap: 4 },
  statValue: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { width: 1, height: 40 },
  chartContainer: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  chartLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 4 },
  weightCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 14, borderWidth: 1, padding: 16,
  },
  weightValue: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  weightDate: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  saveText: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  weightInputContainer: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", paddingTop: 60, gap: 8 },
  weightInput: { fontSize: 64, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "right", minWidth: 120 },
  weightUnit: { fontSize: 28, fontFamily: "Inter_400Regular" },
});
