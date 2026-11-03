begin;

alter table public.workouts add column archived_at timestamptz;
alter table public.exercises add column is_active boolean not null default true;

create index workouts_owner_archive_idx on public.workouts(user_id, archived_at, created_at desc);
create index exercises_active_workout_idx on public.exercises(workout_id, user_id, position) where is_active;

create or replace function public.validate_workout_entry() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  exercise_kind text;
  exercise_is_active boolean;
begin
  select e.kind, e.is_active into exercise_kind, exercise_is_active
    from public.exercises e
    where e.id = new.exercise_id and e.workout_id = new.workout_id and e.user_id = new.user_id;
  if exercise_kind is null or exercise_is_active is distinct from true or
    (tg_table_name = 'workout_sets' and exercise_kind <> 'strength') or
    (tg_table_name = 'cardio_logs' and exercise_kind <> 'cardio') then
    raise exception 'Tipo de registro incompativel com o exercicio';
  end if;
  return new;
end;
$$;

create or replace function public.get_workout_session(p_workout_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout public.workouts;
  session public.workout_sessions;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select * into workout from public.workouts where id = p_workout_id and user_id = owner_id;
  if not found then raise exception 'Ficha indisponivel'; end if;
  select * into session from public.workout_sessions
    where workout_id = workout.id and user_id = owner_id and finished_at is null;
  if not found then
    insert into public.workout_sessions(workout_id, user_id) values (workout.id, owner_id)
      returning * into session;
  end if;
  return jsonb_build_object(
    'workout', jsonb_build_object('id', workout.id, 'name', workout.name, 'isStarter', workout.is_starter),
    'session', jsonb_build_object('id', session.id, 'startedAt', session.started_at),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name,
        'targetSets', e.target_sets, 'targetReps', e.target_reps::text,
        'kind', e.kind, 'targetMinutes', e.target_minutes, 'restSeconds', e.rest_seconds) order by e.position)
      from public.exercises e where e.workout_id = workout.id and e.user_id = owner_id and e.is_active
    ), '[]'::jsonb),
    'sets', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'exerciseId', s.exercise_id,
        'reps', s.reps, 'weightKg', s.weight_kg) order by s.recorded_at, s.set_number)
      from public.workout_sets s where s.session_id = session.id and s.user_id = owner_id
    ), '[]'::jsonb),
    'cardio', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'exerciseId', c.exercise_id,
        'durationMinutes', c.duration_minutes, 'distanceKm', c.distance_km,
        'perceivedExertion', c.perceived_exertion) order by c.recorded_at)
      from public.cardio_logs c where c.session_id = session.id and c.user_id = owner_id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(h.entry order by h.finished_at desc) from (
        select ws.finished_at, jsonb_build_object('id', ws.id, 'finishedAt', ws.finished_at,
          'setCount', (select count(*) from public.workout_sets s where s.session_id = ws.id),
          'volume', (select coalesce(sum(s.reps * s.weight_kg), 0) from public.workout_sets s where s.session_id = ws.id),
          'cardioMinutes', (select coalesce(sum(c.duration_minutes), 0) from public.cardio_logs c where c.session_id = ws.id)
        ) as entry from public.workout_sessions ws
        where ws.workout_id = workout.id and ws.user_id = owner_id and ws.finished_at is not null
        order by ws.finished_at desc limit 10
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

create function public.replace_manual_workout(
  p_workout_id uuid, p_name text, p_exercises jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout public.workouts;
  item jsonb;
  catalog public.exercise_catalog;
  existing public.exercises;
  ordinal integer := 0;
  selected_catalog_id text;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'Informe um nome de 1 a 120 caracteres';
  end if;
  if jsonb_typeof(p_exercises) is distinct from 'array' or jsonb_array_length(p_exercises) not between 1 and 30 then
    raise exception 'Selecione de 1 a 30 exercicios';
  end if;
  if exists (select 1 from jsonb_array_elements(p_exercises) x
    group by x->>'catalogId' having count(*) > 1) then
    raise exception 'Nao repita o mesmo exercicio na ficha';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workout-edit:' || p_workout_id::text, 0));
  select * into workout from public.workouts
    where id = p_workout_id and user_id = owner_id for update;
  if not found or workout.is_starter or workout.archived_at is not null then
    raise exception 'Ficha manual indisponivel para edicao';
  end if;
  if exists (
    select 1 from public.workout_sessions s
    where s.workout_id = p_workout_id and s.user_id = owner_id and s.finished_at is null
      and (exists (select 1 from public.workout_sets ws where ws.session_id = s.id)
        or exists (select 1 from public.cardio_logs cl where cl.session_id = s.id))
  ) then
    raise exception 'Conclua o treino em andamento antes de editar a ficha';
  end if;

  for item in select value from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(item) is distinct from 'object' or
       jsonb_typeof(item->'catalogId') is distinct from 'string' then
      raise exception 'Exercicio invalido na ficha';
    end if;
    select * into catalog from public.exercise_catalog where id = item->>'catalogId';
    if not found then raise exception 'Exercicio do catalogo nao encontrado'; end if;
    if catalog.kind = 'strength' then
      if jsonb_typeof(item->'targetSets') is distinct from 'number' or
         jsonb_typeof(item->'targetReps') is distinct from 'number' or
         jsonb_typeof(item->'restSeconds') is distinct from 'number' or
         item->>'targetSets' !~ '^([1-9]|[1-9][0-9]|100)$' or
         item->>'targetReps' !~ '^([1-9]|[1-9][0-9]{1,2}|1000)$' or
         item->>'restSeconds' !~ '^(5|[6-9]|[1-9][0-9]|[1-5][0-9]{2}|600)$' then
        raise exception 'Parametros de forca invalidos';
      end if;
    else
      if jsonb_typeof(item->'targetMinutes') is distinct from 'number' or
         item->>'targetMinutes' !~ '^([1-9]|[1-9][0-9]{1,2}|600)$' then
        raise exception 'Duracao de cardio invalida';
      end if;
    end if;
  end loop;

  update public.workouts set name = trim(p_name) where id = workout.id and user_id = owner_id;
  for item in select value from jsonb_array_elements(p_exercises) loop
    selected_catalog_id := item->>'catalogId';
    select * into catalog from public.exercise_catalog where id = selected_catalog_id;
    select * into existing from public.exercises
      where workout_id = workout.id and user_id = owner_id and is_active and exercises.catalog_id = selected_catalog_id
      for update;
    if found then
      if catalog.kind = 'strength' then
        update public.exercises set name = catalog.name, position = ordinal,
          target_sets = (item->>'targetSets')::integer, target_reps = (item->>'targetReps')::integer,
          rest_seconds = (item->>'restSeconds')::integer, target_minutes = null
          where id = existing.id and user_id = owner_id;
      else
        update public.exercises set name = catalog.name, position = ordinal,
          target_sets = 1, target_reps = 1, rest_seconds = 60,
          target_minutes = (item->>'targetMinutes')::integer
          where id = existing.id and user_id = owner_id;
      end if;
    else
      if catalog.kind = 'strength' then
        insert into public.exercises(workout_id, user_id, catalog_id, name, position,
          target_sets, target_reps, rest_seconds, kind, is_active)
        values (workout.id, owner_id, catalog.id, catalog.name, ordinal,
          (item->>'targetSets')::integer, (item->>'targetReps')::integer,
          (item->>'restSeconds')::integer, catalog.kind, true);
      else
        insert into public.exercises(workout_id, user_id, catalog_id, name, position,
          target_sets, target_reps, rest_seconds, kind, target_minutes, is_active)
        values (workout.id, owner_id, catalog.id, catalog.name, ordinal,
          1, 1, 60, catalog.kind, (item->>'targetMinutes')::integer, true);
      end if;
    end if;
    ordinal := ordinal + 1;
  end loop;

  for existing in select e.* from public.exercises e
    where e.workout_id = workout.id and e.user_id = owner_id and e.is_active
      and not (e.catalog_id = any(array(select jsonb_array_elements(p_exercises)->>'catalogId')))
    for update
  loop
    if exists (select 1 from public.workout_sets where exercise_id = existing.id)
       or exists (select 1 from public.cardio_logs where exercise_id = existing.id) then
      update public.exercises set is_active = false where id = existing.id and user_id = owner_id;
    else
      delete from public.exercises where id = existing.id and user_id = owner_id;
    end if;
  end loop;
end;
$$;

create function public.archive_manual_workout(p_workout_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticacao necessaria'; end if;
  update public.workouts set archived_at = now()
    where id = p_workout_id and user_id = auth.uid() and not is_starter and archived_at is null;
  if not found then raise exception 'Ficha manual indisponivel para arquivamento'; end if;
end;
$$;

create function public.restore_manual_workout(p_workout_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticacao necessaria'; end if;
  update public.workouts set archived_at = null
    where id = p_workout_id and user_id = auth.uid() and not is_starter and archived_at is not null;
  if not found then raise exception 'Ficha arquivada indisponivel para restauracao'; end if;
end;
$$;

revoke execute on function public.replace_manual_workout(uuid, text, jsonb),
  public.archive_manual_workout(uuid), public.restore_manual_workout(uuid) from public, anon;
grant execute on function public.replace_manual_workout(uuid, text, jsonb),
  public.archive_manual_workout(uuid), public.restore_manual_workout(uuid) to authenticated;

commit;
