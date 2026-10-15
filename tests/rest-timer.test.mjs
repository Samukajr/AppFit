import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remainingSeconds } from '../src/features/workouts/utils.ts';

test('usa prazo absoluto mesmo apos um periodo em segundo plano', () => {
  const deadline = 61_000;
  assert.equal(remainingSeconds(deadline, 1_000), 60);
  assert.equal(remainingSeconds(deadline, 31_500), 30);
  assert.equal(remainingSeconds(deadline, 60_999), 1);
  assert.equal(remainingSeconds(deadline, 61_000), 0);
  assert.equal(remainingSeconds(deadline, 90_000), 0);
});

test('timer cancelado nao mantem segundos restantes', () => {
  assert.equal(remainingSeconds(null, 1_000), 0);
});
