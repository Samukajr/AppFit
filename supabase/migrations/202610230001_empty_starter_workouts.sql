begin;

update public.exercises e
set is_active = false
from public.workouts w
where e.workout_id = w.id
  and e.user_id = w.user_id
  and w.is_starter
  and e.is_active;

create or replace function public.get_or_create_workout_session() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout public.workouts;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select * into workout from public.workouts where user_id = owner_id and is_starter;
  if not found then
    insert into public.workouts(user_id, name, description, is_starter)
      values (owner_id, 'Minha ficha', 'Monte sua ficha escolhendo os exercicios que deseja.', true)
      returning * into workout;
  end if;
  return public.get_workout_session(workout.id);
end;
$$;

revoke execute on function public.get_or_create_workout_session() from public, anon;
grant execute on function public.get_or_create_workout_session() to authenticated;

commit;
