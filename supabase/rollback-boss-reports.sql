-- Retour arrière fonctionnel pour une ancienne interface.
-- Les tables, colonnes, instantanés et rapports restent intacts.
-- Attention : ce script ouvre une fenêtre de compatibilité. Les onglets et
-- PWA récents perdent aussitôt les nouvelles RPC et affichent le message de
-- maintenance jusqu’au déploiement puis à l’activation du frontend restauré.
begin;

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

revoke all on function public.select_boss_team(uuid, uuid) from authenticated;
revoke all on function public.complete_boss_run_with_report(uuid, bigint, text) from authenticated;
revoke all on function public.update_boss_run_report(uuid, bigint, text) from authenticated;
revoke all on function public.complete_boss_run(uuid) from public;
grant execute on function public.complete_boss_run(uuid) to authenticated;

commit;
