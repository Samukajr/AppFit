begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  height_cm numeric(5,2) check (height_cm > 0 and height_cm <= 300),
  created_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  position integer not null default 0 check (position >= 0),
  target_sets integer not null default 3 check (target_sets between 1 and 100),
  target_reps integer not null default 10 check (target_reps between 1 and 1000),
  rest_seconds integer not null default 60 check (rest_seconds between 5 and 600),
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade,
  unique (id, workout_id, user_id)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz check (finished_at >= started_at),
  foreign key (workout_id, user_id) references public.workouts(id, user_id),
  unique (id, workout_id, user_id)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  workout_id uuid not null,
  exercise_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_name text not null check (char_length(trim(exercise_name)) between 1 and 120),
  set_number integer not null check (set_number > 0),
  reps integer not null check (reps between 1 and 1000),
  weight_kg numeric(6,2) not null check (weight_kg between 0 and 2000),
  rest_seconds integer check (rest_seconds between 5 and 600),
  recorded_at timestamptz not null default now(),
  foreign key (session_id, workout_id, user_id)
    references public.workout_sessions(id, workout_id, user_id) on delete cascade,
  foreign key (exercise_id, workout_id, user_id)
    references public.exercises(id, workout_id, user_id),
  unique (session_id, exercise_id, set_number)
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_name text not null check (char_length(trim(meal_name)) between 1 and 200),
  image_path text,
  calories numeric(10,2) not null check (calories >= 0),
  proteins_g numeric(10,2) not null check (proteins_g >= 0),
  carbs_g numeric(10,2) not null check (carbs_g >= 0),
  fats_g numeric(10,2) not null check (fats_g >= 0),
  is_estimate boolean not null default true,
  confirmed_at timestamptz,
  logged_at timestamptz not null default now()
);

create table public.health_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed')),
  analysis jsonb,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (split_part(file_path, '/', 1) = user_id::text)
);

create index workouts_user_idx on public.workouts(user_id);
create index exercises_workout_idx on public.exercises(workout_id, user_id);
create index sessions_user_idx on public.workout_sessions(user_id, started_at desc);
create index sets_session_idx on public.workout_sets(session_id);
create index sets_exercise_idx on public.workout_sets(exercise_id, workout_id, user_id);
create index food_logs_user_idx on public.food_logs(user_id, logged_at desc);
create index health_reports_user_idx on public.health_reports(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.food_logs enable row level security;
alter table public.health_reports enable row level security;

create policy profiles_owner on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy workouts_owner on public.workouts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_owner on public.exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sessions_owner on public.workout_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sets_owner on public.workout_sets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy food_logs_owner on public.food_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy health_reports_owner on public.health_reports for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.profiles, public.workouts,
  public.exercises, public.workout_sessions, public.workout_sets,
  public.food_logs, public.health_reports to authenticated;
revoke all on public.profiles, public.workouts, public.exercises,
  public.workout_sessions, public.workout_sets, public.food_logs,
  public.health_reports from anon;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('meal-images', 'meal-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('health-reports', 'health-reports', false, 10485760, array['application/pdf']);

create policy fitvision_files_select on storage.objects for select to authenticated
  using (bucket_id in ('meal-images', 'health-reports')
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fitvision_files_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('meal-images', 'health-reports')
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fitvision_files_update on storage.objects for update to authenticated
  using (bucket_id in ('meal-images', 'health-reports')
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('meal-images', 'health-reports')
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fitvision_files_delete on storage.objects for delete to authenticated
  using (bucket_id in ('meal-images', 'health-reports')
    and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
