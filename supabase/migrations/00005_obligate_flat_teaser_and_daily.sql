create or replace function public.get_case_teaser(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_case public.cases;
  v_sample jsonb;
begin
  select * into v_case from public.cases where slug = p_slug and status = 'published';
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(t.item order by t.player, t.sort_order), '[]'::jsonb) into v_sample
  from (
    select ce.player, ce.sort_order,
      jsonb_build_object(
        'code', ce.code, 'player', ce.player, 'type', ce.type,
        'title', ce.title, 'body', ce.body, 'meta', ce.meta
      ) as item
    from (
      select * from public.case_evidence
      where case_id = v_case.id and player = 'A'
      order by sort_order limit 3
    ) ce
    union all
    select ce.player, ce.sort_order,
      jsonb_build_object(
        'code', ce.code, 'player', ce.player, 'type', ce.type,
        'title', ce.title, 'body', ce.body, 'meta', ce.meta
      ) as item
    from (
      select * from public.case_evidence
      where case_id = v_case.id and player = 'B'
      order by sort_order limit 3
    ) ce
  ) t;

  return jsonb_build_object(
    'id', v_case.id, 'slug', v_case.slug, 'title', v_case.title,
    'setting', v_case.setting, 'premise', v_case.premise,
    'difficulty', v_case.difficulty, 'est_minutes', v_case.est_minutes,
    'questions', v_case.questions, 'sample', v_sample
  );
end;
$$;

create or replace function public.get_daily_case()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_idx int;
  v_count int;
  v_case public.cases;
  v_solved int := 0;
  v_room uuid;
begin
  select count(*) into v_count from public.cases where kind = 'daily' and status = 'published';
  if v_count = 0 then
    return jsonb_build_object('day_key', v_day, 'next_reset', ((v_day + 1)::timestamp at time zone 'utc'));
  end if;

  v_idx := (((v_day - date '2026-01-01') % v_count) + v_count) % v_count;
  select * into v_case from public.cases
    where kind = 'daily' and status = 'published'
    order by daily_order, created_at limit 1 offset v_idx;

  select count(*) into v_solved
  from public.case_results r
  where r.case_id = v_case.id and r.solved
    and (r.created_at at time zone 'utc')::date = v_day;

  if v_uid is not null then
    select r.id into v_room
    from public.rooms r
    where r.case_id = v_case.id
      and (r.host_id = v_uid or r.guest_id = v_uid)
      and r.status in ('lobby', 'active')
    order by r.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'id', v_case.id, 'slug', v_case.slug, 'title', v_case.title,
    'setting', v_case.setting, 'premise', v_case.premise,
    'difficulty', v_case.difficulty, 'est_minutes', v_case.est_minutes,
    'daily_order', v_case.daily_order,
    'day_key', v_day,
    'next_reset', ((v_day + 1)::timestamp at time zone 'utc'),
    'solved_today', v_solved,
    'my_room_id', v_room
  );
end;
$$;

grant execute on function public.get_case_teaser(text) to authenticated, anon;
grant execute on function public.get_daily_case() to authenticated, anon;