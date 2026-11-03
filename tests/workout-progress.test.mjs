import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workoutProgress } from '../src/features/workouts/utils.ts';

const exercises = [
  { id: 'a', name: 'A', targetSets: 3, targetReps: '10' },
  { id: 'b', name: 'B', targetSets: 3, targetReps: '10' },
];
const sets = (exerciseId, count) => Array.from({ length: count }, (_, index) =>
  ({ id: `${exerciseId}-${index}`, exerciseId, reps: 10, weightKg: 20 }));

test('progresso vazio e parcial usa a meta real de series', () => {
  assert.equal(workoutProgress([], []), 0);
  assert.equal(workoutProgress(exercises, []), 0);
  assert.equal(workoutProgress(exercises, sets('a', 1)), 17);
  assert.equal(workoutProgress(exercises, sets('a', 3)), 50);
});

test('series extras nao completam outro exercicio nem ultrapassam 100%', () => {
  assert.equal(workoutProgress(exercises, sets('a', 10)), 50);
  assert.equal(workoutProgress(exercises, [...sets('a', 10), ...sets('b', 5)]), 100);
  assert.equal(workoutProgress(exercises, sets('fora-da-ficha', 10)), 0);
});
