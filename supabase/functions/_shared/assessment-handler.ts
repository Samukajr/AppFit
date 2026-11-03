import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildGeminiAssessmentRequest, geminiConsentVersion, geminiFailureCode, geminiReady, parseGeminiAssessmentResponse } from './gemini-assessment.ts';
import { workoutConsentVersion, workoutPlannerReady } from './gemini-workout.ts';
import { generateWorkoutProposal } from './workout-generation.ts';
import type { WorkoutGenerationResponse } from '../../../src/features/workouts/ai-types.ts';
import { parseAssessment, parseDocument, parseDocuments, validateFileSignature } from '../../../src/features/assessments/contract.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function handleAssessmentRequest(req: Request, scope: 'all' | 'workout' = 'all') {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return reply(503, { error: 'Serviço não configurado.' });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Autenticação necessária.' });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await client.auth.getUser(authorization.slice(7));
  if (authError || !identity.user) return reply(401, { error: 'Sessão inválida.' });
  const settings = {
    GEMINI_API_KEY: Deno.env.get('GEMINI_API_KEY'), GEMINI_MODEL: Deno.env.get('GEMINI_MODEL'),
    GEMINI_REPORTS_ENABLED: Deno.env.get('GEMINI_REPORTS_ENABLED'),
    GEMINI_PAID_SERVICE_CONFIRMED: Deno.env.get('GEMINI_PAID_SERVICE_CONFIRMED'),
    GEMINI_PRIVACY_REVIEWED: Deno.env.get('GEMINI_PRIVACY_REVIEWED'),
    GEMINI_WORKOUTS_ENABLED: Deno.env.get('GEMINI_WORKOUTS_ENABLED'),
  };
  let body: Record<string, unknown>;
  try {
    const reader = req.body?.getReader();
    if (!reader) return reply(400, { error: 'Requisição obrigatória.' });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2048) { await reader.cancel(); return reply(413, { error: 'Requisição excede o limite.' }); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply(400, { error: 'Requisição inválida.' });
    body = parsed as Record<string, unknown>;
  } catch { return reply(400, { error: 'JSON inválido.' }); }
  if (scope === 'workout') {
    if (body.action === undefined) body.action = 'generate_workout_plan';
    if (body.action !== 'generate_workout_plan' && body.action !== 'status') {
      return reply(400, { error: 'Ação inválida para geração de treino.' });
    }
  }
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const testUserId = Deno.env.get('GEMINI_REPORTS_TEST_USER_ID')?.trim();
  const enabled = geminiReady(settings) && !!serviceKey && (!testUserId || identity.user.id === testUserId);
  const workoutsEnabled = workoutPlannerReady(settings) && !!serviceKey && (!testUserId || identity.user.id === testUserId);
  if (body.action === 'status') return reply(200, { enabled, workoutsEnabled, provider: 'gemini' });
  if (body.action === 'generate_workout_plan') {
    if (!workoutsEnabled || !serviceKey) return reply(503, { error: 'Geração de treinos por IA indisponível. O serviço pode estar desativado no servidor.' });
    if (!uuid(body.assessment_id) || body.consent_version !== workoutConsentVersion ||
        body.adult_confirmed !== true || !Array.isArray(body.document_ids) ||
        body.document_ids.length > 5 || body.document_ids.some((id) => !uuid(id)) ||
        new Set(body.document_ids).size !== body.document_ids.length) {
      return reply(400, { error: 'Avaliação, documentos conferidos, consentimento e confirmação de 18 anos são obrigatórios.' });
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: generationId, error: claimError } = await admin.rpc('claim_ai_workout_plan', {
      p_user_id: identity.user.id, p_assessment_id: body.assessment_id,
      p_document_ids: body.document_ids, p_consent_version: workoutConsentVersion, p_adult_confirmed: true,
    });
    if (claimError || !uuid(generationId)) {
      return reply(409, { error: claimError?.message ?? 'Não foi possível validar a autorização para gerar o plano.' });
    }
    let stage = 'assessment_load';
    try {
      const { data: assessmentRow, error: assessmentError } = await admin.from('assessments').select('*')
        .eq('id', body.assessment_id).eq('user_id', identity.user.id).maybeSingle();
      if (assessmentError || !assessmentRow) throw new Error('AssessmentUnavailable');
      const assessment = parseAssessment(assessmentRow);
      let extractions: NonNullable<ReturnType<typeof parseDocuments>[number]['extraction']>[] = [];
      if (body.document_ids.length) {
        stage = 'reviewed_document_load';
        const { data: documentRows, error: documentError } = await admin.from('assessment_documents')
          .select('id,assessment_id,user_id,file_path,display_name,mime_type,size_bytes,uploaded_at,extraction_status,extraction,extraction_reviewed_at')
          .eq('assessment_id', body.assessment_id).eq('user_id', identity.user.id).in('id', body.document_ids);
        if (documentError || !documentRows || documentRows.length !== body.document_ids.length) throw new Error('ReviewedDocumentsUnavailable');
        const documents = parseDocuments(documentRows, identity.user.id);
        if (documents.some((document) => !document.uploaded_at || !document.extraction || document.extraction_status !== 'succeeded' || !document.extraction_reviewed_at)) {
          throw new Error('ReviewedDocumentsRequired');
        }
        extractions = documents.map((document) => document.extraction!);
      }
      stage = 'catalog_load';
      const { data: catalog, error: catalogError } = await admin.from('exercise_catalog')
        .select('id,name,muscle_group,equipment,kind').order('name').limit(200);
      if (catalogError || !catalog?.length) throw new Error('ExerciseCatalogUnavailable');
      stage = 'workout_generation';
      const plan = await generateWorkoutProposal(settings, assessment, catalog, extractions);
      stage = 'plan_persistence';
      const { data: saved, error: saveError } = await admin.from('workout_ai_attempts')
        .update({ generated_plan: plan }).eq('id', generationId).eq('user_id', identity.user.id).select('id');
      if (saveError || saved?.length !== 1) throw new Error('WorkoutPlanPersistenceFailed');
      return reply(200, { generationId, plan } satisfies WorkoutGenerationResponse);
    } catch (cause) {
      console.error('Gemini workout generation failed', { stage, errorType: cause instanceof Error ? cause.name : 'UnknownError' });
      return reply(502, { error: 'Não foi possível gerar uma proposta de treino confirmada. Revise os dados e tente novamente mais tarde.' });
    }
  }
  if (!enabled || !serviceKey) return reply(503, { error: 'Gemini preparado, mas desativado. Configure serviço pago, privacidade, chave e modelo no servidor.' });
  if (body.action === 'models') {
    if (!testUserId || identity.user.id !== testUserId) return reply(403, { error: 'Consulta de modelos restrita à conta de homologação.' });
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
        headers: { 'x-goog-api-key': settings.GEMINI_API_KEY! }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return reply(502, { error: `Não foi possível consultar modelos Gemini (HTTP ${response.status}).` });
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('models' in data) || !Array.isArray(data.models)) throw new Error('InvalidModelList');
      const models = data.models.flatMap((model: unknown) => {
        if (!model || typeof model !== 'object' || !('name' in model) || typeof model.name !== 'string' ||
            !/^models\/gemini-[a-z0-9.-]+$/.test(model.name) ||
            !('supportedGenerationMethods' in model) || !Array.isArray(model.supportedGenerationMethods) ||
            !model.supportedGenerationMethods.includes('generateContent')) return [];
        return [model.name.slice('models/'.length)];
      });
      return reply(200, { models });
    } catch {
      console.error('Gemini model availability query failed');
      return reply(502, { error: 'Falha ao consultar disponibilidade dos modelos Gemini.' });
    }
  }
  if (!uuid(body.document_id) || body.consent_version !== geminiConsentVersion || body.adult_confirmed !== true) {
    return reply(400, { error: 'Documento, consentimento Gemini e confirmação de 18 anos ou mais são obrigatórios.' });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: document, error: claimError } = await admin.rpc('claim_gemini_assessment', {
    p_user_id: identity.user.id, p_document_id: body.document_id,
    p_consent_version: body.consent_version, p_adult_confirmed: true,
  });
  if (claimError) return reply(409, { error: claimError.message });
  let failureStage = 'document_validation';
  try {
    const descriptor = parseDocument(document, identity.user.id);
    if (!uuid(document.extraction_attempt_id)) throw new Error('InvalidAttempt');
    failureStage = 'private_download';
    const { data: blob, error: downloadError } = await admin.storage.from('health-reports').download(document.file_path);
    if (downloadError || !blob) throw new Error('PrivateDownloadFailed');
    if (blob.size !== document.size_bytes || blob.size > 10 * 1024 * 1024) throw new Error('DocumentSizeMismatch');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    validateFileSignature(bytes, descriptor.mime_type);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    failureStage = 'provider_request';
    const payload = buildGeminiAssessmentRequest(settings, document.mime_type, btoa(binary));
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settings.GEMINI_MODEL}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(60_000),
      headers: { 'x-goog-api-key': settings.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const providerBody = await response.text();
      let reason: string | null = null;
      try { reason = geminiFailureCode(JSON.parse(providerBody)); }
      catch { console.error('Gemini provider returned a non-JSON error'); }
      failureStage = `provider_http_${response.status}${reason ? `_${reason}` : ''}`;
      console.error('Gemini assessment provider failed', { status: response.status, reason });
      throw new Error('ProviderRequestFailed');
    }
    failureStage = 'provider_output_validation';
    const extraction = parseGeminiAssessmentResponse(await response.json());
    failureStage = 'result_persistence';
    const { data: updated, error: saveError } = await admin.from('assessment_documents').update({
      extraction_status: 'succeeded', extraction, extraction_model: settings.GEMINI_MODEL,
    }).eq('id', body.document_id).eq('user_id', identity.user.id)
      .eq('extraction_attempt_id', document.extraction_attempt_id).select('id');
    if (saveError || !updated?.length) throw new Error('ExtractionPersistenceFailed');
    return reply(200, { saved: true });
  } catch (cause) {
    console.error('Gemini assessment failed', { stage: failureStage, errorType: cause instanceof Error ? cause.name : 'UnknownError' });
    const { error } = await admin.from('assessment_documents').update({ extraction_status: 'failed' })
      .eq('id', body.document_id).eq('user_id', identity.user.id).eq('extraction_attempt_id', document?.extraction_attempt_id ?? '');
    if (error) console.error('Gemini failure state could not be saved');
    return reply(502, { error: `Leitura não confirmada (${failureStage}). O arquivo pode estar ilegível, o provedor pode ter recusado ou o serviço falhou. Atualize os documentos antes de tentar novamente. A tentativa conta para o limite diário.` });
  }
}
