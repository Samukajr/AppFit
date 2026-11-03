import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWorkoutDefinition, parseWorkoutSnapshot, parseSavedSet, parseCatalog, parseCatalogWithDemonstrations, parseWorkoutList, parseCardioLog } from '../src/features/workouts/contract.ts';

function snapshot() {
  return {
    workout: { id: 'workout', name: 'Treino' },
    session: { id: 'session', startedAt: '2026-10-15T10:00:00Z' },
    exercises: [{ id: 'exercise', name: 'Agachamento', targetSets: 3, targetReps: '10' }],
    sets: [{ id: 'set', exerciseId: 'exercise', reps: 10, weightKg: 25.5 }],
    history: [{ id: 'previous', finishedAt: '2026-10-14T10:00:00Z', setCount: 3, volume: 765 }],
  };
}

test('contrato preserva sessao, series e historico retornados pelo servidor', () => {
  const input = snapshot();
  assert.deepEqual(parseWorkoutSnapshot(input), input);
});

test('contrato novo preserva modalidades, metas, cardio e historico', () => {
  const input = snapshot();
  input.workout.isStarter = false;
  Object.assign(input.exercises[0], { kind: 'strength', targetMinutes: null, restSeconds: 90 });
  input.exercises.push({ id: 'bike', name: 'Bike', targetSets: 1, targetReps: '1',
    kind: 'cardio', targetMinutes: 20, restSeconds: 60 });
  input.cardio = [{ id: 'log', exerciseId: 'bike', durationMinutes: 15, distanceKm: null, perceivedExertion: 5 }];
  input.history[0].cardioMinutes = 15;
  assert.deepEqual(parseWorkoutSnapshot(input), input);
  input.sets[0].exerciseId = 'bike';
  assert.throws(() => parseWorkoutSnapshot(input), /não pertence/);
  input.sets = [];
  input.cardio[0].exerciseId = 'exercise';
  assert.throws(() => parseWorkoutSnapshot(input), /não pertence/);
});

test('demonstrações só aceitam URLs seguros, crédito e licença explícitos', () => {
  const demo = { exercise_id: 'bench', url: 'https://www.youtube.com/watch?v=abcdefghijk',
    credit: 'Canal oficial', license: 'Uso com autorização do criador' };
  assert.deepEqual(parseCatalogWithDemonstrations([
    { id: 'bench', name: 'Supino', muscle_group: 'Peito', equipment: 'Barra', kind: 'strength' },
    { id: 'squat', name: 'Agachamento', muscle_group: 'Quadriceps', equipment: 'Barra', kind: 'strength' },
  ], [demo]), [
    { id: 'bench', name: 'Supino', muscleGroup: 'Peito', equipment: 'Barra', kind: 'strength',
      demonstration: { url: demo.url, provider: 'youtube', credit: demo.credit, license: demo.license } },
    { id: 'squat', name: 'Agachamento', muscleGroup: 'Quadriceps', equipment: 'Barra', kind: 'strength' },
  ]);
  assert.throws(() => parseCatalogWithDemonstrations([], [demo, demo]), /duplicada/);
  for (const url of [
    'http://www.youtube.com/watch?v=abcdefghijk',
    'https://youtube.com.evil.example/watch?v=abcdefghijk',
    'https://youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=abcdefghijk@evil.example',
    'https://vimeo.com/not-a-number',
  ]) assert.throws(() => parseCatalogWithDemonstrations([], [{ ...demo, url }]));
  assert.throws(() => parseCatalogWithDemonstrations([], [{ ...demo, license: '' }]));
});

test('demonstração é associada ao exercício correspondente da sessão', () => {
  const input = snapshot();
  const demo = { exercise_id: 'exercise', url: 'https://youtu.be/abcdefghijk',
    credit: 'Canal oficial', license: 'Uso autorizado' };
  assert.equal(parseWorkoutSnapshot(input, [demo]).exercises[0].demonstration.provider, 'youtube');
  assert.equal(parseWorkoutSnapshot(input).exercises[0].demonstration, undefined);
});

test('contratos do catalogo, fichas e cardio recusam respostas malformadas', () => {
  assert.deepEqual(parseCatalog([{ id: 'bike', name: 'Bike', muscle_group: 'Cardio', equipment: 'Bike', kind: 'cardio' }]),
    [{ id: 'bike', name: 'Bike', muscleGroup: 'Cardio', equipment: 'Bike', kind: 'cardio' }]);
  assert.deepEqual(parseWorkoutList([{ id: 'w', name: 'Ficha', is_starter: false }]),
    [{ id: 'w', name: 'Ficha', isStarter: false, archived: false }]);
  assert.throws(() => parseCatalog([{ id: 'x', name: 'x', muscle_group: 'Cardio', equipment: 'x', kind: 'unknown' }]));
  assert.throws(() => parseWorkoutList([{ id: 'w', name: 'Ficha', is_starter: 'false' }]));
  const log = { id: 'log', exerciseId: 'bike', durationMinutes: 20, distanceKm: 0, perceivedExertion: 5 };
  assert.deepEqual(parseCardioLog(log), log);
  for (const invalid of [
    { durationMinutes: 0 }, { durationMinutes: 601 }, { durationMinutes: 1.5 },
    { distanceKm: undefined }, { distanceKm: -1 }, { perceivedExertion: 11 }, { perceivedExertion: 0 },
  ]) assert.throws(() => parseCardioLog({ ...log, ...invalid }));
});

test('ficha manual editavel valida catalogo e preserva configuracoes de forca e cardio', () => {
  const workout = { name: 'Minha ficha', is_starter: false, archived_at: null };
  const catalog = [
    { id: 'bench', name: 'Supino', muscleGroup: 'Peito', equipment: 'Barra', kind: 'strength' },
    { id: 'bike', name: 'Bike', muscleGroup: 'Cardio', equipment: 'Bicicleta', kind: 'cardio' },
  ];
  assert.deepEqual(parseWorkoutDefinition(workout, [
    { catalog_id: 'bench', kind: 'strength', target_sets: 3, target_reps: 10, rest_seconds: 90 },
    { catalog_id: 'bike', kind: 'cardio', target_minutes: 20 },
  ], catalog), {
    name: 'Minha ficha',
    exercises: [
      { catalogId: 'bench', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { catalogId: 'bike', targetMinutes: 20 },
    ],
  });
  assert.throws(() => parseWorkoutDefinition({ ...workout, is_starter: true }, [], catalog), /não pode ser editada/);
  assert.throws(() => parseWorkoutDefinition({ ...workout, archived_at: '2026-10-22T10:00:00Z' }, [], catalog), /não pode ser editada/);
  assert.throws(() => parseWorkoutDefinition(workout,
    [{ catalog_id: 'missing', kind: 'strength', target_sets: 3, target_reps: 10, rest_seconds: 90 }], catalog), /indisponível no catálogo/);
});

test('rejeita series de outra ficha e dados invalidos sem fallback de sucesso', () => {
  const input = snapshot();
  input.sets[0].exerciseId = 'outra-ficha';
  assert.throws(() => parseWorkoutSnapshot(input), /não pertence/);
  input.sets = [];
  input.session.startedAt = 'invalida';
  assert.throws(() => parseWorkoutSnapshot(input), /Data/);
  for (const reps of [0, 1001, 1.5, '10', NaN]) {
    assert.throws(() => parseSavedSet({ id: 'a', exerciseId: 'b', reps, weightKg: 0 }));
  }
});
