begin;

create table public.exercise_catalog (
  id text primary key,
  name text not null check (char_length(name) between 1 and 120),
  muscle_group text not null check (muscle_group in
    ('Peito', 'Costas', 'Pernas', 'Gluteos', 'Ombros', 'Biceps', 'Triceps', 'Abdomen', 'Cardio')),
  equipment text not null,
  kind text not null check (kind in ('strength', 'cardio'))
);
alter table public.exercise_catalog enable row level security;
create policy catalog_read on public.exercise_catalog for select to authenticated using (true);
revoke all on public.exercise_catalog from anon, authenticated;
grant select on public.exercise_catalog to authenticated;

insert into public.exercise_catalog(id, name, muscle_group, equipment, kind) values
  ('bench-bar', 'Supino reto com barra', 'Peito', 'Barra e banco', 'strength'),
  ('bench-dumbbell', 'Supino reto com halteres', 'Peito', 'Halteres e banco', 'strength'),
  ('incline-bench', 'Supino inclinado', 'Peito', 'Halteres e banco', 'strength'),
  ('chest-fly', 'Crucifixo com halteres', 'Peito', 'Halteres e banco', 'strength'),
  ('crossover', 'Crossover na polia', 'Peito', 'Polia', 'strength'),
  ('push-up', 'Flexao de bracos', 'Peito', 'Peso corporal', 'strength'),
  ('chest-machine', 'Supino na maquina', 'Peito', 'Maquina', 'strength'),
  ('lat-pulldown', 'Puxada frontal', 'Costas', 'Polia', 'strength'),
  ('seated-row', 'Remada baixa', 'Costas', 'Polia', 'strength'),
  ('barbell-row', 'Remada curvada', 'Costas', 'Barra', 'strength'),
  ('dumbbell-row', 'Remada unilateral', 'Costas', 'Halter', 'strength'),
  ('pull-up', 'Barra fixa', 'Costas', 'Barra fixa', 'strength'),
  ('pullover', 'Pullover na polia', 'Costas', 'Polia', 'strength'),
  ('squat', 'Agachamento livre', 'Pernas', 'Barra', 'strength'),
  ('goblet-squat', 'Agachamento goblet', 'Pernas', 'Halter', 'strength'),
  ('leg-press', 'Leg press', 'Pernas', 'Maquina', 'strength'),
  ('leg-extension', 'Cadeira extensora', 'Pernas', 'Maquina', 'strength'),
  ('leg-curl', 'Mesa flexora', 'Pernas', 'Maquina', 'strength'),
  ('seated-leg-curl', 'Cadeira flexora', 'Pernas', 'Maquina', 'strength'),
  ('lunge', 'Afundo', 'Pernas', 'Halteres', 'strength'),
  ('calf-raise', 'Elevacao de panturrilhas', 'Pernas', 'Maquina ou halteres', 'strength'),
  ('hip-thrust', 'Elevacao pelvica', 'Gluteos', 'Barra e banco', 'strength'),
  ('glute-bridge', 'Ponte de gluteos', 'Gluteos', 'Peso corporal', 'strength'),
  ('hip-abduction', 'Cadeira abdutora', 'Gluteos', 'Maquina', 'strength'),
  ('cable-kickback', 'Coice na polia', 'Gluteos', 'Polia', 'strength'),
  ('romanian-deadlift', 'Levantamento terra romeno', 'Gluteos', 'Barra ou halteres', 'strength'),
  ('shoulder-press', 'Desenvolvimento com halteres', 'Ombros', 'Halteres', 'strength'),
  ('lateral-raise', 'Elevacao lateral', 'Ombros', 'Halteres', 'strength'),
  ('front-raise', 'Elevacao frontal', 'Ombros', 'Halteres', 'strength'),
  ('reverse-fly', 'Crucifixo inverso', 'Ombros', 'Halteres', 'strength'),
  ('face-pull', 'Face pull', 'Ombros', 'Polia', 'strength'),
  ('barbell-curl', 'Rosca direta', 'Biceps', 'Barra', 'strength'),
  ('alternating-curl', 'Rosca alternada', 'Biceps', 'Halteres', 'strength'),
  ('hammer-curl', 'Rosca martelo', 'Biceps', 'Halteres', 'strength'),
  ('preacher-curl', 'Rosca Scott', 'Biceps', 'Barra e banco Scott', 'strength'),
  ('cable-curl', 'Rosca na polia', 'Biceps', 'Polia', 'strength'),
  ('triceps-rope', 'Triceps com corda', 'Triceps', 'Polia', 'strength'),
  ('triceps-bar', 'Triceps na polia com barra', 'Triceps', 'Polia', 'strength'),
  ('skull-crusher', 'Triceps testa', 'Triceps', 'Barra ou halteres', 'strength'),
  ('overhead-triceps', 'Triceps frances', 'Triceps', 'Halter', 'strength'),
  ('triceps-kickback', 'Triceps coice', 'Triceps', 'Halter', 'strength'),
  ('crunch', 'Abdominal no solo', 'Abdomen', 'Colchonete', 'strength'),
  ('reverse-crunch', 'Abdominal reverso', 'Abdomen', 'Colchonete', 'strength'),
  ('cable-crunch', 'Abdominal na polia', 'Abdomen', 'Polia', 'strength'),
  ('dead-bug', 'Dead bug', 'Abdomen', 'Colchonete', 'strength'),
  ('bike', 'Bike ergometrica', 'Cardio', 'Bicicleta ergometrica', 'cardio'),
  ('spinning', 'Bike de spinning', 'Cardio', 'Bicicleta de spinning', 'cardio'),
  ('treadmill-walk', 'Caminhada na esteira', 'Cardio', 'Esteira', 'cardio'),
  ('treadmill-run', 'Corrida na esteira', 'Cardio', 'Esteira', 'cardio'),
  ('outdoor-walk', 'Caminhada ao ar livre', 'Cardio', 'Sem equipamento', 'cardio'),
  ('outdoor-run', 'Corrida ao ar livre', 'Cardio', 'Sem equipamento', 'cardio'),
  ('elliptical', 'Eliptico', 'Cardio', 'Eliptico', 'cardio'),
  ('rowing', 'Remo ergometrico', 'Cardio', 'Remo ergometrico', 'cardio'),
  ('stair-climber', 'Escada ergometrica', 'Cardio', 'Escada ergometrica', 'cardio'),
  ('jump-rope', 'Pular corda', 'Cardio', 'Corda', 'cardio');

alter table public.exercises
  add column catalog_id text references public.exercise_catalog(id),
  add column kind text not null default 'strength' check (kind in ('strength', 'cardio')),
  add column target_minutes integer check (target_minutes between 1 and 600),
  add constraint exercise_type_target check
    ((kind = 'strength' and target_minutes is null) or (kind = 'cardio' and target_minutes is not null));

create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  workout_id uuid not null,
  exercise_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  distance_km numeric(7,2) check (distance_km between 0 and 1000),
  perceived_exertion integer not null check (perceived_exertion between 1 and 10),
  recorded_at timestamptz not null default now(),
  foreign key (session_id, workout_id, user_id)
    references public.workout_sessions(id, workout_id, user_id) on delete cascade,
  foreign key (exercise_id, workout_id, user_id)
    references public.exercises(id, workout_id, user_id)
);
create index cardio_session_idx on public.cardio_logs(session_id);
create index cardio_exercise_idx on public.cardio_logs(exercise_id, workout_id, user_id);
alter table public.cardio_logs enable row level security;
create policy cardio_owner on public.cardio_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.cardio_logs from anon;
grant select, insert, update, delete on public.cardio_logs to authenticated;

create function public.validate_workout_entry() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  exercise_kind text;
begin
  select e.kind into exercise_kind from public.exercises e
    where e.id = new.exercise_id and e.workout_id = new.workout_id and e.user_id = new.user_id;
  if exercise_kind is null or
    (tg_table_name = 'workout_sets' and exercise_kind <> 'strength') or
    (tg_table_name = 'cardio_logs' and exercise_kind <> 'cardio') then
    raise exception 'Tipo de registro incompativel com o exercicio';
  end if;
  return new;
end;
$$;
revoke execute on function public.validate_workout_entry() from public, anon, authenticated;
create trigger strength_entry_type before insert or update on public.workout_sets
  for each row execute function public.validate_workout_entry();
create trigger cardio_entry_type before insert or update on public.cardio_logs
  for each row execute function public.validate_workout_entry();

create function public.create_manual_workout(p_name text, p_exercises jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout_id uuid;
  item jsonb;
  catalog public.exercise_catalog;
  ordinal integer := 0;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'Informe um nome de 1 a 120 caracteres';
  end if;
  if jsonb_typeof(p_exercises) is distinct from 'array' then raise exception 'Lista de exercicios invalida'; end if;
  if jsonb_array_length(p_exercises) not between 1 and 30 then
    raise exception 'Selecione de 1 a 30 exercicios';
  end if;
  if exists (select 1 from jsonb_array_elements(p_exercises) x
    group by x->>'catalogId' having count(*) > 1) then
    raise exception 'Nao repita o mesmo exercicio na ficha';
  end if;
  insert into public.workouts(user_id, name, description)
    values (owner_id, trim(p_name), 'Ficha montada manualmente pelo usuario')
    returning id into workout_id;
  for item in select value from jsonb_array_elements(p_exercises) loop
    select * into catalog from public.exercise_catalog where id = item->>'catalogId';
    if not found then raise exception 'Exercicio do catalogo nao encontrado'; end if;
    if catalog.kind = 'strength' then
      if jsonb_typeof(item->'targetSets') is distinct from 'number' or
         jsonb_typeof(item->'targetReps') is distinct from 'number' or
         jsonb_typeof(item->'restSeconds') is distinct from 'number' or
         item->>'targetSets' !~ '^[0-9]+$' or item->>'targetReps' !~ '^[0-9]+$' or
         item->>'restSeconds' !~ '^[0-9]+$' then raise exception 'Parametros de forca invalidos'; end if;
      insert into public.exercises(workout_id, user_id, catalog_id, name, position,
        target_sets, target_reps, rest_seconds, kind)
      values (workout_id, owner_id, catalog.id, catalog.name, ordinal,
        (item->>'targetSets')::integer, (item->>'targetReps')::integer,
        (item->>'restSeconds')::integer, 'strength');
    else
      if jsonb_typeof(item->'targetMinutes') is distinct from 'number' or
        item->>'targetMinutes' !~ '^[0-9]+$' then raise exception 'Duracao de cardio invalida'; end if;
      insert into public.exercises(workout_id, user_id, catalog_id, name, position,
        target_sets, target_reps, kind, target_minutes)
      values (workout_id, owner_id, catalog.id, catalog.name, ordinal, 1, 1,
        'cardio', (item->>'targetMinutes')::integer);
    end if;
    ordinal := ordinal + 1;
  end loop;
  return workout_id;
end;
$$;

create function public.get_workout_session(p_workout_id uuid) returns jsonb
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
      from public.exercises e where e.workout_id = workout.id and e.user_id = owner_id
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

create function public.register_cardio(
  p_session_id uuid, p_exercise_id uuid, p_duration_minutes integer,
  p_distance_km numeric, p_perceived_exertion integer
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  session public.workout_sessions;
  saved public.cardio_logs;
begin
  select * into session from public.workout_sessions
    where id = p_session_id and user_id = auth.uid() and finished_at is null for update;
  if not found then raise exception 'Sessao encerrada ou indisponivel'; end if;
  if p_distance_km is not null and p_distance_km <> round(p_distance_km, 2) then
    raise exception 'Use ate duas casas decimais na distancia';
  end if;
  insert into public.cardio_logs(session_id, workout_id, exercise_id, user_id,
    duration_minutes, distance_km, perceived_exertion)
  values (session.id, session.workout_id, p_exercise_id, auth.uid(),
    p_duration_minutes, p_distance_km, p_perceived_exertion) returning * into saved;
  return jsonb_build_object('id', saved.id, 'exerciseId', saved.exercise_id,
    'durationMinutes', saved.duration_minutes, 'distanceKm', saved.distance_km,
    'perceivedExertion', saved.perceived_exertion);
end;
$$;

create function public.remove_cardio(p_session_id uuid, p_log_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.workout_sessions
    where id = p_session_id and user_id = auth.uid() and finished_at is null for update;
  if not found then raise exception 'Sessao encerrada ou indisponivel'; end if;
  delete from public.cardio_logs where id = p_log_id and session_id = p_session_id and user_id = auth.uid();
  if not found then raise exception 'Registro nao encontrado. Atualize o treino.'; end if;
end;
$$;

revoke execute on function public.create_manual_workout(text, jsonb),
  public.get_workout_session(uuid), public.register_cardio(uuid, uuid, integer, numeric, integer),
  public.remove_cardio(uuid, uuid) from public, anon;
grant execute on function public.create_manual_workout(text, jsonb),
  public.get_workout_session(uuid), public.register_cardio(uuid, uuid, integer, numeric, integer),
  public.remove_cardio(uuid, uuid) to authenticated;

commit;
