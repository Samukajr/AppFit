begin;

alter table public.assessments drop constraint assessments_goal_check;
alter table public.assessments add constraint assessments_goal_check
  check (goal in ('hypertrophy', 'weight_loss', 'rehabilitation', 'fitness', 'conditioning', 'other'));

alter table public.workout_ai_attempts add column generated_plan jsonb;

create or replace function public.create_ai_workout_plan(p_generation_id uuid, p_workouts jsonb) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  attempt public.workout_ai_attempts;
  approved_workouts jsonb;
  workout_item jsonb;
  exercise_item jsonb;
  catalog public.exercise_catalog;
  workout_id uuid;
  workout_ids uuid[] := array[]::uuid[];
  exercise_ordinal integer;
  exercise_count integer;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  if p_generation_id is null or jsonb_typeof(p_workouts) is distinct from 'array' then
    raise exception 'Proposta de treino invalida';
  end if;
  if jsonb_array_length(p_workouts) not between 1 and 7 then
    raise exception 'Proposta de treino invalida';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('workout-plan:' || p_generation_id::text, 0));
  select * into attempt from public.workout_ai_attempts
    where id = p_generation_id and user_id = owner_id for update;
  if not found then raise exception 'Proposta de treino indisponivel'; end if;
  if attempt.saved_workout_ids is not null then return attempt.saved_workout_ids; end if;
  if attempt.generated_plan->>'status' is distinct from 'ready' then
    raise exception 'Somente propostas geradas e validadas pelo servidor podem ser salvas';
  end if;
  select jsonb_agg(jsonb_build_object('name', item->'name', 'exercises', item->'exercises') order by ordinal)
    into approved_workouts
    from jsonb_array_elements(attempt.generated_plan->'workouts') with ordinality as x(item, ordinal);
  if p_workouts is distinct from approved_workouts then
    raise exception 'As fichas devem corresponder a proposta validada; gere uma nova proposta para altera-las';
  end if;

  for workout_item in select value from jsonb_array_elements(p_workouts) loop
    if jsonb_typeof(workout_item) is distinct from 'object' or
       jsonb_typeof(workout_item->'name') is distinct from 'string' or
       char_length(trim(workout_item->>'name')) not between 1 and 120 or
       jsonb_typeof(workout_item->'exercises') is distinct from 'array' then
      raise exception 'Ficha invalida na proposta';
    end if;
    exercise_count := jsonb_array_length(workout_item->'exercises');
    if exercise_count not between 2 and 8 then raise exception 'Cada ficha deve conter de 2 a 8 exercicios'; end if;
    if exists (select 1 from jsonb_array_elements(workout_item->'exercises') x
      group by x->>'catalogId' having count(*) > 1) then
      raise exception 'Nao repita exercicios na mesma ficha';
    end if;
    insert into public.workouts(user_id, name, description)
      values (owner_id, trim(workout_item->>'name'), 'Proposta de IA revisada e salva pelo usuario.')
      returning id into workout_id;
    workout_ids := array_append(workout_ids, workout_id);
    exercise_ordinal := 0;
    for exercise_item in select value from jsonb_array_elements(workout_item->'exercises') loop
      if jsonb_typeof(exercise_item) is distinct from 'object' or
         jsonb_typeof(exercise_item->'catalogId') is distinct from 'string' or
         jsonb_typeof(exercise_item->'targetSets') is distinct from 'number' or
         jsonb_typeof(exercise_item->'targetReps') is distinct from 'number' or
         jsonb_typeof(exercise_item->'restSeconds') is distinct from 'number' or
         exercise_item->>'targetSets' !~ '^[2-4]$' or
         exercise_item->>'targetReps' !~ '^(6|[7-9]|1[0-9]|20)$' or
         exercise_item->>'restSeconds' !~ '^(4[5-9]|[5-9][0-9]|1[0-7][0-9]|180)$' then
        raise exception 'Parametros de exercicio invalidos';
      end if;
      select * into catalog from public.exercise_catalog where id = exercise_item->>'catalogId' and kind = 'strength';
      if not found then raise exception 'Exercicio de forca nao encontrado no catalogo'; end if;
      insert into public.exercises(workout_id, user_id, catalog_id, name, position,
        target_sets, target_reps, rest_seconds, kind)
      values (workout_id, owner_id, catalog.id, catalog.name, exercise_ordinal,
        (exercise_item->>'targetSets')::integer, (exercise_item->>'targetReps')::integer,
        (exercise_item->>'restSeconds')::integer, 'strength');
      exercise_ordinal := exercise_ordinal + 1;
    end loop;
  end loop;
  update public.workout_ai_attempts set saved_workout_ids = workout_ids
    where id = p_generation_id and user_id = owner_id;
  return workout_ids;
end;
$$;
revoke execute on function public.create_ai_workout_plan(uuid, jsonb) from public, anon;
grant execute on function public.create_ai_workout_plan(uuid, jsonb) to authenticated;

commit;
