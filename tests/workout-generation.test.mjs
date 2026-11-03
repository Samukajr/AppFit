import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateWorkoutProposal } from '../supabase/functions/_shared/workout-generation.ts';
import { buildWorkoutPlanRequest } from '../supabase/functions/_shared/gemini-workout.ts';

const settings = { GEMINI_API_KEY: 'synthetic-key', GEMINI_MODEL: 'gemini-test',
  GEMINI_WORKOUTS_ENABLED: 'true', GEMINI_PAID_SERVICE_CONFIRMED: 'true', GEMINI_PRIVACY_REVIEWED: 'true' };
const assessment = { goal: 'weight_loss', experience: 'beginner', days_per_week: 3, session_minutes: 45,
  equipment: 'Academia', limitations: '', professional_guidance: '', measured_on: '2026-10-20',
  weight_kg: 70, height_cm: 170, body_fat_percent: 25, muscle_mass_kg: 30 };
const catalog = [
  { id: 'a', name: 'Exercicio A', muscle_group: 'Pernas', equipment: 'Banco', kind: 'strength' },
  { id: 'b', name: 'Exercicio B', muscle_group: 'Costas', equipment: 'Polia', kind: 'strength' },
];
const plan = { status: 'ready', title: 'Plano semanal', reasons: [], warnings: ['Proposta geral.'],
  workouts: [{ name: 'A', focus: 'Geral', exercises: catalog.map(({ id }) =>
    ({ catalogId: id, targetSets: 2, targetReps: 10, restSeconds: 60 })) }] };
const respond = (value) => new Response(JSON.stringify(value));
const envelope = (value) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });

test('servico considera anamnese e bioimpedancia sem enviar identificadores ou estimar ausentes', async () => {
  const payload = buildWorkoutPlanRequest(settings, assessment, catalog, []);
  const context = JSON.parse(payload.contents[0].parts[0].text).assessment;
  assert.equal(context.goal, 'weight_loss');
  assert.deepEqual(context.bioimpedance, { measured_on: '2026-10-20',
    weight_kg: 70, height_cm: 170, body_fat_percent: 25, muscle_mass_kg: 30 });
  let calls = 0;
  const result = await generateWorkoutProposal(settings, assessment, catalog, [], async (url, options) => {
    calls++;
    assert.match(url, /^https:\/\/generativelanguage.googleapis.com\//);
    assert.equal(options.headers['x-goog-api-key'], settings.GEMINI_API_KEY);
    assert.equal('id' in JSON.parse(options.body).contents[0].parts[0], false);
    assert.ok(options.signal);
    return respond(envelope(plan));
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'ready');
  assert.equal(result.workouts.length, 1);
});

test('reabilitacao e sinais clinicos nunca chamam o provedor nem retornam exercicios', async () => {
  const forbidden = async () => { assert.fail('Nao deve chamar o provedor'); };
  for (const input of [
    { ...assessment, goal: 'rehabilitation', professional_guidance: 'Liberado para fisioterapia' },
    { ...assessment, limitations: 'Dor no peito' },
  ]) {
    const result = await generateWorkoutProposal(settings, input, catalog, [], forbidden);
    assert.equal(result.status, 'professional_review');
    assert.ok(result.reasons.length);
    assert.equal('workouts' in result, false);
  }
  const result = await generateWorkoutProposal(settings, assessment, catalog, [{
    measurements: [{ label: 'Observacao', value: 'cirurgia recente', unit: '', page: 1, source: 'Texto original' }], warnings: [],
  }], forbidden);
  assert.equal(result.status, 'professional_review');
});

test('falhas, recusa, truncamento e catalogo invalido nao se tornam planos de sucesso', async () => {
  await assert.rejects(generateWorkoutProposal(settings, assessment, catalog, [], async () => new Response('', { status: 429 })));
  await assert.rejects(generateWorkoutProposal(settings, assessment, catalog, [], async () => { throw new Error('Timeout'); }), /Timeout/);
  await assert.rejects(generateWorkoutProposal(settings, assessment, catalog, [], async () => respond({ candidates: [] })));
  await assert.rejects(generateWorkoutProposal(settings, assessment, catalog, [], async () => respond({
    candidates: [{ finishReason: 'MAX_TOKENS' }],
  })));
  await assert.rejects(generateWorkoutProposal(settings, assessment, [], [], async () => respond(envelope(plan))), /Catálogo/);
  await assert.rejects(generateWorkoutProposal({ ...settings, GEMINI_WORKOUTS_ENABLED: 'false' },
    assessment, catalog, [], async () => respond(envelope(plan))), /desativada/);
});
