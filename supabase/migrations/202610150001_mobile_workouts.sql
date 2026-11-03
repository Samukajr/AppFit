begin;

alter table public.workouts add column is_starter boolean not null default false;
create unique index workouts_starter_user_idx on public.workouts(user_id) where is_starter;
create unique index sessions_active_workout_idx on public.workout_sessions(workout_id, user_id)
  where finished_at is null;

create function public.get_or_create_workout_session() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout public.workouts;
  session public.workout_sessions;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select * into workout from public.workouts where user_id = owner_id and is_starter;
  if not found then
    insert into public.workouts(user_id, name, description, is_starter)
      values (owner_id, 'Corpo inteiro', 'Ficha de exemplo; nao e uma prescricao personalizada.', true)
      returning * into workout;
    insert into public.exercises(workout_id, user_id, name, position, target_reps)
      values (workout.id, owner_id, 'Agachamento livre', 0, 10),
             (workout.id, owner_id, 'Supino reto', 1, 10),
             (workout.id, owner_id, 'Remada baixa', 2, 12);
  end if;
  select * into session from public.workout_sessions
    where workout_id = workout.id and user_id = owner_id and finished_at is null;
  if not found then
    insert into public.workout_sessions(workout_id, user_id) values (workout.id, owner_id)
      returning * into session;
  end if;
  return jsonb_build_object(
    'workout', jsonb_build_object('id', workout.id, 'name', workout.name),
    'session', jsonb_build_object('id', session.id, 'startedAt', session.started_at),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name,
        'targetSets', e.target_sets, 'targetReps', e.target_reps::text) order by e.position)
      from public.exercises e where e.workout_id = workout.id and e.user_id = owner_id
    ), '[]'::jsonb),
    'sets', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'exerciseId', s.exercise_id,
        'reps', s.reps, 'weightKg', s.weight_kg) order by s.recorded_at, s.set_number)
      from public.workout_sets s where s.session_id = session.id and s.user_id = owner_id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(h.entry order by h.finished_at desc) from (
        select ws.finished_at, jsonb_build_object('id', ws.id, 'finishedAt', ws.finished_at,
          'setCount', count(s.id), 'volume', coalesce(sum(s.reps * s.weight_kg), 0)) as entry
        from public.workout_sessions ws
        left join public.workout_sets s on s.session_id = ws.id
        where ws.workout_id = workout.id and ws.user_id = owner_id and ws.finished_at is not null
        group by ws.id order by ws.finished_at desc limit 10
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

create function public.register_workout_set(
  p_session_id uuid, p_exercise_id uuid, p_reps integer, p_weight_kg numeric, p_rest_seconds integer
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  session public.workout_sessions;
  exercise public.exercises;
  saved public.workout_sets;
begin
  select * into session from public.workout_sessions
    where id = p_session_id and user_id = auth.uid() and finished_at is null for update;
  if not found then raise exception 'Sessao encerrada ou indisponivel'; end if;
  select * into exercise from public.exercises
    where id = p_exercise_id and workout_id = session.workout_id and user_id = auth.uid();
  if not found then raise exception 'Exercicio indisponivel'; end if;
  if p_reps is null or p_weight_kg is null or p_rest_seconds is null or
     p_reps not between 1 and 1000 or p_weight_kg not between 0 and 2000 or
     p_weight_kg <> round(p_weight_kg, 2) or p_rest_seconds not between 5 and 600 then
    raise exception 'Valores da serie invalidos';
  end if;
  insert into public.workout_sets(session_id, workout_id, exercise_id, user_id,
    exercise_name, set_number, reps, weight_kg, rest_seconds)
  select session.id, session.workout_id, exercise.id, auth.uid(), exercise.name,
    coalesce(max(s.set_number), 0) + 1, p_reps, p_weight_kg, p_rest_seconds
    from public.workout_sets s where s.session_id = session.id and s.exercise_id = exercise.id
    returning * into saved;
  return jsonb_build_object('id', saved.id, 'exerciseId', saved.exercise_id,
    'reps', saved.reps, 'weightKg', saved.weight_kg);
end;
$$;

create function public.remove_workout_set(p_session_id uuid, p_set_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.workout_sessions
    where id = p_session_id and user_id = auth.uid() and finished_at is null for update;
  if not found then raise exception 'Sessao encerrada ou indisponivel'; end if;
  delete from public.workout_sets where id = p_set_id and session_id = p_session_id and user_id = auth.uid();
  if not found then raise exception 'Serie nao encontrada. Atualize seu treino.'; end if;
end;
$$;

create function public.finish_workout_session(p_session_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.workout_sessions set finished_at = now()
    where id = p_session_id and user_id = auth.uid() and finished_at is null;
  if not found then raise exception 'Sessao encerrada ou indisponivel'; end if;
end;
$$;

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  if exists (select 1 from storage.objects
    where bucket_id in ('meal-images', 'health-reports') and (storage.foldername(name))[1] = owner_id::text) then
    raise exception 'Remova os arquivos pela funcao delete-account antes de excluir a conta';
  end if;
  delete from public.workout_sets where user_id = owner_id;
  delete from public.workout_sessions where user_id = owner_id;
  delete from public.exercises where user_id = owner_id;
  delete from public.workouts where user_id = owner_id;
  delete from public.food_logs where user_id = owner_id;
  delete from public.health_reports where user_id = owner_id;
  delete from auth.users where id = owner_id;
  if not found then raise exception 'Conta nao encontrada'; end if;
end;
$$;

revoke execute on function public.get_or_create_workout_session(),
  public.register_workout_set(uuid, uuid, integer, numeric, integer),
  public.remove_workout_set(uuid, uuid), public.finish_workout_session(uuid),
  public.delete_my_account() from public, anon;
grant execute on function public.get_or_create_workout_session(),
  public.register_workout_set(uuid, uuid, integer, numeric, integer),
  public.remove_workout_set(uuid, uuid), public.finish_workout_session(uuid),
  public.delete_my_account() to authenticated;

commit;
