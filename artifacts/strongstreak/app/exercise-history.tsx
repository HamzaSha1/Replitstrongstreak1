import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import type { ExerciseHistoryEntry } from "@/context/WorkoutContext";
import { SESSION_COLORS } from "@/components/ExerciseData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function calcE1rm(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

function entryStats(entry: ExerciseHistoryEntry) {
  const completed = entry.sets;
  if (completed.length === 0) return { maxWeight: 0, totalVolume: 0, bestE1rm: 0 };
  const maxWeight = Math.max(...completed.map((s) => s.weight));
  const totalVolume = Math.round(completed.reduce((acc, s) => acc + s.weight * s.reps, 0));
  const bestE1rm = Math.max(...completed.map((s) => calcE1rm(s.weight, s.reps)));
  return { maxWeight, totalVolume, bestE1rm };
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ entry, weightUnit }: { entry: ExerciseHistoryEntry; weightUnit: "kg" | "lbs" }) {
  const colors = useColors();
  const sessionColor = SESSION_COLORS[entry.sessionType] ?? colors.primary;
  const { maxWeight, totalVolume, bestE1rm } = entryStats(entry);

  return (
    <View style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Session header */}
      <View style={styles.sessionHeader}>
        <View style={[styles.sessionDot, { backgroundColor: sessionColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionDate, { color: colors.foreground }]}>
            {formatDate(entry.performedAt)}
          </Text>
          <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
            {entry.splitName}
            {entry.sessionType ? ` · ${entry.sessionType}` : ""}
            {entry.dayLabel ? ` · ${entry.dayLabel}` : ""}
          </Text>
        </View>
        <View style={[styles.sessionTypePill, { backgroundColor: sessionColor + "20", borderColor: sessionColor + "40" }]}>
          <Text style={[styles.sessionTypePillText, { color: sessionColor }]}>{entry.sessionType || "—"}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={[styles.statsRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{maxWeight}{weightUnit}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Max</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#F97316" }]}>{bestE1rm}{weightUnit}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Est. 1RM</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.mutedForeground }]}>{totalVolume}{weightUnit}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Volume</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{entry.sets.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sets</Text>
        </View>
      </View>

      {/* Set details table */}
      <View style={styles.tableWrap}>
        <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.thCell, styles.thSet, { color: colors.mutedForeground }]}>Set</Text>
          <Text style={[styles.thCell, styles.thWt, { color: colors.mutedForeground }]}>Weight</Text>
          <Text style={[styles.thCell, styles.thReps, { color: colors.mutedForeground }]}>Reps</Text>
          <Text style={[styles.thCell, styles.thRir, { color: colors.mutedForeground }]}>RIR</Text>
          <Text style={[styles.thCell, styles.thType, { color: colors.mutedForeground }]}>Type</Text>
        </View>
        {entry.sets.map((s, i) => (
          <View
            key={i}
            style={[
              styles.tableRow,
              i < entry.sets.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border + "60",
              },
            ]}
          >
            <Text style={[styles.tdCell, styles.thSet, { color: colors.mutedForeground }]}>{s.setNumber}</Text>
            <Text style={[styles.tdCell, styles.thWt, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {s.weight > 0 ? `${s.weight}${s.unit}` : "—"}
            </Text>
            <Text style={[styles.tdCell, styles.thReps, { color: colors.foreground }]}>
              {s.reps > 0 ? `${s.reps}` : "—"}
            </Text>
            <Text style={[styles.tdCell, styles.thRir, { color: colors.mutedForeground }]}>
              {s.rir != null ? `${s.rir}` : "—"}
            </Text>
            <Text style={[styles.tdCell, styles.thType, { color: s.type === "dropset" ? colors.primary : colors.mutedForeground }]}>
              {s.type === "dropset" ? "DS" : "—"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExerciseHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const exerciseName = name ?? "";

  const { getExerciseHistory, workoutLogs, weightUnit } = useWorkout();

  const [entries, setEntries] = useState<ExerciseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExerciseHistory(exerciseName);
      if (data.length > 0) {
        setEntries(data);
      } else {
        // Fall back to deriving history from workoutLogs for exercises
        // that pre-date the exerciseHistory collection (no backfill migration)
        const fallback = buildFallbackFromLogs(exerciseName, workoutLogs, weightUnit);
        setEntries(fallback);
      }
    } catch {
      const fallback = buildFallbackFromLogs(exerciseName, workoutLogs, weightUnit);
      setEntries(fallback);
    } finally {
      setLoading(false);
    }
  }, [exerciseName, workoutLogs, weightUnit]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Summary stats from all entries ───────────────────────────────────────────
  const allStats = entries.reduce(
    (acc, e) => {
      const { maxWeight, bestE1rm } = entryStats(e);
      return {
        bestWeight: Math.max(acc.bestWeight, maxWeight),
        bestE1rm: Math.max(acc.bestE1rm, bestE1rm),
      };
    },
    { bestWeight: 0, bestE1rm: 0 }
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {loading ? "Loading…" : entries.length === 0
              ? "No history yet"
              : `${entries.length} session${entries.length === 1 ? "" : "s"}`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={52} color={colors.mutedForeground + "50"} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Complete a workout with this exercise to start building your history.
          </Text>
        </View>
      ) : (
        <>
          {/* Aggregate stats banner */}
          <View style={[styles.summaryBanner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{allStats.bestWeight}{weightUnit}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Best Weight</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: "#F97316" }]}>{allStats.bestE1rm}{weightUnit}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Best Est. 1RM</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: "#8B5CF6" }]}>{entries.length}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Sessions</Text>
            </View>
          </View>

          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <SessionCard entry={item} weightUnit={weightUnit} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        </>
      )}
    </View>
  );
}

// ─── Fallback builder (from workoutLogs when exerciseHistory is empty) ─────────

function buildFallbackFromLogs(
  exerciseName: string,
  workoutLogs: import("@/context/WorkoutContext").WorkoutLog[],
  weightUnit: "kg" | "lbs"
): ExerciseHistoryEntry[] {
  const name = exerciseName.toLowerCase();
  const sorted = [...workoutLogs]
    .filter((l) => !!l.finishedAt)
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime());

  const results: ExerciseHistoryEntry[] = [];
  for (const log of sorted) {
    const matching = (log.setLogs ?? [])
      .filter((s) => s.exerciseName.toLowerCase() === name && s.completed)
      .sort((a, b) => a.setNumber - b.setNumber);
    if (matching.length === 0) continue;

    results.push({
      id: `fallback_${log.id}`,
      userId: log.userId,
      exerciseName,
      muscleGroup: matching[0]?.muscleGroup ?? "",
      workoutLogId: log.id,
      splitId: log.splitId,
      splitName: log.splitName,
      splitDayId: log.splitDayId,
      sessionType: log.sessionType,
      dayLabel: log.dayLabel,
      performedAt: log.finishedAt!,
      sets: matching.map((s) => ({
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        unit: s.unit ?? weightUnit,
        type: s.type,
        rir: s.rir ?? null,
        rpe: s.rpe ?? null,
      })),
    });
  }
  return results;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },

  summaryBanner: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },

  list: { padding: 16 },

  sessionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  sessionDate: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sessionMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sessionTypePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sessionTypePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  statsRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 8, gap: 2 },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statDivider: { width: StyleSheet.hairlineWidth },

  tableWrap: { paddingBottom: 4 },
  tableHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  thCell: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  tdCell: { fontSize: 14, fontFamily: "Inter_400Regular" },
  thSet: { width: 36 },
  thWt: { flex: 1 },
  thReps: { width: 52, textAlign: "center" },
  thRir: { width: 44, textAlign: "center" },
  thType: { width: 40, textAlign: "center" },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
