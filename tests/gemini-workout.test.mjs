import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildWorkoutPlanRequest, parseGeminiWorkoutResponse, parseWorkoutPlan,
  requiresProfessionalReview, workoutConsentVersion, workoutPlannerReady,
} from '../supabase/functions/_shared/gemini-workout.ts';

const settings = {
  GEMINI_API_KEY: 'synthetic-not-a-key',
  GEMINI_MODEL: 'gemini-test',
  GEMINI_REPORTS_ENABLED: 'true',
  GEMINI_WORKOUTS_ENABLED: 'true',
  GEMINI_PAID_SERVICE_CONFIRMED: 'true',
  GEMINI_PRIVACY_REVIEWED: 'true',
};
const assessment = {
  goal: 'hypertrophy', experience: 'beginner', days_per_week: 3, session_minutes: 45,
  equipment: 'Academia', limitations: '', professional_guidance: '', measured_on: null,
  weight_kg: 70, height_cm: 170, body_fat_percent: null, muscle_mass_kg: null,
};
const catalog = [
  { id: 'bench', name: 'Supino reto', muscle_group: 'Peito', equipment: 'Barra e banco', kind: 'strength' },
  { id: 'triceps', name: 'Tríceps corda', muscle_group: 'Triceps', equipment: 'Polia', kind: 'strength' },
  { id: 'bike', name: 'Bicicleta', muscle_group: 'Cardio', equipment: 'Bike', kind: 'cardio' },
];
const readyPlan = {
  status: 'ready',
  title: 'Proposta semanal',
  reasons: [],
  warnings: ['Proposta geral; confirme a adequação com um profissional.'],
  workouts: [{
    name: 'Treino A — Peito e tríceps',
    focus: 'Peito e tríceps',
    exercises: [
      { catalogId: 'bench', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { catalogId: 'triceps', targetSets: 2, targetReps: 12, restSeconds: 60 },
    ],
  }],
};
const providerResponse = (result = readyPlan) => ({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }],
});

test('geração exige flags de provedor, cobrança, privacidade e ativação independente', () => {
  assert.equal(workoutConsentVersion, 'gemini-workout-v1');
  assert.equal(workoutPlannerReady(settings), true);
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_WORKOUTS_ENABLED',
    'GEMINI_PAID_SERVICE_CONFIRMED', 'GEMINI_PRIVACY_REVIEWED']) {
    assert.equal(workoutPlannerReady({ ...settings, [key]: '' }), false);
  }
  assert.equal(workoutPlannerReady({ ...settings, GEMINI_REPORTS_ENABLED: 'false' }), true);
  assert.throws(() => buildWorkoutPlanRequest({ ...settings, GEMINI_WORKOUTS_ENABLED: 'false' }, assessment, catalog, []), /desativada/);
});

test('pedido inclui apenas dados necessários e medidas conferidas, nunca trechos originais ou identificadores', () => {
  const payload = buildWorkoutPlanRequest(settings, assessment, catalog, [{
    measurements: [{ label: 'Peso', value: '70', unit: 'kg', page: 1, source: 'Peso 70 kg' }],
    warnings: [],
  }]);
  const request = JSON.stringify(payload);
  assert.equal(request.includes('Peso 70 kg'), false);
  assert.equal(request.includes('source'), false);
  assert.ok(request.includes('\\"value\\":\\"70\\"'));
  assert.match(request, /Não diagnostique/);
  assert.equal(request.includes(settings.GEMINI_API_KEY), false);
  assert.equal(request.includes('"id":"bike"'), false);
});

test('sinais explícitos de risco clínico interrompem proposta, sem inferir diagnóstico', () => {
  assert.equal(requiresProfessionalReview(['Relata dor no peito durante esforço.']), true);
  assert.equal(requiresProfessionalReview(['Não fui liberada para fazer exercício.']), true);
  assert.equal(requiresProfessionalReview(['Tenho fratura recente no braço.']), true);
  assert.equal(requiresProfessionalReview(['A avaliação informa hipertensão.']), true);
  assert.equal(requiresProfessionalReview(['Objetivo: hipertrofia; treino 3 dias por semana.']), false);
});

test('proposta divide fichas por dias e aceita somente exercícios de força do catálogo', () => {
  const expectedPlan = { ...readyPlan };
  delete expectedPlan.reasons;
  assert.deepEqual(parseWorkoutPlan(readyPlan, catalog, 3), expectedPlan);
  assert.deepEqual(parseWorkoutPlan(expectedPlan, catalog, 3), expectedPlan);
  assert.deepEqual(parseGeminiWorkoutResponse(providerResponse(), catalog, 3), expectedPlan);
  for (const invalid of [
    { ...readyPlan, workouts: [readyPlan.workouts[0], readyPlan.workouts[0], readyPlan.workouts[0], readyPlan.workouts[0]] },
    { ...readyPlan, workouts: [{ ...readyPlan.workouts[0], exercises: [{ ...readyPlan.workouts[0].exercises[0], catalogId: 'unknown' }, readyPlan.workouts[0].exercises[1]] }] },
    { ...readyPlan, workouts: [{ ...readyPlan.workouts[0], exercises: [{ ...readyPlan.workouts[0].exercises[0], catalogId: 'bike' }, readyPlan.workouts[0].exercises[1]] }] },
    { ...readyPlan, workouts: [{ ...readyPlan.workouts[0], exercises: [readyPlan.workouts[0].exercises[0], readyPlan.workouts[0].exercises[0]] }] },
    { ...readyPlan, workouts: [{ ...readyPlan.workouts[0], exercises: [{ ...readyPlan.workouts[0].exercises[0], targetSets: 1 }, readyPlan.workouts[0].exercises[1]] }] },
  ]) assert.throws(() => parseWorkoutPlan(invalid, catalog, 3));
  assert.throws(() => parseWorkoutPlan(readyPlan, catalog, 0));
});

test('revisão profissional nunca retorna uma ficha ou exercícios', () => {
  const review = {
    status: 'professional_review', title: 'Revisão necessária',
    reasons: ['Procure avaliação profissional antes de iniciar.'], warnings: [], workouts: [],
  };
  assert.deepEqual(parseWorkoutPlan(review, catalog, 3), {
    status: 'professional_review', title: review.title, reasons: review.reasons,
  });
  assert.deepEqual(parseWorkoutPlan(parseWorkoutPlan(review, catalog, 3), catalog, 3),
    parseWorkoutPlan(review, catalog, 3));
  assert.throws(() => parseWorkoutPlan({ ...review, workouts: [readyPlan.workouts[0]] }, catalog, 3));
});

test('recusa, truncamento e saída malformada do provedor são falhas explícitas', () => {
  for (const response of [
    null, {}, { candidates: [] }, { candidates: [{ finishReason: 'MAX_TOKENS' }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] },
    providerResponse({ ...readyPlan, diagnosis: 'not allowed' }),
  ]) assert.throws(() => parseGeminiWorkoutResponse(response, catalog, 3));
});
