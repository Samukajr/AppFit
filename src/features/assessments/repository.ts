import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiConsentVersion } from '../../../supabase/functions/_shared/gemini-assessment.ts';
import { parseWorkoutPlan, workoutConsentVersion, type GeneratedWorkout, type WorkoutCatalogEntry } from '../../../supabase/functions/_shared/gemini-workout.ts';
import { parseAssessment, parseAssessments, parseDocument, parseDocuments, validateAttachment, validateFileSignature,
  type AssessmentDocument, type AssessmentInput } from './contract.ts';
import { parseCatalog } from '../workouts/contract.ts';
import type { WorkoutGenerationRequest } from '../workouts/ai-types.ts';

const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function createAssessmentRepository(client: SupabaseClient, userId: string) {
  async function invokeGemini(body: Record<string, unknown>, endpoint = 'analyze-assessment') {
    const { data, error } = await client.functions.invoke(endpoint, { body });
    if (error) {
      let detail = error.message;
      if ('context' in error && error.context instanceof Response) {
        const response = await error.context.text();
        try {
          const value: unknown = JSON.parse(response);
          if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') detail = value.error;
        } catch { detail = `${detail}. Resposta do servidor inválida.`; }
      }
      throw new Error(`Gemini indisponível: ${detail}`);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Resposta Gemini inválida.');
    return data as Record<string, unknown>;
  }
  return {
    async geminiStatus() {
      const result = await invokeGemini({ action: 'status' });
      if (typeof result.enabled !== 'boolean' || typeof result.workoutsEnabled !== 'boolean' || result.provider !== 'gemini') {
        throw new Error('Estado Gemini inválido.');
      }
      return { documents: result.enabled, workouts: result.workoutsEnabled };
    },
    async analyzeDocument(documentId: string, adultConfirmed: boolean, consent: boolean) {
      if (!adultConfirmed || !consent) throw new Error('Confirme maioridade e consentimento específico para enviar este documento ao Google Gemini.');
      const result = await invokeGemini({ document_id: documentId, adult_confirmed: true, consent_version: geminiConsentVersion });
      if (result.saved !== true) throw new Error('Leitura não confirmada. Atualize os documentos antes de repetir.');
    },
    async generateWorkoutPlan(assessmentId: string, maxDays: number, documentIds: string[], adultConfirmed: boolean, consent: boolean) {
      if (!adultConfirmed || !consent) throw new Error('Confirme maioridade e consentimento específico para gerar uma proposta de treino.');
      const { data: catalogData, error: catalogError } = await client.from('exercise_catalog')
        .select('id,name,muscle_group,equipment,kind').order('name').limit(200);
      if (catalogError) throw new Error(`Catálogo indisponível: ${catalogError.message}`);
      const catalog = parseCatalog(catalogData);
      const validationCatalog: WorkoutCatalogEntry[] = catalog.map((entry) => ({
        id: entry.id, name: entry.name, muscle_group: entry.muscleGroup,
        equipment: entry.equipment, kind: entry.kind,
      }));
      const result = await invokeGemini({
        assessment_id: assessmentId, document_ids: documentIds,
        adult_confirmed: true, consent_version: workoutConsentVersion,
      } satisfies WorkoutGenerationRequest, 'generate-workout-plan');
      if (!uuid(result.generationId)) throw new Error('Identificador da proposta inválido.');
      const plan = parseWorkoutPlan(result.plan, validationCatalog, maxDays);
      return { generationId: result.generationId, plan, catalog };
    },
    async saveWorkoutPlan(generationId: string, workouts: GeneratedWorkout[]) {
      if (!uuid(generationId)) throw new Error('Identificador da proposta inválido.');
      const p_workouts = workouts.map((workout) => ({
        name: workout.name,
        exercises: workout.exercises,
      }));
      const { data, error } = await client.rpc('create_ai_workout_plan', { p_generation_id: generationId, p_workouts });
      if (error) throw new Error(`Não foi possível salvar as fichas: ${error.message}`);
      const ids = Array.isArray(data) ? data.filter((id: unknown): id is string => uuid(id)) : [];
      if (!Array.isArray(data) || ids.length !== data.length || ids.length !== workouts.length ||
          new Set(ids).size !== ids.length) throw new Error('O servidor não confirmou todas as fichas. Atualize a biblioteca antes de repetir.');
      return ids;
    },
    async reviewExtraction(documentId: string) {
      const { error } = await client.rpc('review_assessment_extraction', { p_document_id: documentId });
      if (error) throw new Error(`Conferência não confirmada: ${error.message}`);
    },
    async list() {
      const { data, error } = await client.from('assessments').select('*').order('created_at', { ascending: false }).limit(10);
      if (error) throw new Error(`Não foi possível carregar as avaliações. Verifique a migração de avaliações: ${error.message}`);
      return parseAssessments(data);
    },
    async save(input: AssessmentInput) {
      const { data, error } = await client.from('assessments').insert({ ...input, user_id: userId }).select('*').single();
      if (error) throw new Error(`O salvamento não foi confirmado: ${error.message}. Atualize a lista antes de repetir para evitar duplicação.`);
      return parseAssessment(data);
    },
    async documents(assessmentId: string) {
      const { data, error } = await client.from('assessment_documents').select('*')
        .eq('assessment_id', assessmentId).order('created_at', { ascending: false });
      if (error) throw new Error(`Não foi possível consultar os documentos: ${error.message}`);
      return parseDocuments(data, userId);
    },
    async beginDocument(assessmentId: string, name: string, mime: string | undefined, size: number | undefined) {
      const attachment = validateAttachment(name, mime, size);
      const { data, error } = await client.rpc('begin_assessment_document', {
        p_assessment_id: assessmentId, p_name: attachment.name, p_mime_type: attachment.mimeType, p_size_bytes: attachment.size,
      });
      if (error) throw new Error(`Não foi possível preparar o anexo: ${error.message}. Atualize os documentos antes de repetir.`);
      return parseDocument(data, userId);
    },
    async upload(document: AssessmentDocument, buffer: ArrayBuffer) {
      if (buffer.byteLength !== document.size_bytes) throw new Error('O tamanho do arquivo mudou. Selecione o documento novamente.');
      validateFileSignature(new Uint8Array(buffer), document.mime_type);
      const { error } = await client.storage.from('health-reports').upload(document.file_path, buffer,
        { contentType: document.mime_type, upsert: false });
      if (error) throw new Error(`Envio não confirmado: ${error.message}. Use “Verificar envio” antes de repetir.`);
    },
    async confirmDocument(documentId: string) {
      const { error } = await client.rpc('confirm_assessment_document', { p_document_id: documentId });
      if (error) throw new Error(`Não foi possível confirmar o arquivo: ${error.message}`);
    },
    async removeDocument(document: AssessmentDocument) {
      const { error: storageError } = await client.storage.from('health-reports').remove([document.file_path]);
      if (storageError) throw new Error(`Não foi possível remover o arquivo privado: ${storageError.message}`);
      const { data, error } = await client.from('assessment_documents').delete().eq('id', document.id).select('id');
      if (error || !data?.length) throw new Error('O arquivo foi removido, mas o registro não foi confirmado como excluído. Atualize a lista e tente novamente.');
    },
  };
}
