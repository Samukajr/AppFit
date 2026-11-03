begin;

create table public.exercise_demonstrations (
  exercise_id text primary key references public.exercise_catalog(id) on delete cascade,
  url text not null,
  provider text not null check (provider in ('youtube', 'vimeo')),
  credit text not null check (char_length(trim(credit)) between 1 and 120),
  license text not null check (char_length(trim(license)) between 1 and 240),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint exercise_demonstrations_approved_video_url_check check (
    (provider = 'youtube' and url ~* '^https://(www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}([&].*)?|youtu[.]be/[A-Za-z0-9_-]{11}([?].*)?)$')
    or (provider = 'vimeo' and url ~* '^https://(www[.]vimeo[.]com/[0-9]+|vimeo[.]com/[0-9]+)([?].*)?$')
  )
);

alter table public.exercise_demonstrations enable row level security;

create policy "Authenticated users can read approved exercise demonstrations"
  on public.exercise_demonstrations for select to authenticated using (true);

revoke all on public.exercise_demonstrations from public, anon, authenticated;
grant select on public.exercise_demonstrations to authenticated;
grant all on public.exercise_demonstrations to service_role;

commit;
