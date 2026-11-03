import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geminiReady, geminiFailureCode, buildGeminiAssessmentRequest, parseGeminiAssessmentResponse, parseAssessmentExtraction } from '../supabase/functions/_shared/gemini-assessment.ts';

const settings = { GEMINI_API_KEY: 'synthetic-not-a-key', GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_REPORTS_ENABLED: 'true', GEMINI_PAID_SERVICE_CONFIRMED: 'true', GEMINI_PRIVACY_REVIEWED: 'true' };
const result = { measurements: [{ label: 'Medida sintética', value: '42,5', unit: 'unidade', page: 1, source: 'Medida sintética 42,5 unidade' }], warnings: [] };
const response = (data = result) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(data) }] } }] });

test('Gemini fica desativado por padrao e exige todas as confirmacoes exclusivamente no servidor', () => {
  assert.equal(geminiReady({}), false);
  for (const key of Object.keys(settings)) {
    const missing = { ...settings, [key]: '' };
    assert.equal(geminiReady(missing), false);
    assert.throws(() => buildGeminiAssessmentRequest(missing, 'application/pdf', 'JVBERi0='), /desativada/);
  }
  assert.equal(geminiReady({ ...settings, GEMINI_MODEL: 'gemini-test?key=bad' }), false);
  assert.equal(geminiReady(settings), true);
});

test('payload envia apenas documento inline para transcricao estruturada sem chave, ferramentas ou upload Files API', () => {
  const payload = buildGeminiAssessmentRequest(settings, 'application/pdf', 'JVBERi0=');
  assert.deepEqual(payload.contents[0].parts[1], { inlineData: { mimeType: 'application/pdf', data: 'JVBERi0=' } });
  assert.equal(JSON.stringify(payload).includes(settings.GEMINI_API_KEY), false);
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  assert.equal(payload.generationConfig.maxOutputTokens, 4096);
  assert.match(payload.systemInstruction.parts[0].text, /Nunca diagnostique/);
  assert.equal('tools' in payload, false);
  assert.throws(() => buildGeminiAssessmentRequest(settings, 'text/html', 'x'));
});

test('resposta completa preserva valores literais; recusas, truncamentos, JSON invalido e campos clinicos sao rejeitados', () => {
  assert.deepEqual(parseGeminiAssessmentResponse(response()), result);
  for (const invalid of [
    null, {}, { candidates: [] }, { candidates: [{ finishReason: 'MAX_TOKENS' }] },
    { candidates: [{ finishReason: 'SAFETY' }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] },
    response({ ...result, diagnosis: 'not allowed' }),
    response({ ...result, measurements: [{ ...result.measurements[0], page: 0 }] }),
    response({ ...result, measurements: [] }),
    response({ ...result, measurements: Array(31).fill(result.measurements[0]) }),
    response({ ...result, warnings: Array(6).fill('warning') }),
  ]) assert.throws(() => parseGeminiAssessmentResponse(invalid));
  assert.throws(() => parseAssessmentExtraction({ ...result, measurements: [{ ...result.measurements[0], source: '' }] }));
});

test('diagnostico do provedor expoe apenas codigos conhecidos, nunca mensagens ou conteudos arbitrarios', () => {
  assert.equal(geminiFailureCode({ error: { message: 'private', details: [{ reason: 'API_KEY_INVALID' }] } }), 'API_KEY_INVALID');
  assert.equal(geminiFailureCode({ error: { details: [{ reason: 'private-user-content' }] } }), null);
  assert.equal(geminiFailureCode({ error: { details: 'private' } }), null);
  assert.equal(geminiFailureCode(null), null);
});
