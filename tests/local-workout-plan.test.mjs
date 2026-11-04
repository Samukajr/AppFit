import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalWorkoutPlan } from '../src/features/workouts/local-plan.ts';

const catalog = [
  { id: 'squat', name: 'Agachamento', muscleGroup: 'Quadriceps', equipment: 'Barra', kind: 'strength' },
  { id: 'push-up', name: 'Flexão', muscleGroup: 'Peito', equipment: 'Peso corporal', kind: 'strength' },
  { id: 'row', name: 'Remada', muscleGroup: 'Costas', equipment: 'Polia', kind: 'strength' },
  { id: 'plank', name: 'Prancha', muscleGroup: 'Abdomen', equipment: 'Colchonete', kind: 'strength' },
  { id: 'bike', name: 'Bicicleta', muscleGroup: 'Cardio', equipment: 'Bicicleta ergométrica', kind: 'cardio' },
];

const profile = {
  goal: 'hypertrophy',
  experience: 'beginner',
  days_per_week: 3,
  session_minutes: 45,
  equipment: 'Academia',
  limitations: '',
  professional_guidance: '',
};

test('creates a revisable local plan for each available day using only catalog strength exercises', () => {
  const result = createLocalWorkoutPlan(profile, catalog);
  assert.equal(result.status, 'ready');
  assert.equal(result.workouts.length, 3);
  assert.match(result.title, /Hipertrofia/);
  for (const workout of result.workouts) {
    assert.ok(workout.exercises.length >= 2 && workout.exercises.length <= 4);
    assert.ok(workout.exercises.every((exercise) => catalog.some((item) => item.id === exercise.catalogId && item.kind === 'strength')));
    assert.ok(workout.exercises.every((exercise) => exercise.targetSets === 2 && exercise.targetReps === 10 && exercise.restSeconds === 90));
  }
});

test('labels the stated goal and adjusts targets without prescribing loads', () => {
  const result = createLocalWorkoutPlan({ ...profile, goal: 'weight_loss', experience: 'advanced' }, catalog);
  assert.equal(result.status, 'ready');
  assert.match(result.title, /Emagrecimento/);
  assert.ok(result.workouts[0].exercises.every((exercise) => exercise.targetSets === 2));
  assert.ok(result.warnings.some((warning) => warning.includes('Não inclui cargas')));
  const conditioning = createLocalWorkoutPlan({ ...profile, goal: 'conditioning' }, catalog);
  assert.ok(conditioning.workouts[0].exercises.every((exercise) => exercise.targetReps === 12));
});

test('does not propose exercises for rehabilitation, limitations, or professional guidance', () => {
  for (const input of [
    { ...profile, goal: 'rehabilitation' },
    { ...profile, limitations: 'dor no joelho' },
    { ...profile, professional_guidance: 'evitar impacto' },
  ]) {
    const result = createLocalWorkoutPlan(input, catalog);
    assert.equal(result.status, 'professional_review');
    assert.deepEqual(result.reasons.length > 0, true);
  }
});

test('filters home equipment and rejects insufficient catalog matches', () => {
  const home = createLocalWorkoutPlan({ ...profile, equipment: 'em casa, peso corporal e colchonete' }, catalog);
  assert.equal(home.status, 'ready');
  assert.ok(home.workouts[0].exercises.every((exercise) => ['push-up', 'plank'].includes(exercise.catalogId)));
  assert.throws(
    () => createLocalWorkoutPlan({ ...profile, equipment: 'somente bicicleta ergométrica' }, catalog),
    /não tem exercícios suficientes/,
  );
});

test('caps the number of weekly sessions and keeps recovery days', () => {
  const result = createLocalWorkoutPlan({ ...profile, days_per_week: 7 }, catalog);
  assert.equal(result.status, 'ready');
  assert.equal(result.workouts.length, 4);
  assert.ok(result.warnings.some((warning) => warning.includes('reserve dias para recuperação')));
});
