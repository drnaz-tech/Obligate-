alter table public.case_solutions add column hints jsonb not null default '[]'::jsonb;

create or replace function public.gen_code(p_len int default 6)
returns text language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
begin
  for i in 1..p_len loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end;
$$;

create or replace function public.codes_subset(p_need text[], p_have text[])
returns boolean language sql immutable as $$
  select not exists (select 1 from unnest(p_need) c where not (c = any(p_have)));
$$;

create or replace function public.has_active_group_plan(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = p_user and g.plan = 'group'
  );
$$;

create or replace function public.has_personal_plan(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.owner_id = p_user and s.scope = 'personal' and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create or replace function public.get_daily_case()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_idx int;
  v_count int;
  v_case public.cases;
begin
  select count(*) into v_count from public.cases where kind = 'daily' and status = 'published';
  if v_count = 0 then
    return jsonb_build_object('day', v_day, 'next_reset', ((v_day + 1)::timestamp at time zone 'utc'), 'case', null);
  end if;
  v_idx := (((v_day - date '2026-01-01') % v_count) + v_count) % v_count;
  select * into v_case from public.cases
    where kind = 'daily' and status = 'published'
    order by daily_order, created_at limit 1 offset v_idx;
  return jsonb_build_object(
    'day', v_day,
    'next_reset', ((v_day + 1)::timestamp at time zone 'utc'),
    'case', jsonb_build_object(
      'id', v_case.id, 'slug', v_case.slug, 'title', v_case.title, 'setting', v_case.setting,
      'premise', v_case.premise, 'difficulty', v_case.difficulty,
      'est_minutes', v_case.est_minutes, 'questions', v_case.questions
    )
  );
end;
$$;

create or replace function public.get_entitlements()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_used int;
  v_group uuid;
  v_group_plan boolean;
  v_personal boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*) into v_used from public.rooms
    where host_id = v_uid and mode = 'private'
      and created_at >= ((now() at time zone 'utc')::date::timestamp at time zone 'utc');
  select gm.group_id into v_group from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.user_id = v_uid and g.plan = 'group' limit 1;
  v_group_plan := v_group is not null;
  v_personal := public.has_personal_plan(v_uid);
  return jsonb_build_object(
    'plan', case when v_group_plan then 'group' when v_personal then 'solo' else 'free' end,
    'private_rooms_used', v_used,
    'private_rooms_limit', case when v_group_plan or v_personal then null else 3 end,
    'group_plan', v_group_plan,
    'group_id', v_group,
    'personal_plan', v_personal
  );
end;
$$;

create or replace function public.create_room(p_case_id uuid, p_mode text default 'private', p_group_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_case public.cases;
  v_room public.rooms;
  v_code text;
  v_used int;
  v_unlimited boolean;
  v_attempt int := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_case from public.cases where id = p_case_id and status = 'published';
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  if v_case.group_only then
    if p_group_id is null or not public.is_group_member(p_group_id) or not public.has_group_plan(p_group_id) then
      raise exception 'GROUP_PLAN_REQUIRED';
    end if;
  end if;
  if p_mode = 'private' then
    v_unlimited := public.has_active_group_plan(v_uid) or public.has_personal_plan(v_uid);
    if not v_unlimited then
      select count(*) into v_used from public.rooms
        where host_id = v_uid and mode = 'private'
          and created_at >= ((now() at time zone 'utc')::date::timestamp at time zone 'utc');
      if v_used >= 3 then raise exception 'FREE_ROOM_LIMIT'; end if;
    end if;
  end if;
  loop
    v_code := public.gen_code(6);
    exit when not exists (select 1 from public.rooms where code = v_code);
    v_attempt := v_attempt + 1;
    if v_attempt > 12 then raise exception 'CODE_GENERATION_FAILED'; end if;
  end loop;
  insert into public.rooms (code, host_id, case_id, mode, campaign_id, chapter_number, group_id)
  values (v_code, v_uid, p_case_id, p_mode, v_case.campaign_id, v_case.chapter_number, p_group_id)
  returning * into v_room;
  insert into public.room_players (room_id, user_id, slot) values (v_room.id, v_uid, 'A');
  insert into public.room_events (room_id, user_id, kind, body)
  values (v_room.id, v_uid, 'system', 'Room opened. Waiting for a second detective.');
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
end;
$$;

create or replace function public.join_room(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_blocked boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.rooms where code = upper(trim(p_code));
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_id = v_uid then return jsonb_build_object('room_id', v_room.id, 'code', v_room.code); end if;
  if v_room.guest_id is not null and v_room.guest_id <> v_uid then raise exception 'ROOM_FULL'; end if;
  if v_room.status = 'finished' then raise exception 'ROOM_FINISHED'; end if;
  if v_room.status = 'abandoned' then raise exception 'ROOM_ABANDONED'; end if;
  if v_room.expires_at < now() and v_room.status = 'lobby' then raise exception 'INVITE_EXPIRED'; end if;
  select exists (select 1 from public.blocks where blocker_id = v_room.host_id and blocked_id = v_uid) into v_blocked;
  if v_blocked then raise exception 'ROOM_UNAVAILABLE'; end if;
  update public.rooms set guest_id = v_uid, expires_at = now() + interval '6 hours' where id = v_room.id;
  insert into public.room_players (room_id, user_id, slot) values (v_room.id, v_uid, 'B')
    on conflict (room_id, user_id) do nothing;
  insert into public.room_events (room_id, user_id, kind, body)
  values (v_room.id, v_uid, 'system', 'Second detective joined the room.');
  insert into public.notifications (user_id, kind, title, body, link)
  values (v_room.host_id, 'partner_joined', 'Your partner is in', 'Both halves of the dossier are now in play.', '/room/' || v_room.id);
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
end;
$$;

create or replace function public.get_room_state(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_me public.room_players;
  v_partner public.room_players;
  v_partner_profile public.profiles;
  v_case public.cases;
  v_evidence jsonb;
  v_shared jsonb;
  v_events jsonb;
  v_links jsonb;
  v_partner_total int;
  v_partner_shared int;
  v_elapsed int;
  v_result jsonb;
  v_online boolean;
  v_partner_slot text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.host_id <> v_uid and coalesce(v_room.guest_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_uid then
    raise exception 'NOT_A_MEMBER';
  end if;
  select * into v_me from public.room_players where room_id = p_room_id and user_id = v_uid;
  select * into v_partner from public.room_players where room_id = p_room_id and user_id <> v_uid limit 1;
  if v_partner.user_id is not null then
    select * into v_partner_profile from public.profiles where id = v_partner.user_id;
  end if;
  select * into v_case from public.cases where id = v_room.case_id;
  v_partner_slot := case when v_me.slot = 'A' then 'B' else 'A' end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'code', ce.code, 'player', ce.player, 'type', ce.type, 'title', ce.title,
      'body', ce.body, 'meta', ce.meta, 'sort_order', ce.sort_order
    ) order by ce.sort_order), '[]'::jsonb)
  into v_evidence
  from public.case_evidence ce
  where ce.case_id = v_room.case_id and ce.player = v_me.slot;

  select coalesce(jsonb_agg(x.item order by x.first_at), '[]'::jsonb) into v_shared
  from (
    select distinct on (ce.code)
      jsonb_build_object(
        'code', ce.code, 'player', ce.player, 'type', ce.type, 'title', ce.title,
        'body', ce.body, 'meta', ce.meta, 'shared_by', e.user_id, 'shared_at', e.created_at
      ) as item, e.created_at as first_at
    from public.room_events e
    join public.case_evidence ce on ce.case_id = v_room.case_id and ce.code = e.payload->>'code'
    where e.room_id = p_room_id and e.kind = 'share'
    order by ce.code, e.created_at
  ) x;

  select count(*) into v_partner_total from public.case_evidence
    where case_id = v_room.case_id and player = v_partner_slot;
  select count(distinct ce.code) into v_partner_shared
    from public.room_events e
    join public.case_evidence ce on ce.case_id = v_room.case_id and ce.code = e.payload->>'code'
    where e.room_id = p_room_id and e.kind = 'share' and ce.player = v_partner_slot;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'kind', e.kind, 'body', e.body, 'payload', e.payload,
      'user_id', e.user_id, 'created_at', e.created_at
    ) order by e.id), '[]'::jsonb)
  into v_events
  from (select * from public.room_events where room_id = p_room_id order by id desc limit 250) e;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'from_code', l.from_code, 'to_code', l.to_code, 'user_id', l.user_id
    )), '[]'::jsonb)
  into v_links
  from public.evidence_links l where l.room_id = p_room_id;

  v_elapsed := 0;
  if v_room.started_at is not null then
    v_elapsed := greatest(0, floor(extract(epoch from (
      coalesce(v_room.finished_at, now()) - v_room.started_at
    )) - (v_room.paused_ms / 1000.0)
      - case when v_room.paused_at is not null then extract(epoch from (now() - v_room.paused_at)) else 0 end)::int);
  end if;

  v_online := v_partner.user_id is not null and v_partner.last_seen_at > now() - interval '45 seconds';

  v_result := null;
  if v_room.status = 'finished' then
    select jsonb_build_object(
      'outcome', v_room.outcome,
      'attempts', v_room.attempts,
      'hints_used', v_room.hints_used,
      'duration_seconds', v_elapsed,
      'verdict', v_room.verdict,
      'solution', s.solution,
      'deduction_chain', s.deduction_chain,
      'narrative', s.narrative,
      'epilogue', s.epilogue
    ) into v_result
    from public.case_solutions s where s.case_id = v_room.case_id;
  end if;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id, 'code', v_room.code, 'status', v_room.status, 'mode', v_room.mode,
      'host_id', v_room.host_id, 'guest_id', v_room.guest_id, 'case_id', v_room.case_id,
      'attempts', v_room.attempts, 'hints_used', v_room.hints_used,
      'verdict', v_room.verdict, 'outcome', v_room.outcome,
      'started_at', v_room.started_at, 'finished_at', v_room.finished_at,
      'paused', v_room.paused_at is not null, 'expires_at', v_room.expires_at,
      'campaign_id', v_room.campaign_id, 'chapter_number', v_room.chapter_number,
      'group_id', v_room.group_id
    ),
    'me', jsonb_build_object(
      'slot', v_me.slot, 'ready', v_me.ready, 'notes', v_me.notes,
      'pinned', to_jsonb(v_me.pinned), 'suspicious', to_jsonb(v_me.suspicious)
    ),
    'partner', case when v_partner.user_id is null then null else jsonb_build_object(
      'id', v_partner.user_id, 'slot', v_partner.slot, 'ready', v_partner.ready,
      'detective_name', v_partner_profile.detective_name, 'avatar_seed', v_partner_profile.avatar_seed,
      'online', v_online
    ) end,
    'case', jsonb_build_object(
      'id', v_case.id, 'slug', v_case.slug, 'title', v_case.title, 'setting', v_case.setting,
      'premise', v_case.premise, 'difficulty', v_case.difficulty,
      'est_minutes', v_case.est_minutes, 'questions', v_case.questions,
      'kind', v_case.kind, 'chapter_number', v_case.chapter_number
    ),
    'evidence', v_evidence,
    'shared', v_shared,
    'partner_total', v_partner_total,
    'partner_shared', v_partner_shared,
    'events', v_events,
    'links', v_links,
    'elapsed_seconds', v_elapsed,
    'result', v_result
  );
end;
$$;

create or replace function public.set_ready(p_room_id uuid, p_ready boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_both boolean;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.status <> 'lobby' then raise exception 'ROOM_NOT_IN_LOBBY'; end if;
  update public.room_players set ready = p_ready, last_seen_at = now()
    where room_id = p_room_id and user_id = v_uid;
  select (bool_and(ready) and count(*) = 2) into v_both from public.room_players where room_id = p_room_id;
  if coalesce(v_both, false) then
    update public.rooms set status = 'active', started_at = now(), expires_at = now() + interval '6 hours'
      where id = p_room_id;
    insert into public.room_events (room_id, kind, body)
    values (p_room_id, 'system', 'Both detectives ready. The dossier is open.');
  end if;
  return jsonb_build_object('both_ready', coalesce(v_both, false));
end;
$$;

create or replace function public.heartbeat(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_partner public.room_players;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  update public.room_players set last_seen_at = now() where room_id = p_room_id and user_id = v_uid;
  update public.profiles set last_seen_at = now() where id = v_uid;
  select * into v_room from public.rooms where id = p_room_id;
  select * into v_partner from public.room_players where room_id = p_room_id and user_id <> v_uid limit 1;
  if v_room.status = 'active' and v_partner.user_id is not null then
    if v_room.paused_at is not null and v_partner.last_seen_at > now() - interval '30 seconds' then
      update public.rooms set paused_ms = paused_ms + (extract(epoch from (now() - paused_at)) * 1000)::bigint, paused_at = null
        where id = p_room_id;
      insert into public.room_events (room_id, kind, body) values (p_room_id, 'system', 'Partner reconnected. Clock running.');
    elsif v_room.paused_at is null and v_partner.last_seen_at < now() - interval '75 seconds' then
      update public.rooms set paused_at = now() where id = p_room_id;
      insert into public.room_events (room_id, kind, body) values (p_room_id, 'system', 'Partner dropped. Clock paused.');
    end if;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.save_player_state(p_room_id uuid, p_notes text, p_pinned text[], p_suspicious text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  update public.room_players
    set notes = coalesce(p_notes, notes),
        pinned = coalesce(p_pinned, pinned),
        suspicious = coalesce(p_suspicious, suspicious),
        last_seen_at = now()
    where room_id = p_room_id and user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.add_link(p_room_id uuid, p_from text, p_to text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  if p_from = p_to then raise exception 'SAME_ITEM'; end if;
  insert into public.evidence_links (room_id, user_id, from_code, to_code)
  values (p_room_id, v_uid, p_from, p_to)
  on conflict (room_id, user_id, from_code, to_code) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_link(p_link_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.evidence_links where id = p_link_id and (user_id = auth.uid() or public.is_admin());
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.share_evidence(p_room_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_me public.room_players;
  v_item public.case_evidence;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  select * into v_me from public.room_players where room_id = p_room_id and user_id = v_uid;
  select * into v_item from public.case_evidence where case_id = v_room.case_id and code = p_code;
  if v_item.id is null then raise exception 'EVIDENCE_NOT_FOUND'; end if;
  if v_item.player <> v_me.slot then raise exception 'NOT_YOUR_EVIDENCE'; end if;
  if exists (select 1 from public.room_events where room_id = p_room_id and kind = 'share' and payload->>'code' = p_code) then
    return jsonb_build_object('already_shared', true);
  end if;
  insert into public.room_events (room_id, user_id, kind, body, payload)
  values (p_room_id, v_uid, 'share', v_item.title, jsonb_build_object('code', p_code, 'player', v_item.player));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.send_message(p_room_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := btrim(coalesce(p_body, ''));
  v_recent int;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  if length(v_clean) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  if length(v_clean) > 1200 then raise exception 'MESSAGE_TOO_LONG'; end if;
  select count(*) into v_recent from public.room_events
    where room_id = p_room_id and user_id = v_uid and kind = 'chat' and created_at > now() - interval '20 seconds';
  if v_recent >= 12 then raise exception 'SLOW_DOWN'; end if;
  insert into public.room_events (room_id, user_id, kind, body) values (p_room_id, v_uid, 'chat', v_clean);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.propose_verdict(p_room_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  if v_room.attempts >= 3 then raise exception 'NO_ATTEMPTS_LEFT'; end if;
  update public.rooms set verdict = jsonb_build_object(
    'proposed_by', v_uid, 'answers', p_answers, 'proposed_at', now()
  ) where id = p_room_id;
  insert into public.room_events (room_id, user_id, kind, body, payload)
  values (p_room_id, v_uid, 'verdict_proposal', 'Proposed a joint accusation.', jsonb_build_object('answers', p_answers));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reject_verdict(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.verdict is null then raise exception 'NO_PROPOSAL'; end if;
  if (v_room.verdict->>'proposed_by')::uuid = v_uid then raise exception 'CANNOT_REJECT_OWN'; end if;
  update public.rooms set verdict = null where id = p_room_id;
  insert into public.room_events (room_id, user_id, kind, body)
  values (p_room_id, v_uid, 'verdict_reject', 'Rejected the accusation. Back to the board.');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.confirm_verdict(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_solution jsonb;
  v_answers jsonb;
  v_key text;
  v_correct boolean := true;
  v_attempts int;
  v_duration int;
  v_outcome text;
  v_pa uuid;
  v_pb uuid;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  if v_room.verdict is null then raise exception 'NO_PROPOSAL'; end if;
  if (v_room.verdict->>'proposed_by')::uuid = v_uid then raise exception 'PARTNER_MUST_CONFIRM'; end if;
  if v_room.attempts >= 3 then raise exception 'NO_ATTEMPTS_LEFT'; end if;

  v_answers := v_room.verdict->'answers';
  select solution into v_solution from public.case_solutions where case_id = v_room.case_id;
  for v_key in select jsonb_object_keys(v_solution) loop
    if (v_solution->>v_key) is distinct from (v_answers->>v_key) then v_correct := false; end if;
  end loop;

  v_attempts := v_room.attempts + 1;
  v_duration := greatest(0, floor(extract(epoch from (now() - v_room.started_at)) - (v_room.paused_ms / 1000.0))::int);
  v_outcome := case when v_correct then 'solved' when v_attempts >= 3 then 'failed' else null end;

  update public.rooms set
    attempts = v_attempts,
    verdict = jsonb_build_object('proposed_by', v_room.verdict->>'proposed_by', 'answers', v_answers,
      'confirmed_by', v_uid, 'correct', v_correct, 'submitted_at', now()),
    status = case when v_outcome is null then 'active' else 'finished' end,
    outcome = v_outcome,
    finished_at = case when v_outcome is null then null else now() end
  where id = p_room_id;

  insert into public.room_events (room_id, user_id, kind, body, payload)
  values (p_room_id, v_uid, 'verdict_confirm', 'Confirmed the joint accusation.',
    jsonb_build_object('correct', v_correct, 'attempt', v_attempts));

  if v_outcome is not null then
    v_pa := case when (select slot from public.room_players where room_id = p_room_id and user_id = v_room.host_id) = 'A' then v_room.host_id else v_room.guest_id end;
    v_pb := case when v_pa = v_room.host_id then v_room.guest_id else v_room.host_id end;
    insert into public.case_results (room_id, case_id, player_a, player_b, solved, duration_seconds, attempts, hints_used, verdict, mode, group_id)
    values (p_room_id, v_room.case_id, v_pa, v_pb, v_correct, v_duration, v_attempts, v_room.hints_used, v_answers, v_room.mode, v_room.group_id)
    on conflict (room_id) do nothing;
    if v_room.campaign_id is not null and v_correct then
      insert into public.campaign_progress (campaign_id, pair_key, player_a, player_b, chapters_completed, decisions)
      values (v_room.campaign_id, least(v_pa::text, v_pb::text) || ':' || greatest(v_pa::text, v_pb::text), v_pa, v_pb,
        coalesce(v_room.chapter_number, 1), jsonb_build_object(coalesce(v_room.chapter_number, 1)::text, v_answers))
      on conflict (campaign_id, pair_key) do update set
        chapters_completed = greatest(public.campaign_progress.chapters_completed, coalesce(v_room.chapter_number, 1)),
        decisions = public.campaign_progress.decisions || excluded.decisions,
        updated_at = now();
    end if;
    insert into public.room_events (room_id, kind, body)
    values (p_room_id, 'system', case when v_correct then 'Case closed. The truth holds.' else 'Three attempts spent. The file closes unsolved.' end);
  else
    update public.rooms set verdict = null where id = p_room_id;
  end if;

  return jsonb_build_object('correct', v_correct, 'attempts', v_attempts, 'outcome', v_outcome);
end;
$$;

create or replace function public.request_hint(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_hints jsonb;
  v_idx int;
  v_text text;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status <> 'active' then raise exception 'ROOM_NOT_ACTIVE'; end if;
  if v_room.hints_used >= 3 then raise exception 'NO_HINTS_LEFT'; end if;
  select hints into v_hints from public.case_solutions where case_id = v_room.case_id;
  v_idx := v_room.hints_used;
  if v_hints is null or jsonb_array_length(v_hints) <= v_idx then
    v_text := 'Compare what each of you was told about the same hour. One of you is repeating a claim, not a fact.';
  else
    v_text := v_hints->>v_idx;
  end if;
  update public.rooms set hints_used = hints_used + 1 where id = p_room_id;
  insert into public.room_events (room_id, user_id, kind, body, payload)
  values (p_room_id, v_uid, 'hint', v_text, jsonb_build_object('index', v_idx));
  return jsonb_build_object('hint', v_text, 'used', v_idx + 1);
end;
$$;

create or replace function public.abandon_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if not public.is_room_member(p_room_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.status = 'finished' then return jsonb_build_object('ok', true); end if;
  update public.rooms set status = 'abandoned', finished_at = now() where id = p_room_id;
  insert into public.room_events (room_id, user_id, kind, body)
  values (p_room_id, v_uid, 'system', 'Room abandoned.');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.join_matchmaking(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_other public.matchmaking_queue;
  v_room_id uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.matchmaking_queue where user_id = v_uid;
  select q.* into v_other from public.matchmaking_queue q
    where q.case_id = p_case_id and q.user_id <> v_uid
      and q.created_at > now() - interval '10 minutes'
      and not exists (select 1 from public.blocks b where (b.blocker_id = q.user_id and b.blocked_id = v_uid) or (b.blocker_id = v_uid and b.blocked_id = q.user_id))
    order by q.created_at limit 1 for update skip locked;
  if v_other.user_id is not null then
    loop
      v_code := public.gen_code(6);
      exit when not exists (select 1 from public.rooms where code = v_code);
    end loop;
    insert into public.rooms (code, host_id, guest_id, case_id, mode, status, started_at, expires_at)
    values (v_code, v_other.user_id, v_uid, p_case_id, 'matchmaking', 'active', now(), now() + interval '6 hours')
    returning id into v_room_id;
    insert into public.room_players (room_id, user_id, slot) values (v_room_id, v_other.user_id, 'A');
    insert into public.room_players (room_id, user_id, slot) values (v_room_id, v_uid, 'B');
    insert into public.room_events (room_id, kind, body) values (v_room_id, 'system', 'Matched. The dossier is open.');
    delete from public.matchmaking_queue where user_id in (v_other.user_id, v_uid);
    return jsonb_build_object('matched', true, 'room_id', v_room_id);
  end if;
  insert into public.matchmaking_queue (user_id, case_id) values (v_uid, p_case_id);
  return jsonb_build_object('matched', false);
end;
$$;

create or replace function public.poll_matchmaking()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.matchmaking_queue;
  v_room public.rooms;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.matchmaking_queue where user_id = v_uid;
  if v_row.user_id is null then return jsonb_build_object('state', 'idle'); end if;
  select * into v_room from public.rooms
    where (host_id = v_uid or guest_id = v_uid) and mode = 'matchmaking' and status = 'active'
    order by created_at desc limit 1;
  if v_room.id is not null then
    delete from public.matchmaking_queue where user_id = v_uid;
    return jsonb_build_object('state', 'matched', 'room_id', v_room.id);
  end if;
  return jsonb_build_object('state', 'waiting', 'since', v_row.created_at,
    'waiting_count', (select count(*) from public.matchmaking_queue where case_id = v_row.case_id));
end;
$$;

create or replace function public.leave_matchmaking()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.matchmaking_queue where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_leaderboard(p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t) order by t.duration_seconds), '[]'::jsonb) into v_rows
  from (
    select r.id, r.duration_seconds, r.attempts, r.hints_used, r.created_at,
      pa.detective_name as player_a_name, pa.avatar_seed as player_a_avatar,
      pb.detective_name as player_b_name, pb.avatar_seed as player_b_avatar
    from public.case_results r
    join public.profiles pa on pa.id = r.player_a
    join public.profiles pb on pb.id = r.player_b
    where r.case_id = p_case_id and r.solved = true
    order by r.duration_seconds asc
    limit 50
  ) t;
  return v_rows;
end;
$$;

create or replace function public.get_public_case_result(p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_case public.cases;
  v_sol public.case_solutions;
  v_unlocked boolean := false;
  v_uid uuid := auth.uid();
  v_count int;
  v_idx int;
  v_today_order int;
begin
  select * into v_case from public.cases where id = p_case_id and status = 'published';
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  if v_case.kind = 'daily' then
    select count(*) into v_count from public.cases where kind = 'daily' and status = 'published';
    if v_count > 0 then
      v_idx := ((((now() at time zone 'utc')::date - date '2026-01-01') % v_count) + v_count) % v_count;
      select daily_order into v_today_order from public.cases where kind='daily' and status='published' order by daily_order limit 1 offset v_idx;
      v_unlocked := coalesce(v_case.daily_order, 0) < coalesce(v_today_order, 0);
    end if;
  else
    v_unlocked := true;
  end if;
  if v_uid is not null and exists (
    select 1 from public.case_results r where r.case_id = p_case_id and (r.player_a = v_uid or r.player_b = v_uid)
  ) then
    v_unlocked := true;
  end if;
  select * into v_sol from public.case_solutions where case_id = p_case_id;
  return jsonb_build_object(
    'case', jsonb_build_object('id', v_case.id, 'slug', v_case.slug, 'title', v_case.title,
      'setting', v_case.setting, 'premise', v_case.premise, 'difficulty', v_case.difficulty,
      'kind', v_case.kind, 'questions', v_case.questions),
    'unlocked', v_unlocked,
    'solution', case when v_unlocked then v_sol.solution else null end,
    'deduction_chain', case when v_unlocked then v_sol.deduction_chain else null end,
    'narrative', case when v_unlocked then v_sol.narrative else null end,
    'leaderboard', public.get_leaderboard(p_case_id)
  );
end;
$$;

create or replace function public.get_my_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_total int;
  v_solved int;
  v_avg numeric;
  v_best int;
  v_streak int := 0;
  v_days date[];
  v_d date;
  v_prev date;
  v_hints int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*), count(*) filter (where solved), avg(duration_seconds) filter (where solved),
         min(duration_seconds) filter (where solved), coalesce(sum(hints_used), 0)
    into v_total, v_solved, v_avg, v_best, v_hints
  from public.case_results where player_a = v_uid or player_b = v_uid;
  select array_agg(distinct (created_at at time zone 'utc')::date order by (created_at at time zone 'utc')::date desc)
    into v_days from public.case_results
    where (player_a = v_uid or player_b = v_uid) and solved = true;
  if v_days is not null then
    v_prev := null;
    foreach v_d in array v_days loop
      if v_prev is null then
        if v_d >= (now() at time zone 'utc')::date - 1 then v_streak := 1; v_prev := v_d; else exit; end if;
      elsif v_prev - v_d = 1 then
        v_streak := v_streak + 1; v_prev := v_d;
      else
        exit;
      end if;
    end loop;
  end if;
  return jsonb_build_object(
    'cases_played', v_total, 'cases_solved', v_solved,
    'solve_rate', case when v_total > 0 then round((v_solved::numeric / v_total) * 100) else 0 end,
    'avg_seconds', coalesce(round(v_avg), 0), 'best_seconds', coalesce(v_best, 0),
    'streak', v_streak, 'hints_used', v_hints
  );
end;
$$;

create or replace function public.create_group(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_group public.groups;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_TOO_SHORT'; end if;
  loop
    v_code := public.gen_code(7);
    exit when not exists (select 1 from public.groups where invite_code = v_code);
  end loop;
  insert into public.groups (name, owner_id, invite_code) values (btrim(p_name), v_uid, v_code) returning * into v_group;
  insert into public.group_members (group_id, user_id, role) values (v_group.id, v_uid, 'owner');
  return jsonb_build_object('group_id', v_group.id, 'invite_code', v_group.invite_code);
end;
$$;

create or replace function public.join_group(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_group from public.groups where invite_code = upper(trim(p_code));
  if v_group.id is null then raise exception 'GROUP_NOT_FOUND'; end if;
  insert into public.group_members (group_id, user_id, role) values (v_group.id, v_uid, 'member')
    on conflict (group_id, user_id) do nothing;
  return jsonb_build_object('group_id', v_group.id);
end;
$$;

create or replace function public.get_my_groups()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'plan', g.plan, 'invite_code', g.invite_code,
      'owner_id', g.owner_id, 'role', gm.role,
      'member_count', (select count(*) from public.group_members x where x.group_id = g.id)
    ) order by g.created_at desc)
    from public.group_members gm join public.groups g on g.id = gm.group_id
    where gm.user_id = v_uid
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_group_detail(p_group_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups;
  v_members jsonb;
  v_stats jsonb;
  v_pairs jsonb;
begin
  if not public.is_group_member(p_group_id) then raise exception 'NOT_A_MEMBER'; end if;
  select * into v_group from public.groups where id = p_group_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', gm.user_id, 'role', gm.role, 'joined_at', gm.joined_at,
      'detective_name', p.detective_name, 'avatar_seed', p.avatar_seed,
      'solved', (select count(*) from public.case_results r where r.solved and (r.player_a = gm.user_id or r.player_b = gm.user_id)),
      'played', (select count(*) from public.case_results r where r.player_a = gm.user_id or r.player_b = gm.user_id)
    ) order by gm.joined_at), '[]'::jsonb) into v_members
  from public.group_members gm join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id;
  select jsonb_build_object(
    'played', count(*), 'solved', count(*) filter (where solved),
    'avg_seconds', coalesce(round(avg(duration_seconds) filter (where solved)), 0),
    'best_seconds', coalesce(min(duration_seconds) filter (where solved), 0)
  ) into v_stats
  from public.case_results where group_id = p_group_id;
  select coalesce(jsonb_agg(t order by t.solved desc, t.avg_seconds asc), '[]'::jsonb) into v_pairs
  from (
    select pa.detective_name as a_name, pb.detective_name as b_name,
      count(*) as played, count(*) filter (where r.solved) as solved,
      coalesce(round(avg(r.duration_seconds) filter (where r.solved)), 0) as avg_seconds
    from public.case_results r
    join public.profiles pa on pa.id = r.player_a
    join public.profiles pb on pb.id = r.player_b
    where r.group_id = p_group_id
    group by pa.detective_name, pb.detective_name
    limit 20
  ) t;
  return jsonb_build_object(
    'group', jsonb_build_object('id', v_group.id, 'name', v_group.name, 'plan', v_group.plan,
      'invite_code', v_group.invite_code, 'owner_id', v_group.owner_id),
    'members', v_members, 'stats', v_stats, 'pairs', v_pairs,
    'is_owner', v_group.owner_id = v_uid
  );
end;
$$;

create or replace function public.report_user(p_reported uuid, p_room_id uuid, p_reason text, p_details text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reported = auth.uid() then raise exception 'CANNOT_REPORT_SELF'; end if;
  insert into public.reports (reporter_id, reported_id, room_id, reason, details)
  values (auth.uid(), p_reported, p_room_id, p_reason, p_details);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.block_user(p_blocked uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_blocked = auth.uid() then raise exception 'CANNOT_BLOCK_SELF'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_blocked) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.unblock_user(p_blocked uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_blocked;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_my_blocks()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', b.blocked_id, 'detective_name', p.detective_name, 'created_at', b.created_at))
    from public.blocks b join public.profiles p on p.id = b.blocked_id
    where b.blocker_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_my_notifications()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title,
      'body', n.body, 'link', n.link, 'read_at', n.read_at, 'created_at', n.created_at) order by n.created_at desc)
    from (select * from public.notifications where user_id = auth.uid() order by created_at desc limit 40) n
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mark_notifications_read()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_campaign_detail(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_camp public.campaigns;
  v_chapters jsonb;
  v_progress jsonb;
begin
  select * into v_camp from public.campaigns where slug = p_slug;
  if v_camp.id is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'setting', c.setting, 'premise', c.premise,
      'difficulty', c.difficulty, 'est_minutes', c.est_minutes, 'chapter_number', c.chapter_number
    ) order by c.chapter_number), '[]'::jsonb) into v_chapters
  from public.cases c where c.campaign_id = v_camp.id and c.status = 'published';
  select jsonb_build_object('chapters_completed', cp.chapters_completed, 'decisions', cp.decisions, 'updated_at', cp.updated_at)
    into v_progress
  from public.campaign_progress cp
  where cp.campaign_id = v_camp.id and (cp.player_a = auth.uid() or cp.player_b = auth.uid())
  order by cp.updated_at desc limit 1;
  return jsonb_build_object(
    'campaign', jsonb_build_object('id', v_camp.id, 'slug', v_camp.slug, 'title', v_camp.title,
      'tagline', v_camp.tagline, 'description', v_camp.description, 'chapter_count', v_camp.chapter_count),
    'chapters', v_chapters,
    'progress', v_progress
  );
end;
$$;

create or replace function public.validate_case(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_case public.cases;
  v_sol public.case_solutions;
  v_checks jsonb := '[]'::jsonb;
  v_ok boolean := true;
  v_q jsonb;
  v_qid text;
  v_opts jsonb;
  v_opt jsonb;
  v_a_codes text[];
  v_b_codes text[];
  v_d jsonb;
  v_req text[];
  v_a_elim int;
  v_b_elim int;
  v_both_elim int;
  v_a_possible int;
  v_b_possible int;
  v_both_possible int;
  v_remaining text[];
  v_a_count int;
  v_b_count int;
  v_bad_deductions int := 0;
  v_missing int := 0;
  v_solution_ok boolean := true;
  v_chain jsonb;
  v_all_codes text[];
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  select * into v_sol from public.case_solutions where case_id = p_case_id;
  if v_sol.case_id is null then
    return jsonb_build_object('ok', false, 'checks', jsonb_build_array(
      jsonb_build_object('id','solution','label','Solution and deduction chain present','pass',false,'detail','No solution row found.')));
  end if;
  v_chain := v_sol.deduction_chain;

  select coalesce(array_agg(code), '{}') into v_a_codes from public.case_evidence where case_id = p_case_id and player = 'A';
  select coalesce(array_agg(code), '{}') into v_b_codes from public.case_evidence where case_id = p_case_id and player = 'B';
  v_all_codes := v_a_codes || v_b_codes;
  v_a_count := coalesce(array_length(v_a_codes, 1), 0);
  v_b_count := coalesce(array_length(v_b_codes, 1), 0);

  v_checks := v_checks || jsonb_build_object('id','evidence_a','label','Player A has 6-10 evidence items','pass', v_a_count between 6 and 10,'detail', v_a_count || ' items');
  v_checks := v_checks || jsonb_build_object('id','evidence_b','label','Player B has 6-10 evidence items','pass', v_b_count between 6 and 10,'detail', v_b_count || ' items');
  if not (v_a_count between 6 and 10) or not (v_b_count between 6 and 10) then v_ok := false; end if;

  for v_d in select * from jsonb_array_elements(v_chain) loop
    v_req := array(select jsonb_array_elements_text(coalesce(v_d->'requires', '[]'::jsonb)));
    if not exists (select 1 from unnest(v_req) c where c = any(v_a_codes))
       or not exists (select 1 from unnest(v_req) c where c = any(v_b_codes)) then
      v_bad_deductions := v_bad_deductions + 1;
    end if;
    if exists (select 1 from unnest(v_req) c where not (c = any(v_all_codes))) then
      v_missing := v_missing + 1;
    end if;
  end loop;

  v_checks := v_checks || jsonb_build_object('id','lock_and_key','label','Every deduction needs a fact from each side','pass', v_bad_deductions = 0,'detail', v_bad_deductions || ' deductions are single-sided');
  v_checks := v_checks || jsonb_build_object('id','references','label','Every referenced evidence code exists','pass', v_missing = 0,'detail', v_missing || ' dangling references');
  if v_bad_deductions > 0 or v_missing > 0 then v_ok := false; end if;

  for v_q in select * from jsonb_array_elements(v_case.questions) loop
    v_qid := v_q->>'id';
    v_opts := v_q->'options';
    v_a_elim := 0; v_b_elim := 0; v_both_elim := 0;
    v_remaining := '{}';
    for v_opt in select * from jsonb_array_elements(v_opts) loop
      declare
        v_opt_id text := v_opt->>'id';
        v_elim_a boolean := false;
        v_elim_b boolean := false;
        v_elim_both boolean := false;
      begin
        for v_d in select * from jsonb_array_elements(v_chain) loop
          if (v_d->>'question') = v_qid and (v_d->>'option') = v_opt_id then
            v_req := array(select jsonb_array_elements_text(coalesce(v_d->'requires', '[]'::jsonb)));
            if public.codes_subset(v_req, v_a_codes) then v_elim_a := true; end if;
            if public.codes_subset(v_req, v_b_codes) then v_elim_b := true; end if;
            if public.codes_subset(v_req, v_all_codes) then v_elim_both := true; end if;
          end if;
        end loop;
        if v_elim_a then v_a_elim := v_a_elim + 1; end if;
        if v_elim_b then v_b_elim := v_b_elim + 1; end if;
        if v_elim_both then v_both_elim := v_both_elim + 1; else v_remaining := v_remaining || v_opt_id; end if;
      end;
    end loop;
    v_a_possible := jsonb_array_length(v_opts) - v_a_elim;
    v_b_possible := jsonb_array_length(v_opts) - v_b_elim;
    v_both_possible := jsonb_array_length(v_opts) - v_both_elim;
    v_checks := v_checks || jsonb_build_object('id','a_'||v_qid,'label','A alone leaves 2+ answers for '||upper(v_qid),'pass', v_a_possible >= 2,'detail', v_a_possible || ' possible');
    v_checks := v_checks || jsonb_build_object('id','b_'||v_qid,'label','B alone leaves 2+ answers for '||upper(v_qid),'pass', v_b_possible >= 2,'detail', v_b_possible || ' possible');
    v_checks := v_checks || jsonb_build_object('id','both_'||v_qid,'label','Both halves leave exactly 1 answer for '||upper(v_qid),'pass', v_both_possible = 1,'detail', v_both_possible || ' possible');
    if v_a_possible < 2 or v_b_possible < 2 or v_both_possible <> 1 then v_ok := false; end if;
    if v_both_possible = 1 and (v_sol.solution->>v_qid) is distinct from v_remaining[1] then
      v_solution_ok := false;
    end if;
  end loop;

  v_checks := v_checks || jsonb_build_object('id','solution_match','label','Stored solution matches the surviving answer','pass', v_solution_ok,'detail', case when v_solution_ok then 'Aligned' else 'Solution does not match the deduction chain' end);
  if not v_solution_ok then v_ok := false; end if;

  update public.cases set validation_report = jsonb_build_object('ok', v_ok, 'checks', v_checks, 'ran_at', now()),
    validated_at = case when v_ok then now() else null end
  where id = p_case_id;

  return jsonb_build_object('ok', v_ok, 'checks', v_checks);
end;
$$;

create or replace function public.publish_case(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_report jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  v_report := public.validate_case(p_case_id);
  if not (v_report->>'ok')::boolean then
    raise exception 'VALIDATION_FAILED';
  end if;
  update public.cases set status = 'published' where id = p_case_id;
  return v_report;
end;
$$;

create or replace function public.unpublish_case(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.cases set status = 'draft' where id = p_case_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_admin_cases()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'kind', c.kind, 'difficulty', c.difficulty,
      'status', c.status, 'daily_order', c.daily_order, 'group_only', c.group_only,
      'chapter_number', c.chapter_number, 'validation_report', c.validation_report,
      'evidence_count', (select count(*) from public.case_evidence e where e.case_id = c.id)
    ) order by c.kind, c.daily_order nulls last, c.chapter_number nulls last, c.title)
    from public.cases c
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_admin_case(p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_case public.cases;
  v_sol public.case_solutions;
  v_ev jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  select * into v_sol from public.case_solutions where case_id = p_case_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', e.code, 'player', e.player, 'type', e.type, 'title', e.title,
    'body', e.body, 'meta', e.meta, 'sort_order', e.sort_order
  ) order by e.player, e.sort_order), '[]'::jsonb) into v_ev
  from public.case_evidence e where e.case_id = p_case_id;
  return jsonb_build_object(
    'case', to_jsonb(v_case),
    'solution', case when v_sol.case_id is null then null else jsonb_build_object(
      'solution', v_sol.solution, 'deduction_chain', v_sol.deduction_chain,
      'narrative', v_sol.narrative, 'epilogue', v_sol.epilogue, 'hints', v_sol.hints) end,
    'evidence', v_ev
  );
end;
$$;

create or replace function public.save_case(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_ev jsonb;
  v_item jsonb;
  v_sol jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  v_id := nullif(p_payload->>'id', '')::uuid;
  if v_id is null then
    insert into public.cases (slug, title, setting, premise, difficulty, est_minutes, kind,
      campaign_id, chapter_number, group_only, daily_order, questions, status)
    values (
      p_payload->>'slug', p_payload->>'title', p_payload->>'setting', p_payload->>'premise',
      p_payload->>'difficulty', coalesce((p_payload->>'est_minutes')::int, 15), p_payload->>'kind',
      nullif(p_payload->>'campaign_id','')::uuid, nullif(p_payload->>'chapter_number','')::int,
      coalesce((p_payload->>'group_only')::boolean, false), nullif(p_payload->>'daily_order','')::int,
      p_payload->'questions', 'draft')
    returning id into v_id;
  else
    update public.cases set
      slug = p_payload->>'slug', title = p_payload->>'title', setting = p_payload->>'setting',
      premise = p_payload->>'premise', difficulty = p_payload->>'difficulty',
      est_minutes = coalesce((p_payload->>'est_minutes')::int, est_minutes),
      kind = p_payload->>'kind',
      campaign_id = nullif(p_payload->>'campaign_id','')::uuid,
      chapter_number = nullif(p_payload->>'chapter_number','')::int,
      group_only = coalesce((p_payload->>'group_only')::boolean, false),
      daily_order = nullif(p_payload->>'daily_order','')::int,
      questions = p_payload->'questions'
    where id = v_id;
  end if;

  delete from public.case_evidence where case_id = v_id;
  v_ev := coalesce(p_payload->'evidence', '[]'::jsonb);
  for v_item in select * from jsonb_array_elements(v_ev) loop
    insert into public.case_evidence (case_id, player, code, type, title, body, meta, sort_order)
    values (v_id, v_item->>'player', v_item->>'code', v_item->>'type', v_item->>'title',
      v_item->>'body', coalesce(v_item->'meta', '{}'::jsonb), coalesce((v_item->>'sort_order')::int, 0));
  end loop;

  v_sol := p_payload->'solution';
  insert into public.case_solutions (case_id, solution, deduction_chain, narrative, epilogue, hints)
  values (v_id, v_sol->'solution', v_sol->'deduction_chain', v_sol->>'narrative',
    v_sol->>'epilogue', coalesce(v_sol->'hints', '[]'::jsonb))
  on conflict (case_id) do update set
    solution = excluded.solution, deduction_chain = excluded.deduction_chain,
    narrative = excluded.narrative, epilogue = excluded.epilogue, hints = excluded.hints;

  return jsonb_build_object('case_id', v_id, 'validation', public.validate_case(v_id));
end;
$$;

create or replace function public.get_admin_reports()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at,
      'reporter', rp.detective_name, 'reported', rd.detective_name, 'reported_id', r.reported_id, 'room_id', r.room_id
    ) order by r.created_at desc)
    from public.reports r
    join public.profiles rp on rp.id = r.reporter_id
    join public.profiles rd on rd.id = r.reported_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.set_report_status(p_report_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.reports set status = p_status where id = p_report_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_admin_users()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  return coalesce((
    select jsonb_agg(t order by t.created_at desc)
    from (
      select p.id, p.detective_name, p.created_at, p.is_admin, p.last_seen_at,
        (select count(*) from public.case_results r where r.player_a = p.id or r.player_b = p.id) as played,
        (select count(*) from public.reports rp where rp.reported_id = p.id) as reports_against
      from public.profiles p order by p.created_at desc limit 200
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_my_rooms()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(t order by t.created_at desc)
    from (
      select r.id, r.code, r.status, r.mode, c.title as case_title, c.slug as case_slug,
        c.difficulty, r.created_at, r.started_at, r.finished_at, r.outcome, r.attempts,
        coalesce(pp.detective_name, 'Waiting for a partner') as partner
      from public.rooms r
      join public.cases c on c.id = r.case_id
      left join public.profiles pp on pp.id = case when r.host_id = auth.uid() then r.guest_id else r.host_id end
      where r.host_id = auth.uid() or r.guest_id = auth.uid()
      order by r.created_at desc limit 30
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_my_pending_invites()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'code', r.code, 'case_title', c.title, 'difficulty', c.difficulty,
      'host', p.detective_name, 'created_at', r.created_at, 'expires_at', r.expires_at
    ) order by r.created_at desc)
    from public.rooms r
    join public.cases c on c.id = r.case_id
    join public.profiles p on p.id = r.host_id
    where r.guest_id = auth.uid() and r.status = 'lobby'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_public_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_detectives int;
  v_cases int;
  v_solved int;
begin
  select count(*) into v_detectives from public.profiles;
  select count(*) into v_cases from public.cases where status = 'published';
  select count(*) into v_solved from public.case_results where solved = true;
  return jsonb_build_object('detectives', v_detectives, 'cases', v_cases, 'solved', v_solved);
end;
$$;

create or replace function public.get_case_teaser(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_case public.cases;
  v_a jsonb;
  v_b jsonb;
begin
  select * into v_case from public.cases where slug = p_slug and status = 'published';
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(t order by t.sort_order), '[]'::jsonb) into v_a
  from (select code, type, title, body, meta, sort_order from public.case_evidence
        where case_id = v_case.id and player = 'A' order by sort_order limit 3) t;
  select coalesce(jsonb_agg(t order by t.sort_order), '[]'::jsonb) into v_b
  from (select code, type, title, body, meta, sort_order from public.case_evidence
        where case_id = v_case.id and player = 'B' order by sort_order limit 3) t;
  return jsonb_build_object(
    'case', jsonb_build_object('id', v_case.id, 'slug', v_case.slug, 'title', v_case.title,
      'setting', v_case.setting, 'premise', v_case.premise, 'difficulty', v_case.difficulty),
    'a', v_a, 'b', v_b
  );
end;
$$;

create or replace function public.get_public_cases()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'setting', c.setting,
      'difficulty', c.difficulty, 'kind', c.kind, 'est_minutes', c.est_minutes,
      'daily_order', c.daily_order, 'chapter_number', c.chapter_number,
      'solves', (select count(*) from public.case_results r where r.case_id = c.id and r.solved)
    ) order by c.kind, c.daily_order nulls last, c.chapter_number nulls last)
    from public.cases c where c.status = 'published' and c.group_only = false
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_group_cases(p_group_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_group_member(p_group_id) then raise exception 'NOT_A_MEMBER'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'setting', c.setting,
      'difficulty', c.difficulty, 'est_minutes', c.est_minutes, 'premise', c.premise
    ) order by c.title)
    from public.cases c where c.status = 'published' and c.group_only = true
  ), '[]'::jsonb);
end;
$$;
