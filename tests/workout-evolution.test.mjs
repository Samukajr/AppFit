import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProgress, weeklyFrequency } from '../src/features/workouts/progress.ts';
import { createWorkoutRepository } from '../src/features/workouts/repository.ts';

const session = (id, finishedAt, lifts = []) => ({
  id, workoutId: 'workout', workoutName: 'Minha ficha', finishedAt, lifts,
});
const lift = { exerciseKey: 'bench', name: 'Supino', weightKg: 20.5, reps: 10 };

test('evolução preserva zero, carga decimal, repetições e ordem cronológica', () => {
  const first = session('one', '2026-10-12T12:00:00Z', [{ ...lift, weightKg: 0 }]);
  const second = session('two', '2026-10-13T12:00:00Z', [lift]);
  assert.deepEqual(parseProgress([second, first]), [first, second]);
  assert.deepEqual(parseProgress([]), []);
  for (const input of [null, {}, [first, first], [{ ...first, finishedAt: 'invalid' }],
    [{ ...first, lifts: [lift, lift] }], [{ ...first, lifts: [{ ...lift, weightKg: -1 }] }],
    [{ ...first, lifts: [{ ...lift, weightKg: NaN }] }], [{ ...first, lifts: [{ ...lift, reps: 1.5 }] }],
    [{ ...first, lifts: [{ ...lift, reps: 1001 }] }]]) {
    assert.throws(() => parseProgress(input));
  }
});

test('frequência conta sessões e inclui semanas sem treino, começando na segunda-feira', () => {
  const now = new Date(2026, 9, 23, 15);
  const sessions = parseProgress([
    session('a', new Date(2026, 9, 12, 10).toISOString(), [lift]),
    session('b', new Date(2026, 9, 18, 10).toISOString()),
    session('c', new Date(2026, 9, 19, 10).toISOString()),
  ]);
  const weeks = weeklyFrequency(sessions, 30, now);
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks.map((week) => week.count), [0, 0, 0, 2, 1]);
  assert.ok(weeks.every((week) => new Date(week.date).getDay() === 1));
  assert.deepEqual(weeklyFrequency([], null, now).map((week) => week.count), [0]);
  assert.equal(weeklyFrequency([], 90, now).length, 14);
  assert.deepEqual(weeklyFrequency(sessions, null, now).map((week) => week.count), [2, 1]);
});

test('evolução chama o servidor com período explícito e não mascara erros ou respostas inválidas', async () => {
  const calls = [];
  let data = [session('a', '2026-10-12T12:00:00Z', [lift])];
  let error = null;
  const repository = createWorkoutRepository({
    async rpc(name, params) { calls.push({ name, params }); return { data, error }; },
  });
  for (const days of [30, 90, null]) assert.deepEqual(await repository.progress(days), data);
  assert.deepEqual(calls, [30, 90, null].map((days) => ({
    name: 'get_workout_progress', params: { p_days: days },
  })));
  error = { message: 'Sessão indisponível' };
  await assert.rejects(repository.progress(30), /Sessão indisponível/);
  error = null; data = {};
  await assert.rejects(repository.progress(30), /Histórico de evolução inválido/);
});
