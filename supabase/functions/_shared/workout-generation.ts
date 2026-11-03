import type { AssessmentExtraction } from './gemini-assessment.ts';
import {
  buildWorkoutPlanRequest, parseGeminiWorkoutResponse, requiresProfessionalReview, workoutPlannerReady,
  type WorkoutCatalogEntry, type WorkoutPlanAssessment, type WorkoutPlanResult, type WorkoutPlannerSettings,
} from './gemini-workout.ts';

export async function generateWorkoutProposal(
  settings: WorkoutPlannerSettings,
  assessment: WorkoutPlanAssessment,
  catalog: WorkoutCatalogEntry[],
  extractions: AssessmentExtraction[],
  request: typeof fetch = fetch,
): Promise<WorkoutPlanResult> {
  if (!workoutPlannerReady(settings)) throw new Error('Geração de treinos por IA desativada.');
  if (assessment.goal === 'rehabilitation') {
    return {
      status: 'professional_review', title: 'Reabilitação exige avaliação profissional',
      reasons: ['Procure um fisioterapeuta ou profissional habilitado para avaliar a anamnese e definir exercícios, restrições e progressão. A IA não prescreve tratamento.'],
    };
  }
  const riskText = [
    assessment.limitations, assessment.professional_guidance,
    ...extractions.flatMap((extraction) => [
      ...extraction.warnings, ...extraction.measurements.flatMap((item) => [item.label, item.value]),
    ]),
  ];
  if (requiresProfessionalReview(riskText)) {
    return {
      status: 'professional_review', title: 'Avaliação profissional necessária',
      reasons: ['As informações registradas incluem sinais que precisam de avaliação profissional antes da montagem de exercícios.'],
    };
  }
  const payload = buildWorkoutPlanRequest(settings, assessment, catalog, extractions);
  const response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${settings.GEMINI_MODEL}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { 'x-goog-api-key': settings.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error('Gemini workout provider failed', { status: response.status });
    throw new Error('WorkoutProviderFailed');
  }
  return parseGeminiWorkoutResponse(await response.json(), catalog, assessment.days_per_week);
}
