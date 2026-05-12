export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const SESSION_TYPES = [
  "Push",
  "Pull",
  "Legs",
  "Upper",
  "Lower",
  "Full Body",
  "Cardio",
  "Rest",
  "Custom",
];

export const SESSION_COLORS: Record<string, string> = {
  Push: "#F97316",
  Pull: "#38BDF8",
  Legs: "#22C55E",
  Upper: "#A855F7",
  Lower: "#EC4899",
  "Full Body": "#F59E0B",
  Cardio: "#06B6D4",
  Rest: "#6B7FA8",
  Custom: "#38BDF8",
};

export interface ExerciseTemplate {
  name: string;
  muscleGroup: string;
  defaultSets: number;
  defaultReps: string;
  type: "strength" | "cardio";
}

export const EXERCISE_LIBRARY: Record<string, ExerciseTemplate[]> = {
  Chest: [
    { name: "Bench Press", muscleGroup: "Chest", defaultSets: 4, defaultReps: "6-10", type: "strength" },
    { name: "Incline Bench Press", muscleGroup: "Chest", defaultSets: 3, defaultReps: "8-12", type: "strength" },
    { name: "Dumbbell Flyes", muscleGroup: "Chest", defaultSets: 3, defaultReps: "10-15", type: "strength" },
    { name: "Push-Ups", muscleGroup: "Chest", defaultSets: 3, defaultReps: "15-20", type: "strength" },
    { name: "Cable Crossover", muscleGroup: "Chest", defaultSets: 3, defaultReps: "12-15", type: "strength" },
    { name: "Dips", muscleGroup: "Chest", defaultSets: 3, defaultReps: "10-15", type: "strength" },
  ],
  Back: [
    { name: "Pull-Ups", muscleGroup: "Back", defaultSets: 4, defaultReps: "6-10", type: "strength" },
    { name: "Barbell Row", muscleGroup: "Back", defaultSets: 4, defaultReps: "6-10", type: "strength" },
    { name: "Deadlift", muscleGroup: "Back", defaultSets: 4, defaultReps: "3-6", type: "strength" },
    { name: "Lat Pulldown", muscleGroup: "Back", defaultSets: 3, defaultReps: "8-12", type: "strength" },
    { name: "Seated Cable Row", muscleGroup: "Back", defaultSets: 3, defaultReps: "10-12", type: "strength" },
    { name: "Face Pulls", muscleGroup: "Back", defaultSets: 3, defaultReps: "15-20", type: "strength" },
  ],
  Shoulders: [
    { name: "Overhead Press", muscleGroup: "Shoulders", defaultSets: 4, defaultReps: "6-10", type: "strength" },
    { name: "Lateral Raises", muscleGroup: "Shoulders", defaultSets: 3, defaultReps: "12-15", type: "strength" },
    { name: "Front Raises", muscleGroup: "Shoulders", defaultSets: 3, defaultReps: "12-15", type: "strength" },
    { name: "Arnold Press", muscleGroup: "Shoulders", defaultSets: 3, defaultReps: "10-12", type: "strength" },
    { name: "Rear Delt Flyes", muscleGroup: "Shoulders", defaultSets: 3, defaultReps: "15-20", type: "strength" },
  ],
  Arms: [
    { name: "Barbell Curl", muscleGroup: "Biceps", defaultSets: 3, defaultReps: "8-12", type: "strength" },
    { name: "Hammer Curl", muscleGroup: "Biceps", defaultSets: 3, defaultReps: "10-12", type: "strength" },
    { name: "Tricep Pushdown", muscleGroup: "Triceps", defaultSets: 3, defaultReps: "10-15", type: "strength" },
    { name: "Skull Crushers", muscleGroup: "Triceps", defaultSets: 3, defaultReps: "8-12", type: "strength" },
    { name: "Preacher Curl", muscleGroup: "Biceps", defaultSets: 3, defaultReps: "8-12", type: "strength" },
    { name: "Overhead Tricep Extension", muscleGroup: "Triceps", defaultSets: 3, defaultReps: "10-15", type: "strength" },
  ],
  Legs: [
    { name: "Squat", muscleGroup: "Quads", defaultSets: 4, defaultReps: "5-8", type: "strength" },
    { name: "Romanian Deadlift", muscleGroup: "Hamstrings", defaultSets: 3, defaultReps: "8-12", type: "strength" },
    { name: "Leg Press", muscleGroup: "Quads", defaultSets: 3, defaultReps: "10-15", type: "strength" },
    { name: "Leg Curl", muscleGroup: "Hamstrings", defaultSets: 3, defaultReps: "10-15", type: "strength" },
    { name: "Calf Raises", muscleGroup: "Calves", defaultSets: 4, defaultReps: "15-20", type: "strength" },
    { name: "Bulgarian Split Squat", muscleGroup: "Quads", defaultSets: 3, defaultReps: "8-12", type: "strength" },
    { name: "Hip Thrust", muscleGroup: "Glutes", defaultSets: 3, defaultReps: "10-15", type: "strength" },
    { name: "Leg Extension", muscleGroup: "Quads", defaultSets: 3, defaultReps: "12-15", type: "strength" },
  ],
  Core: [
    { name: "Plank", muscleGroup: "Core", defaultSets: 3, defaultReps: "60s", type: "strength" },
    { name: "Crunches", muscleGroup: "Core", defaultSets: 3, defaultReps: "15-20", type: "strength" },
    { name: "Russian Twists", muscleGroup: "Core", defaultSets: 3, defaultReps: "20", type: "strength" },
    { name: "Hanging Leg Raises", muscleGroup: "Core", defaultSets: 3, defaultReps: "12-15", type: "strength" },
  ],
  Cardio: [
    { name: "Treadmill Run", muscleGroup: "Cardio", defaultSets: 1, defaultReps: "30min", type: "cardio" },
    { name: "Cycling", muscleGroup: "Cardio", defaultSets: 1, defaultReps: "45min", type: "cardio" },
    { name: "Jump Rope", muscleGroup: "Cardio", defaultSets: 5, defaultReps: "2min", type: "cardio" },
    { name: "Rowing Machine", muscleGroup: "Cardio", defaultSets: 1, defaultReps: "20min", type: "cardio" },
    { name: "Stair Climber", muscleGroup: "Cardio", defaultSets: 1, defaultReps: "20min", type: "cardio" },
    { name: "HIIT", muscleGroup: "Cardio", defaultSets: 8, defaultReps: "20s on/10s off", type: "cardio" },
  ],
};

export const ALL_EXERCISES = Object.values(EXERCISE_LIBRARY).flat();
