begin;

create table public.workout_ai_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_id uuid not null,
  consent_version text not null check (consent_version = 'gemini-workout-v1'),
  adult_confirmed boolean not null check (adult_confirmed),
  created_at timestamptz not null default now(),
  saved_workout_ids uuid[],
  foreign key (assessment_id, user_id) references public.assessments(id, user_id) on delete cascade
);
create index workout_ai_usage_idx on public.workout_ai_attempts(user_id, created_at);
alter table public.workout_ai_attempts enable row level security;
revoke all on public.workout_ai_attempts from public, anon, authenticated;
grant select, insert, update on public.workout_ai_attempts to service_role;

create function public.claim_ai_workout_plan(
  p_user_id uuid, p_assessment_id uuid, p_document_ids uuid[],
  p_consent_version text, p_adult_confirmed boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  attempt_id uuid;
begin
  if p_user_id is null or p_assessment_id is null or
     p_adult_confirmed is distinct from true or
     p_consent_version is distinct from 'gemini-workout-v1' then
    raise exception 'Consentimento de IA e confirmacao de maioridade necessarios';
  end if;
  if coalesce(cardinality(p_document_ids), 0) > 5 or
     (select count(distinct selected.document_id) from unnest(coalesce(p_document_ids, array[]::uuid[])) as selected(document_id))
       <> coalesce(cardinality(p_document_ids), 0) then
    raise exception 'Lista de documentos invalida';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('workout-ai:' || p_user_id::text, 0));
  perform 1 from public.assessments
    where id = p_assessment_id and user_id = p_user_id and consent_version = 'assessment-storage-v1';
  if not found then raise exception 'Avaliacao privada indisponivel'; end if;
  if exists (
    select 1 from unnest(coalesce(p_document_ids, array[]::uuid[])) selected(document_id)
    left join public.assessment_documents d
      on d.id = selected.document_id and d.assessment_id = p_assessment_id and d.user_id = p_user_id
    where d.id is null or d.uploaded_at is null or d.extraction_status <> 'succeeded'
      or d.extraction is null or d.extraction_reviewed_at is null
  ) then raise exception 'Confira no documento original todas as leituras Gemini selecionadas antes de gerar o treino'; end if;
  if (select count(*) from public.workout_ai_attempts where user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 2 then
    raise exception 'Limite de duas propostas de treino por dia UTC atingido';
  end if;
  if exists (select 1 from public.workout_ai_attempts where user_id = p_user_id and created_at > now() - interval '1 minute') then
    raise exception 'Aguarde um minuto antes de gerar outra proposta';
  end if;
  insert into public.workout_ai_attempts(user_id, assessment_id, consent_version, adult_confirmed)
    values (p_user_id, p_assessment_id, p_consent_version, p_adult_confirmed)
    returning id into attempt_id;
  return attempt_id;
end;
$$;
revoke execute on function public.claim_ai_workout_plan(uuid, uuid, uuid[], text, boolean) from public, anon, authenticated;
grant execute on function public.claim_ai_workout_plan(uuid, uuid, uuid[], text, boolean) to service_role;

create function public.create_ai_workout_plan(p_generation_id uuid, p_workouts jsonb) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  attempt public.workout_ai_attempts;
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
