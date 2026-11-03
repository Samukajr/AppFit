export type Exercise = {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  kind?: 'strength' | 'cardio';
  targetMinutes?: number | null;
  restSeconds?: number;
  demonstration?: ExerciseDemonstration;
};

export type WorkoutSet = {
  id: string;
  exerciseId: string;
  reps: number;
  weightKg: number;
};

export type WorkoutSnapshot = {
  workout: { id: string; name: string; isStarter?: boolean };
  session: { id: string; startedAt: string };
  exercises: Exercise[];
  sets: WorkoutSet[];
  cardio?: CardioLog[];
  history: { id: string; finishedAt: string; setCount: number; volume: number; cardioMinutes?: number }[];
};

export type CardioLog = {
  id: string;
  exerciseId: string;
  durationMinutes: number;
  distanceKm: number | null;
  perceivedExertion: number;
};

export type CatalogExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: 'strength' | 'cardio';
  demonstration?: ExerciseDemonstration;
};

export type ExerciseDemonstration = {
  url: string;
  provider: 'youtube' | 'vimeo';
  credit: string;
  license: string;
};

export type DraftExercise = {
  catalogId: string;
  targetSets: string;
  targetReps: string;
  restSeconds: string;
  targetMinutes: string;
};

export type ManualExercise =
  | { catalogId: string; targetSets: number; targetReps: number; restSeconds: number }
  | { catalogId: string; targetMinutes: number };

export type WorkoutSummary = { id: string; name: string; isStarter: boolean; archived: boolean };
