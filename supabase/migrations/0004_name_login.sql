create or replace function public.bingo_public_participants()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'people',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'nickname', nickname,
          'role', role,
          'roleLabel', case role when 'camper' then '营员' when 'counselor' then '辅导员' else '工作人员' end
        )
        order by id
      ),
      '[]'::jsonb
    )
  )
  from bingo_private.participants
  where active = true;
$$;

create or replace function public.bingo_login(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant bingo_private.participants%rowtype;
  v_token text;
begin
  if nullif(btrim(coalesce(p_code, '')), '') is null then
    raise exception using message = '请选择你的姓名';
  end if;

  select * into v_participant
  from bingo_private.participants
  where nickname = btrim(p_code)
    and active = true;

  if not found then
    raise exception using message = '未找到该姓名，请联系工作人员';
  end if;

  delete from bingo_private.sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into bingo_private.sessions(token_hash, participant_id, expires_at)
  values (
    encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'),
    v_participant.id,
    now() + interval '7 days'
  );

  return jsonb_build_object(
    'token', v_token,
    'participant', jsonb_build_object(
      'id', v_participant.id,
      'nickname', v_participant.nickname,
      'role', v_participant.role,
      'eligible_for_prize', v_participant.eligible_for_prize,
      'roleLabel', case v_participant.role when 'camper' then '营员' when 'counselor' then '辅导员' else '工作人员' end
    )
  );
end;
$$;

revoke all on function public.bingo_public_participants() from public;
grant execute on function public.bingo_public_participants() to anon;
