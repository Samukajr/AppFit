import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

const user = '11111111-1111-4111-8111-111111111111';
const assessment = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const attempt = '44444444-4444-4444-8444-444444444444';
const generation = '55555555-5555-4555-8555-555555555555';
const pdf = '%PDF-1.4\nSynthetic, no personal data\n%%EOF';
const extraction = { measurements: [{ label: 'Medida sintética', value: '42', unit: 'unidade', page: 1, source: 'Medida sintética 42' }], warnings: [] };
const assessmentRow = { id: assessment, user_id: user, goal: 'hypertrophy', experience: 'beginner', days_per_week: 3,
  session_minutes: 45, equipment: 'Academia', limitations: '', professional_guidance: '', measured_on: null,
  weight_kg: 70, height_cm: 170, body_fat_percent: null, muscle_mass_kg: null,
  consent_version: 'assessment-storage-v1', created_at: '2026-10-16T10:00:00Z' };
const workoutPlan = { status: 'ready', title: 'Plano semanal', reasons: [], warnings: ['Proposta geral.'],
  workouts: [{ name: 'Treino A — Peito e tríceps', focus: 'Peito e tríceps', exercises: [
    { catalogId: 'bench', targetSets: 3, targetReps: 10, restSeconds: 90 },
    { catalogId: 'triceps', targetSets: 2, targetReps: 12, restSeconds: 60 },
  ] }] };
const env = { SUPABASE_URL: 'https://supabase.example.invalid', SUPABASE_ANON_KEY: 'synthetic-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', GEMINI_API_KEY: 'synthetic-gemini', GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_REPORTS_ENABLED: 'false', GEMINI_PAID_SERVICE_CONFIRMED: 'true', GEMINI_PRIVACY_REVIEWED: 'true' };
let handler, workoutHandler, providerCalls = 0, downloads = 0, claims = 0, claimDenied = false, providerFails = false, stored;
let storedPlan, planPersistenceFails = false, unreviewedDocument = false;
globalThis.Deno = { env: { get: (key) => env[key] }, serve: (callback) => { handler = callback; } };
const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'npm:@supabase/supabase-js@2' ? '@supabase/supabase-js' : specifier, context);
} });
await import('../supabase/functions/analyze-assessment/index.ts');
const assessmentHandler = handler;
await import('../supabase/functions/generate-workout-plan/index.ts');
workoutHandler = handler;
handler = assessmentHandler;
hooks.deregister();

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = String(input);
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.includes('/auth/v1/user')) return json({ id: user, email: 'test@example.invalid' });
  if (url.includes('/rpc/claim_gemini_assessment')) {
    claims++;
    assert.equal(JSON.parse(options.body).p_user_id, user);
    if (claimDenied) return json({ message: 'Limite diario', code: 'P0001' }, 400);
    return json({ id, assessment_id: assessment, file_path: `${user}/assessments/${assessment}/${id}.pdf`,
      display_name: 'Synthetic.pdf', mime_type: 'application/pdf', size_bytes: pdf.length, uploaded_at: '2026-10-16T10:00:00Z',
      extraction_status: 'processing', extraction: null, extraction_reviewed_at: null, extraction_attempt_id: attempt });
  }
  if (url.includes('/rpc/claim_ai_workout_plan')) return json(generation);
  if (url.includes('/rest/v1/workout_ai_attempts') && options.method === 'PATCH') {
    assert.match(url, new RegExp(generation));
    assert.match(url, new RegExp(user));
    storedPlan = JSON.parse(options.body).generated_plan;
    return planPersistenceFails ? json({ message: 'Synthetic storage failure' }, 500) : json([{ id: generation }]);
  }
  if (url.includes('/rest/v1/assessment_documents') && options.method === 'PATCH') {
    assert.match(url, new RegExp(attempt));
    stored = { ...stored, ...JSON.parse(options.body) };
    return json([{ id }]);
  }
  if (url.includes('/rest/v1/assessments?')) return json(assessmentRow);
  if (url.includes('/rest/v1/assessment_documents?')) return json([{
    id, assessment_id: assessment, file_path: `${user}/assessments/${assessment}/${id}.pdf`, display_name: 'Synthetic.pdf',
    mime_type: 'application/pdf', size_bytes: pdf.length, uploaded_at: '2026-10-16T10:00:00Z',
    extraction_status: 'succeeded', extraction, extraction_reviewed_at: unreviewedDocument ? null : '2026-10-16T10:05:00Z',
  }]);
  if (url.includes('/rest/v1/exercise_catalog?')) return json([
    { id: 'bench', name: 'Supino reto', muscle_group: 'Peito', equipment: 'Barra e banco', kind: 'strength' },
    { id: 'triceps', name: 'Tríceps corda', muscle_group: 'Triceps', equipment: 'Polia', kind: 'strength' },
  ]);
  if (url.includes('/storage/v1/object/')) { downloads++; return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }); }
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    if (url.includes('/models?pageSize=')) return json({ models: [
      { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/other', supportedGenerationMethods: ['embedContent'] },
      { name: 'unexpected-model', supportedGenerationMethods: ['generateContent'] },
    ] });
    providerCalls++;
    assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
    if (JSON.parse(options.body).contents[0].parts[0].text.includes('strength_exercise_catalog')) {
      assert.equal(options.body.includes(pdf), false);
      return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(workoutPlan) }] } }] });
    }
    assert.equal(JSON.parse(options.body).contents[0].parts[1].inlineData.data, btoa(pdf));
    if (providerFails) return json({ error: { message: 'Synthetic provider error' } }, 429);
    return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(extraction) }] } }] });
  }
  throw new Error(`Unexpected synthetic request: ${url}`);
};

const request = (body, authenticated = true) => new Request('https://edge.example.invalid', {
  method: 'POST', headers: authenticated ? { Authorization: 'Bearer synthetic-user' } : {},
  body: JSON.stringify(body),
});
const payload = { document_id: id, adult_confirmed: true, consent_version: 'gemini-document-v1' };
const workoutPayload = { action: 'generate_workout_plan', assessment_id: assessment,
  document_ids: [id], adult_confirmed: true, consent_version: 'gemini-workout-v1' };

test('endpoint exige autenticacao, fica bloqueado sem configuracao e nao baixa nem envia documento', async () => {
  assert.equal((await handler(request({ action: 'status' }, false))).status, 401);
  const status = await handler(request({ action: 'status' }));
  assert.deepEqual(await status.json(), { enabled: false, workoutsEnabled: false, provider: 'gemini' });
  assert.equal((await handler(request(payload))).status, 503);
  assert.equal(claims, 0); assert.equal(downloads, 0); assert.equal(providerCalls, 0);
});

test('endpoint valida consentimento e respeita recusa de quota antes do download', async () => {
  env.GEMINI_REPORTS_ENABLED = 'true';
  env.GEMINI_REPORTS_TEST_USER_ID = '99999999-9999-4999-8999-999999999999';
  assert.deepEqual(await (await handler(request({ action: 'status' }))).json(), { enabled: false, workoutsEnabled: false, provider: 'gemini' });
  assert.equal((await handler(request(payload))).status, 503);
  assert.equal(claims, 0);
  env.GEMINI_REPORTS_TEST_USER_ID = user;
  assert.deepEqual(await (await handler(request({ action: 'status' }))).json(), { enabled: true, workoutsEnabled: false, provider: 'gemini' });
  assert.deepEqual(await (await handler(request({ action: 'models' }))).json(), { models: ['gemini-3.1-flash-lite'] });
  delete env.GEMINI_REPORTS_TEST_USER_ID;
  assert.equal((await handler(request({ action: 'models' }))).status, 403);
  env.GEMINI_REPORTS_TEST_USER_ID = user;
  assert.equal((await handler(request({ ...payload, adult_confirmed: false }))).status, 400);
  claimDenied = true;
  assert.equal((await handler(request(payload))).status, 409);
  assert.equal(downloads, 0); assert.equal(providerCalls, 0);
  claimDenied = false;
});

test('endpoint envia somente arquivo autorizado, persiste transcricao sem confirmar revisao e explicita falhas', async () => {
  const response = await handler(request(payload));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { saved: true });
  assert.equal(stored.extraction_status, 'succeeded');
  assert.deepEqual(stored.extraction, extraction);
  assert.equal(stored.extraction_reviewed_at, undefined);
  providerFails = true;
  assert.equal((await handler(request(payload))).status, 502);
  assert.equal(stored.extraction_status, 'failed');
});

test('geracao valida consentimento, usa somente medidas conferidas e bloqueia sinais de risco', async () => {
  env.GEMINI_WORKOUTS_ENABLED = 'true';
  env.GEMINI_REPORTS_ENABLED = 'false';
  env.GEMINI_REPORTS_TEST_USER_ID = user;
  const status = await (await handler(request({ action: 'status' }))).json();
  assert.deepEqual(status, { enabled: false, workoutsEnabled: true, provider: 'gemini' });
  assert.equal((await handler(request({ ...workoutPayload, adult_confirmed: false }))).status, 400);
  const response = await handler(request(workoutPayload));
  assert.equal(response.status, 200);
  const result = await response.json();
  const { reasons, ...expectedPlan } = workoutPlan;
  assert.deepEqual(result, { generationId: generation, plan: expectedPlan });
  const count = providerCalls;
  assessmentRow.limitations = 'Relata dor no peito durante esforço.';
  const riskResponse = await handler(request(workoutPayload));
  assert.equal(riskResponse.status, 200);
  const riskResult = await riskResponse.json();
  assert.equal(riskResult.plan.status, 'professional_review');
  assert.equal('workouts' in riskResult.plan, false);
  assert.equal(providerCalls, count);
  delete env.GEMINI_WORKOUTS_ENABLED;
  delete env.GEMINI_REPORTS_TEST_USER_ID;
  env.GEMINI_REPORTS_ENABLED = 'true';
});

test.after(() => { globalThis.fetch = originalFetch; delete globalThis.Deno; });

test('rota dedicada valida acesso, metodos, corpo, documentos conferidos e persistencia', async () => {
  env.GEMINI_WORKOUTS_ENABLED = 'true';
  assessmentRow.limitations = '';
  assert.equal((await workoutHandler(new Request('https://edge.example.invalid', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await workoutHandler(new Request('https://edge.example.invalid'))).status, 405);
  assert.equal((await workoutHandler(request(workoutPayload, false))).status, 401);
  assert.equal((await workoutHandler(request({ action: 'models' }))).status, 400);
  assert.equal((await workoutHandler(request({ ...workoutPayload, consent_version: 'wrong' }))).status, 400);
  assert.equal((await workoutHandler(request({ ...workoutPayload, document_ids: [id, id] }))).status, 400);
  assert.equal((await workoutHandler(request({ ...workoutPayload, padding: 'x'.repeat(2048) }))).status, 413);
  const { action, ...dedicatedPayload } = workoutPayload;
  const response = await workoutHandler(request(dedicatedPayload));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).plan, storedPlan);
  const calls = providerCalls;
  unreviewedDocument = true;
  assert.equal((await workoutHandler(request(dedicatedPayload))).status, 502);
  assert.equal(providerCalls, calls);
  unreviewedDocument = false;
  planPersistenceFails = true;
  assert.equal((await workoutHandler(request(dedicatedPayload))).status, 502);
  planPersistenceFails = false;
});

test('rota dedicada suporta emagrecimento e encaminha reabilitacao sem chamada clinica ao provedor', async () => {
  assessmentRow.goal = 'weight_loss';
  const response = await workoutHandler(request(workoutPayload));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).plan.status, 'ready');
  const calls = providerCalls;
  assessmentRow.goal = 'rehabilitation';
  const review = await workoutHandler(request(workoutPayload));
  assert.equal(review.status, 200);
  assert.equal((await review.json()).plan.status, 'professional_review');
  assert.equal(providerCalls, calls);
  assert.equal(storedPlan.status, 'professional_review');
  assert.equal('workouts' in storedPlan, false);
  assessmentRow.goal = 'hypertrophy';
});
