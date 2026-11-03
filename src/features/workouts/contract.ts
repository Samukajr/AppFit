import type { CardioLog, CatalogExercise, Exercise, ExerciseDemonstration, ManualExercise, WorkoutSet, WorkoutSnapshot, WorkoutSummary } from './types';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta de treino inválida.');
  return value as Record<string, unknown>;
}
function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Texto de treino inválido.');
  return value;
}
function number(value: unknown, max: number, min = 0, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) throw new Error('Valor de treino inválido.');
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Lista de treino inválida.');
  return value;
}
function date(value: unknown) {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Data de treino inválida.');
  return result;
}

function kind(value: unknown) {
  if (value !== 'strength' && value !== 'cardio') throw new Error('Tipo de exercício inválido.');
  return value;
}

export function parseCatalog(value: unknown): CatalogExercise[] {
  return parseCatalogWithDemonstrations(value, []);
}

export function parseCatalogWithDemonstrations(value: unknown, demonstrationsValue: unknown): CatalogExercise[] {
  const demonstrations = new Map<string, ExerciseDemonstration>();
  for (const value of array(demonstrationsValue)) {
    const entry = record(value);
    const id = text(entry.exercise_id);
    if (demonstrations.has(id)) throw new Error('Demonstração duplicada no catálogo.');
    demonstrations.set(id, parseExerciseDemonstration(entry));
  }
  return array(value).map((value) => {
    const entry = record(value);
    const id = text(entry.id);
    const demonstration = demonstrations.get(id);
    return { id, name: text(entry.name), muscleGroup: text(entry.muscle_group),
      equipment: text(entry.equipment), kind: kind(entry.kind),
      ...(demonstration ? { demonstration } : {}) };
  });
}

export function parseExerciseDemonstration(value: unknown): ExerciseDemonstration {
  const entry = record(value);
  const result = text(entry.url);
  let url: URL;
  try { url = new URL(result); }
  catch { throw new Error('Link de demonstração inválido.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Link de demonstração inválido.');
  }
  const host = url.hostname.toLowerCase();
  let provider: ExerciseDemonstration['provider'];
  if (host === 'youtube.com' || host === 'www.youtube.com') {
    provider = 'youtube';
    if (url.pathname !== '/watch' || !/^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') ?? '')) {
      throw new Error('Link do YouTube inválido.');
    }
  } else if (host === 'youtu.be') {
    provider = 'youtube';
    if (!/^\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) throw new Error('Link do YouTube inválido.');
  } else if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    provider = 'vimeo';
    if (!/^\/[0-9]+$/.test(url.pathname)) throw new Error('Link do Vimeo inválido.');
  } else {
    throw new Error('A demonstração deve usar um link aprovado do YouTube ou Vimeo.');
  }
  const credit = text(entry.credit);
  const license = text(entry.license);
  if (credit.length > 120 || license.length > 240) throw new Error('Crédito da demonstração inválido.');
  return { url: result, provider, credit, license };
}

export function parseWorkoutList(value: unknown): WorkoutSummary[] {
  return array(value).map((value) => {
    const entry = record(value);
    if (typeof entry.is_starter !== 'boolean') throw new Error('Origem da ficha inválida.');
    if (entry.archived_at !== null && entry.archived_at !== undefined) date(entry.archived_at);
    return { id: text(entry.id), name: text(entry.name), isStarter: entry.is_starter, archived: entry.archived_at != null };
  });
}

export function parseWorkoutDefinition(workoutValue: unknown, exercisesValue: unknown, catalog: CatalogExercise[]) {
  const workout = record(workoutValue);
  if (workout.is_starter !== false || workout.archived_at !== null) throw new Error('Esta ficha não pode ser editada.');
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const exercises = array(exercisesValue).map((value): ManualExercise => {
    const exercise = record(value);
    const catalogId = text(exercise.catalog_id);
    const entry = catalogById.get(catalogId);
    if (!entry || entry.kind !== exercise.kind) throw new Error('A ficha contém um exercício indisponível no catálogo.');
    if (entry.kind === 'cardio') {
      return { catalogId, targetMinutes: number(exercise.target_minutes, 600, 1, true) };
    }
    return {
      catalogId,
      targetSets: number(exercise.target_sets, 100, 1, true),
      targetReps: number(exercise.target_reps, 1000, 1, true),
      restSeconds: number(exercise.rest_seconds, 600, 5, true),
    };
  });
  return { name: text(workout.name), exercises };
}

export function parseCardioLog(value: unknown): CardioLog {
  const entry = record(value);
  return { id: text(entry.id), exerciseId: text(entry.exerciseId),
    durationMinutes: number(entry.durationMinutes, 600, 1, true),
    distanceKm: entry.distanceKm === null ? null : number(entry.distanceKm, 1000),
    perceivedExertion: number(entry.perceivedExertion, 10, 1, true) };
}

export function parseSavedSet(value: unknown): WorkoutSet {
  const data = record(value);
  return { id: text(data.id), exerciseId: text(data.exerciseId),
    reps: number(data.reps, 1000, 1, true), weightKg: number(data.weightKg, 2000) };
}

export function parseWorkoutSnapshot(value: unknown, demonstrationsValue: unknown[] = []): WorkoutSnapshot {
  const data = record(value);
  const workout = record(data.workout);
  const session = record(data.session);
  const demonstrations = new Map<string, ExerciseDemonstration>();
  for (const value of demonstrationsValue) {
    const entry = record(value);
    const id = text(entry.exercise_id);
    if (demonstrations.has(id)) throw new Error('Demonstração duplicada no treino.');
    demonstrations.set(id, parseExerciseDemonstration(entry));
  }
  const exercises = array(data.exercises).map((value): Exercise => {
    const exercise = record(value);
    const type = exercise.kind === undefined ? undefined : kind(exercise.kind);
    const id = text(exercise.id);
    const demonstration = exercise.demonstration == null
      ? demonstrations.get(id)
      : parseExerciseDemonstration(exercise.demonstration);
    return { id, name: text(exercise.name),
      targetSets: number(exercise.targetSets, 100, 1, true), targetReps: text(exercise.targetReps),
      ...(type === undefined ? {} : { kind: type,
        targetMinutes: type === 'cardio' ? number(exercise.targetMinutes, 600, 1, true) : null,
        restSeconds: number(exercise.restSeconds, 600, 5, true) }),
      ...(demonstration ? { demonstration } : {}),
    };
  });
  const sets = array(data.sets).map(parseSavedSet);
  if (sets.some((set) => !exercises.some((exercise) => exercise.id === set.exerciseId && exercise.kind !== 'cardio'))) {
    throw new Error('Série recebida não pertence à ficha atual.');
  }
  const cardio = data.cardio === undefined ? undefined : array(data.cardio).map(parseCardioLog);
  if (cardio?.some((log) => !exercises.some((exercise) => exercise.id === log.exerciseId && exercise.kind === 'cardio'))) {
    throw new Error('Registro de cardio não pertence à ficha atual.');
  }
  if (workout.isStarter !== undefined && typeof workout.isStarter !== 'boolean') throw new Error('Origem da ficha inválida.');
  return {
    workout: { id: text(workout.id), name: text(workout.name),
      ...(workout.isStarter === undefined ? {} : { isStarter: workout.isStarter }) },
    session: { id: text(session.id), startedAt: date(session.startedAt) },
    exercises, sets,
    ...(cardio === undefined ? {} : { cardio }),
    history: array(data.history).map((value) => {
      const entry = record(value);
      return { id: text(entry.id), finishedAt: date(entry.finishedAt),
        setCount: number(entry.setCount, Number.MAX_SAFE_INTEGER, 0, true),
        volume: number(entry.volume, Number.MAX_SAFE_INTEGER),
        ...(entry.cardioMinutes === undefined ? {} : { cardioMinutes: number(entry.cardioMinutes, Number.MAX_SAFE_INTEGER, 0, true) }) };
    }),
  };
}
