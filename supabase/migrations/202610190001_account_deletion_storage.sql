begin;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
<<account_deletion>>
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then raise exception 'Autenticacao necessaria'; end if;
  if exists (select 1 from storage.objects as object
    where object.bucket_id in ('meal-images', 'health-reports')
      and (storage.foldername(object.name))[1] = account_deletion.target_user_id::text) then
    raise exception 'Remova os arquivos pela funcao delete-account antes de excluir a conta';
  end if;
  delete from public.workout_sets where user_id = account_deletion.target_user_id;
  delete from public.workout_sessions where user_id = account_deletion.target_user_id;
  delete from public.exercises where user_id = account_deletion.target_user_id;
  delete from public.workouts where user_id = account_deletion.target_user_id;
  delete from public.food_logs where user_id = account_deletion.target_user_id;
  delete from public.health_reports where user_id = account_deletion.target_user_id;
  delete from auth.users where id = account_deletion.target_user_id;
  if not found then raise exception 'Conta nao encontrada'; end if;
end;
$$;

commit;
