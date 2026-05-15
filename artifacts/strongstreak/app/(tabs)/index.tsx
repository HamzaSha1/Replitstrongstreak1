import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SESSION_COLORS } from "@/components/ExerciseData";
import type { Split, SplitDay } from "@/context/WorkoutContext";
import SplitImportExport from "@/components/SplitImportExport";
import { StreakCalendar } from "@/components/StreakCalendar";
import { StreakMilestone, isMilestoneStreak } from "@/components/StreakMilestone";

function SessionTypePill({ type }: { type: string }) {
  const colors = useColors();
  const color = SESSION_COLORS[type] ?? colors.primary;
  return (
    <View style={[styles.pill, { backgroundColor: color + "22", borderColor: color + "55" }]}> 
      <Text style={[styles.pillText, { color }]}>{type}</Text>
    </View>
  );
}

function DayCard({ day, onStart }: { day: SplitDay; onStart: () => void }) {
  const colors = useColors();
  const color = SESSION_COLORS[day.sessionType] ?? colors.primary;
  const isRest = day.sessionType === "Rest";
  return (
    <TouchableOpacity
      style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={isRest ? undefined : onStart}
      activeOpacity={isRest ? 1 : 0.7}
    >
      <View style={[styles.dayAccent, { backgroundColor: color }]} />
      <View style={styles.dayCardInner}>
        <View style={styles.dayCardTop}>
          <Text style={[styles.dayName, { color: colors.mutedForeground }]}>{day.dayOfWeek}</Text>
          <SessionTypePill type={day.sessionType || "Rest"} />
        </View>
        <Text style={[styles.dayExerciseCount, { color: colors.foreground }]}> 
          {isRest ? "Recovery day" : day.sessionType || `${day.exercises.length} exercises`}
        </Text>
        {!isRest && day.exercises.length > 0 && (
          <Text style={[styles.dayExercisePreview, { color: colors.mutedForeground }]} numberOfLines={1}>
            {day.exercises.slice(0, 3).map((e) => e.name).join(" · ")}
            {day.exercises.length > 3 ? ` +${day.exercises.length - 3}` : ""}
          </Text>
        )}
        {!isRest && (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: color }]}
            onPress={onStart}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={styles.startBtnText}>Start</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SplitCard({ split, onExport, onDelete }: { split: Split; onExport: () => void; onDelete: () => void }) {
  const colors = useColors();
  const { startWorkout } = useWorkout();

  const handleStart = (day: SplitDay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startWorkout(split, day);
    router.push("/active-workout");
  };

  return (
    <View style={[styles.splitCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
      <View style={styles.splitCardHeader}>
        <Text style={[styles.splitName, { color: colors.foreground }]}>{split.name}</Text>
        <View style={styles.splitCardActions}>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onExport} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="share-outline" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/split-builder", params: { splitId: split.id } })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="pencil" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.daysList}>
        {split.days.map((day) => (
          <DayCard key={day.id} day={day} onStart={() => handleStart(day)} />
        ))}
      </View>
    </View>
  );
}

export default function WorkoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { splits, streak, longestStreak, activeWorkout, deleteSplit, workoutLogs } = useWorkout();
  const [refreshing, setRefreshing] = useState(false);
  const [importExportVisible, setImportExportVisible] = useState(false);
  const [exportSplit, setExportSplit] = useState<Split | undefined>(undefined);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  const prevStreakRef = useRef(streak);

  useEffect(() => {
    if (streak !== prevStreakRef.current && isMilestoneStreak(streak)) {
      setMilestoneVisible(true);
    }
    prevStreakRef.current = streak;
  }, [streak]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const openImport = () => {
    setExportSplit(undefined);
    setImportExportVisible(true);
  };

  const confirmDelete = (split: Split) => {
    Alert.alert(
      "Delete split?",
      `This will permanently delete \"${split.name}\".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSplit(split.id);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}> 
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Workouts</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {splits.length === 0 ? "No splits yet" : `${splits.length} split${splits.length > 1 ? "s" : ""}`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.streakChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => setCalendarVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="flame" size={16} color="#F97316" />
            <Text style={[styles.streakCount, { color: colors.foreground }]}>{streak}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={openImport}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-down-circle-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/split-builder");
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {activeWorkout?.isActive && (
        <TouchableOpacity
          style={[styles.activeWorkoutBanner, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/active-workout")}
          activeOpacity={0.9}
        >
          <View style={styles.activeWorkoutLeft}>
            <View style={[styles.activeDot, { backgroundColor: colors.primaryForeground }]} />
            <Text style={[styles.activeWorkoutText, { color: colors.primaryForeground }]}>Workout in progress — {activeWorkout.sessionType}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {splits.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}> 
              <Ionicons name="barbell-outline" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No splits yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Create your first training split to get started</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/split-builder")}
              activeOpacity={0.8}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Create Split</Text>
            </TouchableOpacity>
          </View>
        ) : (
          splits.map((split) => (
            <SplitCard
              key={split.id}
              split={split}
              onExport={() => { setExportSplit(split); setImportExportVisible(true); }}
              onDelete={() => confirmDelete(split)}
            />
          ))
        )}

        <View style={[styles.statsRow]}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Ionicons name="flame" size={20} color="#F97316" />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Current streak</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Ionicons name="trophy" size={20} color="#F59E0B" />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{longestStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Best streak</Text>
          </View>
        </View>
      </ScrollView>

      <SplitImportExport
        visible={importExportVisible}
        onClose={() => setImportExportVisible(false)}
        splitToExport={exportSplit}
      />

      <StreakCalendar
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        workoutLogs={workoutLogs}
        streak={streak}
        longestStreak={longestStreak}
      />

      <StreakMilestone
        visible={milestoneVisible}
        streak={streak}
        onClose={() => setMilestoneVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  streakChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, borderWidth: 1,
  },
  streakCount: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  importBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  activeWorkoutBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 16, marginTop: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14,
  },
  activeWorkoutLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeWorkoutText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  splitCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  splitCardHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  splitName: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", flex: 1 },
  splitCardActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  daysList: { padding: 10, gap: 8 },
  dayCard: {
    borderRadius: 12, borderWidth: 1, overflow: "hidden",
    flexDirection: "row",
  },
  dayAccent: { width: 4 },
  dayCardInner: { flex: 1, padding: 12, gap: 4 },
  dayCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  dayExerciseCount: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  dayExercisePreview: { fontSize: 12, fontFamily: "Inter_400Regular" },
  startBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, marginTop: 4,
  },
  startBtnText: { color: "#fff", fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  statBox: {
    flex: 1, alignItems: "center", padding: 16, borderRadius: 14, borderWidth: 1, gap: 4,
  },
  statNum: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});