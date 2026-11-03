import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAssessment, emptyDraft, parseAssessment, parseAssessments, parseDocument, parseDocuments,
  validateAttachment, validateFileSignature } from '../src/features/assessments/contract.ts';

const user = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const docId = '33333333-3333-4333-8333-333333333333';
const draft = { ...emptyDraft, goal: 'hypertrophy', experience: 'beginner', days: '3', minutes: '45', equipment: 'Academia' };
const timestamp = '2026-10-16T10:00:00Z';
const row = () => ({ ...buildAssessment(draft, true), id, created_at: timestamp });
const doc = () => ({ id: docId, assessment_id: id, display_name: 'Synthetic.pdf', mime_type: 'application/pdf',
  size_bytes: 100, file_path: `${user}/assessments/${id}/${docId}.pdf`, uploaded_at: null,
  extraction_status: 'not_requested', extraction: null, extraction_reviewed_at: null });

test('anamnese exige consentimento, preserva opcionais ausentes e decimais brasileiros', () => {
  assert.throws(() => buildAssessment(draft, false), /consentimento/);
  const input = buildAssessment({ ...draft, weight: '70,25', bodyFat: '0', measuredOn: '2024-02-29' }, true);
  assert.equal(input.weight_kg, 70.25);
  assert.equal(input.body_fat_percent, 0);
  assert.equal(input.muscle_mass_kg, null);
  assert.equal(input.measured_on, '2024-02-29');
  assert.equal(input.consent_version, 'assessment-storage-v1');
});

test('objetivos de hipertrofia, emagrecimento e reabilitacao preservam o historico', () => {
  for (const goal of ['hypertrophy', 'weight_loss', 'rehabilitation', 'fitness', 'conditioning', 'other']) {
    const input = buildAssessment({ ...draft, goal }, true);
    assert.equal(parseAssessment({ ...input, id, created_at: timestamp }).goal, goal);
  }
});

test('anamnese rejeita metas ausentes, limites tecnicos invalidos e datas inexistentes', () => {
  for (const invalid of [
    { goal: '' }, { experience: 'unknown' }, { days: '0' }, { days: '8' }, { days: '1.5' },
    { minutes: '9' }, { minutes: '181' }, { equipment: ' ' }, { equipment: 'x'.repeat(1001) },
    { limitations: 'x'.repeat(2001) }, { guidance: 'x'.repeat(2001) },
    { measuredOn: '2026-02-29' }, { measuredOn: '2026-04-31' }, { measuredOn: '01/09/2026' },
    { weight: '0' }, { weight: '501' }, { height: '29' }, { height: '301' },
    { bodyFat: '101' }, { muscleMass: '-1' }, { muscleMass: '500.001' }, { weight: 'NaN' },
  ]) assert.throws(() => buildAssessment({ ...draft, ...invalid }, true));
});

test('contrato de avaliacoes recusa campos e tipos incorretos sem resultado simulado', () => {
  assert.deepEqual(parseAssessment(row()), row());
  assert.deepEqual(parseAssessments([row()]), [row()]);
  assert.throws(() => parseAssessments(null));
  for (const invalid of [{ id: 'wrong' }, { consent_version: 'wrong' }, { weight_kg: '70' }, { created_at: 'wrong' }, { days_per_week: 1.5 }]) {
    assert.throws(() => parseAssessment({ ...row(), ...invalid }));
  }
});

test('anexos aceitam apenas PDF JPEG PNG ate 10MB e validam a assinatura', () => {
  assert.equal(validateAttachment('x.pdf', 'application/pdf', 10485760).size, 10485760);
  for (const args of [
    ['x', undefined, 1], ['x', 'text/plain', 1], ['x', 'application/pdf', 0],
    ['x', 'application/pdf', 10485761], ['x', 'application/pdf', 1.5], ['', 'image/png', 100],
  ]) assert.throws(() => validateAttachment(...args));
  validateFileSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), 'application/pdf');
  validateFileSignature(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg');
  validateFileSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png');
  assert.throws(() => validateFileSignature(new Uint8Array([1, 2, 3]), 'application/pdf'));
});

test('documentos nao podem apontar para caminhos fora da conta e avaliacao', () => {
  assert.deepEqual(parseDocument(doc(), user), doc());
  assert.equal(parseDocuments([doc()], user).length, 1);
  for (const invalid of [
    { file_path: `other/${id}/${docId}.pdf` }, { assessment_id: docId }, { file_path: 'https://public.example/file.pdf' },
    { mime_type: 'text/html' }, { uploaded_at: 'wrong' }, { size_bytes: undefined },
    { extraction_status: undefined }, { extraction_status: 'succeeded', extraction: null },
    { extraction_reviewed_at: 'not-a-date' }, { extraction: { advice: 'unexpected' } },
  ]) assert.throws(() => parseDocument({ ...doc(), ...invalid }, user));
});
