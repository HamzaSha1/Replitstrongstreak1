import React, { useMemo, useState } from "react";
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, StatusBar,
} from "react-native";
import Svg, { Line, Circle, Path, Text as SvgText, G, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { WorkoutLog } from "@/context/WorkoutContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionSet {
  setNumber: number;
  weight: number;
  reps: number;
  rir?: number;
  unit: string;
}

interface SessionData {
  date: string;         // ISO date string
  shortLabel: string;   // "May 12"
  sets: SessionSet[];
  maxWeight: number;
  e1rm: number;         // Epley: weight × (1 + reps / 30)
  totalVolume: number;  // sum(weight × reps)
}

// ─── Chart ────────────────────────────────────────────────────────────────────

const CHART_H = 160;
const PAD = { top: 16, bottom: 32, left: 44, right: 16 };

function SparkChart({
  sessions,
  metric,
  accentColor,
}: {
  sessions: SessionData[];
  metric: "weight" | "e1rm" | "volume";
  accentColor: string;
}) {
  const W = Dimensions.get("window").width - 80;
  const plotW = W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const values = sessions.map((s) =>
    metric === "weight" ? s.maxWeight : metric === "e1rm" ? s.e1rm : s.totalVolume
  );
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = (rawMax - rawMin) * 0.12 || 5;
  const minVal = Math.max(0, rawMin - pad);
  const maxVal = rawMax + pad;
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    PAD.left + (sessions.length === 1 ? plotW / 2 : (i / (sessions.length - 1)) * plotW);
  const toY = (v: number) => PAD.top + (1 - (v - minVal) / range) * plotH;

  const pts = sessions.map((s, i) => ({
    x: toX(i),
    y: toY(metric === "weight" ? s.maxWeight : metric === "e1rm" ? s.e1rm : s.totalVolume),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;

  // Y labels: 3 evenly spaced
  const ySteps = [0, 0.5, 1].map((t) => minVal + t * range);

  // X labels: max 5, always show first and last
  const maxXLabels = 5;
  const showEvery = Math.max(1, Math.ceil(sessions.length / maxXLabels));
  const showIndices = new Set<number>();
  sessions.forEach((_, i) => { if (i % showEvery === 0) showIndices.add(i); });
  showIndices.add(sessions.length - 1);

  const formatVal = (v: number) => {
    if (metric === "volume") return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
    return `${Math.round(v)}`;
  };

  return (
    <Svg width={W} height={CHART_H}>
      <Defs>
        <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accentColor} stopOpacity={0.25} />
          <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Y grid lines */}
      {ySteps.map((v, i) => (
        <G key={i}>
          <Line
            x1={PAD.left} y1={toY(v)}
            x2={W - PAD.right} y2={toY(v)}
            stroke="rgba(120,120,128,0.15)" strokeWidth={1}
          />
          <SvgText
            x={PAD.left - 6} y={toY(v) + 4}
            textAnchor="end" fontSize={10} fill="rgba(120,120,128,0.65)"
          >
            {formatVal(v)}
          </SvgText>
        </G>
      ))}

      {/* Area fill */}
      {sessions.length > 1 && <Path d={areaPath} fill="url(#chartFill)" />}

      {/* Line */}
      {sessions.length > 1 && (
        <Path d={linePath} stroke={accentColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Dots */}
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={sessions.length === 1 ? 6 : 4} fill={accentColor} />
      ))}

      {/* X labels */}
      {sessions.map((s, i) => {
        if (!showIndices.has(i)) return null;
        return (
          <SvgText key={i} x={toX(i)} y={CHART_H - 6}
            textAnchor={i === 0 ? "start" : i === sessions.length - 1 ? "end" : "middle"}
            fontSize={10} fill="rgba(120,120,128,0.7)">
            {s.shortLabel}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[statStyles.pill, { backgroundColor: color + "15", borderColor: color + "30" }]}>
      <Text style={[statStyles.val, { color }]}>{value}</Text>
      <Text style={[statStyles.lbl, { color: color + "aa" }]}>{label}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  pill: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: "center", gap: 2 },
  val: { fontSize: 18, fontFamily: "Inter_700Bold" },
  lbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ExerciseHistoryModal({
  visible,
  exerciseName,
  workoutLogs,
  weightUnit,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  workoutLogs: WorkoutLog[];
  weightUnit: "kg" | "lbs";
  onClose: () => void;
}) {
  const colors = useColors();
  const [metric, setMetric] = useState<"weight" | "e1rm" | "volume">("weight");

  // ── Build session list ───────────────────────────────────────────────────────
  const sessions = useMemo((): SessionData[] => {
    const finished = workoutLogs
      .filter((l) => !!l.finishedAt)
      .sort((a, b) => new Date(a.finishedAt!).getTime() - new Date(b.finishedAt!).getTime());

    const result: SessionData[] = [];
    for (const log of finished) {
      const matching = (log.setLogs ?? [])
        .filter((s) => s.exerciseName.toLowerCase() === exerciseName.toLowerCase() && s.completed)
        .sort((a, b) => a.setNumber - b.setNumber);
      if (matching.length === 0) continue;

      const sets: SessionSet[] = matching.map((s) => ({
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        rir: s.rir,
        unit: s.unit ?? weightUnit,
      }));

      const maxWeight = Math.max(...sets.map((s) => s.weight));
      const best = sets.reduce((b, s) => {
        const e = s.weight * (1 + s.reps / 30);
        return e > b.weight * (1 + b.reps / 30) ? s : b;
      }, sets[0]);
      const e1rm = Math.round(best.weight * (1 + best.reps / 30));
      const totalVolume = Math.round(sets.reduce((acc, s) => acc + s.weight * s.reps, 0));

      const dateObj = new Date(log.finishedAt!);
      const shortLabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      result.push({ date: log.finishedAt!, shortLabel, sets, maxWeight, e1rm, totalVolume });
    }
    return result;
  }, [workoutLogs, exerciseName, weightUnit]);

  // ── Summary stats ────────────────────────────────────────────────────────────
  const bestWeight = sessions.length > 0 ? Math.max(...sessions.map((s) => s.maxWeight)) : 0;
  const bestE1rm   = sessions.length > 0 ? Math.max(...sessions.map((s) => s.e1rm))     : 0;
  const sessionCount = sessions.length;

  const metricLabels: Record<typeof metric, string> = {
    weight: `Max Weight (${weightUnit})`,
    e1rm:   "Est. 1RM",
    volume: "Volume",
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{exerciseName}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {sessionCount === 0 ? "No history yet" : `${sessionCount} session${sessionCount === 1 ? "" : "s"}`}
            </Text>
          </View>
        </View>

        {sessions.length === 0 ? (
          /* Empty state */
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.mutedForeground + "60"} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Complete a set and finish the workout to start tracking your progress.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Stat pills */}
            <View style={styles.statRow}>
              <StatPill label={`Best (${weightUnit})`} value={`${bestWeight}`} color={colors.primary} />
              <StatPill label="Est. 1RM" value={`${bestE1rm}`} color="#F97316" />
              <StatPill label="Sessions" value={`${sessionCount}`} color="#8B5CF6" />
            </View>

            {/* Metric tabs */}
            <View style={[styles.metricTabs, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              {(["weight", "e1rm", "volume"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.metricTab, metric === m && { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setMetric(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.metricTabText, { color: metric === m ? colors.foreground : colors.mutedForeground }]}>
                    {m === "weight" ? "Weight" : m === "e1rm" ? "Est. 1RM" : "Volume"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Chart */}
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>{metricLabels[metric]}</Text>
              <SparkChart sessions={sessions} metric={metric} accentColor={colors.primary} />
            </View>

            {/* Session history table */}
            <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>SESSIONS</Text>
            {[...sessions].reverse().map((session, si) => (
              <View key={si} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Session header */}
                <View style={styles.sessionHeader}>
                  <View style={[styles.sessionDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.sessionDate, { color: colors.foreground }]}>
                    {new Date(session.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                  <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                    {session.sets.length} set{session.sets.length === 1 ? "" : "s"}
                  </Text>
                </View>

                {/* Set rows */}
                <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.thCell, styles.thSet,  { color: colors.mutedForeground }]}>Set</Text>
                  <Text style={[styles.thCell, styles.thWt,   { color: colors.mutedForeground }]}>Weight</Text>
                  <Text style={[styles.thCell, styles.thReps, { color: colors.mutedForeground }]}>Reps</Text>
                  <Text style={[styles.thCell, styles.thRir,  { color: colors.mutedForeground }]}>RIR</Text>
                </View>
                {session.sets.map((s, i) => (
                  <View key={i} style={[styles.tableRow, i < session.sets.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border + "60" }]}>
                    <Text style={[styles.tdCell, styles.thSet,  { color: colors.mutedForeground }]}>{s.setNumber}</Text>
                    <Text style={[styles.tdCell, styles.thWt,   { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {s.weight > 0 ? `${s.weight}${s.unit}` : "—"}
                    </Text>
                    <Text style={[styles.tdCell, styles.thReps, { color: colors.foreground }]}>
                      {s.reps > 0 ? `${s.reps}` : "—"}
                    </Text>
                    <Text style={[styles.tdCell, styles.thRir,  { color: colors.mutedForeground }]}>
                      {s.rir != null ? `${s.rir}` : "—"}
                    </Text>
                  </View>
                ))}

                {/* Session summary */}
                <View style={[styles.sessionFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.sessionFooterText, { color: colors.mutedForeground }]}>
                    Max <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>{session.maxWeight}{weightUnit}</Text>
                    {"  ·  "}Est. 1RM <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>{session.e1rm}{weightUnit}</Text>
                    {"  ·  "}Vol <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }}>{session.totalVolume}{weightUnit}</Text>
                  </Text>
                </View>
              </View>
            ))}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },

  scroll: { padding: 20, gap: 16 },

  statRow: { flexDirection: "row", gap: 10 },

  metricTabs: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  metricTab: {
    flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
    borderColor: "transparent", alignItems: "center",
  },
  metricTabText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  chartCard: {
    borderRadius: 14, borderWidth: 1,
    paddingTop: 14, paddingBottom: 4, paddingHorizontal: 4,
    overflow: "hidden",
  },
  chartLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.6,
    paddingHorizontal: 12, marginBottom: 6,
  },

  sectionHeader: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 2,
  },
  sessionCard: {
    borderRadius: 14, borderWidth: 1,
    overflow: "hidden",
  },
  sessionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionDate: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sessionMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },

  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 14, paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 14, paddingVertical: 8,
  },
  thCell: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  tdCell: { fontSize: 14, fontFamily: "Inter_400Regular" },
  thSet:  { width: 36 },
  thWt:   { flex: 1 },
  thReps: { width: 60, textAlign: "center" },
  thRir:  { width: 50, textAlign: "center" },

  sessionFooter: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sessionFooterText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyBody:  { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
