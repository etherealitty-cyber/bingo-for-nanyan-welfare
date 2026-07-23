create or replace function public.bingo_my_answers(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id text;
  v_answers jsonb;
begin
  select p.id into v_participant_id
  from bingo_private.sessions s
  join bingo_private.participants p on p.id = s.participant_id
  where s.token_hash = encode(
    extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'),
    'hex'
  )
    and s.expires_at > now()
    and p.active = true;

  if not found then
    raise exception using message = '请重新登录';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'topic_id', a.topic_id,
    'interested', a.interested
  ) order by a.topic_id), '[]'::jsonb)
  into v_answers
  from bingo_private.answers a
  where a.participant_id = v_participant_id;

  return jsonb_build_object('answers', v_answers);
end;
$$;

revoke all on function public.bingo_my_answers(text) from public;
grant execute on function public.bingo_my_answers(text) to anon;
