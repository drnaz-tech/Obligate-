create or replace function public.campaign_chapter_unlocked(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_chapter int;
begin
  select campaign_id, chapter_number into v_campaign, v_chapter
  from public.cases where id = p_case_id;

  if v_campaign is null then return true; end if;
  if coalesce(v_chapter, 1) <= 1 then return true; end if;
  if p_uid is null then return false; end if;

  return exists (
    select 1 from public.campaign_progress cp
    where cp.campaign_id = v_campaign
      and (cp.player_a = p_uid or cp.player_b = p_uid)
      and cp.chapters_completed >= coalesce(v_chapter, 1) - 1
  );
end;
$$;

create or replace function public.enforce_chapter_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.campaign_chapter_unlocked(new.case_id, new.host_id) then
    raise exception 'CHAPTER_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_chapter_lock on public.rooms;
create trigger rooms_chapter_lock
  before insert on public.rooms
  for each row execute function public.enforce_chapter_lock();

create or replace function public.get_campaign_detail(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_camp public.campaigns;
  v_chapters jsonb;
  v_progress jsonb;
  v_done int := 0;
begin
  select * into v_camp from public.campaigns where slug = p_slug;
  if v_camp.id is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;

  select jsonb_build_object('chapters_completed', cp.chapters_completed,
      'decisions', cp.decisions, 'updated_at', cp.updated_at)
    into v_progress
  from public.campaign_progress cp
  where cp.campaign_id = v_camp.id and (cp.player_a = v_uid or cp.player_b = v_uid)
  order by cp.updated_at desc limit 1;

  v_done := coalesce((v_progress->>'chapters_completed')::int, 0);

  select coalesce(jsonb_agg(t.item order by t.chapter_number), '[]'::jsonb) into v_chapters
  from (
    select c.chapter_number,
      case
        when c.chapter_number <= v_done then
          jsonb_build_object(
            'id', c.id, 'slug', c.slug, 'title', c.title, 'setting', c.setting,
            'premise', c.premise, 'difficulty', c.difficulty, 'est_minutes', c.est_minutes,
            'chapter_number', c.chapter_number, 'locked', false, 'status', 'completed'
          )
        when c.chapter_number = v_done + 1 then
          jsonb_build_object(
            'id', c.id, 'slug', c.slug, 'title', c.title, 'setting', c.setting,
            'premise', c.premise, 'difficulty', c.difficulty, 'est_minutes', c.est_minutes,
            'chapter_number', c.chapter_number, 'locked', false,
            'status', case when exists (
              select 1 from public.rooms r
              where r.case_id = c.id and r.status in ('lobby', 'active')
                and (r.host_id = v_uid or r.guest_id = v_uid)
            ) then 'in_progress' else 'unlocked' end
          )
        else
          jsonb_build_object(
            'id', c.id, 'title', c.title, 'chapter_number', c.chapter_number,
            'locked', true, 'status', 'locked'
          )
      end as item
    from public.cases c
    where c.campaign_id = v_camp.id and c.status = 'published'
  ) t;

  return jsonb_build_object(
    'campaign', jsonb_build_object('id', v_camp.id, 'slug', v_camp.slug, 'title', v_camp.title,
      'tagline', v_camp.tagline, 'description', v_camp.description, 'chapter_count', v_camp.chapter_count),
    'chapters', v_chapters,
    'progress', v_progress,
    'chapters_completed', v_done,
    'next_chapter', least(v_done + 1, v_camp.chapter_count)
  );
end;
$$;

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
  if not public.campaign_chapter_unlocked(v_case.id, auth.uid()) then
    raise exception 'CHAPTER_LOCKED';
  end if;

  select coalesce(jsonb_agg(t.item order by t.player, t.sort_order), '[]'::jsonb) into v_sample
  from (
    select ce.player, ce.sort_order,
      jsonb_build_object('code', ce.code, 'player', ce.player, 'type', ce.type,
        'title', ce.title, 'body', ce.body, 'meta', ce.meta) as item
    from (select * from public.case_evidence
          where case_id = v_case.id and player = 'A' order by sort_order limit 3) ce
    union all
    select ce.player, ce.sort_order,
      jsonb_build_object('code', ce.code, 'player', ce.player, 'type', ce.type,
        'title', ce.title, 'body', ce.body, 'meta', ce.meta) as item
    from (select * from public.case_evidence
          where case_id = v_case.id and player = 'B' order by sort_order limit 3) ce
  ) t;

  return jsonb_build_object(
    'id', v_case.id, 'slug', v_case.slug, 'title', v_case.title,
    'setting', v_case.setting, 'premise', v_case.premise,
    'difficulty', v_case.difficulty, 'est_minutes', v_case.est_minutes,
    'questions', v_case.questions, 'sample', v_sample
  );
end;
$$;

create or replace function public.get_public_cases()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'setting', c.setting,
      'premise', c.premise,
      'difficulty', c.difficulty, 'kind', c.kind, 'est_minutes', c.est_minutes,
      'daily_order', c.daily_order, 'chapter_number', c.chapter_number,
      'locked', not public.campaign_chapter_unlocked(c.id, v_uid),
      'solved_count', (select count(*) from public.case_results r where r.case_id = c.id and r.solved)
    ) order by c.kind, c.daily_order nulls last, c.chapter_number nulls last)
    from public.cases c where c.status = 'published' and c.group_only = false
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.campaign_chapter_unlocked(uuid, uuid) to authenticated, anon;
grant execute on function public.get_campaign_detail(text) to authenticated, anon;
grant execute on function public.get_case_teaser(text) to authenticated, anon;
grant execute on function public.get_public_cases() to authenticated, anon;