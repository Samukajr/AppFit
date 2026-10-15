import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSet } from '../src/features/workouts/utils.ts';

test('registra carga decimal brasileira, peso corporal e limites', () => {
  assert.deepEqual(parseSet('12', '25,50'), { reps: 12, weightKg: 25.5 });
  assert.deepEqual(parseSet('1', '0'), { reps: 1, weightKg: 0 });
  assert.deepEqual(parseSet('1000', '2000'), { reps: 1000, weightKg: 2000 });
});

test('rejeita entradas vazias, negativas, infinitas e fora dos limites', () => {
  for (const [reps, weight] of [
    ['', '20'], ['0', '20'], ['1.5', '20'], ['-1', '20'], ['1001', '20'],
    ['10', ''], ['10', '-1'], ['10', 'Infinity'], ['10', '1e2'],
    ['10', '20.123'], ['10', '2000.01'], ['10', '1,2,3'],
  ]) {
    assert.throws(() => parseSet(reps, weight));
  }
});
