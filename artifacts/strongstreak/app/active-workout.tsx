import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Modal, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { useSocial } from "@/context/SocialContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SESSION_COLORS } from "@/components/ExerciseData";

function useTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return { elapsed, formatted: format(elapsed) };
}

function RestTimerModal({ visible, seconds, onClose }: { visible: boolean; seconds: number; onClose: () => void }) {
  const colors = useColors();
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!visible) { setRemaining(seconds); return; }
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onClose();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, seconds]);

  const progress = remaining / seconds;
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.restOverlay}>
        <View style={[styles.restModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.restTitle, { color: colors.mutedForeground }]}>Rest Timer</Text>
          <Text style={[styles.restTime, { color: colors.foreground }]}>
            {minutes}:{secs.toString().padStart(2, "0")}
          </Text>
          <View style={[styles.restProgressBg, { backgroundColor: colors.muted }]}>
            <View style={[styles.restProgressBar, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
          </View>
          <TouchableOpacity
            style={[styles.restSkipBtn, { backgroundColor: colors.muted }]}
            onPress={onClose}
          >
            <Text style={[styles.restSkipText, { color: colors.foreground }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SetRow({ set, setNumber, onUpdate }: {
  set: { reps: number; weight: number; unit: "kg" | "lbs"; completed: boolean };
  setNumber: number;
  onUpdate: (s: typeof set) => void;
}) {
  const colors = useColors();
  const [repsStr, setRepsStr] = useState(set.reps.toString());
  const [weightStr, setWeightStr] = useState(set.weight.toString());

  return (
    <View style={[styles.setRow, set.completed && { opacity: 0.6 }]}>
      <Text style={[styles.setNum, { color: colors.mutedForeground }]}>{setNumber}</Text>
      <TextInput
        style={[styles.setInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={weightStr}
        onChangeText={(v) => { setWeightStr(v); onUpdate({ ...set, weight: parseFloat(v) || 0 }); }}
        keyboardType="decimal-pad"
        placeholder="kg"
        placeholderTextColor={colors.mutedForeground}
      />
      <Text style={[styles.setX, { color: colors.mutedForeground }]}>×</Text>
      <TextInput
        style={[styles.setInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={repsStr}
        onChangeText={(v) => { setRepsStr(v); onUpdate({ ...set, reps: parseInt(v) || 0 }); }}
        keyboardType="number-pad"
        placeholder="reps"
        placeholderTextColor={colors.mutedForeground}
      />
      <TouchableOpacity
        style={[styles.setDoneBtn, { backgroundColor: set.completed ? colors.success : colors.muted, borderColor: set.completed ? colors.success : colors.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onUpdate({ ...set, completed: !set.completed });
        }}
      >
        <Ionicons name="checkmark" size={16} color={set.completed ? "#fff" : colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

function ExerciseCard({ exercise, weightUnit, onLogSet }: {
  exercise: any;
  weightUnit: "kg" | "lbs";
  onLogSet: (sets: any[]) => void;
}) {
  const colors = useColors();
  const [sets, setSets] = useState(
    Array.from({ length: exercise.sets }).map(() => ({ reps: 0, weight: 0, unit: weightUnit, completed: false }))
  );
  const [showRest, setShowRest] = useState(false);

  const updateSet = (i: number, updated: any) => {
    const next = sets.map((s, idx) => (idx === i ? updated : s));
    setSets(next);
    onLogSet(next);
    if (updated.completed) setShowRest(true);
  };

  const addSet = () => {
    setSets((prev) => [...prev, { reps: 0, weight: 0, unit: weightUnit, completed: false }]);
  };

  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.exerciseCardHeader}>
        <View>
          <Text style={[styles.exerciseCardName, { color: colors.foreground }]}>{exercise.name}</Text>
          <Text style={[styles.exerciseCardMeta, { color: colors.mutedForeground }]}>
            {exercise.muscleGroup} · Target: {exercise.sets}×{exercise.reps}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowRest(true)}>
          <Ionicons name="timer-outline" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.setHeader}>
        <Text style={[styles.setHeaderText, { color: colors.mutedForeground }]}>Set</Text>
        <Text style={[styles.setHeaderText, { color: colors.mutedForeground }]}>Weight</Text>
        <Text style={[styles.setHeaderText, { color: colors.mutedForeground }]}></Text>
        <Text style={[styles.setHeaderText, { color: colors.mutedForeground }]}>Reps</Text>
        <Text style={[styles.setHeaderText, { color: colors.mutedForeground }]}></Text>
      </View>

      {sets.map((set, i) => (
        <SetRow key={i} set={set} setNumber={i + 1} onUpdate={(updated) => updateSet(i, updated)} />
      ))}

      <TouchableOpacity style={[styles.addSetBtn, { borderColor: colors.border }]} onPress={addSet}>
        <Ionicons name="add" size={14} color={colors.primary} />
        <Text style={[styles.addSetText, { color: colors.primary }]}>Add set</Text>
      </TouchableOpacity>

      <RestTimerModal visible={showRest} seconds={exercise.restSeconds || 90} onClose={() => setShowRest(false)} />
    </View>
  );
}

export default function ActiveWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeWorkout, logSet, finishWorkout, cancelWorkout, weightUnit } = useWorkout();
  const { addPost } = useSocial();
  const { elapsed, formatted } = useTimer(!!activeWorkout?.isActive);
  const [pendingSets, setPendingSets] = useState<Record<string, any[]>>({});
  const [notes, setNotes] = useState("");
  const [shareOnFeed, setShareOnFeed] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!activeWorkout) {
    router.replace("/");
    return null;
  }

  const color = SESSION_COLORS[activeWorkout.sessionType] ?? colors.primary;

  const handleFinish = async () => {
    Alert.alert("Finish Workout", "Complete this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Finish",
        onPress: async () => {
          for (const [exId, sets] of Object.entries(pendingSets)) {
            for (const set of sets) {
              if (set.completed) {
                const ex = activeWorkout.exercises.find((e) => e.id === exId);
                logSet({
                  exerciseId: exId,
                  exerciseName: ex?.name ?? "",
                  setNumber: 1,
                  reps: set.reps,
                  weight: set.weight,
                  unit: set.unit ?? weightUnit,
                  completed: true,
                });
              }
            }
          }
          const log = await finishWorkout(notes);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (shareOnFeed) {
            await addPost({
              content: `Crushed ${activeWorkout.sessionType} day! ${Math.round(elapsed / 60)} minutes in the books.`,
              workoutSummary: {
                splitName: activeWorkout.splitName,
                sessionType: activeWorkout.sessionType,
                durationMinutes: Math.round(elapsed / 60),
                exerciseCount: activeWorkout.exercises.length,
              },
            });
          }
          router.replace("/");
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert("Cancel Workout", "Discard this session?", [
      { text: "Keep Going", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => { cancelWorkout(); router.replace("/"); } },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="close" size={26} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.sessionPill, { backgroundColor: color + "22", borderColor: color + "44" }]}>
            <Text style={[styles.sessionPillText, { color }]}>{activeWorkout.sessionType}</Text>
          </View>
          <Text style={[styles.timerText, { color: colors.foreground }]}>{formatted}</Text>
        </View>
        <TouchableOpacity
          style={[styles.finishBtn, { backgroundColor: colors.success }]}
          onPress={handleFinish}
        >
          <Text style={styles.finishBtnText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeWorkout.exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            weightUnit={weightUnit}
            onLogSet={(sets) => setPendingSets((prev) => ({ ...prev, [ex.id]: sets }))}
          />
        ))}

        <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>Session notes</Text>
          <TextInput
            style={[styles.notesInput, { color: colors.foreground }]}
            placeholder="How did it feel?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity
          style={[styles.shareToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShareOnFeed(!shareOnFeed)}
          activeOpacity={0.8}
        >
          <Ionicons name={shareOnFeed ? "checkbox" : "square-outline"} size={20} color={shareOnFeed ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.shareToggleText, { color: colors.foreground }]}>Share on feed when finished</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { alignItems: "center", gap: 4 },
  sessionPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  sessionPillText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  timerText: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  finishBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  finishBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  scrollContent: { padding: 16, gap: 12 },
  exerciseCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  exerciseCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  exerciseCardName: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  exerciseCardMeta: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  setHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  setHeaderText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  setNum: { width: 24, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  setInput: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  setX: { fontSize: 16, fontFamily: "Inter_400Regular" },
  setDoneBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  addSetBtn: { flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 10 },
  addSetText: { fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium" },
  notesCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  notesLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  notesInput: { fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 60 },
  shareToggle: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  shareToggleText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  restOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  restModal: { borderRadius: 24, borderWidth: 1, padding: 32, alignItems: "center", gap: 16, width: 280 },
  restTitle: { fontSize: 14, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
  restTime: { fontSize: 56, fontWeight: "700", fontFamily: "Inter_700Bold" },
  restProgressBg: { width: "100%", height: 6, borderRadius: 3 },
  restProgressBar: { height: 6, borderRadius: 3 },
  restSkipBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 100 },
  restSkipText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
