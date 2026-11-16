create or replace function public.get_campaigns()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.sort_order), '[]'::jsonb)
  from (
    select
      c.id,
      c.slug,
      c.title,
      c.tagline,
      c.description,
      c.chapter_count,
      c.sort_order,
      coalesce((
        select cp.chapters_completed
        from campaign_progress cp
        where cp.campaign_id = c.id
          and (cp.player_a = auth.uid() or cp.player_b = auth.uid())
        order by cp.chapters_completed desc
        limit 1
      ), 0) as chapters_completed
    from campaigns c
  ) t;
$$;

grant execute on function public.get_campaigns() to authenticated, anon;