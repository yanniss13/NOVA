-- =============================================================================
--  Confrérie 7DS — schéma Supabase (Étape 1 : comptes + partage)
--  À COLLER dans Supabase -> SQL Editor -> Run.  Idempotent (re-jouable).
--  Auth choisie : email + mot de passe, SANS confirmation email.
-- =============================================================================

-- 1) Profils : un pseudo par membre (lié au compte auth)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  pseudo     text not null,
  created_at timestamptz not null default now()
);

-- 2) Équipes : partagées (tout membre les voit), possédées par un membre
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  pseudo     text,
  data       jsonb not null,          -- l'équipe complète (heroes[4] + builds)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists teams_owner_idx on public.teams(owner);

-- 3) Recensement DPS : une ligne par membre
create table if not exists public.recensement (
  owner      uuid primary key references auth.users(id) on delete cascade,
  pseudo     text,
  dps        jsonb not null default '[]'::jsonb,  -- [{char, element, pot}]
  updated_at timestamptz not null default now()
);

-- ============================ RLS (sécurité) ============================
alter table public.profiles    enable row level security;
alter table public.teams       enable row level security;
alter table public.recensement enable row level security;

-- profiles : lecture par tout membre connecté ; on gère uniquement le sien
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid());

-- teams : lecture par tout membre ; écriture/suppression de SES équipes
drop policy if exists teams_read   on public.teams;
drop policy if exists teams_insert on public.teams;
drop policy if exists teams_update on public.teams;
drop policy if exists teams_delete on public.teams;
create policy teams_read   on public.teams for select to authenticated using (true);
create policy teams_insert on public.teams for insert to authenticated with check (owner = auth.uid());
create policy teams_update on public.teams for update to authenticated using (owner = auth.uid());
create policy teams_delete on public.teams for delete to authenticated using (owner = auth.uid());

-- recensement : lecture par tout membre ; écriture de SON recensement
drop policy if exists rec_read   on public.recensement;
drop policy if exists rec_insert on public.recensement;
drop policy if exists rec_update on public.recensement;
drop policy if exists rec_delete on public.recensement;
create policy rec_read   on public.recensement for select to authenticated using (true);
create policy rec_insert on public.recensement for insert to authenticated with check (owner = auth.uid());
create policy rec_update on public.recensement for update to authenticated using (owner = auth.uid());
create policy rec_delete on public.recensement for delete to authenticated using (owner = auth.uid());
