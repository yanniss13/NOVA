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

-- 5) Sessions de boss de guilde : 6 GROUPES auto-créés chaque semaine (reset lundi 9h).
--    Les membres rejoignent un ou plusieurs groupes (boss_participation).
-- Une ligne boss_sessions represente une run precise, et non un groupe permanent.
create table if not exists public.boss_sessions (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  boss_name    text,
  session_date date,
  week_start   date,                             -- nullable pour les lignes historiques ; policy/RPC strictes
  slot         int,                              -- n° de groupe (1..6)
  elements     text[] not null default '{}',   -- (héritage) éléments visés
  status       text not null default 'open',    -- open | won | lost | archived
  run_no       integer not null default 1,      -- run du groupe pendant la semaine
  completed_at timestamptz,                     -- fin definitive de cette run
  remind_at    timestamptz,                      -- rappel Discord auto (optionnel)
  reminded_at  timestamptz,                      -- horodatage de l'envoi du rappel
  created_at   timestamptz not null default now()
);
-- Colonnes ajoutées aussi pour les bases déjà créées (idempotent) :
alter table public.boss_sessions add column if not exists remind_at   timestamptz;
alter table public.boss_sessions add column if not exists reminded_at timestamptz;
alter table public.boss_sessions add column if not exists week_start  date;
alter table public.boss_sessions add column if not exists slot        int;
alter table public.boss_sessions add column if not exists run_no       integer not null default 1;
alter table public.boss_sessions add column if not exists completed_at timestamptz;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.current_boss_week_start()
returns date
language sql
stable
set search_path = pg_catalog
as $$
  with paris as (
    select now() at time zone 'Europe/Paris' as local_now
  )
  select (
    local_now::date
    - (extract(isodow from local_now)::integer - 1)
    - case
        when extract(isodow from local_now) = 1
         and local_now::time < time '09:00'
        then 7
        else 0
      end
  )::date
  from paris;
$$;

grant usage on schema private to authenticated;
revoke all on function private.current_boss_week_start() from public;
grant execute on function private.current_boss_week_start() to authenticated;

create index if not exists boss_sessions_created_idx on public.boss_sessions(created_at desc);
-- Un seul groupe N par semaine : sert de cible au "upsert" côté appli (anti-doublon).
drop index if exists public.boss_sessions_week_slot_idx;
create unique index if not exists boss_sessions_week_slot_run_idx
  on public.boss_sessions(week_start, slot, run_no);
create unique index if not exists boss_sessions_one_open_slot_idx
  on public.boss_sessions(week_start, slot)
  where status = 'open';

-- Appartenance d'un membre à un groupe (rejoindre / quitter). "Juste rejoindre".
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

create or replace function public.join_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_week date;
  v_status text;
  v_count integer;
  v_pseudo text;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select week_start, status
    into v_week, v_status
    from public.boss_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_week is null then
    raise exception 'RUN_INVALID_WEEK' using errcode = 'P0001';
  end if;
  if v_week <> private.current_boss_week_start() then
    raise exception 'RUN_INVALID_WEEK' using errcode = 'P0001';
  end if;
  if v_status <> 'open' then
    raise exception 'RUN_ARCHIVED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.boss_participation
     where session_id = p_session_id and owner = v_owner
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_owner::text || ':' || v_week::text, 0)
  );

  select count(*)
    into v_count
    from public.boss_participation bp
    join public.boss_sessions bs on bs.id = bp.session_id
   where bp.owner = v_owner
     and bs.week_start = v_week;

  if v_count >= 3 then
    raise exception 'RUN_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select nullif(trim(pseudo), '')
    into v_pseudo
    from public.profiles
   where id = v_owner;

  insert into public.boss_participation(session_id, owner, pseudo, updated_at)
  values (p_session_id, v_owner, coalesce(v_pseudo, 'Membre'), now())
  on conflict (session_id, owner) do nothing;
end;
$$;

create or replace function public.leave_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_week date;
  v_status text;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select week_start, status
    into v_week, v_status
    from public.boss_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_week is null then
    raise exception 'RUN_INVALID_WEEK' using errcode = 'P0001';
  end if;
  if v_week <> private.current_boss_week_start() then
    raise exception 'RUN_INVALID_WEEK' using errcode = 'P0001';
  end if;
  if v_status <> 'open' then
    raise exception 'RUN_ARCHIVED' using errcode = 'P0001';
  end if;

  delete from public.boss_participation
   where session_id = p_session_id
     and owner = v_owner;
end;
$$;

create or replace function public.complete_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_run public.boss_sessions%rowtype;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select *
    into v_run
    from public.boss_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_run.week_start is null then
    raise exception 'RUN_INVALID_WEEK' using errcode = 'P0001';
  end if;
  if v_run.week_start <> private.current_boss_week_start() then
    raise exception 'RUN_INVALID_WEEK' using errcode = 'P0001';
  end if;
  if v_run.status <> 'open' then
    return;
  end if;
  if not exists (
    select 1 from public.boss_participation
     where session_id = p_session_id
       and owner = v_owner
  ) then
    raise exception 'RUN_MEMBERS_ONLY' using errcode = 'P0001';
  end if;

  update public.boss_sessions
     set status = 'archived',
         completed_at = now()
   where id = p_session_id;

  insert into public.boss_sessions(
    created_by, title, boss_name, session_date, week_start, slot,
    run_no, elements, status, created_at
  )
  values (
    v_owner, 'Groupe ' || v_run.slot, v_run.boss_name, v_run.session_date,
    v_run.week_start, v_run.slot, v_run.run_no + 1, v_run.elements, 'open', now()
  )
  on conflict (week_start, slot, run_no) do nothing;
end;
$$;

-- boss_sessions : lecture par tout membre ; seules les six seeds courantes sont insérables directement.
drop policy if exists boss_sessions_read   on public.boss_sessions;
drop policy if exists boss_sessions_insert on public.boss_sessions;
drop policy if exists boss_sessions_update on public.boss_sessions;
drop policy if exists boss_sessions_delete on public.boss_sessions;
create policy boss_sessions_read   on public.boss_sessions for select to authenticated using (true);
create policy boss_sessions_insert
  on public.boss_sessions
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and week_start is not null
    and week_start = private.current_boss_week_start()
    and run_no = 1
    and slot between 1 and 6
    and title = 'Groupe ' || slot
    and boss_name = 'Akumu, bête démoniaque'
    and session_date = week_start
    and elements = '{}'::text[]
    and status = 'open'
    and completed_at is null
    and remind_at is null
    and reminded_at is null
  );

-- boss_participation : lecture par tout membre ; chacun écrit SA propre ligne
drop policy if exists boss_part_read   on public.boss_participation;
drop policy if exists boss_part_insert on public.boss_participation;
drop policy if exists boss_part_update on public.boss_participation;
drop policy if exists boss_part_delete on public.boss_participation;
create policy boss_part_read   on public.boss_participation for select to authenticated using (true);

revoke all on function public.join_boss_run(uuid) from public;
revoke all on function public.leave_boss_run(uuid) from public;
revoke all on function public.complete_boss_run(uuid) from public;
grant execute on function public.join_boss_run(uuid) to authenticated;
grant execute on function public.leave_boss_run(uuid) to authenticated;
grant execute on function public.complete_boss_run(uuid) to authenticated;
