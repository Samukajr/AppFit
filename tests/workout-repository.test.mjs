import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkoutRepository } from '../src/features/workouts/repository.ts';

test('envia parametros corretos ao salvar, remover e concluir', async () => {
  const calls = [];
  const saved = { id: 'set', exerciseId: 'exercise', reps: 12, weightKg: 30 };
  const repository = createWorkoutRepository({
    async rpc(name, params) { calls.push({ name, params }); return { data: saved, error: null }; },
  });
  assert.deepEqual(await repository.register('session', 'exercise', 12, 30, 60), saved);
  await repository.remove('session', 'set');
  await repository.finish('session');
  assert.deepEqual(calls, [
    { name: 'register_workout_set', params: { p_session_id: 'session', p_exercise_id: 'exercise', p_reps: 12, p_weight_kg: 30, p_rest_seconds: 60 } },
    { name: 'remove_workout_set', params: { p_session_id: 'session', p_set_id: 'set' } },
    { name: 'finish_workout_session', params: { p_session_id: 'session' } },
  ]);
});

test('erros de autenticacao ou servidor nunca sao tratados como persistencia confirmada', async () => {
  const repository = createWorkoutRepository({
    async rpc() { return { data: null, error: { message: 'Sessao invalida' } }; },
  });
  for (const action of [
    () => repository.load(), () => repository.register('s', 'e', 10, 0, 60),
    () => repository.remove('s', 'set'), () => repository.finish('s'), () => repository.load('w'),
    () => repository.create('Ficha', []), () => repository.registerCardio('s', 'e', 20, null, 5),
    () => repository.removeCardio('s', 'log'),
  ]) await assert.rejects(action(), /Sessao invalida/);
});

test('criar, selecionar e registrar cardio usa RPCs e parametros exatos', async () => {
  const calls = [];
  const payload = { workout: { id: 'w', name: 'Ficha', isStarter: false },
    session: { id: 's', startedAt: '2026-10-16T10:00:00Z' }, exercises: [], sets: [], cardio: [], history: [] };
  const log = { id: 'log', exerciseId: 'e', durationMinutes: 20, distanceKm: null, perceivedExertion: 5 };
  const repository = createWorkoutRepository({
    async rpc(name, params) {
      calls.push({ name, params });
      return { data: name === 'create_manual_workout' ? 'w' : name === 'get_workout_session' ? payload : log, error: null };
    },
    from() {
      const query = {
        select() { return query; },
        eq() { return query; },
        async then(resolve) { resolve({ data: [], error: null }); },
      };
      return query;
    },
  });
  const exercises = [{ catalogId: 'bike', targetMinutes: 20 }];
  assert.equal(await repository.create('Ficha', exercises), 'w');
  assert.deepEqual(await repository.load('w'), payload);
  assert.deepEqual(await repository.registerCardio('s', 'e', 20, null, 5), log);
  await repository.removeCardio('s', 'log');
  assert.deepEqual(calls, [
    { name: 'create_manual_workout', params: { p_name: 'Ficha', p_exercises: exercises } },
    { name: 'get_workout_session', params: { p_workout_id: 'w' } },
    { name: 'register_cardio', params: { p_session_id: 's', p_exercise_id: 'e', p_duration_minutes: 20, p_distance_km: null, p_perceived_exertion: 5 } },
    { name: 'remove_cardio', params: { p_session_id: 's', p_log_id: 'log' } },
  ]);
});

test('biblioteca le catalogo e fichas e informa migracao ausente sem catalogo falso', async () => {
  let fail = false;
  const repository = createWorkoutRepository({
    from(table) {
      return { select() { return { async order() {
        return table === 'exercise_catalog'
          ? { data: [{ id: 'bike', name: 'Bike', muscle_group: 'Cardio', equipment: 'Bike', kind: 'cardio' }], error: fail ? { message: 'missing relation' } : null }
          : table === 'exercise_demonstrations'
            ? { data: [], error: null }
            : { data: [{ id: 'w', name: 'Ficha', is_starter: false }], error: null };
      } }; } };
    },
  });
  const library = await repository.library();
  assert.equal(library.catalog[0].kind, 'cardio');
  assert.equal(library.workouts[0].isStarter, false);
  fail = true;
  await assert.rejects(repository.library(), /migração.*missing relation/);
});

test('carrega a demonstração aprovada vinculada ao exercício atual do treino', async () => {
  const payload = { workout: { id: 'w', name: 'Ficha', isStarter: false },
    session: { id: 's', startedAt: '2026-10-16T10:00:00Z' },
    exercises: [{ id: 'exercise-uuid', name: 'Supino', targetSets: 3, targetReps: '10' }],
    sets: [], cardio: [], history: [] };
  const repository = createWorkoutRepository({
    async rpc() { return { data: payload, error: null }; },
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        async in(_field, ids) {
          assert.deepEqual(ids, ['bench']);
          return { data: [{ exercise_id: 'bench', url: 'https://youtu.be/abcdefghijk',
            credit: 'Canal oficial', license: 'Uso autorizado' }], error: null };
        },
        async then(resolve) {
          if (table === 'exercises') resolve({ data: [{ id: 'exercise-uuid', catalog_id: 'bench' }], error: null });
          else resolve({ data: [], error: null });
        },
      };
      return query;
    },
  });
  const snapshot = await repository.load('w');
  assert.deepEqual(snapshot.exercises[0].demonstration, {
    url: 'https://youtu.be/abcdefghijk', provider: 'youtube',
    credit: 'Canal oficial', license: 'Uso autorizado',
  });
});

test('criacao sem identificador confirmado nunca aparenta sucesso', async () => {
  for (const data of [null, '', {}, []]) {
    const repository = createWorkoutRepository({ async rpc() { return { data, error: null }; } });
    await assert.rejects(repository.create('Ficha', []), /não confirmou/);
  }
});

test('edicao, arquivamento e restauracao usam RPCs do servidor', async () => {
  const calls = [];
  const repository = createWorkoutRepository({
    async rpc(name, params) { calls.push({ name, params }); return { data: null, error: null }; },
  });
  const exercises = [{ catalogId: 'bench', targetSets: 3, targetReps: 10, restSeconds: 90 }];
  await repository.update('workout', 'Peito', exercises);
  await repository.archive('workout');
  await repository.restore('workout');
  assert.deepEqual(calls, [
    { name: 'replace_manual_workout', params: { p_workout_id: 'workout', p_name: 'Peito', p_exercises: exercises } },
    { name: 'archive_manual_workout', params: { p_workout_id: 'workout' } },
    { name: 'restore_manual_workout', params: { p_workout_id: 'workout' } },
  ]);
});
