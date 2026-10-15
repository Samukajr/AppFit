export type Exercise = {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
};

export type WorkoutSet = {
  id: number;
  exerciseId: string;
  reps: number;
  weightKg: number;
};
