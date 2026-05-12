import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  weight: number;
  unit: "kg" | "lbs";
  restSeconds: number;
  notes: string;
  type: "strength" | "cardio";
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

export interface SetLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
  unit: "kg" | "lbs";
  completed: boolean;
  timestamp: string;
}

export interface WorkoutLog {
  id: string;
  splitId: string;
  splitName: string;
  dayLabel: string;
  sessionType: string;
  startedAt: string;
  finishedAt?: string;
  durationMinutes?: number;
  setLogs: SetLog[];
  notes: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  unit: "kg" | "lbs";
  photoUri?: string;
}

export interface ActiveWorkoutState {
  isActive: boolean;
  splitId: string;
  splitName: string;
  dayLabel: string;
  sessionType: string;
  exercises: Exercise[];
  setLogs: SetLog[];
  startedAt: string;
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
  finishWorkout: (notes: string) => Promise<WorkoutLog>;
  cancelWorkout: () => void;
  addWeightEntry: (entry: Omit<WeightEntry, "id">) => Promise<void>;
  deleteWeightEntry: (id: string) => Promise<void>;
  weightUnit: "kg" | "lbs";
  setWeightUnit: (unit: "kg" | "lbs") => Promise<void>;
  streak: number;
  longestStreak: number;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

const STORAGE_KEYS = {
  SPLITS: "strongstreak_splits",
  LOGS: "strongstreak_logs",
  WEIGHT_ENTRIES: "strongstreak_weight",
  WEIGHT_UNIT: "strongstreak_weight_unit",
};

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function calculateStreaks(logs: WorkoutLog[]): { streak: number; longestStreak: number } {
  if (logs.length === 0) return { streak: 0, longestStreak: 0 };

  const workoutDates = new Set(
    logs
      .filter((l) => l.finishedAt)
      .map((l) => l.startedAt.split("T")[0])
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
      if (diff <= 1) {
        streak++;
        current = d;
      } else {
        break;
      }
    }
  }

  let longestStreak = 0;
  let currentRun = 1;
  const ascending = [...sortedDates].reverse();
  for (let i = 1; i < ascending.length; i++) {
    const prev = new Date(ascending[i - 1]);
    const curr = new Date(ascending[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      currentRun++;
      if (currentRun > longestStreak) longestStreak = currentRun;
    } else {
      currentRun = 1;
    }
  }
  if (longestStreak === 0 && ascending.length > 0) longestStreak = 1;

  return { streak, longestStreak };
}

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(null);
  const [weightUnit, setWeightUnitState] = useState<"kg" | "lbs">("kg");
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [splitsRaw, logsRaw, weightRaw, unitRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SPLITS),
        AsyncStorage.getItem(STORAGE_KEYS.LOGS),
        AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_ENTRIES),
        AsyncStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT),
      ]);
      if (splitsRaw) setSplits(JSON.parse(splitsRaw));
      if (logsRaw) setWorkoutLogs(JSON.parse(logsRaw));
      if (weightRaw) setWeightEntries(JSON.parse(weightRaw));
      if (unitRaw) setWeightUnitState(unitRaw as "kg" | "lbs");
    } catch (e) {
    } finally {
      setIsLoaded(true);
    }
  };

  const saveSplits = async (data: Split[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.SPLITS, JSON.stringify(data));
  };

  const saveLogs = async (data: WorkoutLog[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data));
  };

  const saveWeightEntries = async (data: WeightEntry[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_ENTRIES, JSON.stringify(data));
  };

  const addSplit = async (split: Omit<Split, "id" | "createdAt">) => {
    const newSplit: Split = { ...split, id: generateId(), createdAt: new Date().toISOString() };
    const updated = [...splits, newSplit];
    setSplits(updated);
    await saveSplits(updated);
  };

  const updateSplit = async (split: Split) => {
    const updated = splits.map((s) => (s.id === split.id ? split : s));
    setSplits(updated);
    await saveSplits(updated);
  };

  const deleteSplit = async (splitId: string) => {
    const updated = splits.filter((s) => s.id !== splitId);
    setSplits(updated);
    await saveSplits(updated);
  };

  const startWorkout = (split: Split, day: SplitDay) => {
    setActiveWorkout({
      isActive: true,
      splitId: split.id,
      splitName: split.name,
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

  const finishWorkout = async (notes: string): Promise<WorkoutLog> => {
    if (!activeWorkout) throw new Error("No active workout");
    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(activeWorkout.startedAt).getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    const log: WorkoutLog = {
      id: generateId(),
      splitId: activeWorkout.splitId,
      splitName: activeWorkout.splitName,
      dayLabel: activeWorkout.dayLabel,
      sessionType: activeWorkout.sessionType,
      startedAt: activeWorkout.startedAt,
      finishedAt,
      durationMinutes,
      setLogs: activeWorkout.setLogs,
      notes,
    };

    const updated = [log, ...workoutLogs];
    setWorkoutLogs(updated);
    await saveLogs(updated);
    setActiveWorkout(null);
    return log;
  };

  const cancelWorkout = () => {
    setActiveWorkout(null);
  };

  const addWeightEntry = async (entry: Omit<WeightEntry, "id">) => {
    const newEntry: WeightEntry = { ...entry, id: generateId() };
    const updated = [newEntry, ...weightEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setWeightEntries(updated);
    await saveWeightEntries(updated);
  };

  const deleteWeightEntry = async (id: string) => {
    const updated = weightEntries.filter((e) => e.id !== id);
    setWeightEntries(updated);
    await saveWeightEntries(updated);
  };

  const setWeightUnit = async (unit: "kg" | "lbs") => {
    setWeightUnitState(unit);
    await AsyncStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, unit);
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
        finishWorkout,
        cancelWorkout,
        addWeightEntry,
        deleteWeightEntry,
        weightUnit,
        setWeightUnit,
        streak,
        longestStreak,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}
