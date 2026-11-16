create or replace function public.send_message(
  p_room_id uuid,
  p_body text,
  p_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  insert into public.room_events (room_id, user_id, kind, body, payload)
  values (p_room_id, v_uid, 'chat', v_clean, p_payload);
  return jsonb_build_object('ok', true);
end;
$function$;

grant execute on function public.send_message(uuid, text, jsonb) to authenticated;