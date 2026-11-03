import type { CatalogExercise, DraftExercise, Exercise, ManualExercise, WorkoutSet } from './types';

export const catalogCategories = [
  { id: 'all', label: 'Todos' },
  { id: 'upper', label: 'Membros superiores' },
  { id: 'lower', label: 'Membros inferiores' },
  { id: 'core', label: 'Core e abdômen' },
  { id: 'cardio', label: 'Cardio' },
] as const;

export type CatalogCategory = typeof catalogCategories[number]['id'];

export const exerciseGroupLabels: Record<string, string> = {
  Peito: 'Peito',
  Costas: 'Costas',
  Ombros: 'Ombros',
  Biceps: 'Bíceps',
  Triceps: 'Tríceps',
  Trapezio: 'Trapézio',
  Antebracos: 'Antebraços',
  Quadriceps: 'Quadríceps',
  'Posterior de coxa': 'Posterior de coxa',
  Gluteos: 'Glúteos',
  Adutores: 'Adutores',
  Abdutores: 'Abdutores',
  Panturrilhas: 'Panturrilhas',
  Abdomen: 'Abdômen',
  Cardio: 'Cardio',
};

const categoryGroups: Record<Exclude<CatalogCategory, 'all'>, string[]> = {
  upper: ['Peito', 'Costas', 'Ombros', 'Biceps', 'Triceps', 'Trapezio', 'Antebracos'],
  lower: ['Quadriceps', 'Posterior de coxa', 'Gluteos', 'Adutores', 'Abdutores', 'Panturrilhas'],
  core: ['Abdomen'],
  cardio: ['Cardio'],
};

export function groupsForCategory(category: CatalogCategory, catalog: CatalogExercise[]) {
  if (category === 'all') return [...new Set(catalog.map((entry) => entry.muscleGroup))];
  return categoryGroups[category].filter((group) => catalog.some((entry) => entry.muscleGroup === group));
}

export function workoutProgress(exercises: Exercise[], sets: WorkoutSet[]) {
  const strength = exercises.filter((exercise) => exercise.kind !== 'cardio');
  const target = strength.reduce((total, exercise) => total + exercise.targetSets, 0);
  const completed = strength.reduce((total, exercise) =>
    total + Math.min(exercise.targetSets, sets.filter((set) => set.exerciseId === exercise.id).length), 0);
  return target === 0 ? 0 : Math.round(completed / target * 100);
}

function integer(text: string, min: number, max: number, label: string) {
  if (!/^\d+$/.test(text.trim()) || Number(text) < min || Number(text) > max) {
    throw new Error(`${label}: use um número inteiro de ${min} a ${max}.`);
  }
  return Number(text);
}

export function parseCardio(minutes: string, distance: string, exertion: string) {
  const durationMinutes = integer(minutes, 1, 600, 'Duração em minutos');
  const perceivedExertion = integer(exertion, 1, 10, 'Esforço percebido');
  const normalized = distance.trim().replace(',', '.');
  let distanceKm: number | null = null;
  if (normalized) {
    if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) > 1000) {
      throw new Error('Distância: use de 0 a 1000 km, com até 2 casas decimais, ou deixe em branco.');
    }
    distanceKm = Number(normalized);
  }
  return { durationMinutes, distanceKm, perceivedExertion };
}

export function buildManualWorkout(name: string, drafts: DraftExercise[], catalog: CatalogExercise[]) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) throw new Error('Dê um nome de 1 a 120 caracteres à ficha.');
  if (drafts.length < 1 || drafts.length > 30) throw new Error('Selecione de 1 a 30 exercícios.');
  if (new Set(drafts.map((draft) => draft.catalogId)).size !== drafts.length) throw new Error('Não repita exercícios na ficha.');
  const exercises: ManualExercise[] = drafts.map((draft) => {
    const item = catalog.find((entry) => entry.id === draft.catalogId);
    if (!item) throw new Error('Exercício não encontrado no catálogo. Atualize a biblioteca.');
    if (item.kind === 'cardio') return {
      catalogId: item.id, targetMinutes: integer(draft.targetMinutes, 1, 600, `${item.name}: minutos`),
    };
    return { catalogId: item.id,
      targetSets: integer(draft.targetSets, 1, 100, `${item.name}: séries`),
      targetReps: integer(draft.targetReps, 1, 1000, `${item.name}: repetições`),
      restSeconds: integer(draft.restSeconds, 5, 600, `${item.name}: descanso`),
    };
  });
  return { name: trimmed, exercises };
}

export function filterCatalog(catalog: CatalogExercise[], query: string, group: string, category: CatalogCategory = 'all') {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const term = normalize(query.trim());
  const allowedGroups = category === 'all' ? null : categoryGroups[category];
  return catalog.filter((entry) => (allowedGroups === null || allowedGroups.includes(entry.muscleGroup)) &&
    (group === 'Todos' || entry.muscleGroup === group) &&
    normalize(`${entry.name} ${entry.equipment} ${entry.muscleGroup}`).includes(term));
}

export function parseSet(repsText: string, weightText: string) {
  const normalizedWeight = weightText.trim().replace(',', '.');
  if (!/^\d+$/.test(repsText.trim()) || !/^\d+(\.\d{1,2})?$/.test(normalizedWeight)) {
    throw new Error('Informe repetições inteiras e uma carga válida (até 2 casas decimais).');
  }
  const reps = Number(repsText);
  const weightKg = Number(normalizedWeight);
  if (reps < 1 || reps > 1000 || weightKg > 2000) {
    throw new Error('Use de 1 a 1000 repetições e carga entre 0 e 2000 kg.');
  }
  return { reps, weightKg };
}

export function remainingSeconds(deadline: number | null, now: number) {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}
