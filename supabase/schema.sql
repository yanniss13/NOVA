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

-- 4) Roster persistant : un personnage par membre, avec un build par type d'arme
create table if not exists public.roster_characters (
  owner          uuid not null references auth.users(id) on delete cascade,
  char_id        text not null,
  potential_tier smallint not null default 0 check (potential_tier between 0 and 10),
  builds         jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (owner, char_id)
);
create index if not exists roster_characters_owner_idx
  on public.roster_characters(owner);

-- ============================ RLS (sécurité) ============================
alter table public.profiles    enable row level security;
alter table public.teams       enable row level security;
alter table public.recensement enable row level security;
alter table public.roster_characters enable row level security;

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

-- roster : lecture par tout membre ; ecriture/suppression de SON roster
drop policy if exists roster_read   on public.roster_characters;
drop policy if exists roster_insert on public.roster_characters;
drop policy if exists roster_update on public.roster_characters;
drop policy if exists roster_delete on public.roster_characters;
create policy roster_read   on public.roster_characters for select to authenticated using (true);
create policy roster_insert on public.roster_characters for insert to authenticated with check (owner = auth.uid());
create policy roster_update on public.roster_characters for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy roster_delete on public.roster_characters for delete to authenticated using (owner = auth.uid());

-- 5) Sessions de boss de guilde (assignation + suivi)
create table if not exists public.boss_sessions (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  boss_name    text,
  session_date date,
  elements     text[] not null default '{}',   -- éléments visés (FIRE, ICE, …)
  status       text not null default 'open',    -- open | won | lost
  created_at   timestamptz not null default now()
);
create index if not exists boss_sessions_created_idx on public.boss_sessions(created_at desc);

-- Participation d'un membre à une session : assignation (avant) + résultat (après)
create table if not exists public.boss_participation (
  session_id   uuid not null references public.boss_sessions(id) on delete cascade,
  owner        uuid not null references auth.users(id) on delete cascade,
  pseudo       text,
  element      text,               -- élément assigné
  team_id      uuid,               -- équipe utilisée (référence libre vers teams.id)
  damage       bigint,             -- dégâts (suivi après)
  participated boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (session_id, owner)
);
create index if not exists boss_participation_session_idx on public.boss_participation(session_id);

alter table public.boss_sessions      enable row level security;
alter table public.boss_participation enable row level security;

-- boss_sessions : lecture par tout membre ; écriture/suppression par le créateur
drop policy if exists boss_sessions_read   on public.boss_sessions;
drop policy if exists boss_sessions_insert on public.boss_sessions;
drop policy if exists boss_sessions_update on public.boss_sessions;
drop policy if exists boss_sessions_delete on public.boss_sessions;
create policy boss_sessions_read   on public.boss_sessions for select to authenticated using (true);
create policy boss_sessions_insert on public.boss_sessions for insert to authenticated with check (created_by = auth.uid());
create policy boss_sessions_update on public.boss_sessions for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy boss_sessions_delete on public.boss_sessions for delete to authenticated using (created_by = auth.uid());

-- boss_participation : lecture par tout membre ; chacun écrit SA propre ligne
drop policy if exists boss_part_read   on public.boss_participation;
drop policy if exists boss_part_insert on public.boss_participation;
drop policy if exists boss_part_update on public.boss_participation;
drop policy if exists boss_part_delete on public.boss_participation;
create policy boss_part_read   on public.boss_participation for select to authenticated using (true);
create policy boss_part_insert on public.boss_participation for insert to authenticated with check (owner = auth.uid());
create policy boss_part_update on public.boss_participation for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy boss_part_delete on public.boss_participation for delete to authenticated using (owner = auth.uid());
