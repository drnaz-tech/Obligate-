DO $$ begin
  perform public.get_case_teaser('meridian-ii-the-second-signature');
  raise notice 'LEAK: chapter 2 teaser returned';
exception when others then
  raise notice 'BLOCKED: %', sqlerrm;
end $$;