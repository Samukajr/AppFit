begin;

create table public.student_onboarding (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null check (status in ('completed', 'skipped')),
  updated_at timestamptz not null default now()
);
alter table public.student_onboarding enable row level security;
create policy "Students can read their onboarding"
  on public.student_onboarding for select to authenticated using (user_id = auth.uid());
revoke all on public.student_onboarding from public, anon, authenticated;
grant select on public.student_onboarding to authenticated;

create function public.finish_student_onboarding(p_status text) returns text
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  if p_status is null or p_status not in ('completed', 'skipped') then
    raise exception 'Estado de apresentacao invalido';
  end if;
  if p_status = 'completed' and not exists (
    select 1 from public.assessments where user_id = owner_id
  ) then raise exception 'Salve seu objetivo antes de concluir'; end if;
  insert into public.student_onboarding(user_id, status)
    values (owner_id, p_status)
    on conflict (user_id) do update set status = excluded.status, updated_at = now();
  return p_status;
end;
$$;
revoke execute on function public.finish_student_onboarding(text) from public, anon;
grant execute on function public.finish_student_onboarding(text) to authenticated;

create table public.local_workout_plan_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  saved_workout_ids uuid[] not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.local_workout_plan_saves enable row level security;
revoke all on public.local_workout_plan_saves from public, anon, authenticated;

create function public.create_local_workout_plan(p_request_id uuid, p_workouts jsonb) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout_item jsonb;
  exercise_item jsonb;
  catalog public.exercise_catalog;
  workout_id uuid;
  workout_ids uuid[] := array[]::uuid[];
  exercise_ordinal integer;
  existing_ids uuid[];
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  if p_request_id is null then raise exception 'Identificador da sugestao invalido'; end if;
  perform pg_advisory_xact_lock(hashtextextended('local-plan:' || owner_id::text || ':' || p_request_id::text, 0));
  select saved_workout_ids into existing_ids from public.local_workout_plan_saves
    where user_id = owner_id and request_id = p_request_id;
  if found then return existing_ids; end if;
  if jsonb_typeof(p_workouts) is distinct from 'array' or jsonb_array_length(p_workouts) not between 1 and 7 then
    raise exception 'Sugestao de treino invalida';
  end if;

  for workout_item in select value from jsonb_array_elements(p_workouts) loop
    if jsonb_typeof(workout_item) is distinct from 'object' or
       jsonb_typeof(workout_item->'name') is distinct from 'string' or
       char_length(trim(workout_item->>'name')) not between 1 and 120 or
       jsonb_typeof(workout_item->'focus') is distinct from 'string' or
       char_length(trim(workout_item->>'focus')) not between 1 and 120 or
       jsonb_typeof(workout_item->'exercises') is distinct from 'array' or
       jsonb_array_length(workout_item->'exercises') not between 2 and 4 then
      raise exception 'Ficha invalida na sugestao';
    end if;
    if exists (select 1 from jsonb_array_elements(workout_item->'exercises') x
      group by x->>'catalogId' having count(*) > 1) then
      raise exception 'Nao repita exercicios na mesma ficha';
    end if;
    for exercise_item in select value from jsonb_array_elements(workout_item->'exercises') loop
      if jsonb_typeof(exercise_item) is distinct from 'object' or
         jsonb_typeof(exercise_item->'catalogId') is distinct from 'string' or
         jsonb_typeof(exercise_item->'targetSets') is distinct from 'number' or
         jsonb_typeof(exercise_item->'targetReps') is distinct from 'number' or
         jsonb_typeof(exercise_item->'restSeconds') is distinct from 'number' or
         exercise_item->>'targetSets' !~ '^[2-3]$' or
         exercise_item->>'targetReps' !~ '^(8|9|10|11|12)$' or
         exercise_item->>'restSeconds' !~ '^(60|7[0-9]|8[0-9]|9[0-9]|1[01][0-9]|120)$' then
        raise exception 'Parametros de exercicio invalidos';
      end if;
      select * into catalog from public.exercise_catalog
        where id = exercise_item->>'catalogId' and kind = 'strength';
      if not found then raise exception 'Exercicio de forca nao encontrado no catalogo'; end if;
    end loop;
  end loop;

  for workout_item in select value from jsonb_array_elements(p_workouts) loop
    insert into public.workouts(user_id, name, description)
      values (owner_id, trim(workout_item->>'name'),
        'Sugestao local revisavel. Foco: ' || trim(workout_item->>'focus') || '.')
      returning id into workout_id;
    workout_ids := array_append(workout_ids, workout_id);
    exercise_ordinal := 0;
    for exercise_item in select value from jsonb_array_elements(workout_item->'exercises') loop
      select * into catalog from public.exercise_catalog
        where id = exercise_item->>'catalogId' and kind = 'strength';
      insert into public.exercises(workout_id, user_id, catalog_id, name, position,
        target_sets, target_reps, rest_seconds, kind)
      values (workout_id, owner_id, catalog.id, catalog.name, exercise_ordinal,
        (exercise_item->>'targetSets')::integer, (exercise_item->>'targetReps')::integer,
        (exercise_item->>'restSeconds')::integer, 'strength');
      exercise_ordinal := exercise_ordinal + 1;
    end loop;
  end loop;
  insert into public.local_workout_plan_saves(user_id, request_id, saved_workout_ids)
    values (owner_id, p_request_id, workout_ids);
  return workout_ids;
end;
$$;
revoke execute on function public.create_local_workout_plan(uuid, jsonb) from public, anon;
grant execute on function public.create_local_workout_plan(uuid, jsonb) to authenticated;

commit;
