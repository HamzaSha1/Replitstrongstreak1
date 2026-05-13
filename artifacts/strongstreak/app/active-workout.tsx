import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { useSocial } from "@/context/SocialContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SESSION_COLORS, EXERCISE_LIBRARY } from "@/components/ExerciseData";
import type { Exercise, WorkoutLog } from "@/context/WorkoutContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalSet {
  setNumber: number;
  weight: string;
  reps: string;
  rir: string;
  completed: boolean;
  type: "normal" | "dropset";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return { elapsed, formatted: fmt(elapsed) };
}

function getPrevSets(exerciseName: string, workoutLogs: WorkoutLog[]): LocalSet[] {
  const name = exerciseName.toLowerCase();
  for (const log of workoutLogs) {
    if (!log.finishedAt) continue;
    const sets = (log.setLogs ?? [])
      .filter((s) => s.exerciseName.toLowerCase() === name && s.completed)
      .sort((a, b) => a.setNumber - b.setNumber);
    if (sets.length > 0) {
      return sets.map((s) => ({
        setNumber: s.setNumber,
        weight: s.weight > 0 ? s.weight.toString() : "",
        reps: s.reps > 0 ? s.reps.toString() : "",
        rir: s.rir != null ? s.rir.toString() : "",
        completed: false,
        type: (s.type ?? "normal") as "normal" | "dropset",
      }));
    }
  }
  return [];
}

function buildInitialSets(exercise: Exercise): LocalSet[] {
  const drop = exercise.dropSetCount ?? 0;
  const result: LocalSet[] = [];
  let num = 1;
  for (let i = 0; i < exercise.sets; i++) {
    result.push({ setNumber: num++, weight: "", reps: "", rir: "", completed: false, type: "normal" });
    for (let d = 0; d < drop; d++) {
      result.push({ setNumber: num++, weight: "", reps: "", rir: "", completed: false, type: "dropset" });
    }
  }
  return result;
}

// ─── RestTimerModal ───────────────────────────────────────────────────────────

function RestTimerModal({
  visible,
  seconds,
  onClose,
}: {
  visible: boolean;
  seconds: number;
  onClose: () => void;
}) {
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

  const progress = seconds > 0 ? remaining / seconds : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.restOverlay}>
        <View style={[styles.restModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.restTitle, { color: colors.mutedForeground }]}>REST</Text>
          <Text style={[styles.restTime, { color: colors.foreground }]}>
            {mins}:{secs.toString().padStart(2, "0")}
          </Text>
          <View style={[styles.restProgressBg, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.restProgressFill,
                { backgroundColor: colors.primary, width: `${progress * 100}%` as any },
              ]}
            />
          </View>
          <TouchableOpacity style={[styles.restSkipBtn, { backgroundColor: colors.muted }]} onPress={onClose}>
            <Text style={[styles.restSkipText, { color: colors.foreground }]}>Skip Rest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── RIRPickerModal ───────────────────────────────────────────────────────────

const RIR_OPTIONS = [
  { value: 0, label: "0", sub: "Failure" },
  { value: 1, label: "1", sub: "1 left" },
  { value: 2, label: "2", sub: "2 left" },
  { value: 3, label: "3", sub: "3 left" },
  { value: 4, label: "4+", sub: "Easy" },
];

function RIRPickerModal({
  visible,
  onConfirm,
  onSkip,
}: {
  visible: boolean;
  onConfirm: (rir: number) => void;
  onSkip: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.rirOverlay}>
        <View style={[styles.rirSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.rirTitle, { color: colors.foreground }]}>Reps In Reserve</Text>
          <Text style={[styles.rirSub, { color: colors.mutedForeground }]}>
            How many reps could you have done?
          </Text>
          <View style={styles.rirOptions}>
            {RIR_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.rirOption, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => onConfirm(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rirOptionVal, { color: colors.foreground }]}>{opt.label}</Text>
                <Text style={[styles.rirOptionSub, { color: colors.mutedForeground }]}>{opt.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.rirSkipRow} onPress={onSkip}>
            <Text style={[styles.rirSkipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── SwapExerciseModal ────────────────────────────────────────────────────────

function SwapExerciseModal({
  currentName,
  onSwap,
  onClose,
}: {
  currentName: string;
  onSwap: (name: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const all = Object.values(EXERCISE_LIBRARY).flat();
  const filtered = query.trim()
    ? all.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())).slice(0, 40)
    : all.slice(0, 40);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.fullModal, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Swap Exercise</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={query}
            onChangeText={setQuery}
            placeholder={`Currently: ${currentName}`}
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {query.trim() && (
            <TouchableOpacity
              style={[styles.listItem, { borderBottomColor: colors.border }]}
              onPress={() => { onSwap(query.trim()); onClose(); }}
            >
              <Text style={[styles.listItemText, { color: colors.primary }]}>
                + Use "{query.trim()}" as custom
              </Text>
            </TouchableOpacity>
          )}
          {filtered.map((e) => (
            <TouchableOpacity
              key={e.name}
              style={[styles.listItem, { borderBottomColor: colors.border }]}
              onPress={() => { onSwap(e.name); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.listItemText, { color: e.name === currentName ? colors.primary : colors.foreground }]}>
                {e.name}
              </Text>
              <Text style={[styles.listItemMeta, { color: colors.mutedForeground }]}>{e.muscleGroup}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── EditExercisesModal ───────────────────────────────────────────────────────

function EditExercisesModal({
  exercises,
  onAdd,
  onRemove,
  onClose,
}: {
  exercises: Exercise[];
  onAdd: (ex: Exercise) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const existingNames = new Set(exercises.map((e) => e.name));
  const muscleGroups = Object.keys(EXERCISE_LIBRARY);
  const filtered = query.trim()
    ? Object.values(EXERCISE_LIBRARY).flat()
        .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()) && !existingNames.has(e.name))
        .slice(0, 30)
    : selectedMuscle
    ? (EXERCISE_LIBRARY[selectedMuscle] ?? []).filter((e) => !existingNames.has(e.name))
    : [];

  const handleAdd = (name: string, muscleGroup: string, type: "strength" | "cardio" = "strength") => {
    onAdd({
      id: `tmp_${Date.now()}`,
      name,
      muscleGroup,
      sets: 3,
      reps: "8-12",
      weight: 0,
      unit: "kg",
      restSeconds: 90,
      notes: "",
      type,
    });
    setShowPicker(false);
    setQuery("");
    setSelectedMuscle(null);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.fullModal, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <View style={{ width: 24 }} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Exercises</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {exercises.map((ex) => (
            <View key={ex.id} style={[styles.editExRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.editExName, { color: colors.foreground }]}>{ex.name}</Text>
                <Text style={[styles.editExMeta, { color: colors.mutedForeground }]}>{ex.sets} × {ex.reps}</Text>
              </View>
              <TouchableOpacity
                style={[styles.smallDeleteBtn, { backgroundColor: colors.destructive + "20" }]}
                onPress={() => onRemove(ex.id)}
              >
                <Ionicons name="trash-outline" size={15} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}

          {!showPicker ? (
            <TouchableOpacity
              style={[styles.addExBtn, { borderColor: colors.border }]}
              onPress={() => setShowPicker(true)}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[styles.addExText, { color: colors.primary }]}>Add Exercise</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.pickerBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search or type name..."
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
              {query.trim() && (
                <TouchableOpacity
                  style={[styles.addCustomBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
                  onPress={() => handleAdd(query.trim(), "Other")}
                >
                  <Text style={[styles.addCustomText, { color: colors.primaryForeground }]}>
                    Add "{query.trim()}"
                  </Text>
                </TouchableOpacity>
              )}
              {!query.trim() && (
                <View style={[styles.muscleChips, { marginTop: 10 }]}>
                  {muscleGroups.map((mg) => (
                    <TouchableOpacity
                      key={mg}
                      style={[
                        styles.muscleChip,
                        { backgroundColor: selectedMuscle === mg ? colors.primary : colors.muted, borderColor: colors.border },
                      ]}
                      onPress={() => setSelectedMuscle(selectedMuscle === mg ? null : mg)}
                    >
                      <Text style={[styles.muscleChipText, { color: selectedMuscle === mg ? colors.primaryForeground : colors.mutedForeground }]}>
                        {mg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {filtered.map((e) => (
                <TouchableOpacity
                  key={e.name}
                  style={[styles.listItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleAdd(e.name, e.muscleGroup, e.type)}
                >
                  <Text style={[styles.listItemText, { color: colors.foreground }]}>{e.name}</Text>
                  <Text style={[styles.listItemMeta, { color: colors.mutedForeground }]}>{e.muscleGroup}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={{ alignItems: "center", paddingVertical: 10, marginTop: 4 }}
                onPress={() => { setShowPicker(false); setQuery(""); setSelectedMuscle(null); }}
              >
                <Text style={[styles.rirSkipText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── SummaryModal ─────────────────────────────────────────────────────────────

function SummaryModal({
  visible,
  exercises,
  allSets,
  elapsed,
  shareOnFeed,
  notes,
  onShareToggle,
  onNotesChange,
  onFinish,
}: {
  visible: boolean;
  exercises: Exercise[];
  allSets: Record<string, LocalSet[]>;
  elapsed: number;
  shareOnFeed: boolean;
  notes: string;
  onShareToggle: () => void;
  onNotesChange: (s: string) => void;
  onFinish: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const completedTotal = Object.values(allSets).flat().filter((s) => s.completed).length;
  const durationMins = Math.round(elapsed / 60);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.summaryContainer, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Workout Complete! 🎉</Text>

          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{durationMins}m</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Duration</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{completedTotal}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sets Done</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{exercises.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Exercises</Text>
            </View>
          </View>

          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>SESSION NOTES</Text>
            <TextInput
              style={[styles.notesInput, { color: colors.foreground }]}
              value={notes}
              onChangeText={onNotesChange}
              placeholder="How did it feel?"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.shareRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onShareToggle}
            activeOpacity={0.8}
          >
            <Ionicons
              name={shareOnFeed ? "checkbox" : "square-outline"}
              size={20}
              color={shareOnFeed ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.shareText, { color: colors.foreground }]}>Share on feed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.finishSummaryBtn, { backgroundColor: colors.primary }]}
            onPress={onFinish}
            activeOpacity={0.85}
          >
            <Ionicons name="flag" size={18} color={colors.primaryForeground} />
            <Text style={[styles.finishSummaryText, { color: colors.primaryForeground }]}>
              {shareOnFeed ? "Post & Finish" : "Finish"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── SetRow ───────────────────────────────────────────────────────────────────

function SetRow({
  set,
  prevSet,
  weightUnit,
  onUpdate,
  onCompleteRequest,
  onUndo,
  onDelete,
}: {
  set: LocalSet;
  prevSet?: LocalSet;
  weightUnit: "kg" | "lbs";
  onUpdate: (patch: Partial<LocalSet>) => void;
  onCompleteRequest: () => void;
  onUndo: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const isDropset = set.type === "dropset";

  return (
    <View
      style={[
        styles.setRow,
        isDropset && { marginLeft: 14, borderLeftWidth: 2, borderLeftColor: colors.primary + "40", paddingLeft: 8 },
        set.completed && { opacity: 0.65 },
      ]}
    >
      <Text style={[styles.setLabel, { color: isDropset ? colors.primary + "90" : colors.mutedForeground }]}>
        {isDropset ? "DS" : set.setNumber}
      </Text>

      <TextInput
        style={[
          styles.setInput,
          { backgroundColor: colors.muted, color: colors.foreground, borderColor: set.completed ? colors.primary + "30" : colors.border },
        ]}
        value={set.weight}
        onChangeText={(v) => onUpdate({ weight: v })}
        keyboardType="decimal-pad"
        placeholder={prevSet?.weight || "—"}
        placeholderTextColor={colors.mutedForeground + "50"}
        editable={!set.completed}
      />

      <Text style={[styles.setX, { color: colors.mutedForeground }]}>×</Text>

      <TextInput
        style={[
          styles.setInput,
          { backgroundColor: colors.muted, color: colors.foreground, borderColor: set.completed ? colors.primary + "30" : colors.border },
        ]}
        value={set.reps}
        onChangeText={(v) => onUpdate({ reps: v })}
        keyboardType="decimal-pad"
        placeholder={prevSet?.reps || "—"}
        placeholderTextColor={colors.mutedForeground + "50"}
        editable={!set.completed}
      />

      <View
        style={[
          styles.rirBadge,
          { backgroundColor: set.rir ? colors.primary + "20" : colors.muted, borderColor: set.rir ? colors.primary + "50" : colors.border },
        ]}
      >
        <Text style={[styles.rirBadgeText, { color: set.rir ? colors.primary : colors.mutedForeground + "50" }]}>
          {set.rir || "—"}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.checkBtn,
          { backgroundColor: set.completed ? colors.primary : "transparent", borderColor: set.completed ? colors.primary : colors.border },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (set.completed) onUndo();
          else onCompleteRequest();
        }}
      >
        <Ionicons name="checkmark" size={14} color={set.completed ? "#fff" : colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteSetBtn} onPress={onDelete}>
        <Ionicons name="remove-circle-outline" size={16} color={colors.mutedForeground + "60"} />
      </TouchableOpacity>
    </View>
  );
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  sets,
  prevSets,
  weightUnit,
  onSetsChange,
  onCompleteRequest,
  onSwapPress,
}: {
  exercise: Exercise;
  sets: LocalSet[];
  prevSets: LocalSet[];
  weightUnit: "kg" | "lbs";
  onSetsChange: (sets: LocalSet[]) => void;
  onCompleteRequest: (setIdx: number) => void;
  onSwapPress: () => void;
}) {
  const colors = useColors();
  const [showHistory, setShowHistory] = useState(false);
  const completedCount = sets.filter((s) => s.completed).length;

  const updateSet = (i: number, patch: Partial<LocalSet>) => {
    onSetsChange(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const undoSet = (i: number) => {
    onSetsChange(sets.map((s, idx) => (idx === i ? { ...s, completed: false } : s)));
  };

  const deleteSet = (i: number) => {
    onSetsChange(
      sets.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, setNumber: idx + 1 }))
    );
  };

  const addSet = () => {
    const drop = exercise.dropSetCount ?? 0;
    const next = [...sets];
    const nextNum = next.length + 1;
    next.push({ setNumber: nextNum, weight: "", reps: "", rir: "", completed: false, type: "normal" });
    for (let d = 0; d < drop; d++) {
      next.push({ setNumber: nextNum + d + 1, weight: "", reps: "", rir: "", completed: false, type: "dropset" });
    }
    onSetsChange(next);
  };

  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.exHeader}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowHistory((v) => !v)} activeOpacity={0.7}>
          <Text style={[styles.exName, { color: colors.foreground }]}>{exercise.name}</Text>
          <Text style={[styles.exMeta, { color: colors.mutedForeground }]}>
            {exercise.muscleGroup} · {exercise.sets}×{exercise.reps} · {exercise.restSeconds}s rest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.swapBtn, { borderColor: colors.border }]} onPress={onSwapPress}>
          <Ionicons name="swap-horizontal-outline" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.exProgressText, { color: colors.mutedForeground }]}>
          {completedCount}/{sets.length}
        </Text>
      </View>

      {/* History panel */}
      {showHistory && (
        <View style={[styles.historyPanel, { backgroundColor: colors.muted + "30", borderColor: colors.border }]}>
          {prevSets.length === 0 ? (
            <Text style={[styles.historyEmpty, { color: colors.mutedForeground }]}>No previous data</Text>
          ) : (
            <>
              <Text style={[styles.historyHeading, { color: colors.mutedForeground }]}>LAST SESSION</Text>
              {prevSets
                .filter((s) => s.type !== "dropset")
                .map((s, i) => (
                  <Text key={i} style={[styles.historyEntry, { color: colors.mutedForeground }]}>
                    Set {s.setNumber}:{" "}
                    {s.weight ? `${s.weight}${weightUnit}` : "—"} × {s.reps || "—"} reps
                    {s.rir ? `  ·  RIR ${s.rir}` : ""}
                  </Text>
                ))}
            </>
          )}
        </View>
      )}

      {/* Column headers */}
      <View style={styles.setColHeaders}>
        <Text style={[styles.colHeader, { width: 26, color: colors.mutedForeground }]}>Set</Text>
        <Text style={[styles.colHeader, { flex: 1, textAlign: "center", color: colors.mutedForeground }]}>
          Wt ({weightUnit})
        </Text>
        <Text style={[styles.colHeader, { width: 14 }]} />
        <Text style={[styles.colHeader, { flex: 1, textAlign: "center", color: colors.mutedForeground }]}>
          Reps
        </Text>
        <Text style={[styles.colHeader, { width: 38, textAlign: "center", color: colors.mutedForeground }]}>
          RIR
        </Text>
        <Text style={[styles.colHeader, { width: 34 }]} />
        <Text style={[styles.colHeader, { width: 24 }]} />
      </View>

      {/* Sets */}
      {sets.map((set, i) => (
        <SetRow
          key={i}
          set={set}
          prevSet={prevSets[i]}
          weightUnit={weightUnit}
          onUpdate={(patch) => updateSet(i, patch)}
          onCompleteRequest={() => onCompleteRequest(i)}
          onUndo={() => undoSet(i)}
          onDelete={() => deleteSet(i)}
        />
      ))}

      {/* Add set */}
      <TouchableOpacity style={[styles.addSetBtn, { borderColor: colors.border }]} onPress={addSet} activeOpacity={0.7}>
        <Ionicons name="add" size={13} color={colors.primary} />
        <Text style={[styles.addSetText, { color: colors.primary }]}>Add set</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeWorkout, workoutLogs, logSet, finishWorkout, cancelWorkout, weightUnit } = useWorkout();
  const { addPost } = useSocial();
  const { elapsed, formatted } = useTimer(!!activeWorkout?.isActive);

  const [localExercises, setLocalExercises] = useState<Exercise[]>([]);
  const [allSets, setAllSets] = useState<Record<string, LocalSet[]>>({});
  const [restTimer, setRestTimer] = useState<{ seconds: number } | null>(null);
  const [pendingComplete, setPendingComplete] = useState<{ exId: string; setIdx: number } | null>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [showEditExercises, setShowEditExercises] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [shareOnFeed, setShareOnFeed] = useState(true);

  // Capture set type for rest timer decision before state update
  const pendingSetTypeRef = useRef<"normal" | "dropset">("normal");
  const pendingRestSecondsRef = useRef(90);

  useEffect(() => {
    if (!activeWorkout) return;
    const exs = activeWorkout.exercises;
    setLocalExercises(exs);
    const initial: Record<string, LocalSet[]> = {};
    exs.forEach((ex) => { initial[ex.id] = buildInitialSets(ex); });
    setAllSets(initial);
  }, []);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!activeWorkout) {
    router.replace("/");
    return null;
  }

  const color = SESSION_COLORS[activeWorkout.sessionType] ?? colors.primary;
  const allFlatSets = Object.values(allSets).flat();
  const completedTotal = allFlatSets.filter((s) => s.completed).length;
  const totalSets = allFlatSets.length;
  const progress = totalSets > 0 ? completedTotal / totalSets : 0;
  const allDone = totalSets > 0 && completedTotal === totalSets;

  // ─── Set complete flow ──────────────────────────────────────────────────────

  const handleCompleteRequest = (exId: string, setIdx: number) => {
    const ex = localExercises.find((e) => e.id === exId);
    const set = allSets[exId]?.[setIdx];
    pendingSetTypeRef.current = set?.type ?? "normal";
    pendingRestSecondsRef.current = ex?.restSeconds ?? 90;
    setPendingComplete({ exId, setIdx });
  };

  const confirmComplete = (rir?: number) => {
    if (!pendingComplete) return;
    const { exId, setIdx } = pendingComplete;

    setAllSets((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((s, i) =>
        i === setIdx ? { ...s, completed: true, rir: rir != null ? rir.toString() : s.rir } : s
      ),
    }));

    setPendingComplete(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (pendingSetTypeRef.current !== "dropset" && pendingRestSecondsRef.current > 0) {
      setRestTimer({ seconds: pendingRestSecondsRef.current });
    }
  };

  // ─── Exercise management ────────────────────────────────────────────────────

  const addExercise = (ex: Exercise) => {
    setLocalExercises((prev) => [...prev, ex]);
    setAllSets((prev) => ({ ...prev, [ex.id]: buildInitialSets(ex) }));
  };

  const removeExercise = (id: string) => {
    setLocalExercises((prev) => prev.filter((e) => e.id !== id));
    setAllSets((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  };

  const swapExercise = (exId: string, newName: string) => {
    setLocalExercises((prev) => prev.map((e) => (e.id === exId ? { ...e, name: newName } : e)));
  };

  // ─── Finish ─────────────────────────────────────────────────────────────────

  const handleFinish = () => {
    if (!allDone) {
      Alert.alert(
        "Finish Workout",
        `${totalSets - completedTotal} sets still incomplete. Finish anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Finish", onPress: () => setShowSummary(true) },
        ]
      );
    } else {
      setShowSummary(true);
    }
  };

  const handleCancel = () => {
    Alert.alert("Cancel Workout", "Discard this session?", [
      { text: "Keep Going", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => { cancelWorkout(); router.replace("/"); } },
    ]);
  };

  const handleSummaryFinish = async () => {
    for (const [exId, sets] of Object.entries(allSets)) {
      const ex = localExercises.find((e) => e.id === exId);
      sets.forEach((set) => {
        if (set.completed) {
          logSet({
            exerciseId: exId,
            exerciseName: ex?.name ?? "",
            setNumber: set.setNumber,
            reps: parseInt(set.reps) || 0,
            weight: parseFloat(set.weight) || 0,
            unit: weightUnit,
            completed: true,
            type: set.type,
            rir: set.rir ? parseInt(set.rir) : undefined,
          });
        }
      });
    }

    const log = await finishWorkout(notes);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (shareOnFeed) {
      await addPost({
        content: `Crushed ${activeWorkout.sessionType} day! ${Math.round(elapsed / 60)} min in the books 💪`,
        workoutSummary: {
          splitName: activeWorkout.splitName,
          sessionType: activeWorkout.sessionType,
          durationMinutes: Math.round(elapsed / 60),
          exerciseCount: localExercises.length,
        },
      });
    }

    router.replace("/");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="close" size={24} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.sessionPill, { backgroundColor: color + "22", borderColor: color + "44" }]}>
            <Text style={[styles.sessionPillText, { color }]}>{activeWorkout.sessionType}</Text>
          </View>
          <Text style={[styles.timerText, { color: colors.foreground }]}>{formatted}</Text>
        </View>
        <TouchableOpacity
          style={[styles.editBtn, { borderColor: colors.border }]}
          onPress={() => setShowEditExercises(true)}
        >
          <Ionicons name="pencil-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: colors.muted }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` as any }]} />
      </View>
      <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
        {completedTotal}/{totalSets} sets
      </Text>

      {/* Exercises */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {localExercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            sets={allSets[ex.id] ?? []}
            prevSets={getPrevSets(ex.name, workoutLogs)}
            weightUnit={weightUnit}
            onSetsChange={(newSets) => setAllSets((prev) => ({ ...prev, [ex.id]: newSets }))}
            onCompleteRequest={(setIdx) => handleCompleteRequest(ex.id, setIdx)}
            onSwapPress={() => setSwapTarget(ex.id)}
          />
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View
        style={[
          styles.bottomBar,
          { borderTopColor: colors.border, paddingBottom: bottomPad + 8, backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity
          style={[styles.discardBtn, { borderColor: colors.destructive }]}
          onPress={handleCancel}
        >
          <Text style={[styles.discardBtnText, { color: colors.destructive }]}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.finishBtn, { backgroundColor: allDone ? colors.primary : colors.secondary }]}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Ionicons name="flag" size={16} color={allDone ? colors.primaryForeground : colors.mutedForeground} />
          <Text style={[styles.finishBtnText, { color: allDone ? colors.primaryForeground : colors.mutedForeground }]}>
            {allDone ? "Finish Workout!" : `Finish (${totalSets - completedTotal} left)`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* RIR picker */}
      <RIRPickerModal
        visible={!!pendingComplete}
        onConfirm={(rir) => confirmComplete(rir)}
        onSkip={() => confirmComplete()}
      />

      {/* Rest timer */}
      <RestTimerModal
        visible={!!restTimer}
        seconds={restTimer?.seconds ?? 90}
        onClose={() => setRestTimer(null)}
      />

      {/* Swap modal */}
      {swapTarget && (
        <SwapExerciseModal
          currentName={localExercises.find((e) => e.id === swapTarget)?.name ?? ""}
          onSwap={(newName) => { swapExercise(swapTarget, newName); setSwapTarget(null); }}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {/* Edit exercises */}
      {showEditExercises && (
        <EditExercisesModal
          exercises={localExercises}
          onAdd={addExercise}
          onRemove={removeExercise}
          onClose={() => setShowEditExercises(false)}
        />
      )}

      {/* Summary */}
      <SummaryModal
        visible={showSummary}
        exercises={localExercises}
        allSets={allSets}
        elapsed={elapsed}
        shareOnFeed={shareOnFeed}
        notes={notes}
        onShareToggle={() => setShareOnFeed((v) => !v)}
        onNotesChange={setNotes}
        onFinish={handleSummaryFinish}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { alignItems: "center", gap: 4 },
  sessionPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  sessionPillText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  timerText: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
  },
  editBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Progress
  progressBg: { height: 3 },
  progressFill: { height: 3 },
  progressText: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center", paddingVertical: 5 },

  // Scroll
  scrollContent: { padding: 12, gap: 10 },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 10,
  },
  discardBtn: { borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  discardBtnText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  finishBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 14,
  },
  finishBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Exercise card
  exerciseCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  exHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  exName: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  exMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  swapBtn: { borderWidth: 1, borderRadius: 8, padding: 6 },
  exProgressText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // History
  historyPanel: {
    marginHorizontal: 14, marginBottom: 8, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 3,
  },
  historyEmpty: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  historyHeading: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2,
  },
  historyEntry: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Column headers
  setColHeaders: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, marginBottom: 4, gap: 6,
  },
  colHeader: {
    fontSize: 10, fontFamily: "Inter_500Medium",
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  // Set row
  setRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 5, gap: 6 },
  setLabel: { width: 26, fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  setInput: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 6, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center",
  },
  setX: { width: 14, fontSize: 14, textAlign: "center", fontFamily: "Inter_400Regular" },
  rirBadge: { width: 38, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rirBadgeText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  checkBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  deleteSetBtn: { width: 24, alignItems: "center", justifyContent: "center" },

  // Add set
  addSetBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, margin: 10, marginTop: 6, paddingVertical: 9,
    borderWidth: 1, borderStyle: "dashed", borderRadius: 10,
  },
  addSetText: { fontSize: 12, fontWeight: "500", fontFamily: "Inter_500Medium" },

  // Rest timer
  restOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" },
  restModal: { borderRadius: 24, borderWidth: 1, padding: 32, alignItems: "center", gap: 16, width: 280 },
  restTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.5 },
  restTime: { fontSize: 56, fontWeight: "700", fontFamily: "Inter_700Bold" },
  restProgressBg: { width: "100%", height: 5, borderRadius: 3 },
  restProgressFill: { height: 5, borderRadius: 3 },
  restSkipBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 100 },
  restSkipText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // RIR picker
  rirOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  rirSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    padding: 20, paddingBottom: 40, gap: 12, alignItems: "center",
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  rirTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  rirSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  rirOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  rirOption: { width: 60, height: 64, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  rirOptionVal: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  rirOptionSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
  rirSkipRow: { paddingVertical: 10 },
  rirSkipText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  // Full modal (swap / edit)
  fullModal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  doneText: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  searchRow: { padding: 12 },
  searchInput: { height: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  listItem: {
    paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  listItemText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  listItemMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Edit exercises
  editExRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  editExName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  editExMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  smallDeleteBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addExBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 14, paddingVertical: 14,
  },
  addExText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  pickerBox: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  addCustomBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  addCustomText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  muscleChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  muscleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  muscleChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Summary
  summaryContainer: { flex: 1 },
  summaryTitle: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center" },
  statsRow: {
    flexDirection: "row", borderRadius: 16, borderWidth: 1,
    overflow: "hidden", alignItems: "stretch",
  },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16, gap: 4 },
  statValue: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statDivider: { width: StyleSheet.hairlineWidth },
  notesCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  notesLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  notesInput: { fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 56 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  shareText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  finishSummaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 16,
  },
  finishSummaryText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
