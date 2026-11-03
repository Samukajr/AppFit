import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAssessmentRepository } from '../src/features/assessments/repository.ts';

const user = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const docId = '33333333-3333-4333-8333-333333333333';
const generationId = '44444444-4444-4444-8444-444444444444';
const document = { id: docId, assessment_id: id, file_path: `${user}/assessments/${id}/${docId}.pdf`,
  display_name: 'Synthetic.pdf', mime_type: 'application/pdf', size_bytes: 5, uploaded_at: null,
  extraction_status: 'not_requested', extraction: null, extraction_reviewed_at: null };

test('anexo segue preparar, enviar sem sobrescrever, confirmar e remover arquivo antes do registro', async () => {
  const calls = [];
  const client = {
    async rpc(name, params) {
      calls.push({ name, params });
      return { data: name === 'begin_assessment_document' ? document : null, error: null };
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'health-reports');
      return {
        async upload(path, buffer, options) { calls.push({ name: 'upload', path, length: buffer.byteLength, options }); return { error: null }; },
        async remove(paths) { calls.push({ name: 'remove-file', paths }); return { error: null }; },
      };
    } },
    from(table) {
      assert.equal(table, 'assessment_documents');
      return { delete() { return { eq(column, value) { return { async select() {
        calls.push({ name: 'remove-record', column, value }); return { data: [{ id: value }], error: null };
      } }; } }; } };
    },
  };
  const repo = createAssessmentRepository(client, user);
  const prepared = await repo.beginDocument(id, 'Synthetic.pdf', 'application/pdf', 5);
  const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer;
  await repo.upload(prepared, buffer);
  await repo.confirmDocument(prepared.id);
  await repo.removeDocument(prepared);
  assert.deepEqual(calls.map((c) => c.name), ['begin_assessment_document', 'upload', 'confirm_assessment_document', 'remove-file', 'remove-record']);
  assert.deepEqual(calls[0].params, { p_assessment_id: id, p_name: 'Synthetic.pdf', p_mime_type: 'application/pdf', p_size_bytes: 5 });
  assert.deepEqual(calls[1].options, { contentType: 'application/pdf', upsert: false });
  assert.deepEqual(calls[2].params, { p_document_id: docId });
});

test('erros de RPC, upload e limpeza nunca confirmam persistencia e preservam o registro', async () => {
  const failure = { message: 'not authorized' };
  let deleted = false;
  const repo = createAssessmentRepository({
    async rpc() { return { data: null, error: failure }; },
    storage: { from() { return {
      async upload() { return { error: failure }; },
      async remove() { return { error: failure }; },
    }; } },
    from() { deleted = true; throw new Error('Must not delete record'); },
  }, user);
  await assert.rejects(repo.beginDocument(id, 'x.pdf', 'application/pdf', 5), /not authorized/);
  await assert.rejects(repo.confirmDocument(docId), /not authorized/);
  await assert.rejects(repo.upload(document, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer), /não confirmado/);
  await assert.rejects(repo.upload(document, new ArrayBuffer(4)), /tamanho/);
  await assert.rejects(repo.removeDocument(document), /arquivo privado/);
  assert.equal(deleted, false);
});

test('schema remoto ausente produz erro explicito e nao uma lista vazia de sucesso', async () => {
  const repo = createAssessmentRepository({
    from() { return { select() { return {
      order() { return { async limit() { return { data: null, error: { message: 'relation missing' } }; } }; },
      eq() { return { async order() { return { data: null, error: { message: 'relation missing' } }; } }; },
    }; } }; },
  }, user);
  await assert.rejects(repo.list(), /migração.*relation missing/);
  await assert.rejects(repo.documents(id), /relation missing/);
});

test('cliente Gemini exige consentimento separado, consulta disponibilidade e confirma persistencia', async () => {
  const calls = [];
  const repo = createAssessmentRepository({
    functions: { async invoke(name, options) {
      calls.push({ name, ...options.body });
      return { data: options.body.action === 'status' ? { enabled: false, workoutsEnabled: false, provider: 'gemini' } : { saved: true }, error: null };
    } },
    async rpc(name, params) { calls.push({ name, ...params }); return { error: null }; },
  }, user);
  assert.deepEqual(await repo.geminiStatus(), { documents: false, workouts: false });
  await assert.rejects(repo.analyzeDocument(docId, false, true), /maioridade/);
  await assert.rejects(repo.analyzeDocument(docId, true, false), /consentimento/);
  assert.equal(calls.length, 1);
  await repo.analyzeDocument(docId, true, true);
  assert.deepEqual(calls[1], { name: 'analyze-assessment', document_id: docId, adult_confirmed: true, consent_version: 'gemini-document-v1' });
  await repo.reviewExtraction(docId);
  assert.equal(calls[2].name, 'review_assessment_extraction');
});

test('geracao de plano exige consentimento, valida exercicios contra catalogo e salva todas as fichas atomicamente', async () => {
  const calls = [];
  const catalog = [
    { id: 'bench', name: 'Supino', muscle_group: 'Peito', equipment: 'Barra', kind: 'strength' },
    { id: 'triceps', name: 'Tríceps corda', muscle_group: 'Triceps', equipment: 'Polia', kind: 'strength' },
  ];
  const workouts = [{
    name: 'Treino A — Peito e tríceps', focus: 'Peito e tríceps',
    exercises: [
      { catalogId: 'bench', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { catalogId: 'triceps', targetSets: 2, targetReps: 12, restSeconds: 60 },
    ],
  }];
  const plan = { status: 'ready', title: 'Plano semanal', warnings: ['Proposta geral.'], reasons: [], workouts };
  const expectedPlan = { status: 'ready', title: plan.title, warnings: plan.warnings, workouts };
  const repo = createAssessmentRepository({
    from(table) {
      assert.equal(table, 'exercise_catalog');
      return { select() { return { order() { return { async limit() {
        return { data: catalog, error: null };
      } }; } }; } };
    },
    functions: { async invoke(name, options) {
      calls.push({ name, body: options.body });
      return { data: { generationId, plan }, error: null };
    } },
    async rpc(name, params) {
      calls.push({ name, params });
      return { data: [id], error: null };
    },
  }, user);
  await assert.rejects(repo.generateWorkoutPlan(id, 3, [], false, true), /maioridade/);
  await assert.rejects(repo.generateWorkoutPlan(id, 3, [], true, false), /consentimento/);
  const generated = await repo.generateWorkoutPlan(id, 3, [docId], true, true);
  assert.equal(generated.generationId, generationId);
  assert.equal(generated.catalog[0].muscleGroup, 'Peito');
  assert.deepEqual(generated.plan, expectedPlan);
  assert.deepEqual(calls[0], { name: 'generate-workout-plan', body: {
    assessment_id: id, document_ids: [docId],
    adult_confirmed: true, consent_version: 'gemini-workout-v1',
  } });
  assert.deepEqual(await repo.saveWorkoutPlan(generationId, workouts), [id]);
  assert.deepEqual(calls[1], { name: 'create_ai_workout_plan', params: {
    p_generation_id: generationId,
    p_workouts: [{ name: workouts[0].name, exercises: workouts[0].exercises }],
  } });
});

test('cliente mostra erro da Edge Function e rejeita disponibilidade e sucesso invalidos', async () => {
  let mode = 'error';
  const repo = createAssessmentRepository({ functions: { async invoke() {
    if (mode === 'error') return { data: null, error: { message: 'HTTP error', context: new Response(JSON.stringify({ error: 'Gemini desativado' })) } };
    return { data: { enabled: 'yes', workoutsEnabled: false, saved: false }, error: null };
  } } }, user);
  await assert.rejects(repo.geminiStatus(), /desativado/);
  mode = 'invalid';
  await assert.rejects(repo.geminiStatus(), /inválido/);
  await assert.rejects(repo.analyzeDocument(docId, true, true), /não confirmada/);
});
