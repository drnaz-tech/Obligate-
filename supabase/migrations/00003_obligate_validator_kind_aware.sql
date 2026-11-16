create or replace function public.validate_case(p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_keyless int := 0;
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
    if coalesce(v_d->>'kind', 'key') = 'key' then
      if not exists (select 1 from unnest(v_req) c where c = any(v_a_codes))
         or not exists (select 1 from unnest(v_req) c where c = any(v_b_codes)) then
        v_bad_deductions := v_bad_deductions + 1;
      end if;
    else
      if not (public.codes_subset(v_req, v_a_codes) or public.codes_subset(v_req, v_b_codes)) then
        v_bad_deductions := v_bad_deductions + 1;
      end if;
    end if;
    if exists (select 1 from unnest(v_req) c where not (c = any(v_all_codes))) then
      v_missing := v_missing + 1;
    end if;
  end loop;

  v_checks := v_checks || jsonb_build_object('id','lock_and_key','label','Every key deduction needs a fact from each side','pass', v_bad_deductions = 0,'detail', v_bad_deductions || ' deductions are malformed');
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
    if not exists (
      select 1 from jsonb_array_elements(v_chain) d
      where (d->>'question') = v_qid and coalesce(d->>'kind','key') = 'key'
    ) then
      v_keyless := v_keyless + 1;
    end if;
  end loop;

  v_checks := v_checks || jsonb_build_object('id','key_per_question','label','Every question has a two-sided key deduction','pass', v_keyless = 0,'detail', v_keyless || ' questions without one');
  if v_keyless > 0 then v_ok := false; end if;

  v_checks := v_checks || jsonb_build_object('id','solution_match','label','Stored solution matches the surviving answer','pass', v_solution_ok,'detail', case when v_solution_ok then 'Aligned' else 'Solution does not match the deduction chain' end);
  if not v_solution_ok then v_ok := false; end if;

  update public.cases set validation_report = jsonb_build_object('ok', v_ok, 'checks', v_checks, 'ran_at', now()),
    validated_at = case when v_ok then now() else null end
  where id = p_case_id;

  return jsonb_build_object('ok', v_ok, 'checks', v_checks);
end;
$function$;