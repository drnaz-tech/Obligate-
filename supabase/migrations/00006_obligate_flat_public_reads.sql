create or replace function public.get_public_cases()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'setting', c.setting,
      'premise', c.premise,
      'difficulty', c.difficulty, 'kind', c.kind, 'est_minutes', c.est_minutes,
      'daily_order', c.daily_order, 'chapter_number', c.chapter_number,
      'solved_count', (select count(*) from public.case_results r where r.case_id = c.id and r.solved)
    ) order by c.kind, c.daily_order nulls last, c.chapter_number nulls last)
    from public.cases c where c.status = 'published' and c.group_only = false
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_public_case_result(p_case_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_case public.cases;
  v_sol public.case_solutions;
  v_unlocked boolean := false;
  v_uid uuid := auth.uid();
  v_count int;
  v_idx int;
  v_today_order int;
  v_solved int := 0;
  v_fastest int;
begin
  select * into v_case from public.cases where id = p_case_id and status = 'published';
  if v_case.id is null then raise exception 'CASE_NOT_FOUND'; end if;

  if v_case.kind = 'daily' then
    select count(*) into v_count from public.cases where kind = 'daily' and status = 'published';
    if v_count > 0 then
      v_idx := ((((now() at time zone 'utc')::date - date '2026-01-01') % v_count) + v_count) % v_count;
      select daily_order into v_today_order from public.cases
        where kind = 'daily' and status = 'published'
        order by daily_order limit 1 offset v_idx;
      v_unlocked := coalesce(v_case.daily_order, 0) < coalesce(v_today_order, 0);
    end if;
  else
    v_unlocked := true;
  end if;

  if v_uid is not null and exists (
    select 1 from public.case_results r
    where r.case_id = p_case_id and (r.player_a = v_uid or r.player_b = v_uid)
  ) then
    v_unlocked := true;
  end if;

  select * into v_sol from public.case_solutions where case_id = p_case_id;

  select count(*), min(r.duration_seconds) into v_solved, v_fastest
  from public.case_results r where r.case_id = p_case_id and r.solved;

  return jsonb_build_object(
    'title', v_case.title,
    'setting', v_case.setting,
    'premise', v_case.premise,
    'questions', v_case.questions,
    'gated', not v_unlocked,
    'solution', case when v_unlocked then v_sol.solution else null end,
    'deduction_chain', case when v_unlocked then v_sol.deduction_chain else null end,
    'narrative', case when v_unlocked then v_sol.narrative else null end,
    'epilogue', case when v_unlocked then v_sol.epilogue else null end,
    'solved_count', v_solved,
    'fastest_seconds', v_fastest
  );
end;
$$;

grant execute on function public.get_public_cases() to authenticated, anon;
grant execute on function public.get_public_case_result(uuid) to authenticated, anon;