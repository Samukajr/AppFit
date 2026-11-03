export type WorkoutGoal = 'hypertrophy' | 'weight_loss' | 'rehabilitation' | 'fitness' | 'conditioning' | 'other';

export type WorkoutPlanAssessment = {
  goal: WorkoutGoal;
  experience: 'beginner' | 'intermediate' | 'advanced';
  days_per_week: number;
  session_minutes: number;
  equipment: string;
  limitations: string;
  professional_guidance: string;
  measured_on: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percent: number | null;
  muscle_mass_kg: number | null;
};

export type WorkoutCatalogEntry = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  kind: 'strength' | 'cardio';
};

export type GeneratedWorkout = {
  name: string;
  focus: string;
  exercises: { catalogId: string; targetSets: number; targetReps: number; restSeconds: number }[];
};

export type WorkoutPlanResult =
  | { status: 'ready'; title: string; warnings: string[]; workouts: GeneratedWorkout[] }
  | { status: 'professional_review'; title: string; reasons: string[] };

export type WorkoutGenerationRequest = {
  assessment_id: string;
  document_ids: string[];
  adult_confirmed: true;
  consent_version: 'gemini-workout-v1';
};

export type WorkoutGenerationResponse = {
  generationId: string;
  plan: WorkoutPlanResult;
};
