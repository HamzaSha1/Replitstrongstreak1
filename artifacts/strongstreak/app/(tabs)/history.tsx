import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Platform, RefreshControl, TextInput, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { format, parseISO, isToday, isYesterday, isThisWeek } from "date-fns";
import { SESSION_COLORS } from "@/components/ExerciseData";
import { router } from "expo-router";

function groupLogsByPeriod(logs: any[]) {
  const sections: { title: string; data: any[] }[] = [];
  const groups: Record<string, any[]> = {};

  for (const log of logs) {
    const date = parseISO(log.startedAt);
    let title: string;

    if (isToday(date)) title = "Today";
    else if (isYesterday(date)) title = "Yesterday";
    else if (isThisWeek(date)) title = format(date, "EEEE");
    else title = format(date, "MMMM d, yyyy");

    if (!groups[title]) {
      groups[title] = [];
      sections.push({ title, data: [] });
    }
    groups[title].push(log);
  }

  return sections.map((s) => ({ ...s, data: groups[s.title] }));
}

function LogCard({
  log,
  searchQuery,
  onSearchResultPress,
}: {
  log: any;
  searchQuery: string;
  onSearchResultPress?: (exerciseName: string) => void;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const color = SESSION_COLORS[log.sessionType] ?? colors.primary;

  const uniqueExercises = new Set(log.setLogs.map((s: any) => s.exerciseName));

  const matchedExercise = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    for (const name of uniqueExercises) {
      if ((name as string).toLowerCase().includes(q)) return name as string;
    }
    return null;
  }, [searchQuery, log.setLogs]);

  const handlePress = () => {
    if (searchQuery.trim() && matchedExercise && onSearchResultPress) {
      onSearchResultPress(matchedExercise);
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={[styles.logAccent, { backgroundColor: color }]} />
      <View style={styles.logBody}>
        <View style={styles.logHeader}>
          <View style={styles.logTitleRow}>
            <Text style={[styles.logTitle, { color: colors.foreground }]}>{log.sessionType || log.splitName}</Text>
            <View style={[styles.typePill, { backgroundColor: color + "22", borderColor: color + "44" }]}>
              <Text style={[styles.typePillText, { color }]}>{log.sessionType}</Text>
            </View>
          </View>
          {searchQuery.trim() && matchedExercise ? (
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          ) : (
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          )}
        </View>

        <View style={styles.logStats}>
          <View style={styles.logStat}>
            <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.logStatText, { color: colors.mutedForeground }]}>
              {log.durationMinutes ?? "—"}min
            </Text>
          </View>
          <View style={styles.logStat}>
            <Ionicons name="barbell-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.logStatText, { color: colors.mutedForeground }]}>
              {uniqueExercises.size} exercises
            </Text>
          </View>
          <View style={styles.logStat}>
            <Ionicons name="checkmark-circle-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.logStatText, { color: colors.mutedForeground }]}>
              {log.setLogs.length} sets
            </Text>
          </View>
        </View>

        {/* Highlight matched exercise when searching */}
        {searchQuery.trim() && matchedExercise && (
          <View style={[styles.matchedExercise, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
            <Ionicons name="search" size={12} color={colors.primary} />
            <Text style={[styles.matchedExerciseText, { color: colors.primary }]} numberOfLines={1}>
              {matchedExercise}
            </Text>
          </View>
        )}

        {(expanded && !searchQuery.trim()) && log.setLogs.length > 0 && (
          <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
            {Array.from(uniqueExercises).map((name) => {
              const sets = log.setLogs.filter((s: any) => s.exerciseName === name);
              return (
                <View key={name as string} style={styles.exerciseRow}>
                  <Text style={[styles.exerciseName, { color: colors.foreground }]}>{name as string}</Text>
                  <Text style={[styles.exerciseSets, { color: colors.mutedForeground }]}>
                    {sets.length} sets · {sets[0]?.weight > 0 ? `${sets[0].weight}${sets[0].unit}` : "BW"}
                  </Text>
                </View>
              );
            })}
            {log.notes ? (
              <Text style={[styles.logNotes, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
                {log.notes}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workoutLogs } = useWorkout();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const sessionTypes = useMemo(() => {
    const types = new Set<string>();
    for (const log of workoutLogs) {
      if (log.sessionType) types.add(log.sessionType);
    }
    return Array.from(types).sort();
  }, [workoutLogs]);

  const filteredLogs = useMemo(() => {
    let logs = workoutLogs;

    if (activeFilter) {
      logs = logs.filter((log) => log.sessionType === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      logs = logs.filter((log) =>
        log.setLogs.some((s: any) => s.exerciseName.toLowerCase().includes(q))
      );
    }

    return logs;
  }, [workoutLogs, searchQuery, activeFilter]);

  const sections = groupLogsByPeriod(filteredLogs);

  const totalSets = filteredLogs.reduce((sum, log) => sum + log.setLogs.length, 0);
  const totalMinutes = filteredLogs.reduce((sum, log) => sum + (log.durationMinutes ?? 0), 0);

  const isFiltering = searchQuery.trim().length > 0 || activeFilter !== null;

  const handleSearchResultPress = (exerciseName: string) => {
    router.push(`/exercise-history?name=${encodeURIComponent(exerciseName)}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>History</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {isFiltering
              ? `${filteredLogs.length} of ${workoutLogs.length} sessions`
              : `${workoutLogs.length} sessions`}
          </Text>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search exercises…"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        {sessionTypes.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChips}
          >
            {sessionTypes.map((type) => {
              const isActive = activeFilter === type;
              const chipColor = SESSION_COLORS[type] ?? colors.primary;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    isActive
                      ? { backgroundColor: chipColor, borderColor: chipColor }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveFilter(isActive ? null : type)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: isActive ? "#fff" : colors.mutedForeground },
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: bottomPad + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          filteredLogs.length > 0 ? (
            <View style={[styles.summaryRow, { paddingHorizontal: 16, paddingTop: 16 }]}>
              <View style={[styles.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryNum, { color: colors.primary }]}>{filteredLogs.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Sessions</Text>
              </View>
              <View style={[styles.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryNum, { color: colors.primary }]}>{totalSets}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total sets</Text>
              </View>
              <View style={[styles.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryNum, { color: colors.primary }]}>{Math.round(totalMinutes / 60)}h</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total time</Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {isFiltering ? (
              <>
                <Ionicons name="search-outline" size={44} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No matches found</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  Try a different exercise name or remove a filter
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="calendar-outline" size={44} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No workouts yet</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  Complete a workout to see your history
                </Text>
              </>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <LogCard
              log={item}
              searchQuery={searchQuery}
              onSearchResultPress={handleSearchResultPress}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterChips: {
    paddingBottom: 2,
    gap: 8,
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  summaryBox: { flex: 1, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 2 },
  summaryNum: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  logCard: {
    borderRadius: 14, borderWidth: 1, flexDirection: "row", overflow: "hidden",
  },
  logAccent: { width: 4 },
  logBody: { flex: 1, padding: 14 },
  logHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  logTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  typePillText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  logStats: { flexDirection: "row", gap: 14, marginTop: 8 },
  logStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  logStatText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  matchedExercise: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  matchedExerciseText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  exerciseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  exerciseName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  exerciseSets: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logNotes: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: "center", paddingVertical: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
