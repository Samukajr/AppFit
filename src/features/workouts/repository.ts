import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCardioLog, parseCatalogWithDemonstrations, parseSavedSet, parseWorkoutDefinition, parseWorkoutList, parseWorkoutSnapshot } from './contract.ts';
import type { CatalogExercise as CatalogExerciseType, ManualExercise } from './types';
import { parseProgress } from './progress.ts';

export function createWorkoutRepository(client: SupabaseClient) {
  return {
    async progress(days: 30 | 90 | null) {
      const { data, error } = await client.rpc('get_workout_progress', { p_days: days });
      if (error) throw new Error(`Não foi possível carregar sua evolução: ${error.message}`);
      return parseProgress(data);
    },
    async load(workoutId?: string) {
      const { data, error } = workoutId
        ? await client.rpc('get_workout_session', { p_workout_id: workoutId })
        : await client.rpc('get_or_create_workout_session');
      if (error) throw new Error(`Não foi possível carregar o treino: ${error.message}`);
      const snapshot = parseWorkoutSnapshot(data);
      const { data: exercises, error: exerciseError } = await client.from('exercises')
        .select('id,catalog_id').eq('workout_id', snapshot.workout.id).eq('is_active', true);
      if (exerciseError) throw new Error(`Não foi possível carregar os exercícios do treino: ${exerciseError.message}`);
      const catalogIds = [...new Set(exercises.map((exercise) => exercise.catalog_id).filter((id): id is string => typeof id === 'string'))];
      if (catalogIds.length === 0) return snapshot;
      const { data: demonstrations, error: demonstrationError } = await client.from('exercise_demonstrations')
        .select('exercise_id,url,credit,license').in('exercise_id', catalogIds);
      if (demonstrationError) throw new Error(`Não foi possível carregar as demonstrações dos exercícios: ${demonstrationError.message}`);
      const exerciseIdByCatalogId = new Map(exercises.map((exercise) => [exercise.catalog_id, exercise.id]));
      const workoutDemonstrations = demonstrations.map((demonstration) => ({
        ...demonstration,
        exercise_id: exerciseIdByCatalogId.get(demonstration.exercise_id),
      })).filter((demonstration) => typeof demonstration.exercise_id === 'string');
      return parseWorkoutSnapshot(data, workoutDemonstrations);
    },
    async library() {
      const [catalog, demonstrations, workouts] = await Promise.all([
        client.from('exercise_catalog').select('id,name,muscle_group,equipment,kind').order('name'),
        client.from('exercise_demonstrations').select('exercise_id,url,credit,license').order('exercise_id'),
        client.from('workouts').select('id,name,is_starter,archived_at').order('created_at', { ascending: false }),
      ]);
      if (catalog.error) throw new Error(`Catálogo indisponível. Verifique a migração de biblioteca: ${catalog.error.message}`);
      if (demonstrations.error) throw new Error(`Demonstrações indisponíveis. Verifique a migração correspondente: ${demonstrations.error.message}`);
      if (workouts.error) throw new Error(`Não foi possível carregar suas fichas: ${workouts.error.message}`);
      return { catalog: parseCatalogWithDemonstrations(catalog.data, demonstrations.data), workouts: parseWorkoutList(workouts.data) };
    },
    async definition(workoutId: string, catalog: CatalogExerciseType[]) {
      const { data: workout, error: workoutError } = await client.from('workouts')
        .select('name,is_starter,archived_at').eq('id', workoutId).maybeSingle();
      if (workoutError) throw new Error(`Não foi possível abrir a ficha para edição: ${workoutError.message}`);
      if (!workout) throw new Error('Ficha indisponível para edição.');
      const { data: exercises, error: exercisesError } = await client.from('exercises')
        .select('catalog_id,kind,target_sets,target_reps,rest_seconds,target_minutes')
        .eq('workout_id', workoutId).eq('is_active', true).order('position');
      if (exercisesError) throw new Error(`Não foi possível carregar os exercícios da ficha: ${exercisesError.message}`);
      return parseWorkoutDefinition(workout, exercises, catalog);
    },
    async create(name: string, exercises: ManualExercise[]) {
      const { data, error } = await client.rpc('create_manual_workout', { p_name: name, p_exercises: exercises });
      if (error) throw new Error(`Não foi possível criar a ficha: ${error.message}. Atualize a lista antes de repetir para evitar duplicação.`);
      if (typeof data !== 'string' || !data) throw new Error('O servidor não confirmou a ficha. Atualize a lista antes de repetir.');
      return data;
    },
    async update(workoutId: string, name: string, exercises: ManualExercise[]) {
      const { error } = await client.rpc('replace_manual_workout', {
        p_workout_id: workoutId, p_name: name, p_exercises: exercises,
      });
      if (error) throw new Error(`Não foi possível atualizar a ficha: ${error.message}. Atualize a lista antes de repetir.`);
    },
    async archive(workoutId: string) {
      const { error } = await client.rpc('archive_manual_workout', { p_workout_id: workoutId });
      if (error) throw new Error(`Não foi possível arquivar a ficha: ${error.message}`);
    },
    async restore(workoutId: string) {
      const { error } = await client.rpc('restore_manual_workout', { p_workout_id: workoutId });
      if (error) throw new Error(`Não foi possível restaurar a ficha: ${error.message}`);
    },
    async registerCardio(sessionId: string, exerciseId: string, durationMinutes: number, distanceKm: number | null, perceivedExertion: number) {
      const { data, error } = await client.rpc('register_cardio', {
        p_session_id: sessionId, p_exercise_id: exerciseId, p_duration_minutes: durationMinutes,
        p_distance_km: distanceKm, p_perceived_exertion: perceivedExertion,
      });
      if (error) throw new Error(`Não foi possível salvar o cardio: ${error.message}`);
      return parseCardioLog(data);
    },
    async removeCardio(sessionId: string, logId: string) {
      const { error } = await client.rpc('remove_cardio', { p_session_id: sessionId, p_log_id: logId });
      if (error) throw new Error(`Não foi possível remover o cardio: ${error.message}`);
    },
    async register(sessionId: string, exerciseId: string, reps: number, weightKg: number, restSeconds: number) {
      const { data, error } = await client.rpc('register_workout_set', {
        p_session_id: sessionId, p_exercise_id: exerciseId,
        p_reps: reps, p_weight_kg: weightKg, p_rest_seconds: restSeconds,
      });
      if (error) throw new Error(`Não foi possível salvar a série: ${error.message}`);
      return parseSavedSet(data);
    },
    async remove(sessionId: string, setId: string) {
      const { error } = await client.rpc('remove_workout_set', { p_session_id: sessionId, p_set_id: setId });
      if (error) throw new Error(`Não foi possível remover a série: ${error.message}`);
    },
    async finish(sessionId: string) {
      const { error } = await client.rpc('finish_workout_session', { p_session_id: sessionId });
      if (error) throw new Error(`Não foi possível concluir o treino: ${error.message}`);
    },
  };
}
