import React, { useMemo } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { WorkoutLog } from "@/context/WorkoutContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  workoutLogs: WorkoutLog[];
  streak: number;
  longestStreak: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function StreakCalendar({ visible, onClose, workoutLogs, streak, longestStreak }: Props) {
  const completedDates = useMemo(() => {
    return new Set(
      workoutLogs.filter((l) => l.finishedAt).map((l) => l.startedAt.split("T")[0])
    );
  }, [workoutLogs]);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Build last 3 months of calendar
  const months = useMemo(() => {
    const result = [];
    for (let m = 2; m >= 0; m--) {
      const d = new Date(currentYear, currentMonth - m, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay();

      const cells: (null | { date: string; day: number; isToday: boolean; isWorkout: boolean })[] = [];
      for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isToday = dateStr === today.toISOString().split("T")[0];
        cells.push({ date: dateStr, day, isToday, isWorkout: completedDates.has(dateStr) });
      }
      result.push({ month, year, cells });
    }
    return result;
  }, [completedDates, currentMonth, currentYear]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>🔥 {streak}</Text>
            <Text style={styles.statLabel}>Current streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>⚡ {longestStreak}</Text>
            <Text style={styles.statLabel}>Best streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>💪 {completedDates.size}</Text>
            <Text style={styles.statLabel}>Total sessions</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {months.map(({ month, year, cells }) => (
            <View key={`${year}-${month}`} style={styles.monthBlock}>
              <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
              <View style={styles.dayLabels}>
                {DAYS.map((d) => (
                  <Text key={d} style={styles.dayLabel}>{d}</Text>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((cell, i) =>
                  cell === null ? (
                    <View key={`empty-${i}`} style={styles.cell} />
                  ) : (
                    <View
                      key={cell.date}
                      style={[
                        styles.cell,
                        cell.isWorkout && styles.workoutCell,
                        cell.isToday && styles.todayCell,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          cell.isWorkout && styles.workoutCellText,
                          cell.isToday && styles.todayCellText,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          ))}
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: "#FF4500" }]} />
            <Text style={styles.legendText}>Workout day</Text>
            <View style={[styles.legendDot, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#FF4500" }]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const CELL_SIZE = 38;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "75%",
  },
  handle: { width: 40, height: 4, backgroundColor: "#444", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  statsRow: { flexDirection: "row", marginBottom: 24 },
  statBox: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "#333" },
  statNum: { color: "#fff", fontSize: 18, fontWeight: "800" },
  statLabel: { color: "#888", fontSize: 11, marginTop: 4 },
  monthBlock: { marginBottom: 24 },
  monthTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  dayLabels: { flexDirection: "row", marginBottom: 6 },
  dayLabel: { width: CELL_SIZE, textAlign: "center", color: "#666", fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 8, marginBottom: 4 },
  workoutCell: { backgroundColor: "#FF4500" },
  todayCell: { borderWidth: 2, borderColor: "#FF4500" },
  cellText: { color: "#666", fontSize: 13 },
  workoutCellText: { color: "#fff", fontWeight: "700" },
  todayCellText: { color: "#fff", fontWeight: "700" },
  legend: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingBottom: 32 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  legendText: { color: "#888", fontSize: 12, marginRight: 12 },
});
