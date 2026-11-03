begin;

alter table public.assessment_documents
  add column extraction_status text not null default 'not_requested'
    check (extraction_status in ('not_requested', 'processing', 'succeeded', 'failed')),
  add column extraction jsonb check (extraction is null or jsonb_typeof(extraction) = 'object'),
  add column extraction_model text,
  add column extraction_attempt_id uuid,
  add column extraction_started_at timestamptz,
  add column extraction_reviewed_at timestamptz;

create table public.assessment_ai_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.assessment_documents(id) on delete set null,
  consent_version text not null check (consent_version = 'gemini-document-v1'),
  adult_confirmed boolean not null check (adult_confirmed),
  created_at timestamptz not null default now()
);
create index assessment_ai_usage_idx on public.assessment_ai_attempts(user_id, created_at);
alter table public.assessment_ai_attempts enable row level security;
revoke all on public.assessment_ai_attempts from public, anon, authenticated;
grant select, update on public.assessment_documents to service_role;

create function public.claim_gemini_assessment(
  p_user_id uuid, p_document_id uuid, p_consent_version text, p_adult_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  document public.assessment_documents;
  attempt_id uuid;
begin
  if p_user_id is null or p_adult_confirmed is distinct from true or
    p_consent_version is distinct from 'gemini-document-v1' then raise exception 'Consentimento e confirmacao de maioridade necessarios'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gemini:' || p_user_id::text, 0));
  select * into document from public.assessment_documents where id = p_document_id and user_id = p_user_id for update;
  if not found or document.uploaded_at is null then raise exception 'Documento privado confirmado nao encontrado'; end if;
  if document.extraction_status = 'succeeded' then raise exception 'Leitura ja disponivel. Atualize os documentos.'; end if;
  if document.extraction_status = 'processing' and document.extraction_started_at > now() - interval '5 minutes' then
    raise exception 'Leitura em andamento. Aguarde e atualize os documentos.';
  end if;
  if (select count(*) from public.assessment_ai_attempts where user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 3 then
    raise exception 'Limite de tres tentativas por dia UTC atingido';
  end if;
  if exists (select 1 from public.assessment_ai_attempts where user_id = p_user_id and created_at > now() - interval '1 minute') then
    raise exception 'Aguarde um minuto antes de nova leitura';
  end if;
  insert into public.assessment_ai_attempts(user_id, document_id, consent_version, adult_confirmed)
    values(p_user_id, p_document_id, p_consent_version, p_adult_confirmed) returning id into attempt_id;
  update public.assessment_documents set extraction_status = 'processing', extraction = null,
    extraction_attempt_id = attempt_id, extraction_started_at = now(), extraction_reviewed_at = null
    where id = p_document_id returning * into document;
  return to_jsonb(document);
end;
$$;
revoke execute on function public.claim_gemini_assessment(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_gemini_assessment(uuid, uuid, text, boolean) to service_role;

create function public.review_assessment_extraction(p_document_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.assessment_documents set extraction_reviewed_at = now()
    where id = p_document_id and user_id = auth.uid() and extraction_status = 'succeeded' and extraction is not null;
  if not found then raise exception 'Leitura indisponivel para conferencia'; end if;
end;
$$;
revoke execute on function public.review_assessment_extraction(uuid) from public, anon;
grant execute on function public.review_assessment_extraction(uuid) to authenticated;

commit;
