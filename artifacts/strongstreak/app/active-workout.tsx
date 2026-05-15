import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, Modal, Alert, Animated, PanResponder, Image,
  Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { useSocial } from "@/context/SocialContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SESSION_COLORS, EXERCISE_LIBRARY } from "@/components/ExerciseData";
import type { Exercise, WorkoutLog, SetLog } from "@/context/WorkoutContext";
import RestTimerModal, { type GameType, type RestNotification } from "@/components/RestTimerModal";
import ExerciseHistoryModal from "@/components/ExerciseHistoryModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalSet {
  setNumber: number;
  weight: string;
  reps: string;
  rir: string;
  rpe: string;
  completed: boolean;
  type: "normal" | "dropset";
  prefilled: boolean; // true = value came from prev session (shown in grey)
}

interface ExerciseExtra {
  photo: string | null;
  notes: string;
  notePhotos: string[];
  notesExpanded: boolean;
  repMode: "reps" | "time";
  timerVisible: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useWorkoutTimer(running: boolean) {
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
  // Sort newest-first so we always pick the most recent session
  const sorted = [...workoutLogs]
    .filter((l) => !!l.finishedAt)
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime());
  for (const log of sorted) {
    const sets = (log.setLogs ?? [])
      .filter((s) => s.exerciseName.toLowerCase() === name && s.completed)
      .sort((a, b) => a.setNumber - b.setNumber);
    if (sets.length > 0) {
      return sets.map((s) => ({
        setNumber: s.setNumber,
        weight: s.weight > 0 ? s.weight.toString() : "",
        reps: s.reps > 0 ? s.reps.toString() : "",
        rir: s.rir != null ? s.rir.toString() : "",
        rpe: s.rpe != null ? s.rpe.toString() : "",
        completed: false,
        type: (s.type ?? "normal") as "normal" | "dropset",
        prefilled: false,
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
    result.push({ setNumber: num++, weight: "", reps: "", rir: "", rpe: "", completed: false, type: "normal", prefilled: false });
    for (let d = 0; d < drop; d++) {
      result.push({ setNumber: num++, weight: "", reps: "", rir: "", rpe: "", completed: false, type: "dropset", prefilled: false });
    }
  }
  return result;
}

function defaultExtra(): ExerciseExtra {
  return { photo: null, notes: "", notePhotos: [], notesExpanded: false, repMode: "reps", timerVisible: false };
}

const PHOTO_KEY = (name: string) => `exercise_photo_${name.toLowerCase().replace(/\s+/g, "_")}`;

// ─── Rep range feedback ───────────────────────────────────────────────────────

function parseRepRange(s: string): { min: number; max: number } | null {
  const m = s.match(/^(\d+)-(\d+)$/);
  if (m) return { min: parseInt(m[1]), max: parseInt(m[2]) };
  const n = parseInt(s);
  if (!isNaN(n)) return { min: n, max: n };
  return null;
}

type RepResult = "low" | "good" | "top" | "above";

function getRepResult(actualReps: number, rangeStr: string): RepResult | null {
  const range = parseRepRange(rangeStr);
  if (!range) return null;
  if (actualReps < range.min) return "low";
  if (actualReps > range.max) return "above";
  if (actualReps === range.max) return "top";
  return "good";
}

const REP_FEEDBACK: Record<RepResult, RestNotification> = {
  low:   { emoji: "⚖️", title: "Below Range",       message: "Try more reps or lighten the weight.",  color: "#F59E0B" },
  good:  { emoji: "💪", title: "In Range!",          message: "Solid set — keep it consistent.",       color: "#10B981" },
  top:   { emoji: "🔥", title: "Top of Range!",      message: "Push for more reps next time.",         color: "#F97316" },
  above: { emoji: "🚀", title: "Above Range!",       message: "Time to increase the weight.",          color: "#8B5CF6" },
};

// ─── ExerciseTimerWidget ──────────────────────────────────────────────────────

type TimerPhase = "idle" | "pre" | "running" | "stopped";

function ExerciseTimerWidget({ onRemove }: { onRemove: () => void }) {
  const colors = useColors();
  const [mode, setMode] = useState<"open" | "countdown">("open");
  const [targetInput, setTargetInput] = useState("");
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => () => clear(), []);

  const parseMmSs = (str: string) => {
    if (!str) return 0;
    const parts = str.split(":");
    if (parts.length === 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
    return parseInt(str) || 0;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const startRunning = (currentMode: "open" | "countdown", targetSecs: number) => {
    setPhase("running");
    if (currentMode === "open") {
      let elapsed = 0;
      setCount(0);
      intervalRef.current = setInterval(() => { elapsed++; setCount(elapsed); }, 1000);
    } else {
      let remaining = targetSecs;
      setCount(targetSecs);
      intervalRef.current = setInterval(() => {
        remaining--;
        setCount(remaining);
        if (remaining <= 0) {
          clear();
          setPhase("stopped");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 1000);
    }
  };

  const handleStart = () => {
    clear();
    const currentMode = mode;
    const targetSecs = parseMmSs(targetInput);
    let pre = 10;
    setPhase("pre");
    setCount(pre);
    intervalRef.current = setInterval(() => {
      pre--;
      if (pre <= 0) { clear(); startRunning(currentMode, targetSecs); }
      else setCount(pre);
    }, 1000);
  };

  const handleStop = () => { clear(); setPhase("stopped"); };
  const handleReset = () => { clear(); setPhase("idle"); setCount(0); };

  const timeDisplay = phase === "idle"
    ? (mode === "countdown" ? (targetInput || "0:00") : "0:00")
    : phase === "pre" ? String(count)
    : fmt(count);

  return (
    <View style={[styles.timerWidget, { backgroundColor: colors.muted + "40", borderColor: colors.border }]}>
      <View style={styles.timerHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="timer-outline" size={13} color={colors.primary} />
          <Text style={[styles.timerLabel, { color: colors.foreground }]}>Exercise Timer</Text>
        </View>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name="close" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {(phase === "idle" || phase === "stopped") && (
        <View style={styles.timerModeRow}>
          {(["open", "countdown"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.timerModeBtn, { borderColor: mode === m ? colors.primary : colors.border, backgroundColor: mode === m ? colors.primary + "20" : "transparent" }]}
              onPress={() => { setMode(m); handleReset(); }}
            >
              <Text style={[styles.timerModeBtnText, { color: mode === m ? colors.primary : colors.mutedForeground }]}>
                {m === "open" ? "Open Timer" : "Countdown"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {mode === "countdown" && (phase === "idle" || phase === "stopped") && (
        <TextInput
          style={[styles.timerInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
          value={targetInput}
          onChangeText={setTargetInput}
          placeholder="mm:ss — e.g. 1:30"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />
      )}

      <View style={{ alignItems: "center", paddingVertical: 4 }}>
        {phase === "pre" && <Text style={[styles.timerPreText, { color: colors.mutedForeground }]}>Get ready...</Text>}
        <Text style={[styles.timerDisplay, { color: colors.primary, fontSize: phase === "pre" ? 52 : 42 }]}>
          {timeDisplay}
        </Text>
        {phase === "stopped" && <Text style={[styles.timerPreText, { color: colors.mutedForeground }]}>Stopped</Text>}
      </View>

      <View style={styles.timerControls}>
        {(phase === "idle" || phase === "stopped") && (
          <>
            <TouchableOpacity
              style={[styles.timerBtn, { backgroundColor: colors.primary, opacity: mode === "countdown" && !targetInput ? 0.4 : 1 }]}
              onPress={handleStart}
              disabled={mode === "countdown" && !targetInput}
            >
              <Text style={[styles.timerBtnText, { color: colors.primaryForeground }]}>
                {phase === "stopped" ? "Start Again" : "Start Timer"}
              </Text>
            </TouchableOpacity>
            {phase === "stopped" && (
              <TouchableOpacity style={[styles.timerBtn, { backgroundColor: colors.muted }]} onPress={handleReset}>
                <Text style={[styles.timerBtnText, { color: colors.foreground }]}>Reset</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {phase === "pre" && (
          <TouchableOpacity style={[styles.timerBtn, { backgroundColor: colors.muted, flex: 1 }]} onPress={handleReset}>
            <Text style={[styles.timerBtnText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
        )}
        {phase === "running" && (
          <TouchableOpacity style={[styles.timerBtn, { backgroundColor: colors.destructive, flex: 1 }]} onPress={handleStop}>
            <Text style={[styles.timerBtnText, { color: "#fff" }]}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── StreakCelebration ────────────────────────────────────────────────────────

function StreakCelebration({ streak, onDone }: { streak: number; onDone: () => void }) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 40, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Modal visible transparent animationType="fade">
      <Animated.View style={[styles.streakOverlay, { opacity }]}>
        <Animated.View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale }] }]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={[styles.streakNumber, { color: colors.primary }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: colors.foreground }]}>Day Streak!</Text>
          <Text style={[styles.streakSub, { color: colors.mutedForeground }]}>
            Keep the momentum going. See you tomorrow!
          </Text>
          <TouchableOpacity
            style={[styles.streakBtn, { backgroundColor: colors.primary }]}
            onPress={onDone}
          >
            <Text style={[styles.streakBtnText, { color: colors.primaryForeground }]}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── RIRPickerModal ───────────────────────────────────────────────────────────

const RIR_OPTIONS = [
  { value: 0,   label: "0",   sub: "Failure"   },
  { value: 0.5, label: "½",   sub: "Near fail" },
  { value: 1,   label: "1",   sub: "1 left"    },
  { value: 2,   label: "2",   sub: "2 left"    },
  { value: 3,   label: "3",   sub: "3 left"    },
  { value: 4,   label: "4+",  sub: "Easy"      },
];

function RIRPickerModal({ visible, onConfirm, onSkip }: { visible: boolean; onConfirm: (rir: number) => void; onSkip: () => void }) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.rirOverlay}>
        <View style={[styles.rirSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.rirTitle, { color: colors.foreground }]}>Reps In Reserve</Text>
          <Text style={[styles.rirSub, { color: colors.mutedForeground }]}>How many reps could you still do?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rirOptions}
            style={{ width: "100%" }}
          >
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
          </ScrollView>
          <TouchableOpacity style={styles.rirSkipRow} onPress={onSkip}>
            <Text style={[styles.rirSkipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── SwapExerciseModal ────────────────────────────────────────────────────────

function SwapExerciseModal({ currentName, onSwap, onClose }: { currentName: string; onSwap: (name: string) => void; onClose: () => void }) {
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
              <Text style={[styles.listItemText, { color: colors.primary }]}>+ Use "{query.trim()}" as custom</Text>
            </TouchableOpacity>
          )}
          {filtered.map((e) => (
            <TouchableOpacity
              key={e.name}
              style={[styles.listItem, { borderBottomColor: colors.border }]}
              onPress={() => { onSwap(e.name); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.listItemText, { color: e.name === currentName ? colors.primary : colors.foreground }]}>{e.name}</Text>
              <Text style={[styles.listItemMeta, { color: colors.mutedForeground }]}>{e.muscleGroup}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── EditExercisesModal ───────────────────────────────────────────────────────

function EditExercisesModal({ exercises, onAdd, onRemove, onClose }: {
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
    ? Object.values(EXERCISE_LIBRARY).flat().filter((e) => e.name.toLowerCase().includes(query.toLowerCase()) && !existingNames.has(e.name)).slice(0, 30)
    : selectedMuscle ? (EXERCISE_LIBRARY[selectedMuscle] ?? []).filter((e) => !existingNames.has(e.name)) : [];

  const handleAdd = (name: string, muscleGroup: string, type: "strength" | "cardio" = "strength") => {
    onAdd({ id: `tmp_${Date.now()}`, name, muscleGroup, sets: 3, reps: "8-12", weight: 0, unit: "kg", restSeconds: 90, notes: "", type });
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
              <TouchableOpacity style={[styles.smallDeleteBtn, { backgroundColor: colors.destructive + "20" }]} onPress={() => onRemove(ex.id)}>
                <Ionicons name="trash-outline" size={15} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}
          {!showPicker ? (
            <TouchableOpacity style={[styles.addExBtn, { borderColor: colors.border }]} onPress={() => setShowPicker(true)}>
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
                <TouchableOpacity style={[styles.addCustomBtn, { backgroundColor: colors.primary, marginTop: 8 }]} onPress={() => handleAdd(query.trim(), "Other")}>
                  <Text style={[styles.addCustomText, { color: colors.primaryForeground }]}>Add "{query.trim()}"</Text>
                </TouchableOpacity>
              )}
              {!query.trim() && (
                <View style={[styles.muscleChips, { marginTop: 10 }]}>
                  {muscleGroups.map((mg) => (
                    <TouchableOpacity
                      key={mg}
                      style={[styles.muscleChip, { backgroundColor: selectedMuscle === mg ? colors.primary : colors.muted, borderColor: colors.border }]}
                      onPress={() => setSelectedMuscle(selectedMuscle === mg ? null : mg)}
                    >
                      <Text style={[styles.muscleChipText, { color: selectedMuscle === mg ? colors.primaryForeground : colors.mutedForeground }]}>{mg}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {filtered.map((e) => (
                <TouchableOpacity key={e.name} style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={() => handleAdd(e.name, e.muscleGroup, e.type)}>
                  <Text style={[styles.listItemText, { color: colors.foreground }]}>{e.name}</Text>
                  <Text style={[styles.listItemMeta, { color: colors.mutedForeground }]}>{e.muscleGroup}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={{ alignItems: "center", paddingVertical: 10 }} onPress={() => { setShowPicker(false); setQuery(""); setSelectedMuscle(null); }}>
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

function SummaryModal({ visible, exercises, allSets, elapsed, shareOnFeed, notes, onShareToggle, onNotesChange, onFinish }: {
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
          <TouchableOpacity style={[styles.shareRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onShareToggle} activeOpacity={0.8}>
            <Ionicons name={shareOnFeed ? "checkbox" : "square-outline"} size={20} color={shareOnFeed ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.shareText, { color: colors.foreground }]}>Share on feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.finishSummaryBtn, { backgroundColor: colors.primary }]} onPress={onFinish} activeOpacity={0.85}>
            <Ionicons name="flag" size={18} color={colors.primaryForeground} />
            <Text style={[styles.finishSummaryText, { color: colors.primaryForeground }]}>{shareOnFeed ? "Post & Finish" : "Finish"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── SetRow ───────────────────────────────────────────────────────────────────

function SetRow({ set, prevSet, weightUnit, repMode, isCardio, onUpdate, onCompleteRequest, onUndo, onDelete, onSwipeActive, onSwipeIdle }: {
  set: LocalSet;
  prevSet?: LocalSet;
  weightUnit: "kg" | "lbs";
  repMode: "reps" | "time";
  isCardio: boolean;
  onUpdate: (patch: Partial<LocalSet>) => void;
  onCompleteRequest: () => void;
  onUndo: () => void;
  onDelete: () => void;
  onSwipeActive?: () => void;
  onSwipeIdle?: () => void;
}) {
  const colors = useColors();
  const isDropset = set.type === "dropset";
  const swipeX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const snapTo = (toValue: number, open: boolean) => {
    Animated.spring(swipeX, {
      toValue,
      useNativeDriver: true,
      bounciness: 3,
      speed: 14,
    }).start();
    isOpen.current = open;
  };

  const isHorizontal = (g: { dx: number; dy: number }) =>
    Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Claim on clearly horizontal moves (lower threshold = claims sooner = less scroll bleed)
      onMoveShouldSetPanResponder: (_, g) => isHorizontal(g),
      onMoveShouldSetPanResponderCapture: (_, g) => isHorizontal(g),
      // Disable ScrollView the moment our gesture is granted
      onPanResponderGrant: () => { onSwipeActive?.(); },
      // Keep the gesture — don't hand it back to ScrollView
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -80 : 0;
        const dx = Math.min(Math.max(g.dx + base, -80), 0);
        swipeX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        onSwipeIdle?.();
        // If row is open: ANY rightward swipe (dx > 5) closes it
        if (isOpen.current && g.dx > 5) { snapTo(0, false); return; }
        // Velocity-based snap (fluid flick)
        if (g.vx > 0.3) { snapTo(0, false); return; }
        if (g.vx < -0.3) { snapTo(-80, true); return; }
        // Position-based snap
        const finalOffset = g.dx + (isOpen.current ? -80 : 0);
        if (finalOffset < -40) snapTo(-80, true);
        else snapTo(0, false);
      },
      onPanResponderTerminate: () => { onSwipeIdle?.(); snapTo(0, false); },
    })
  ).current;

  const closeSwipe = () => {
    if (isOpen.current) snapTo(0, false);
  };

  const formatMmSs = (val: string) => {
    let v = val.replace(/[^0-9:]/g, "");
    const parts = v.split(":");
    if (parts.length > 2) v = parts[0] + ":" + parts.slice(1).join("");
    if (v.split(":").length === 2) {
      const [m, s] = v.split(":");
      v = m + ":" + s.slice(0, 2);
    }
    return v;
  };

  return (
    // setRowWrap has an opaque background so the red button NEVER bleeds through
    <View style={[styles.setRowWrap, isDropset && { marginLeft: 14 }, { backgroundColor: colors.card }]}>
      {/* Delete button — hidden behind the row until swiped */}
      <View style={[styles.deleteReveal, { backgroundColor: colors.destructive }]}>
        <TouchableOpacity style={styles.deleteRevealBtn} onPress={onDelete}>
          <Ionicons name="trash" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.setRow,
          isDropset && { borderLeftWidth: 2, borderLeftColor: colors.primary + "40", paddingLeft: 8 },
          // Dim text/inputs for completed rows but keep background opaque
          { transform: [{ translateX: swipeX }], backgroundColor: colors.card },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity onPress={closeSwipe} activeOpacity={1} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, opacity: set.completed ? 0.55 : 1 }}>
          <Text style={[styles.setLabel, { color: isDropset ? colors.primary + "90" : colors.mutedForeground }]}>
            {isDropset ? "DS" : set.setNumber}
          </Text>

          {isCardio ? (
            <TextInput
              style={[styles.setInput, { flex: 1, backgroundColor: colors.muted, color: colors.foreground, borderColor: set.completed ? colors.primary + "30" : colors.border }]}
              value={set.reps}
              onChangeText={(v) => onUpdate({ reps: v })}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.mutedForeground + "50"}
              editable={!set.completed}
            />
          ) : (
            <>
              <TextInput
                style={[styles.setInput, { flex: 1, backgroundColor: colors.muted, borderColor: set.completed ? colors.primary + "30" : colors.border,
                  color: set.prefilled ? colors.mutedForeground : colors.foreground }]}
                value={set.weight}
                onChangeText={(v) => onUpdate({ weight: v, prefilled: false })}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.mutedForeground + "50"}
                editable={!set.completed}
              />
              <Text style={[styles.setX, { color: colors.mutedForeground }]}>×</Text>
              {repMode === "time" ? (
                <TextInput
                  style={[styles.setInput, { flex: 1, backgroundColor: colors.muted, borderColor: set.completed ? colors.primary + "30" : colors.border,
                    color: set.prefilled ? colors.mutedForeground : colors.foreground }]}
                  value={set.reps}
                  onChangeText={(v) => onUpdate({ reps: formatMmSs(v), prefilled: false })}
                  keyboardType="numbers-and-punctuation"
                  placeholder="0:00"
                  placeholderTextColor={colors.mutedForeground + "50"}
                  editable={!set.completed}
                />
              ) : (
                <TextInput
                  style={[styles.setInput, { flex: 1, backgroundColor: colors.muted, borderColor: set.completed ? colors.primary + "30" : colors.border,
                    color: set.prefilled ? colors.mutedForeground : colors.foreground }]}
                  value={set.reps}
                  onChangeText={(v) => onUpdate({ reps: v, prefilled: false })}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.mutedForeground + "50"}
                  editable={!set.completed}
                />
              )}
              <View style={[styles.rirBadge, { backgroundColor: set.rir && !set.prefilled ? colors.primary + "20" : colors.muted, borderColor: set.rir && !set.prefilled ? colors.primary + "50" : colors.border }]}>
                <Text style={[styles.rirBadgeText, { color: set.rir && !set.prefilled ? colors.primary : colors.mutedForeground + "50" }]}>
                  {set.rir || "—"}
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.checkBtn,
            { backgroundColor: set.completed ? colors.primary : "transparent", borderColor: set.completed ? colors.primary : colors.border },
            set.completed && { opacity: 0.7 },
          ]}
          onPress={() => {
            closeSwipe();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (set.completed) onUndo(); else onCompleteRequest();
          }}
        >
          <Ionicons name="checkmark" size={14} color={set.completed ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

const REP_CHIPS   = ["1","2","3","4","5","6","8","10","12","15","20","AMRAP"] as const;
const TIME_CHIPS  = ["20s","30s","45s","60s","90s","2min","3min"] as const;

// ─── PhotoLightbox ────────────────────────────────────────────────────────────

function PhotoLightbox({
  uri,
  onClose,
  onEditPress,
}: {
  uri: string;
  onClose: () => void;
  onEditPress?: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.93)", justifyContent: "center", alignItems: "center" }}>
        {/* Close */}
        <TouchableOpacity
          style={{ position: "absolute", top: 56, right: 20, zIndex: 10, padding: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)" }}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Image */}
        <Image source={{ uri }} style={{ width: "100%", height: "65%", resizeMode: "contain" }} />

        {/* Bottom actions */}
        {onEditPress && (
          <TouchableOpacity
            onPress={onEditPress}
            style={{ marginTop: 28, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" }}>Replace / Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

function ExerciseCardImpl({ exercise, sets, prevSets, weightUnit, extra, isDragMode, isDragging, onSetsChange, onCompleteRequest, onSwapPress, onExtraChange, onRepRangeChange, onStartDrag, onDragMove, onDragEnd, onSwipeActive, onSwipeIdle }: {
  exercise: Exercise;
  sets: LocalSet[];
  prevSets: LocalSet[];
  weightUnit: "kg" | "lbs";
  extra: ExerciseExtra;
  isDragMode: boolean;
  isDragging: boolean;
  onSetsChange: (sets: LocalSet[]) => void;
  onCompleteRequest: (setIdx: number) => void;
  onSwapPress: () => void;
  onExtraChange: (patch: Partial<ExerciseExtra>) => void;
  onRepRangeChange: (newReps: string) => void;
  onStartDrag: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
  onSwipeActive?: () => void;
  onSwipeIdle?: () => void;
}) {
  const colors = useColors();
  const { workoutLogs, weightUnit: ctxWeightUnit } = useWorkout();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [repPickerOpen, setRepPickerOpen] = useState(false);
  const [rangeFirst, setRangeFirst] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"reps" | "time">(extra.repMode);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const completedCount = sets.filter((s) => s.completed).length;
  const isCardio = exercise.type === "cardio";

  // ── Rep range chip handler ─────────────────────────────────────────────────
  const handleRepChip = (val: string) => {
    if (pickerMode === "time") {
      onRepRangeChange(val);
      onExtraChange({ repMode: "time", timerVisible: true });
      setRangeFirst(null);
      return;
    }
    if (val === "AMRAP") {
      onRepRangeChange("AMRAP");
      setRangeFirst(null);
      return;
    }
    if (!rangeFirst) {
      setRangeFirst(val);
    } else if (val === rangeFirst) {
      onRepRangeChange(val);
      setRangeFirst(null);
    } else {
      const a = parseFloat(rangeFirst), b = parseFloat(val);
      onRepRangeChange(a <= b ? `${rangeFirst}-${val}` : `${val}-${rangeFirst}`);
      setRangeFirst(null);
    }
  };

  // ── Drag-to-reorder via long press ─────────────────────────────────────────
  const isDraggingRef = useRef(false);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  const onStartDragRef = useRef(onStartDrag);
  const onSetsChangeRef = useRef(onSetsChange);
  const onCompleteRequestRef = useRef(onCompleteRequest);
  const onSwapPressRef = useRef(onSwapPress);
  const onExtraChangeRef = useRef(onExtraChange);
  const onRepRangeChangeRef = useRef(onRepRangeChange);
  const onSwipeActiveRef = useRef(onSwipeActive);
  const onSwipeIdleRef = useRef(onSwipeIdle);
  useEffect(() => { onDragMoveRef.current = onDragMove; }, [onDragMove]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { onStartDragRef.current = onStartDrag; }, [onStartDrag]);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { onSetsChangeRef.current = onSetsChange; }, [onSetsChange]);
  useEffect(() => { onCompleteRequestRef.current = onCompleteRequest; }, [onCompleteRequest]);
  useEffect(() => { onSwapPressRef.current = onSwapPress; }, [onSwapPress]);
  useEffect(() => { onExtraChangeRef.current = onExtraChange; }, [onExtraChange]);
  useEffect(() => { onRepRangeChangeRef.current = onRepRangeChange; }, [onRepRangeChange]);
  useEffect(() => { onSwipeActiveRef.current = onSwipeActive; }, [onSwipeActive]);
  useEffect(() => { onSwipeIdleRef.current = onSwipeIdle; }, [onSwipeIdle]);

  const dragPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isDraggingRef.current,
      onStartShouldSetPanResponderCapture: () => isDraggingRef.current,
      onMoveShouldSetPanResponder: () => isDraggingRef.current,
      onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => { onDragMoveRef.current(g.dy); },
      onPanResponderRelease: () => { isDraggingRef.current = false; onDragEndRef.current(); },
      onPanResponderTerminate: () => { isDraggingRef.current = false; onDragEndRef.current(); },
    })
  ).current;

  const handleLongPressName = () => {
    isDraggingRef.current = true; // set synchronously so PanResponder is ready immediately
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onStartDragRef.current();
  };

  // ── Drag mode: all cards collapse to name-only rows ───────────────────────
  if (isDragMode) {
    return (
      <View
        style={[
          styles.dragCollapsedCard,
          {
            borderColor: isDragging ? colors.primary : colors.border,
            backgroundColor: isDragging ? colors.primary + "18" : colors.muted + "25",
          },
        ]}
        {...(isDragging ? dragPanResponder.panHandlers : {})}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onLongPress={handleLongPressName}
          delayLongPress={500}
          activeOpacity={0.7}
          disabled={isDragging}
        >
          <Text style={[styles.exName, { color: isDragging ? colors.primary : colors.mutedForeground }]}>
            {exercise.name}
          </Text>
        </TouchableOpacity>
        {isDragging ? (
          <Ionicons name="reorder-three-outline" size={20} color={colors.primary + "80"} />
        ) : (
          <Ionicons name="reorder-three-outline" size={16} color={colors.mutedForeground + "40"} />
        )}
      </View>
    );
  }

  const updateSet = (i: number, patch: Partial<LocalSet>) => {
    onSetsChange(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const undoSet = (i: number) => onSetsChange(sets.map((s, idx) => (idx === i ? { ...s, completed: false } : s)));
  const deleteSet = (i: number) => onSetsChange(sets.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, setNumber: idx + 1 })));
  const addSet = () => {
    const drop = exercise.dropSetCount ?? 0;
    const next = [...sets];
    const nextNum = next.length + 1;
    next.push({ setNumber: nextNum, weight: "", reps: "", rir: "", rpe: "", completed: false, type: "normal" });
    for (let d = 0; d < drop; d++) {
      next.push({ setNumber: nextNum + d + 1, weight: "", reps: "", rir: "", rpe: "", completed: false, type: "dropset" });
    }
    onSetsChange(next);
  };

  const handlePhotoPress = async () => {
    const choice = await new Promise<"camera" | "library" | null>((resolve) => {
      Alert.alert("Exercise Photo", `Add photo for ${exercise.name}`, [
        { text: "Take Photo", onPress: () => resolve("camera") },
        { text: "Choose Library", onPress: () => resolve("library") },
        extra.photo ? { text: "Remove Photo", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem(PHOTO_KEY(exercise.name));
          onExtraChange({ photo: null });
          resolve(null);
        }} : null,
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ].filter(Boolean) as any);
    });

    if (!choice) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (choice === "camera") {
      const camStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus.status !== "granted") { Alert.alert("Permission needed", "Camera access is required."); return; }
    } else if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required."); return;
    }

    const result = choice === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7, allowsEditing: true, aspect: [1, 1] });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      await AsyncStorage.setItem(PHOTO_KEY(exercise.name), uri);
      onExtraChange({ photo: uri });
    }
  };

  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.exHeader}>
        {/* Photo thumbnail / camera button */}
        <TouchableOpacity
          onPress={() => extra.photo ? setLightboxUri(extra.photo) : handlePhotoPress()}
          onLongPress={() => extra.photo ? handlePhotoPress() : undefined}
          delayLongPress={400}
          style={styles.photoBtn}
          activeOpacity={0.8}
        >
          {extra.photo ? (
            <Image source={{ uri: extra.photo }} style={styles.photoThumb} />
          ) : (
            <View style={[styles.photoPlaceholder, { borderColor: colors.border }]}>
              <Ionicons name="camera-outline" size={16} color={colors.mutedForeground} />
            </View>
          )}
        </TouchableOpacity>

        {/* Name + meta — tap = history, long press = drag/reorder */}
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setHistoryModalOpen(true)}
          onLongPress={handleLongPressName}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          <Text style={[styles.exName, { color: colors.foreground }]}>{exercise.name}</Text>
          <Text style={[styles.exMeta, { color: colors.mutedForeground }]}>
            {isCardio
              ? `cardio · ${exercise.reps}`
              : `${exercise.muscleGroup} · ${exercise.sets}×${exercise.reps} · ${exercise.restSeconds}s`}
          </Text>
        </TouchableOpacity>

        {/* Right controls */}
        <View style={styles.exHeaderRight}>
          {/* Rep range target button */}
          {!isCardio && (
            <TouchableOpacity
              style={[
                styles.repRangeBtn,
                {
                  borderColor: repPickerOpen ? colors.primary : colors.border,
                  backgroundColor: repPickerOpen ? colors.primary + "18" : "transparent",
                },
              ]}
              onPress={() => setRepPickerOpen((v) => !v)}
            >
              <Text style={[styles.repRangeBtnText, { color: repPickerOpen ? colors.primary : colors.mutedForeground }]}>
                {exercise.reps || "—"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.swapBtn, { borderColor: colors.border }]} onPress={onSwapPress}>
            <Ionicons name="swap-horizontal-outline" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.exProgressText, { color: colors.mutedForeground }]}>{completedCount}/{sets.length}</Text>
        </View>
      </View>

      {/* ── Inline Rep Range Picker ──────────────────────────────────────────── */}
      {repPickerOpen && !isCardio && (
        <View style={[styles.repPickerWrap, { borderTopColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.muted + "25" }]}>
          {/* Mode toggle */}
          <View style={styles.repPickerModeRow}>
            {(["reps", "time"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.repPickerModeBtn,
                  {
                    borderColor: pickerMode === m ? colors.primary : colors.border,
                    backgroundColor: pickerMode === m ? colors.primary + "20" : "transparent",
                  },
                ]}
                onPress={() => {
                  setPickerMode(m);
                  setRangeFirst(null);
                  if (m === "reps") onExtraChange({ repMode: "reps", timerVisible: false });
                }}
              >
                <Text style={[styles.repPickerModeTxt, { color: pickerMode === m ? colors.primary : colors.mutedForeground }]}>
                  {m === "reps" ? "Reps" : "Time"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hint */}
          <Text style={[styles.repPickerHint, { color: colors.mutedForeground }]}>
            {pickerMode === "reps"
              ? rangeFirst
                ? `Start: ${rangeFirst} — tap an end value (or same to confirm)`
                : "Tap once for single · tap two numbers for a range"
              : "Tap a time target"}
          </Text>

          {/* Chips */}
          <View style={styles.repChips}>
            {(pickerMode === "reps" ? REP_CHIPS : TIME_CHIPS).map((val) => {
              const chipNum = val === "AMRAP" ? NaN : parseInt(val as string, 10);

              // Parse confirmed range from exercise.reps e.g. "5-10"
              const rangeMatch = !rangeFirst && exercise.reps?.match(/^(\d+)-(\d+)$/);
              const confirmedRange = rangeMatch
                ? { start: parseInt(rangeMatch[1]), end: parseInt(rangeMatch[2]) }
                : null;

              // Endpoint chips (full primary)
              const isEndpoint =
                rangeFirst === val ||
                (confirmedRange && (confirmedRange.start === chipNum || confirmedRange.end === chipNum));

              // In-between chips (lighter shade)
              const isInRange =
                !rangeFirst &&
                confirmedRange &&
                !isNaN(chipNum) &&
                chipNum > confirmedRange.start &&
                chipNum < confirmedRange.end;

              // Single (non-range) selection
              const isSingle = !rangeFirst && !confirmedRange && exercise.reps === val;

              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.repChip,
                    isEndpoint
                      ? { borderColor: colors.primary, backgroundColor: colors.primary }
                      : isInRange
                      ? { borderColor: colors.primary + "55", backgroundColor: colors.primary + "28" }
                      : isSingle
                      ? { borderColor: colors.primary, backgroundColor: colors.primary + "22" }
                      : { borderColor: colors.border, backgroundColor: colors.muted },
                  ]}
                  onPress={() => handleRepChip(val)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.repChipText,
                      {
                        color: isEndpoint
                          ? colors.primaryForeground
                          : isInRange || isSingle
                          ? colors.primary
                          : colors.foreground,
                      },
                    ]}
                  >
                    {val}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Current target */}
          {exercise.reps ? (
            <Text style={[styles.repPickerCurrent, { color: colors.primary }]}>
              Target: <Text style={{ fontWeight: "700" }}>{exercise.reps}</Text>
            </Text>
          ) : null}
        </View>
      )}

      {/* Notes section — top of card */}
      <TouchableOpacity
        style={[styles.notesToggle, { borderTopColor: colors.border }]}
        onPress={() => onExtraChange({ notesExpanded: !extra.notesExpanded })}
        activeOpacity={0.7}
      >
        <Ionicons name="document-text-outline" size={13} color={colors.mutedForeground} />
        <Text style={[styles.notesToggleText, { color: colors.mutedForeground }]}>
          {extra.notesExpanded ? "Hide notes" : extra.notes ? "Notes · " + extra.notes.slice(0, 24) + (extra.notes.length > 24 ? "…" : "") : "Add notes"}
        </Text>
        <Ionicons name={extra.notesExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
      </TouchableOpacity>
      {extra.notesExpanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 10, gap: 8 }}>
          {/* Text field + camera button row */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <TextInput
              style={[styles.notesField, { flex: 1, backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={extra.notes}
              onChangeText={(v) => onExtraChange({ notes: v })}
              placeholder="Exercise notes, cues, reminders..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[styles.notePhotoBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={async () => {
                const choice = await new Promise<"camera" | "library" | null>((resolve) => {
                  Alert.alert("Add Photo", "Add a photo to notes", [
                    { text: "Take Photo", onPress: () => resolve("camera") },
                    { text: "Choose Library", onPress: () => resolve("library") },
                    { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
                  ]);
                });
                if (!choice) return;
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (choice === "camera") {
                  const camStatus = await ImagePicker.requestCameraPermissionsAsync();
                  if (camStatus.status !== "granted") { Alert.alert("Permission needed", "Camera access is required."); return; }
                } else if (status !== "granted") {
                  Alert.alert("Permission needed", "Photo library access is required."); return;
                }
                const result = choice === "camera"
                  ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8, allowsEditing: false })
                  : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8, allowsEditing: false });
                if (!result.canceled && result.assets[0]) {
                  const uri = result.assets[0].uri;
                  onExtraChange({ notePhotos: [...(extra.notePhotos ?? []), uri] });
                }
              }}
            >
              <Ionicons name="camera-outline" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Note photo strip */}
          {(extra.notePhotos ?? []).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {(extra.notePhotos ?? []).map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setLightboxUri(uri)}
                  onLongPress={() => {
                    Alert.alert("Remove Photo", "Remove this photo from notes?", [
                      { text: "Remove", style: "destructive", onPress: () => {
                        const updated = (extra.notePhotos ?? []).filter((_, i) => i !== idx);
                        onExtraChange({ notePhotos: updated });
                      }},
                      { text: "Cancel", style: "cancel" },
                    ]);
                  }}
                  delayLongPress={400}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri }} style={styles.notePhotoThumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Full exercise history modal */}
      <ExerciseHistoryModal
        visible={historyModalOpen}
        exerciseName={exercise.name}
        workoutLogs={workoutLogs}
        weightUnit={weightUnit}
        onClose={() => setHistoryModalOpen(false)}
      />

      {/* Per-exercise timer (shown in time mode) */}
      {extra.timerVisible && (
        <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
          <ExerciseTimerWidget onRemove={() => onExtraChange({ timerVisible: false, repMode: "reps" })} />
        </View>
      )}

      {/* Column headers */}
      <View style={styles.setColHeaders}>
        <Text style={[styles.colHeader, { width: 26, color: colors.mutedForeground }]}>Set</Text>
        {isCardio ? (
          <Text style={[styles.colHeader, { flex: 1, textAlign: "center", color: colors.mutedForeground }]}>Value</Text>
        ) : (
          <>
            <Text style={[styles.colHeader, { flex: 1, textAlign: "center", color: colors.mutedForeground }]}>Wt ({weightUnit})</Text>
            <Text style={[styles.colHeader, { width: 14 }]} />
            <Text style={[styles.colHeader, { flex: 1, textAlign: "center", color: colors.mutedForeground }]}>{extra.repMode === "time" ? "Time" : "Reps"}</Text>
            <Text style={[styles.colHeader, { width: 38, textAlign: "center", color: colors.mutedForeground }]}>RIR</Text>
          </>
        )}
        <Text style={[styles.colHeader, { width: 34 }]} />
      </View>

      {/* Sets */}
      {sets.map((set, i) => (
        <SetRow
          key={i}
          set={set}
          prevSet={prevSets[i]}
          weightUnit={weightUnit}
          repMode={extra.repMode}
          isCardio={isCardio}
          onUpdate={(patch) => updateSet(i, patch)}
          onCompleteRequest={() => onCompleteRequest(i)}
          onUndo={() => undoSet(i)}
          onDelete={() => deleteSet(i)}
          onSwipeActive={onSwipeActive}
          onSwipeIdle={onSwipeIdle}
        />
      ))}

      {/* Add set */}
      <TouchableOpacity style={[styles.addSetBtn, { borderColor: colors.border }]} onPress={addSet} activeOpacity={0.7}>
        <Ionicons name="add" size={13} color={colors.primary} />
        <Text style={[styles.addSetText, { color: colors.primary }]}>Add set</Text>
      </TouchableOpacity>

      {/* Photo lightbox (exercise photo + note photos) */}
      {lightboxUri && (
        <PhotoLightbox
          uri={lightboxUri}
          onClose={() => setLightboxUri(null)}
          onEditPress={lightboxUri === extra.photo ? () => {
            setLightboxUri(null);
            handlePhotoPress();
          } : undefined}
        />
      )}

    </View>
  );
}

const ExerciseCard = React.memo(ExerciseCardImpl, (prev, next) => {
  return (
    prev.exercise === next.exercise &&
    prev.sets === next.sets &&
    prev.prevSets === next.prevSets &&
    prev.weightUnit === next.weightUnit &&
    prev.extra === next.extra &&
    prev.isDragMode === next.isDragMode &&
    prev.isDragging === next.isDragging
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeWorkout, workoutLogs, finishWorkout, cancelWorkout, weightUnit, streak } = useWorkout();
  const { addPost } = useSocial();
  const { elapsed, formatted } = useWorkoutTimer(!!activeWorkout?.isActive);

  const [localExercises, setLocalExercises] = useState<Exercise[]>([]);
  const [allSets, setAllSets] = useState<Record<string, LocalSet[]>>({});
  const [extras, setExtras] = useState<Record<string, ExerciseExtra>>({});
  const [restTimer, setRestTimer] = useState<{ seconds: number } | null>(null);
  const [restNotification, setRestNotification] = useState<RestNotification | null>(null);
  const [currentGame, setCurrentGame] = useState<GameType | null>(null);
  const [pendingComplete, setPendingComplete] = useState<{ exId: string; setIdx: number } | null>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [showEditExercises, setShowEditExercises] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [shareOnFeed, setShareOnFeed] = useState(true);
  const [showStreak, setShowStreak] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isAnySwiping, setIsAnySwiping] = useState(false);
  const lastSwapYRef = useRef(0);
  const DRAG_ITEM_HEIGHT = 56; // collapsed card height + gap

  const pendingSetTypeRef = useRef<"normal" | "dropset">("normal");
  const pendingRestSecondsRef = useRef(90);

  // Pre-compute previous sets per exercise — avoids O(n×m) work on every render tick
  const prevSetsMap = useMemo(() => {
    const map: Record<string, LocalSet[]> = {};
    localExercises.forEach((ex) => {
      map[ex.id] = getPrevSets(ex.name, workoutLogs);
    });
    return map;
  }, [localExercises, workoutLogs]);

  // All-time bests for PR detection
  const allTimeBests = useMemo(() => {
    const bests: Record<string, { maxWeight: number; maxRepsAtMaxWeight: number }> = {};
    workoutLogs.forEach((log) => {
      log.setLogs.forEach((sl) => {
        if (!sl.completed || sl.type === "dropset") return;
        const key = sl.exerciseName.toLowerCase();
        const w = sl.weight ?? 0;
        const r = sl.reps ?? 0;
        if (!bests[key]) {
          bests[key] = { maxWeight: w, maxRepsAtMaxWeight: r };
        } else if (w > bests[key].maxWeight) {
          bests[key] = { maxWeight: w, maxRepsAtMaxWeight: r };
        } else if (w === bests[key].maxWeight && r > bests[key].maxRepsAtMaxWeight) {
          bests[key].maxRepsAtMaxWeight = r;
        }
      });
    });
    return bests;
  }, [workoutLogs]);

  useEffect(() => {
    if (!activeWorkout) return;
    const exs = activeWorkout.exercises;
    setLocalExercises(exs);
    const initialSets: Record<string, LocalSet[]> = {};
    const initialExtras: Record<string, ExerciseExtra> = {};
    exs.forEach((ex) => {
      const prev = getPrevSets(ex.name, workoutLogs);
      initialSets[ex.id] = buildInitialSets(ex).map((set, i) => {
        const p = prev[i];
        if (p && (p.weight || p.reps)) {
          return { ...set, weight: p.weight, reps: p.reps, rir: p.rir, rpe: p.rpe, prefilled: true };
        }
        return set;
      });
      initialExtras[ex.id] = defaultExtra();
    });
    setAllSets(initialSets);

    // Load persisted photos
    exs.forEach(async (ex) => {
      const stored = await AsyncStorage.getItem(PHOTO_KEY(ex.name));
      if (stored) {
        setExtras((prev) => ({ ...prev, [ex.id]: { ...(prev[ex.id] ?? defaultExtra()), photo: stored } }));
      }
    });
    setExtras(initialExtras);
  }, []);

  useEffect(() => {
    if (!activeWorkout) router.replace("/");
  }, [activeWorkout]);

  if (!activeWorkout) return null;

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const color = SESSION_COLORS[activeWorkout.sessionType] ?? colors.primary;
  const allFlatSets = Object.values(allSets).flat();
  const completedTotal = allFlatSets.filter((s) => s.completed).length;
  const totalSets = allFlatSets.length;
  const progress = totalSets > 0 ? completedTotal / totalSets : 0;
  const allDone = totalSets > 0 && completedTotal === totalSets;

  const updateExtra = (exId: string, patch: Partial<ExerciseExtra>) => {
    setExtras((prev) => ({ ...prev, [exId]: { ...(prev[exId] ?? defaultExtra()), ...patch } }));
  };

  const handleDragStart = (exId: string) => {
    lastSwapYRef.current = 0;
    setDragMode(true);
    setDraggingId(exId);
  };

  const handleDragMove = (exId: string, dy: number) => {
    const delta = dy - lastSwapYRef.current;
    if (delta > DRAG_ITEM_HEIGHT / 2) {
      setLocalExercises((prev) => {
        const idx = prev.findIndex((e) => e.id === exId);
        if (idx >= prev.length - 1) return prev;
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
      lastSwapYRef.current += DRAG_ITEM_HEIGHT;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (delta < -DRAG_ITEM_HEIGHT / 2) {
      setLocalExercises((prev) => {
        const idx = prev.findIndex((e) => e.id === exId);
        if (idx <= 0) return prev;
        const next = [...prev];
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        return next;
      });
      lastSwapYRef.current -= DRAG_ITEM_HEIGHT;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleDragEnd = () => {
    setDragMode(false);
    setDraggingId(null);
    lastSwapYRef.current = 0;
  };

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
    const ex = localExercises.find((e) => e.id === exId);
    const set = allSets[exId]?.[setIdx];

    setAllSets((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((s, i) =>
        i === setIdx ? { ...s, completed: true, rir: rir != null ? rir.toString() : s.rir } : s
      ),
    }));

    setPendingComplete(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Build notification: rep-range feedback first, PR overrides it
    let notif: RestNotification | null = null;

    if (ex && set && ex.type !== "cardio" && set.reps && ex.reps) {
      const actualReps = parseInt(set.reps) || 0;
      const result = getRepResult(actualReps, ex.reps);
      if (result) notif = { ...REP_FEEDBACK[result] };
    }

    if (ex && set && ex.type !== "cardio" && set.weight && set.reps) {
      const key = ex.name.toLowerCase();
      const best = allTimeBests[key];
      const w = parseFloat(set.weight) || 0;
      const r = parseInt(set.reps) || 0;

      if (!best && w > 0) {
        notif = {
          emoji: "🎉", title: `First ${ex.name}!`,
          message: "Your baseline is set. Keep going!",
          color: colors.primary,
        };
      } else if (best && w > best.maxWeight) {
        notif = {
          emoji: "🏆", title: "New PR!",
          message: `${ex.name}: ${w}${weightUnit} × ${r} reps`,
          color: "#F59E0B",
        };
      } else if (best && w === best.maxWeight && r > best.maxRepsAtMaxWeight) {
        notif = {
          emoji: "🏆", title: "New PR!",
          message: `${ex.name}: ${r} reps at ${w}${weightUnit}`,
          color: "#F59E0B",
        };
      }
    }

    setRestNotification(notif);

    if (pendingSetTypeRef.current !== "dropset" && pendingRestSecondsRef.current > 0) {
      setRestTimer({ seconds: pendingRestSecondsRef.current });
    }
  };

  // ─── Exercise management ────────────────────────────────────────────────────

  const addExercise = (ex: Exercise) => {
    setLocalExercises((prev) => [...prev, ex]);
    setAllSets((prev) => ({ ...prev, [ex.id]: buildInitialSets(ex) }));
    setExtras((prev) => ({ ...prev, [ex.id]: defaultExtra() }));
  };

  const removeExercise = (id: string) => {
    setLocalExercises((prev) => prev.filter((e) => e.id !== id));
    setAllSets((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
    setExtras((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  };

  const swapExercise = (exId: string, newName: string) => {
    setLocalExercises((prev) => prev.map((e) => (e.id === exId ? { ...e, name: newName } : e)));
  };

  // ─── Finish ─────────────────────────────────────────────────────────────────

  const handleFinish = () => {
    if (!allDone) {
      Alert.alert("Finish Workout", `${totalSets - completedTotal} sets still incomplete. Finish anyway?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Finish", onPress: () => setShowSummary(true) },
      ]);
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
    // Build the set logs array synchronously — calling logSet() then finishWorkout()
    // immediately after is a race condition because React state updates are async,
    // so activeWorkout.setLogs is still [] by the time finishWorkout reads it.
    const builtSetLogs: SetLog[] = [];
    const now = new Date().toISOString();

    for (const [exId, sets] of Object.entries(allSets)) {
      const ex = localExercises.find((e) => e.id === exId);
      sets.forEach((set) => {
        if (set.completed) {
          builtSetLogs.push({
            id: `${Date.now().toString()}_${exId}_${set.setNumber}_${Math.random().toString(36).substr(2, 4)}`,
            exerciseId: exId,
            exerciseName: ex?.name ?? "",
            muscleGroup: ex?.muscleGroup ?? "",
            setNumber: set.setNumber,
            reps: parseInt(set.reps) || 0,
            weight: parseFloat(set.weight) || 0,
            unit: weightUnit,
            completed: true,
            type: set.type,
            timestamp: now,
            rir: set.rir !== "" && set.rir != null ? parseFloat(set.rir) : null,
            rpe: set.rpe !== "" && set.rpe != null ? parseFloat(set.rpe) : null,
          });
        }
      });
    }

    const builtExerciseNotes: Record<string, string> = {};
    localExercises.forEach((ex) => {
      const note = extras[ex.id]?.notes?.trim();
      if (note) builtExerciseNotes[ex.name] = note;
    });

    try {
      await finishWorkout(notes, builtSetLogs, builtExerciseNotes);
    } catch (err: any) {
      Alert.alert(
        "Save Failed",
        `Could not save workout: ${err?.message ?? String(err)}\n\nMake sure you're connected to the internet and try again.`
      );
      return;
    }
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

    setShowSummary(false);
    if (streak > 1) {
      setShowStreak(true);
    } else {
      router.replace("/");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
        <TouchableOpacity style={[styles.editBtn, { borderColor: colors.border }]} onPress={() => setShowEditExercises(true)}>
          <Ionicons name="pencil-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: colors.muted }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` as any }]} />
      </View>
      <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{completedTotal}/{totalSets} sets</Text>

      {/* Drag hint banner */}
      {dragMode && (
        <View style={[styles.reorderBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Text style={[styles.reorderBannerText, { color: colors.primary }]}>
            Drag up or down · release to drop
          </Text>
        </View>
      )}

      {/* Exercises */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEnabled={!dragMode && !isAnySwiping}
        scrollEventThrottle={16}
        decelerationRate="normal"
      >
        {localExercises.map((ex, idx) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            sets={allSets[ex.id] ?? []}
            prevSets={prevSetsMap[ex.id] ?? []}
            weightUnit={weightUnit}
            extra={extras[ex.id] ?? defaultExtra()}
            isDragMode={dragMode}
            isDragging={draggingId === ex.id}
            onSetsChange={(newSets) => setAllSets((prev) => ({ ...prev, [ex.id]: newSets }))}
            onCompleteRequest={(setIdx) => handleCompleteRequest(ex.id, setIdx)}
            onSwapPress={() => setSwapTarget(ex.id)}
            onExtraChange={(patch) => updateExtra(ex.id, patch)}
            onRepRangeChange={(newReps) =>
              setLocalExercises((prev) =>
                prev.map((e) => (e.id === ex.id ? { ...e, reps: newReps } : e))
              )
            }
            onStartDrag={() => handleDragStart(ex.id)}
            onDragMove={(dy) => handleDragMove(ex.id, dy)}
            onDragEnd={handleDragEnd}
            onSwipeActive={() => setIsAnySwiping(true)}
            onSwipeIdle={() => setIsAnySwiping(false)}
          />
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border, paddingBottom: bottomPad + 8, backgroundColor: colors.background }]}>
        <TouchableOpacity style={[styles.discardBtn, { borderColor: colors.destructive }]} onPress={handleCancel}>
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
        onClose={() => { setRestTimer(null); setRestNotification(null); }}
        notification={restNotification}
        currentGame={currentGame}
        onGameChange={setCurrentGame}
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

      {/* Streak celebration */}
      {showStreak && (
        <StreakCelebration streak={streak} onDone={() => { setShowStreak(false); router.replace("/"); }} />
      )}
    </View>
    </TouchableWithoutFeedback>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Streak celebration
  streakOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" },
  streakCard: { borderRadius: 28, borderWidth: 1, padding: 32, alignItems: "center", gap: 8, width: 280 },
  streakEmoji: { fontSize: 64 },
  streakNumber: { fontSize: 72, fontWeight: "700", fontFamily: "Inter_700Bold" },
  streakLabel: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  streakSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },
  streakBtn: { marginTop: 16, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40 },
  streakBtnText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { alignItems: "center", gap: 4 },
  sessionPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  sessionPillText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  timerText: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  editBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Progress
  progressBg: { height: 3 },
  progressFill: { height: 3 },
  progressText: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center", paddingVertical: 5 },

  // Reorder
  reorderBanner: {
    marginHorizontal: 12, marginBottom: 6, borderRadius: 10, borderWidth: 1,
    paddingVertical: 7, paddingHorizontal: 12,
  },
  reorderBannerText: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },

  // Scroll
  scrollContent: { padding: 12, gap: 10 },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, elevation: 10,
  },
  discardBtn: { borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  discardBtnText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  finishBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, paddingVertical: 14 },
  finishBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Exercise card
  exerciseCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  dragCollapsedCard: {
    borderRadius: 14, borderWidth: 1, overflow: "hidden",
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16, gap: 10,
  },
  exHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  exName: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  exMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  exHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  swapBtn: { borderWidth: 1, borderRadius: 8, padding: 5 },
  dragHandle: { padding: 4 },
  exProgressText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Photo
  photoBtn: { width: 42, height: 42, borderRadius: 10, overflow: "hidden" },
  photoThumb: { width: 42, height: 42, borderRadius: 10 },
  photoPlaceholder: { width: 42, height: 42, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  notePhotoBtn: { width: 42, height: 42, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notePhotoThumb: { width: 80, height: 80, borderRadius: 10 },

  // Rep range button (in header)
  repRangeBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  repRangeBtnText: { fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Inline rep range picker
  repPickerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  repPickerModeRow: { flexDirection: "row", gap: 8 },
  repPickerModeBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  repPickerModeTxt: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  repPickerHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  repChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  repChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  repChipText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  repPickerCurrent: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Rep mode toggle (kept for Time mode indicator, now unused as toggle but styles kept)
  repModeBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  repModeBtnText: { fontSize: 9, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Reorder controls
  reorderControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  reorderArrow: { padding: 4 },
  reorderDoneBtn: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  reorderDoneText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // History
  historyPanel: { marginHorizontal: 14, marginBottom: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 3 },
  historyEmpty: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  historyHeading: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  historyEntry: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Column headers
  setColHeaders: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: 4, gap: 6 },
  colHeader: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },

  // Set row
  setRowWrap: { position: "relative", overflow: "hidden" },
  deleteReveal: { position: "absolute", right: 0, top: 0, bottom: 0, width: 80, alignItems: "center", justifyContent: "center" },
  deleteRevealBtn: { width: 80, height: "100%" as any, alignItems: "center", justifyContent: "center" },
  setRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 5, gap: 6, backgroundColor: "transparent" },
  setLabel: { width: 26, fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  setInput: { height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 6, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  setX: { width: 14, fontSize: 14, textAlign: "center", fontFamily: "Inter_400Regular" },
  rirBadge: { width: 38, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rirBadgeText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  checkBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },

  // Add set
  addSetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, margin: 10, marginTop: 6, paddingVertical: 9, borderWidth: 1, borderStyle: "dashed", borderRadius: 10 },
  addSetText: { fontSize: 12, fontWeight: "500", fontFamily: "Inter_500Medium" },

  // Notes
  notesToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  notesToggleText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  notesField: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 64, textAlignVertical: "top" },

  // RIR picker
  rirOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  rirSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 20, paddingBottom: 40, gap: 12, alignItems: "center" },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  rirTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  rirSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  rirOptions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 4 },
  rirOption: { width: 72, height: 76, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  rirOptionVal: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  rirOptionSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
  rirSkipRow: { paddingVertical: 10 },
  rirSkipText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  // Exercise timer widget
  timerWidget: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10, marginBottom: 10 },
  timerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timerLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  timerModeRow: { flexDirection: "row", gap: 8 },
  timerModeBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  timerModeBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  timerInput: { height: 38, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  timerPreText: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  timerDisplay: { fontWeight: "700", fontFamily: "Inter_700Bold" },
  timerControls: { flexDirection: "row", gap: 8 },
  timerBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  timerBtnText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },

  // Full modal
  fullModal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  doneText: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  searchRow: { padding: 12 },
  searchInput: { height: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  listItem: { paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listItemText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  listItemMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Edit exercises
  editExRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  editExName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  editExMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  smallDeleteBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addExBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 14, paddingVertical: 14 },
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
  statsRow: { flexDirection: "row", borderRadius: 16, borderWidth: 1, overflow: "hidden", alignItems: "stretch" },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16, gap: 4 },
  statValue: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statDivider: { width: StyleSheet.hairlineWidth },
  notesCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  notesLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  notesInput: { fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 56 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  shareText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  finishSummaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, paddingVertical: 16 },
  finishSummaryText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
