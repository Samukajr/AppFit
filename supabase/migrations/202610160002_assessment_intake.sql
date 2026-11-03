begin;

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal text not null check (goal in ('hypertrophy', 'fitness', 'conditioning', 'other')),
  experience text not null check (experience in ('beginner', 'intermediate', 'advanced')),
  days_per_week integer not null check (days_per_week between 1 and 7),
  session_minutes integer not null check (session_minutes between 10 and 180),
  equipment text not null check (char_length(trim(equipment)) between 1 and 1000),
  limitations text not null default '' check (char_length(limitations) <= 2000),
  professional_guidance text not null default '' check (char_length(professional_guidance) <= 2000),
  measured_on date,
  weight_kg numeric(5,2) check (weight_kg between 1 and 500),
  height_cm numeric(5,2) check (height_cm between 30 and 300),
  body_fat_percent numeric(5,2) check (body_fat_percent between 0 and 100),
  muscle_mass_kg numeric(5,2) check (muscle_mass_kg between 0 and 500),
  consent_version text not null check (consent_version = 'assessment-storage-v1'),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(id, user_id)
);
create index assessments_user_idx on public.assessments(user_id, created_at desc);
alter table public.assessments enable row level security;
create policy assessments_owner_read on public.assessments for select to authenticated
  using (user_id = (select auth.uid()));
create policy assessments_owner_insert on public.assessments for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke all on public.assessments from anon, authenticated;
grant select, insert on public.assessments to authenticated;

create table public.assessment_documents (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null unique,
  display_name text not null check (char_length(display_name) between 1 and 120),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (assessment_id, user_id) references public.assessments(id, user_id) on delete cascade,
  check (split_part(file_path, '/', 1) = user_id::text)
);
create index assessment_documents_owner_idx on public.assessment_documents(user_id, assessment_id);
alter table public.assessment_documents enable row level security;
create policy assessment_documents_owner on public.assessment_documents for select to authenticated
  using (user_id = (select auth.uid()));
create policy assessment_documents_delete on public.assessment_documents for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.assessment_documents from anon, authenticated;
grant select, delete on public.assessment_documents to authenticated;

update storage.buckets set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
  where id = 'health-reports';

create function public.begin_assessment_document(
  p_assessment_id uuid, p_name text, p_mime_type text, p_size_bytes integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  document_id uuid := gen_random_uuid();
  saved public.assessment_documents;
  extension text;
begin
  if owner_id is null then raise exception 'Autenticacao necessaria'; end if;
  perform 1 from public.assessments where id = p_assessment_id and user_id = owner_id for update;
  if not found then raise exception 'Avaliacao indisponivel'; end if;
  if (select count(*) from public.assessment_documents where assessment_id = p_assessment_id) >= 5 then
    raise exception 'Limite de cinco documentos por avaliacao';
  end if;
  extension := case p_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
  if extension is null then raise exception 'Formato de documento invalido'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'Nome do documento invalido';
  end if;
  insert into public.assessment_documents(id, assessment_id, user_id, file_path, display_name, mime_type, size_bytes)
    values (document_id, p_assessment_id, owner_id,
      owner_id::text || '/assessments/' || p_assessment_id::text || '/' || document_id::text || '.' || extension,
      trim(p_name), p_mime_type, p_size_bytes) returning * into saved;
  return to_jsonb(saved);
end;
$$;

create function public.confirm_assessment_document(p_document_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  document public.assessment_documents;
begin
  select * into document from public.assessment_documents
    where id = p_document_id and user_id = auth.uid() for update;
  if not found then raise exception 'Documento indisponivel'; end if;
  if not exists (select 1 from storage.objects
    where bucket_id = 'health-reports' and name = document.file_path) then
    raise exception 'Arquivo nao encontrado no armazenamento. Remova o anexo pendente e tente novamente.';
  end if;
  update public.assessment_documents set uploaded_at = coalesce(uploaded_at, now()) where id = document.id;
end;
$$;
revoke execute on function public.begin_assessment_document(uuid, text, text, integer),
  public.confirm_assessment_document(uuid) from public, anon;
grant execute on function public.begin_assessment_document(uuid, text, text, integer),
  public.confirm_assessment_document(uuid) to authenticated;

commit;
