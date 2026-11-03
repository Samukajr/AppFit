import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManualWorkout, filterCatalog, groupsForCategory, parseCardio, workoutProgress } from '../src/features/workouts/utils.ts';

const catalog = [
  { id: 'bench', name: 'Supino', muscleGroup: 'Peito', equipment: 'Halteres', kind: 'strength' },
  { id: 'bike', name: 'Bike ergométrica', muscleGroup: 'Cardio', equipment: 'Bicicleta', kind: 'cardio' },
];
const strength = { catalogId: 'bench', targetSets: '3', targetReps: '12', restSeconds: '90', targetMinutes: '' };
const cardio = { catalogId: 'bike', targetSets: '', targetReps: '', restSeconds: '', targetMinutes: '20' };

test('montagem preserva ordem, metas e formato especifico de cada modalidade', () => {
  assert.deepEqual(buildManualWorkout('  Minha ficha  ', [cardio, strength], catalog), {
    name: 'Minha ficha',
    exercises: [
      { catalogId: 'bike', targetMinutes: 20 },
      { catalogId: 'bench', targetSets: 3, targetReps: 12, restSeconds: 90 },
    ],
  });
  assert.deepEqual(filterCatalog(catalog, 'ergometrica', 'Todos'), [catalog[1]]);
  assert.deepEqual(filterCatalog(catalog, 'halteres', 'Peito'), [catalog[0]]);
  assert.deepEqual(filterCatalog(catalog, 'supino', 'Cardio'), []);
});

test('catalogo separa membros superiores, inferiores, core e cardio por grupos musculares', () => {
  const expandedCatalog = [
    ...catalog,
    { id: 'triceps', name: 'Extensão de tríceps', muscleGroup: 'Triceps', equipment: 'Polia', kind: 'strength' },
    { id: 'quad', name: 'Agachamento frontal', muscleGroup: 'Quadriceps', equipment: 'Barra', kind: 'strength' },
    { id: 'hamstring', name: 'Mesa flexora', muscleGroup: 'Posterior de coxa', equipment: 'Máquina', kind: 'strength' },
    { id: 'core', name: 'Prancha', muscleGroup: 'Abdomen', equipment: 'Colchonete', kind: 'strength' },
  ];
  assert.deepEqual(groupsForCategory('upper', expandedCatalog), ['Peito', 'Triceps']);
  assert.deepEqual(groupsForCategory('lower', expandedCatalog), ['Quadriceps', 'Posterior de coxa']);
  assert.deepEqual(groupsForCategory('core', expandedCatalog), ['Abdomen']);
  assert.deepEqual(groupsForCategory('cardio', expandedCatalog), ['Cardio']);
  assert.deepEqual(filterCatalog(expandedCatalog, '', 'Todos', 'upper').map((entry) => entry.id).sort(),
    ['bench', 'triceps'].sort());
  assert.deepEqual(filterCatalog(expandedCatalog, 'quadriceps', 'Todos', 'lower').map((entry) => entry.id), ['quad']);
  assert.deepEqual(filterCatalog(expandedCatalog, '', 'Todos', 'core').map((entry) => entry.id), ['core']);
  assert.deepEqual(filterCatalog(expandedCatalog, '', 'Todos', 'cardio').map((entry) => entry.id), ['bike']);
});

test('montagem rejeita ficha vazia, duplicados, catalogo ausente e metas invalidas', () => {
  for (const [name, drafts] of [
    ['', [strength]], ['x'.repeat(121), [strength]], ['Ficha', []],
    ['Ficha', [strength, strength]], ['Ficha', [{ ...strength, catalogId: 'missing' }]],
    ['Ficha', [{ ...strength, targetSets: '1.5' }]],
    ['Ficha', [{ ...strength, targetReps: '1001' }]],
    ['Ficha', [{ ...strength, restSeconds: '4' }]],
    ['Ficha', [{ ...cardio, targetMinutes: '0' }]],
    ['Ficha', [{ ...cardio, targetMinutes: '601' }]],
  ]) assert.throws(() => buildManualWorkout(name, drafts, catalog));
});

test('montagem aceita exatamente 30 exercicios e rejeita 31', () => {
  const entries = Array.from({ length: 31 }, (_, index) => ({ ...catalog[0], id: `exercise-${index}` }));
  const drafts = entries.map((entry) => ({ ...strength, catalogId: entry.id }));
  assert.equal(buildManualWorkout('Limite', drafts.slice(0, 30), entries).exercises.length, 30);
  assert.throws(() => buildManualWorkout('Limite', drafts, entries), /30/);
});

test('cardio distingue distancia ausente de zero e aceita decimal brasileiro', () => {
  assert.deepEqual(parseCardio('20', '', '6'), { durationMinutes: 20, distanceKm: null, perceivedExertion: 6 });
  assert.equal(parseCardio('1', '0', '1').distanceKm, 0);
  assert.equal(parseCardio('600', '1000', '10').distanceKm, 1000);
  assert.equal(parseCardio('20', '4,25', '6').distanceKm, 4.25);
  for (const values of [
    ['0', '', '5'], ['601', '', '5'], ['1.5', '', '5'], ['', '', '5'],
    ['20', '', '0'], ['20', '', '11'], ['20', '', '5.5'],
    ['20', '-1', '5'], ['20', '1000.01', '5'], ['20', '1.234', '5'], ['20', 'NaN', '5'],
  ]) assert.throws(() => parseCardio(...values));
});

test('progresso de series exclui cardio e limita extras por exercicio', () => {
  const exercises = [
    { id: 'strength', targetSets: 2, kind: 'strength' },
    { id: 'cardio', targetSets: 1, kind: 'cardio' },
  ];
  const sets = Array.from({ length: 3 }, (_, index) => ({ id: `${index}`, exerciseId: 'strength' }));
  assert.equal(workoutProgress(exercises, sets), 100);
  assert.equal(workoutProgress([exercises[1]], []), 0);
});
