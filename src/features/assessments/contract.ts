import { parseAssessmentExtraction, type AssessmentExtraction } from '../../../supabase/functions/_shared/gemini-assessment.ts';
import type { WorkoutGoal } from '../workouts/ai-types.ts';

export const consentVersion = 'assessment-storage-v1';
export const goals = {
  hypertrophy: 'Ganho de massa muscular', weight_loss: 'Emagrecimento',
  rehabilitation: 'Reabilitação / fisioterapia', fitness: 'Saúde e bem-estar',
  conditioning: 'Condicionamento', other: 'Outro objetivo',
} satisfies Record<WorkoutGoal, string>;
export const experiences = { beginner: 'Iniciante / retomando', intermediate: 'Intermediário', advanced: 'Avançado' };
export type Goal = keyof typeof goals;
export type Experience = keyof typeof experiences;
export type AssessmentDraft = {
  goal: string; experience: string; days: string; minutes: string;
  equipment: string; limitations: string; guidance: string;
  measuredOn: string; weight: string; height: string; bodyFat: string; muscleMass: string;
};
export const emptyDraft: AssessmentDraft = {
  goal: '', experience: '', days: '', minutes: '', equipment: '', limitations: '', guidance: '',
  measuredOn: '', weight: '', height: '', bodyFat: '', muscleMass: '',
};

export function measurement(value: string, min: number, max: number, label: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const number = Number(normalized);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized) || number < min || number > max) {
    throw new Error(`${label}: informe de ${min} a ${max}, com até duas casas decimais, ou deixe vazio.`);
  }
  return number;
}
function integer(value: string, min: number, max: number, label: string) {
  if (!/^\d+$/.test(value.trim()) || Number(value) < min || Number(value) > max) throw new Error(`${label}: use um inteiro de ${min} a ${max}.`);
  return Number(value);
}
function text(value: string, max: number, label: string, required = false) {
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new Error(`${label}: ${required ? 'preenchimento obrigatório; ' : ''}limite de ${max} caracteres.`);
  return result;
}
function goal(value: unknown): Goal {
  if (value !== 'hypertrophy' && value !== 'weight_loss' && value !== 'rehabilitation' &&
      value !== 'fitness' && value !== 'conditioning' && value !== 'other') throw new Error('Selecione um objetivo válido.');
  return value;
}
function experience(value: unknown): Experience {
  if (value !== 'beginner' && value !== 'intermediate' && value !== 'advanced') throw new Error('Selecione sua experiência.');
  return value;
}
function validDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Data da avaliação: use AAAA-MM-DD, com uma data válida, ou deixe vazio.');
  }
  return value;
}
export function buildAssessment(draft: AssessmentDraft, consent: boolean) {
  if (!consent) throw new Error('Confirme o consentimento para armazenar os dados de avaliação.');
  return {
    goal: goal(draft.goal), experience: experience(draft.experience),
    days_per_week: integer(draft.days, 1, 7, 'Dias por semana'),
    session_minutes: integer(draft.minutes, 10, 180, 'Minutos por sessão'),
    equipment: text(draft.equipment, 1000, 'Equipamentos disponíveis', true),
    limitations: text(draft.limitations, 2000, 'Limitações informadas'),
    professional_guidance: text(draft.guidance, 2000, 'Orientações profissionais'),
    measured_on: validDate(draft.measuredOn.trim()),
    weight_kg: measurement(draft.weight, 1, 500, 'Peso em kg'),
    height_cm: measurement(draft.height, 30, 300, 'Altura em cm'),
    body_fat_percent: measurement(draft.bodyFat, 0, 100, 'Gordura corporal em %'),
    muscle_mass_kg: measurement(draft.muscleMass, 0, 500, 'Massa muscular em kg'),
    consent_version: consentVersion,
  };
}
export type AssessmentInput = ReturnType<typeof buildAssessment>;
export type Assessment = AssessmentInput & { id: string; created_at: string };
export type AssessmentDocument = {
  id: string; assessment_id: string; file_path: string; display_name: string;
  mime_type: string; size_bytes: number; uploaded_at: string | null;
  extraction_status: 'not_requested' | 'processing' | 'succeeded' | 'failed';
  extraction: AssessmentExtraction | null; extraction_reviewed_at: string | null;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta de avaliação inválida.');
  return value as Record<string, unknown>;
}
function string(value: unknown) {
  if (typeof value !== 'string') throw new Error('Campo de avaliação inválido.');
  return value;
}
function identifier(value: unknown) {
  const result = string(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) throw new Error('Identificador de avaliação inválido.');
  return result;
}
function date(value: unknown) {
  const result = string(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Data recebida inválida.');
  return result;
}
function number(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Medida recebida inválida.');
  return value;
}
function nullableNumber(value: unknown) { return value === null ? '' : String(number(value)); }

export function parseAssessment(value: unknown): Assessment {
  const row = record(value);
  if (row.consent_version !== consentVersion) throw new Error('Versão de consentimento inválida.');
  const input = buildAssessment({
    goal: goal(row.goal), experience: experience(row.experience),
    days: String(number(row.days_per_week)), minutes: String(number(row.session_minutes)),
    equipment: string(row.equipment), limitations: string(row.limitations), guidance: string(row.professional_guidance),
    measuredOn: row.measured_on === null ? '' : string(row.measured_on),
    weight: nullableNumber(row.weight_kg), height: nullableNumber(row.height_cm),
    bodyFat: nullableNumber(row.body_fat_percent), muscleMass: nullableNumber(row.muscle_mass_kg),
  }, true);
  return { ...input, id: identifier(row.id), created_at: date(row.created_at) };
}
export function parseAssessments(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Lista de avaliações inválida.');
  return value.map(parseAssessment);
}
export function validateAttachment(name: string, mime: string | undefined, size: number | undefined) {
  if (mime !== 'application/pdf' && mime !== 'image/jpeg' && mime !== 'image/png') throw new Error('Escolha um PDF, JPEG ou PNG.');
  if (!Number.isInteger(size) || size === undefined || size < 1 || size > 10 * 1024 * 1024) throw new Error('O documento deve ter entre 1 byte e 10 MB.');
  return { name: text(name, 120, 'Nome do documento', true), mimeType: mime, size };
}
export function validateFileSignature(bytes: Uint8Array, mime: string) {
  const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const valid = mime === 'application/pdf' ? starts([0x25, 0x50, 0x44, 0x46, 0x2d])
    : mime === 'image/jpeg' ? starts([0xff, 0xd8, 0xff])
    : mime === 'image/png' && starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!valid) throw new Error('O conteúdo do arquivo não corresponde ao formato informado.');
}
export function parseDocument(value: unknown, userId: string): AssessmentDocument {
  const row = record(value);
  const id = identifier(row.id), assessmentId = identifier(row.assessment_id);
  const attachment = validateAttachment(string(row.display_name), string(row.mime_type), number(row.size_bytes));
  const extension = attachment.mimeType === 'application/pdf' ? 'pdf' : attachment.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${userId}/assessments/${assessmentId}/${id}.${extension}`;
  if (row.file_path !== path) throw new Error('Caminho de documento inválido para esta conta.');
  if (row.extraction_status !== 'not_requested' && row.extraction_status !== 'processing' &&
      row.extraction_status !== 'succeeded' && row.extraction_status !== 'failed') {
    throw new Error('Estado de leitura ausente ou inválido. Verifique a migração Gemini.');
  }
  const extraction = row.extraction === null ? null : parseAssessmentExtraction(row.extraction);
  if ((row.extraction_status === 'succeeded') !== (extraction !== null)) throw new Error('Resultado de leitura inconsistente.');
  return { id, assessment_id: assessmentId, file_path: path, display_name: attachment.name,
    mime_type: attachment.mimeType, size_bytes: attachment.size, uploaded_at: row.uploaded_at === null ? null : date(row.uploaded_at),
    extraction_status: row.extraction_status, extraction, extraction_reviewed_at: row.extraction_reviewed_at === null ? null : date(row.extraction_reviewed_at) };
}
export function parseDocuments(value: unknown, userId: string) {
  if (!Array.isArray(value)) throw new Error('Lista de documentos inválida.');
  return value.map((row) => parseDocument(row, userId));
}
