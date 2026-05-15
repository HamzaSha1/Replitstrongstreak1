import React, { createContext, useContext, useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  orderBy,
  limit,
} from "@firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;          // e.g. "8-12"
  weight: number;
  unit: "kg" | "lbs";
  restSeconds: number;
  notes: string;
  type: "strength" | "cardio";
  rpe?: number;          // 1-10 Rate of Perceived Exertion
  dropSetCount?: number; // how many drop sets
  supersetGroup?: string;
}

export interface SplitDay {
  id: string;
  dayOfWeek: string;
  sessionType: string;
  exercises: Exercise[];
}

export interface Split {
  id: string;
  name: string;
  days: SplitDay[];
  createdAt: string;
}

export type SetType = "normal" | "dropset";

export interface SetLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;        // e.g. "Quads", "Chest" — for volume tracking
  setNumber: number;
  reps: number;
  weight: number;
  unit: "kg" | "lbs";
  completed: boolean;
  timestamp: string;
  type: SetType;
  rir?: number | null;        // Reps In Reserve (0–4+)
  rpe?: number | null;        // Rate of Perceived Exertion (1–10)
}

export interface WorkoutLog {
  id: string;
  userId: string;
  splitId: string;
  splitName: string;
  splitDayId: string;         // which day in the split was performed
  dayLabel: string;
  sessionType: string;
  startedAt: string;
  finishedAt?: string;
  durationMinutes?: number;
  setLogs: SetLog[];
  notes: string;
  exerciseNotes?: Record<string, string>; // per-exercise notes keyed by exercise name
  schemaVersion: number;      // bump when schema changes so stale writes are detectable
}

export interface WeightEntry {
  id: string;
  userId: string;
  date: string;
  weight: number;
  unit: "kg" | "lbs";
  photoUri?: string;
}

export interface ActiveWorkoutState {
  isActive: boolean;
  splitId: string;
  splitName: string;
  splitDayId: string;
  dayLabel: string;
  sessionType: string;
  exercises: Exercise[];
  setLogs: SetLog[];
  startedAt: string;
}

// ─── Exercise History Types ───────────────────────────────────────────────────

export interface ExerciseHistorySet {
  setNumber: number;
  reps: number;
  weight: number;
  unit: "kg" | "lbs";
  type: SetType;
  rir?: number | null;
  rpe?: number | null;
}

export interface ExerciseHistoryEntry {
  id: string;
  userId: string;
  exerciseName: string;
  muscleGroup: string;
  workoutLogId: string;
  splitId: string;
  splitName: string;
  splitDayId: string;
  sessionType: string;
  dayLabel: string;
  performedAt: string;        // ISO string
  sets: ExerciseHistorySet[];
}

interface WorkoutContextType {
  splits: Split[];
  workoutLogs: WorkoutLog[];
  weightEntries: WeightEntry[];
  activeWorkout: ActiveWorkoutState | null;
  isLoaded: boolean;
  addSplit: (split: Omit<Split, "id" | "createdAt">) => Promise<void>;
  updateSplit: (split: Split) => Promise<void>;
  deleteSplit: (splitId: string) => Promise<void>;
  startWorkout: (split: Split, day: SplitDay) => void;
  logSet: (set: Omit<SetLog, "id" | "timestamp">) => void;
  updateSet: (setId: string, updates: Partial<SetLog>) => void;
  finishWorkout: (notes: string, setLogs?: SetLog[], exerciseNotes?: Record<string, string>) => Promise<WorkoutLog>;
  cancelWorkout: () => void;
  addWeightEntry: (entry: Omit<WeightEntry, "id" | "userId">) => Promise<void>;
  deleteWeightEntry: (id: string) => Promise<void>;
  weightUnit: "kg" | "lbs";
  setWeightUnit: (unit: "kg" | "lbs") => void;
  streak: number;
  longestStreak: number;
  getLastWeightForExercise: (exerciseName: string) => { weight: number; unit: "kg" | "lbs" } | null;
  getExerciseHistory: (exerciseName: string) => Promise<ExerciseHistoryEntry[]>;
  getLastPerformance: (exerciseName: string) => Promise<ExerciseHistoryEntry | null>;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function calculateStreaks(logs: WorkoutLog[]): { streak: number; longestStreak: number } {
  if (logs.length === 0) return { streak: 0, longestStreak: 0 };

  const workoutDates = new Set(
    logs.filter((l) => l.finishedAt).map((l) => l.startedAt.split("T")[0])
  );
  const sortedDates = Array.from(workoutDates).sort().reverse();
  if (sortedDates.length === 0) return { streak: 0, longestStreak: 0 };

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let streak = 0;
  if (sortedDates[0] === today || sortedDates[0] === yesterday) {
    let current = new Date(sortedDates[0]);
    for (const dateStr of sortedDates) {
      const d = new Date(dateStr);
      const diff = Math.round((current.getTime() - d.getTime()) / 86400000);
      if (diff <= 1) { streak++; current = d; } else break;
    }
  }

  let longestStreak = 0;
  let currentRun = 1;
  const ascending = [...sortedDates].reverse();
  for (let i = 1; i < ascending.length; i++) {
    const prev = new Date(ascending[i - 1]);
    const curr = new Date(ascending[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) { currentRun++; if (currentRun > longestStreak) longestStreak = currentRun; }
    else currentRun = 1;
  }
  if (longestStreak === 0 && ascending.length > 0) longestStreak = 1;

  return { streak, longestStreak };
}

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";

  const [splits, setSplits] = useState<Split[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(null);
  const [weightUnit, setWeightUnitState] = useState<"kg" | "lbs">("kg");
  const [isLoaded, setIsLoaded] = useState(false);

  // Real-time listeners
  useEffect(() => {
    if (!uid) return;

    // Fallback: one-time fetch in case the real-time listener fails
    const fetchFallback = async () => {
      try {
        const [splitsSnap, logsSnap, weightSnap] = await Promise.all([
          getDocs(query(collection(db, "splits"), where("userId", "==", uid))),
          getDocs(query(collection(db, "workoutLogs"), where("userId", "==", uid))),
          getDocs(query(collection(db, "weightEntries"), where("userId", "==", uid))),
        ]);
        setSplits(splitsSnap.docs.map((d) => d.data() as Split));
        const logs = logsSnap.docs.map((d) => d.data() as WorkoutLog);
        logs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        setWorkoutLogs(logs);
        setIsLoaded(true);
        const entries = weightSnap.docs.map((d) => d.data() as WeightEntry);
        entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setWeightEntries(entries);
      } catch (e) {
        console.warn("Firestore fallback fetch failed:", e);
      }
    };

    const unsubSplits = onSnapshot(
      query(collection(db, "splits"), where("userId", "==", uid)),
      (snap) => {
        setSplits(snap.docs.map((d) => d.data() as Split));
      },
      (err) => {
        console.warn("splits listener error:", err.code, err.message);
        fetchFallback();
      }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, "workoutLogs"), where("userId", "==", uid)),
      (snap) => {
        const logs = snap.docs.map((d) => d.data() as WorkoutLog);
        logs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        setWorkoutLogs(logs);
        setIsLoaded(true);
      },
      (err) => {
        console.warn("workoutLogs listener error:", err.code, err.message);
        fetchFallback();
      }
    );

    const unsubWeight = onSnapshot(
      query(collection(db, "weightEntries"), where("userId", "==", uid)),
      (snap) => {
        const entries = snap.docs.map((d) => d.data() as WeightEntry);
        entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setWeightEntries(entries);
      },
      (err) => {
        console.warn("weightEntries listener error:", err.code, err.message);
      }
    );

    // Always do an immediate one-time fetch so data appears even if the
    // real-time listener takes a moment to connect or is blocked.
    fetchFallback();

    setIsLoaded(false);
    return () => { unsubSplits(); unsubLogs(); unsubWeight(); };
  }, [uid]);

  const addSplit = async (split: Omit<Split, "id" | "createdAt">) => {
    const id = generateId();
    const newSplit: Split & { userId: string } = {
      ...split,
      id,
      userId: uid,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "splits", id), newSplit);
  };

  const updateSplit = async (split: Split) => {
    await setDoc(doc(db, "splits", split.id), { ...split, userId: uid }, { merge: true });
  };

  const deleteSplit = async (splitId: string) => {
    await deleteDoc(doc(db, "splits", splitId));
  };

  const startWorkout = (split: Split, day: SplitDay) => {
    setActiveWorkout({
      isActive: true,
      splitId: split.id,
      splitName: split.name,
      splitDayId: day.id,
      dayLabel: day.dayOfWeek,
      sessionType: day.sessionType,
      exercises: day.exercises,
      setLogs: [],
      startedAt: new Date().toISOString(),
    });
  };

  const logSet = (set: Omit<SetLog, "id" | "timestamp">) => {
    if (!activeWorkout) return;
    const newSet: SetLog = { ...set, id: generateId(), timestamp: new Date().toISOString() };
    setActiveWorkout((prev) => prev ? { ...prev, setLogs: [...prev.setLogs, newSet] } : null);
  };

  const updateSet = (setId: string, updates: Partial<SetLog>) => {
    setActiveWorkout((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        setLogs: prev.setLogs.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
      };
    });
  };

  const finishWorkout = async (notes: string, setLogs?: SetLog[], exerciseNotes?: Record<string, string>): Promise<WorkoutLog> => {
    if (!activeWorkout) throw new Error("No active workout");
    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(activeWorkout.startedAt).getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    const id = generateId();

    // Use the explicitly passed setLogs if provided (avoids async state timing bug
    // where activeWorkout.setLogs is still [] when finishWorkout is called right
    // after logSet() calls).
    const logsToSave = setLogs ?? activeWorkout.setLogs;

    const log: WorkoutLog = {
      id,
      userId: uid,
      splitId: activeWorkout.splitId,
      splitName: activeWorkout.splitName,
      splitDayId: activeWorkout.splitDayId ?? "",
      dayLabel: activeWorkout.dayLabel,
      sessionType: activeWorkout.sessionType,
      startedAt: activeWorkout.startedAt,
      finishedAt,
      durationMinutes,
      setLogs: logsToSave,
      notes,
      exerciseNotes: exerciseNotes ?? {},
      schemaVersion: 2,
    };

    // Use a single batch for the workoutLog + all exerciseHistory docs so the
    // write is atomic — either everything saves or nothing does.
    const batch = writeBatch(db);

    batch.set(doc(db, "workoutLogs", id), log);

    // Write one exerciseHistory doc per unique exercise
    const completedSets = logsToSave.filter((s) => s.completed);
    if (completedSets.length > 0) {
      const byExercise = new Map<string, SetLog[]>();
      for (const s of completedSets) {
        const key = s.exerciseName;
        if (!byExercise.has(key)) byExercise.set(key, []);
        byExercise.get(key)!.push(s);
      }

      for (const [exerciseName, sets] of byExercise.entries()) {
        const historyId = generateId();
        const historyEntry: ExerciseHistoryEntry = {
          id: historyId,
          userId: uid,
          exerciseName,
          muscleGroup: sets[0]?.muscleGroup ?? "",
          workoutLogId: id,
          splitId: activeWorkout.splitId,
          splitName: activeWorkout.splitName,
          splitDayId: activeWorkout.splitDayId ?? "",
          sessionType: activeWorkout.sessionType,
          dayLabel: activeWorkout.dayLabel,
          performedAt: finishedAt,
          sets: sets
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((s) => ({
              setNumber: s.setNumber,
              reps: s.reps,
              weight: s.weight,
              unit: s.unit,
              type: s.type,
              rir: s.rir ?? null,
              rpe: s.rpe ?? null,
            })),
        };
        batch.set(doc(db, "exerciseHistory", historyId), historyEntry);
      }
    }

    await batch.commit();
    setActiveWorkout(null);
    return log;
  };

  const cancelWorkout = () => setActiveWorkout(null);

  const addWeightEntry = async (entry: Omit<WeightEntry, "id" | "userId">) => {
    const id = generateId();
    const newEntry: WeightEntry = { ...entry, id, userId: uid };
    await setDoc(doc(db, "weightEntries", id), newEntry);
  };

  const deleteWeightEntry = async (id: string) => {
    await deleteDoc(doc(db, "weightEntries", id));
  };

  const setWeightUnit = (unit: "kg" | "lbs") => {
    setWeightUnitState(unit);
  };

  // Returns the most recent logged weight for an exercise (for weight suggestions)
  const getLastWeightForExercise = (exerciseName: string): { weight: number; unit: "kg" | "lbs" } | null => {
    for (const log of workoutLogs) {
      const match = log.setLogs.find(
        (s) => s.exerciseName.toLowerCase() === exerciseName.toLowerCase() && s.completed
      );
      if (match) return { weight: match.weight, unit: match.unit };
    }
    return null;
  };

  // Returns all history entries for a given exercise, ordered newest-first
  const getExerciseHistory = async (exerciseName: string): Promise<ExerciseHistoryEntry[]> => {
    if (!uid) return [];
    try {
      const snap = await getDocs(
        query(
          collection(db, "exerciseHistory"),
          where("userId", "==", uid),
          where("exerciseName", "==", exerciseName),
          orderBy("performedAt", "desc")
        )
      );
      return snap.docs.map((d) => d.data() as ExerciseHistoryEntry);
    } catch (err) {
      console.warn("getExerciseHistory error:", err);
      return [];
    }
  };

  // Returns the most recent history entry for an exercise, or null
  const getLastPerformance = async (exerciseName: string): Promise<ExerciseHistoryEntry | null> => {
    if (!uid) return null;
    try {
      const snap = await getDocs(
        query(
          collection(db, "exerciseHistory"),
          where("userId", "==", uid),
          where("exerciseName", "==", exerciseName),
          orderBy("performedAt", "desc"),
          limit(1)
        )
      );
      if (snap.empty) return null;
      return snap.docs[0].data() as ExerciseHistoryEntry;
    } catch (err) {
      console.warn("getLastPerformance error:", err);
      return null;
    }
  };

  const { streak, longestStreak } = calculateStreaks(workoutLogs);

  return (
    <WorkoutContext.Provider
      value={{
        splits,
        workoutLogs,
        weightEntries,
        activeWorkout,
        isLoaded,
        addSplit,
        updateSplit,
        deleteSplit,
        startWorkout,
        logSet,
        updateSet,
        finishWorkout,
        cancelWorkout,
        addWeightEntry,
        deleteWeightEntry,
        weightUnit,
        setWeightUnit,
        streak,
        longestStreak,
        getLastWeightForExercise,
        getExerciseHistory,
        getLastPerformance,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (!context) throw new Error("useWorkout must be used within a WorkoutProvider");
  return context;
}
