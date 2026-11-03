begin;

create index sessions_progress_owner_idx on public.workout_sessions(user_id, finished_at, id)
  where finished_at is not null;

create function public.get_workout_progress(p_days integer default 30) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  if p_days is not null and p_days not in (30, 90) then
    raise exception 'Periodo invalido';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'workoutId', w.id, 'workoutName', w.name, 'finishedAt', s.finished_at,
    'lifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'exerciseKey', best.exercise_key, 'name', best.exercise_name,
        'weightKg', best.weight_kg, 'reps', best.reps
      ) order by best.exercise_key)
      from (
        select distinct on (coalesce(e.catalog_id, e.id::text))
          coalesce(e.catalog_id, e.id::text) as exercise_key,
          ws.exercise_name, ws.weight_kg, ws.reps
        from public.workout_sets ws
        join public.exercises e on e.id = ws.exercise_id and e.user_id = owner_id
        where ws.session_id = s.id and ws.user_id = owner_id
        order by coalesce(e.catalog_id, e.id::text), ws.weight_kg desc, ws.reps desc, ws.id
      ) best
    ), '[]'::jsonb)
  ) order by s.finished_at, s.id), '[]'::jsonb) into result
  from public.workout_sessions s
  join public.workouts w on w.id = s.workout_id and w.user_id = owner_id
  where s.user_id = owner_id and s.finished_at is not null
    and (p_days is null or s.finished_at >= now() - make_interval(days => p_days))
    and (exists (select 1 from public.workout_sets ws where ws.session_id = s.id and ws.user_id = owner_id)
      or exists (select 1 from public.cardio_logs c where c.session_id = s.id and c.user_id = owner_id));
  return result;
end;
$$;

revoke execute on function public.get_workout_progress(integer) from public, anon;
grant execute on function public.get_workout_progress(integer) to authenticated;

commit;
