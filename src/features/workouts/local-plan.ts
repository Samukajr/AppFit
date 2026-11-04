import type { WorkoutPlanResult, WorkoutGoal } from './ai-types.ts';
import type { CatalogExercise } from './types';

type LocalPlanProfile = {
  goal: WorkoutGoal;
  experience: 'beginner' | 'intermediate' | 'advanced';
  days_per_week: number;
  session_minutes: number;
  equipment: string;
  limitations: string;
  professional_guidance: string;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function createLocalPlanRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function isAvailable(equipment: string, userEquipment: string) {
  const available = normalize(userEquipment);
  const required = normalize(equipment);
  if (/\b(academia|gym|musculacao)\b/.test(available)) return true;
  if (/\b(casa|sem equipamento|peso corporal|bodyweight)\b/.test(available)) {
    return /\b(peso corporal|sem equipamento|colchonete)\b/.test(required);
  }
  const alternatives = required.split(/\s+ou\s+/);
  return alternatives.some((alternative) => alternative.split(/\s+e\s+/)
    .map((item) => item.replace(/\b(opcionais?|ou)\b/g, '').trim())
    .filter(Boolean)
    .every((item) => available.includes(item)));
}

function goalLabel(goal: WorkoutGoal) {
  switch (goal) {
    case 'hypertrophy': return 'Hipertrofia';
    case 'weight_loss': return 'Emagrecimento';
    case 'conditioning': return 'Condicionamento';
    case 'fitness': return 'Saúde e bem-estar';
    case 'rehabilitation': return 'Reabilitação';
    case 'other': return 'Objetivo geral';
  }
}

export function createLocalWorkoutPlan(profile: LocalPlanProfile, catalog: CatalogExercise[]): WorkoutPlanResult {
  const reasons: string[] = [];
  if (profile.goal === 'rehabilitation') reasons.push('Reabilitação exige avaliação e prescrição de profissional habilitado.');
  if (profile.limitations.trim()) reasons.push('As limitações informadas precisam ser avaliadas por um profissional antes de selecionar exercícios.');
  if (profile.professional_guidance.trim()) reasons.push('As orientações profissionais informadas devem ser interpretadas por quem acompanha o aluno.');
  if (reasons.length) return { status: 'professional_review', title: 'Orientação profissional necessária', reasons };

  const available = catalog.filter((exercise) => exercise.kind === 'strength' && isAvailable(exercise.equipment, profile.equipment));
  const categories: { focus: string; groups: string[] }[] = [
    { focus: 'Pernas e quadril', groups: ['Quadriceps', 'Pernas', 'Posterior de coxa', 'Gluteos'] },
    { focus: 'Empurrar', groups: ['Peito', 'Ombros', 'Triceps'] },
    { focus: 'Puxar', groups: ['Costas', 'Biceps'] },
    { focus: 'Região central', groups: ['Abdomen'] },
  ];
  const choices = categories.map((category) => ({
    ...category,
    exercises: available.filter((exercise) => category.groups.includes(exercise.muscleGroup)),
  })).filter((category) => category.exercises.length);
  if (choices.length < 2) {
    throw new Error('O catálogo não tem exercícios suficientes para os equipamentos informados. Revise a lista de equipamentos ou monte uma ficha manualmente.');
  }

  const setCount = profile.experience === 'advanced' && profile.goal === 'hypertrophy' ? 3 : 2;
  const targetReps = profile.goal === 'conditioning' ? 12 : 10;
  const exerciseCount = profile.session_minutes < 30 ? Math.min(3, choices.length) : Math.min(4, choices.length);
  const workoutCount = Math.min(profile.days_per_week, 4);
  const warnings = [
    'Sugestão local baseada apenas no objetivo, experiência, tempo, equipamentos e catálogo. Não é uma prescrição nem avaliação clínica.',
    'Não inclui cargas, dieta ou promessa de resultado. Revise cada exercício e ajuste com um profissional.',
    ...(profile.days_per_week > workoutCount ? ['A sugestão inclui no máximo quatro treinos semanais; reserve dias para recuperação.'] : []),
  ];
  const workouts = Array.from({ length: workoutCount }, (_, dayIndex) => {
    const selected = choices.slice(0, exerciseCount).map((category, categoryIndex) => {
      const offset = (dayIndex + categoryIndex) % category.exercises.length;
      const exercise = category.exercises[offset];
      return {
        catalogId: exercise.id,
        targetSets: setCount,
        targetReps,
        restSeconds: 90,
      };
    });
    const letter = String.fromCharCode(65 + dayIndex);
    return {
      name: `Treino ${letter}`,
      focus: choices.slice(0, exerciseCount).map((category) => category.focus).join(', '),
      exercises: selected,
    };
  });

  return {
    status: 'ready',
    title: `Sugestão local · ${goalLabel(profile.goal)} · ${workoutCount} ${workoutCount === 1 ? 'treino' : 'treinos'} semanais`,
    warnings,
    workouts,
  };
}
