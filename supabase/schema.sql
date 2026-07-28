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

create schema if not exists private;
revoke all on schema private from public;

-- Préservation des configs d'équipement indexées par emplacement (armorConfig,
-- jewelConfig). Une ancienne PWA omet la clé entière ; on ne restaure alors que
-- les emplacements dont la pièce équipée n'a pas changé. Restaurer l'objet
-- complet attacherait une config périmée à une pièce qu'elle ne décrit plus.
-- Renvoie NULL quand il n'y a rien à préserver, pour que l'appelant n'écrive pas.
create or replace function private.preserved_gear_config(
  p_old jsonb,
  p_new jsonb,
  p_gear_key text,
  p_config_key text
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_slot text;
  v_kept jsonb := '{}'::jsonb;
begin
  if p_old is null or p_new is null then
    return null;
  end if;
  -- Le client connaît la clé : sa valeur fait foi, même vide.
  if p_new ? p_config_key then
    return null;
  end if;
  if not (p_old ? p_config_key) then
    return null;
  end if;
  if jsonb_typeof(p_old -> p_config_key) <> 'object' then
    return null;
  end if;

  for v_slot in select jsonb_object_keys(p_old -> p_config_key)
  loop
    if nullif(p_new -> p_gear_key ->> v_slot, '') is not null
       and p_new -> p_gear_key ->> v_slot
           is not distinct from p_old -> p_gear_key ->> v_slot
    then
      v_kept := v_kept || jsonb_build_object(v_slot, p_old -> p_config_key -> v_slot);
    end if;
  end loop;

  if v_kept = '{}'::jsonb then
    return null;
  end if;
  return v_kept;
end;
$$;

-- Empêche une ancienne PWA, qui omet weaponConfig, d'effacer la saisie récente.
create or replace function private.preserve_roster_weapon_configs()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_type text;
  v_old_build jsonb;
  v_new_build jsonb;
  v_kept jsonb;
begin
  if jsonb_typeof(new.builds) <> 'object' then
    return new;
  end if;

  for v_type in select jsonb_object_keys(new.builds)
  loop
    v_old_build := old.builds -> v_type;
    v_new_build := new.builds -> v_type;
    if jsonb_typeof(v_old_build) = 'object'
       and jsonb_typeof(v_new_build) = 'object'
       and not (v_new_build ? 'weaponConfig')
       and v_old_build ? 'weaponConfig'
       and nullif(v_new_build->>'weapon', '') is not null
       and v_new_build->>'weapon' is not distinct from v_old_build->>'weapon'
    then
      new.builds := jsonb_set(
        new.builds,
        array[v_type, 'weaponConfig'],
        v_old_build->'weaponConfig',
        true
      );
    end if;

    v_kept := private.preserved_gear_config(
      v_old_build, v_new_build, 'armor', 'armorConfig'
    );
    if v_kept is not null then
      new.builds := jsonb_set(
        new.builds, array[v_type, 'armorConfig'], v_kept, true
      );
    end if;

    v_kept := private.preserved_gear_config(
      v_old_build, v_new_build, 'jewel', 'jewelConfig'
    );
    if v_kept is not null then
      new.builds := jsonb_set(
        new.builds, array[v_type, 'jewelConfig'], v_kept, true
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists preserve_roster_weapon_configs on public.roster_characters;
create trigger preserve_roster_weapon_configs
before update of builds on public.roster_characters
for each row execute function private.preserve_roster_weapon_configs();

create or replace function private.preserve_team_weapon_configs()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_index integer;
  v_old_hero jsonb;
  v_new_hero jsonb;
  v_kept jsonb;
begin
  if jsonb_typeof(new.data->'heroes') <> 'array' then
    return new;
  end if;

  for v_index in 0 .. jsonb_array_length(new.data->'heroes') - 1
  loop
    v_old_hero := old.data->'heroes'->v_index;
    v_new_hero := new.data->'heroes'->v_index;
    if jsonb_typeof(v_old_hero) = 'object'
       and jsonb_typeof(v_new_hero) = 'object'
       and not (v_new_hero ? 'weaponConfig')
       and v_old_hero ? 'weaponConfig'
       and nullif(v_new_hero->>'weapon', '') is not null
       and v_new_hero->>'char' is not distinct from v_old_hero->>'char'
       and v_new_hero->>'weapon' is not distinct from v_old_hero->>'weapon'
    then
      new.data := jsonb_set(
        new.data,
        array['heroes', v_index::text, 'weaponConfig'],
        v_old_hero->'weaponConfig',
        true
      );
    end if;

    /* Les pièces ne sont préservées que si le héros du slot n'a pas changé :
       sinon on collerait l'équipement d'un héros sur un autre. */
    if v_new_hero->>'char' is not distinct from v_old_hero->>'char' then
      v_kept := private.preserved_gear_config(
        v_old_hero, v_new_hero, 'armor', 'armorConfig'
      );
      if v_kept is not null then
        new.data := jsonb_set(
          new.data, array['heroes', v_index::text, 'armorConfig'], v_kept, true
        );
      end if;

      v_kept := private.preserved_gear_config(
        v_old_hero, v_new_hero, 'jewel', 'jewelConfig'
      );
      if v_kept is not null then
        new.data := jsonb_set(
          new.data, array['heroes', v_index::text, 'jewelConfig'], v_kept, true
        );
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists preserve_team_weapon_configs on public.teams;
create trigger preserve_team_weapon_configs
before update of data on public.teams
for each row execute function private.preserve_team_weapon_configs();

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
  created_by   uuid references auth.users(id) on delete set null,
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
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.boss_sessions(id) on delete restrict,
  owner        uuid references auth.users(id) on delete set null,
  pseudo       text,
  element      text,               -- élément assigné
  team_id      uuid,               -- équipe utilisée (référence libre vers teams.id)
  damage       bigint,             -- dégâts (suivi après)
  participated boolean not null default false,
  updated_at   timestamptz not null default now(),
  constraint boss_participation_session_owner_key unique (session_id, owner)
);
alter table public.boss_participation add column if not exists team_snapshot jsonb;

create table if not exists public.boss_run_reports (
  session_id         uuid primary key
                     references public.boss_sessions(id) on delete restrict,
  global_score       bigint not null check (global_score > 0),
  note               text not null default ''
                     check (char_length(note) <= 1000),
  created_by         uuid references auth.users(id) on delete set null,
  created_by_pseudo  text not null,
  created_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null,
  updated_by_pseudo  text,
  updated_at         timestamptz
);

-- Migration non destructive des archives de boss :
-- - les comptes supprimés sont anonymisés sans retirer sessions/participations ;
-- - une identité technique remplace la clé métier devenue nullable ;
-- - les liens d'archive interdisent toute suppression en cascade d'une session.
alter table public.boss_sessions
  alter column created_by drop not null;
alter table public.boss_sessions
  drop constraint if exists boss_sessions_created_by_fkey;
alter table public.boss_sessions
  add constraint boss_sessions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.boss_participation
  add column if not exists id uuid;
alter table public.boss_participation
  alter column id set default gen_random_uuid();
update public.boss_participation
   set id = gen_random_uuid()
 where id is null;
alter table public.boss_participation
  alter column id set not null;

do $$
declare
  v_primary_key name;
  v_id_attribute smallint;
begin
  select attnum::smallint
    into v_id_attribute
    from pg_attribute
   where attrelid = 'public.boss_participation'::regclass
     and attname = 'id'
     and not attisdropped;

  select conname
    into v_primary_key
    from pg_constraint
   where conrelid = 'public.boss_participation'::regclass
     and contype = 'p';

  if v_primary_key is not null and not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.boss_participation'::regclass
       and contype = 'p'
       and conkey = array[v_id_attribute]::smallint[]
  ) then
    execute format(
      'alter table public.boss_participation drop constraint %I',
      v_primary_key
    );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.boss_participation'::regclass
       and contype = 'p'
       and conkey = array[v_id_attribute]::smallint[]
  ) then
    alter table public.boss_participation
      add constraint boss_participation_pkey primary key (id);
  end if;
end
$$;

alter table public.boss_participation
  alter column owner drop not null;
alter table public.boss_participation
  drop constraint if exists boss_participation_owner_fkey;
alter table public.boss_participation
  add constraint boss_participation_owner_fkey
  foreign key (owner) references auth.users(id) on delete set null;
alter table public.boss_participation
  drop constraint if exists boss_participation_session_id_fkey;
alter table public.boss_participation
  add constraint boss_participation_session_id_fkey
  foreign key (session_id) references public.boss_sessions(id) on delete restrict;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.boss_participation'::regclass
       and conname = 'boss_participation_session_owner_key'
       and contype = 'u'
  ) then
    alter table public.boss_participation
      add constraint boss_participation_session_owner_key
      unique (session_id, owner);
  end if;
end
$$;

alter table public.boss_run_reports
  drop constraint if exists boss_run_reports_session_id_fkey;
alter table public.boss_run_reports
  add constraint boss_run_reports_session_id_fkey
  foreign key (session_id) references public.boss_sessions(id) on delete restrict;

create index if not exists boss_participation_session_idx on public.boss_participation(session_id);

alter table public.boss_sessions      enable row level security;
alter table public.boss_participation enable row level security;
alter table public.boss_run_reports   enable row level security;

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
  v_member_count integer;
  v_week_count integer;
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
    into v_member_count
    from public.boss_participation
   where session_id = p_session_id;

  if v_member_count >= 5 then
    raise exception 'GROUP_FULL' using errcode = 'P0001';
  end if;

  select count(*)
    into v_week_count
    from public.boss_participation bp
    join public.boss_sessions bs on bs.id = bp.session_id
   where bp.owner = v_owner
     and bs.week_start = v_week;

  if v_week_count >= 3 then
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

create or replace function public.select_boss_team(
  p_session_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_week date;
  v_status text;
  v_snapshot jsonb;
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
  if not exists (
    select 1 from public.boss_participation
     where session_id = p_session_id
       and owner = v_owner
  ) then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
           'id', t.id,
           'owner', t.owner,
           'pseudo', t.pseudo,
           'data', t.data,
           'createdAt', t.created_at,
           'updatedAt', t.updated_at,
           'capturedAt', now()
         )
    into v_snapshot
    from public.teams t
   where t.id = p_team_id
     and t.owner = v_owner;

  if v_snapshot is null then
    raise exception 'TEAM_NOT_OWNED' using errcode = 'P0001';
  end if;

  update public.boss_participation
     set team_id = p_team_id,
         team_snapshot = v_snapshot,
         updated_at = now()
   where session_id = p_session_id
     and owner = v_owner;

  if not found then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.complete_boss_run_with_report(
  p_session_id uuid,
  p_global_score bigint,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_run public.boss_sessions%rowtype;
  v_member_count bigint;
  v_missing_count bigint;
  v_missing_names text;
  v_pseudo text;
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

  select count(*),
         count(*) filter (where team_snapshot is null),
         string_agg(pseudo, ', ') filter (where team_snapshot is null)
    into v_member_count, v_missing_count, v_missing_names
    from public.boss_participation
   where session_id = p_session_id;

  if v_run.status <> 'open' then
    raise exception 'RUN_ARCHIVED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.boss_participation
     where session_id = p_session_id and owner = v_owner
  ) then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
  end if;
  if v_member_count < 1 then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
  end if;
  if v_member_count > 5 then
    raise exception 'GROUP_OVER_CAPACITY' using errcode = 'P0001';
  end if;
  if v_missing_count > 0 then
    raise exception 'TEAM_REQUIRED:%', coalesce(v_missing_names, 'Membre')
      using errcode = 'P0001';
  end if;
  if p_global_score is null or p_global_score <= 0 then
    raise exception 'INVALID_SCORE' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
  end if;

  select nullif(trim(pseudo), '')
    into v_pseudo
    from public.profiles
   where id = v_owner;

  insert into public.boss_run_reports(
    session_id, global_score, note, created_by, created_by_pseudo, created_at
  )
  values (
    p_session_id, p_global_score, btrim(coalesce(p_note, '')),
    v_owner, coalesce(v_pseudo, 'Membre'), now()
  );

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

create or replace function public.update_boss_run_report(
  p_session_id uuid,
  p_global_score bigint,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_report_session_id uuid;
  v_run_status text;
  v_pseudo text;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select session_id
    into v_report_session_id
    from public.boss_run_reports
   where session_id = p_session_id
   for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select status
    into v_run_status
    from public.boss_sessions
   where id = v_report_session_id;

  if v_run_status <> 'archived' then
    raise exception 'RUN_NOT_ARCHIVED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from public.boss_participation
     where session_id = p_session_id
       and owner = v_owner
  ) then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
  end if;
  if p_global_score is null or p_global_score <= 0 then
    raise exception 'INVALID_SCORE' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
  end if;

  select nullif(trim(pseudo), '')
    into v_pseudo
    from public.profiles
   where id = v_owner;

  update public.boss_run_reports
     set global_score = p_global_score,
         note = btrim(coalesce(p_note, '')),
         updated_by = v_owner,
         updated_by_pseudo = coalesce(v_pseudo, 'Membre'),
         updated_at = now()
   where session_id = p_session_id;
end;
$$;

create or replace function public.complete_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'REPORT_REQUIRED' using errcode = 'P0001';
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

drop policy if exists boss_reports_read on public.boss_run_reports;
create policy boss_reports_read
  on public.boss_run_reports
  for select to authenticated using (true);

revoke all on function public.join_boss_run(uuid) from public;
revoke all on function public.leave_boss_run(uuid) from public;
revoke all on function public.complete_boss_run(uuid) from public;
revoke all on function public.select_boss_team(uuid, uuid) from public;
revoke all on function public.complete_boss_run_with_report(uuid, bigint, text) from public;
revoke all on function public.update_boss_run_report(uuid, bigint, text) from public;
grant execute on function public.join_boss_run(uuid) to authenticated;
grant execute on function public.leave_boss_run(uuid) to authenticated;
grant execute on function public.complete_boss_run(uuid) to authenticated;
grant execute on function public.select_boss_team(uuid, uuid) to authenticated;
grant execute on function public.complete_boss_run_with_report(uuid, bigint, text) to authenticated;
grant execute on function public.update_boss_run_report(uuid, bigint, text) to authenticated;

-- ============================ Realtime ============================
-- Chaque table est vérifiée séparément pour que le schéma complet reste rejouable.
do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'profiles',
    'teams',
    'roster_characters',
    'boss_sessions',
    'boss_participation',
    'boss_run_reports'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end
$$;
