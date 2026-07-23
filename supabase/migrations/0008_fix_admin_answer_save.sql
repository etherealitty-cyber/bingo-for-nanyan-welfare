create or replace function public.bingo_admin_update_answers(
  p_token text,
  p_participant_id text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_answer_count integer;
  v_updated_count integer;
begin
  if not exists (
    select 1 from bingo_private.admin_sessions
    where token_hash = encode(
      extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'),
      'hex'
    )
      and expires_at > now()
  ) then
    raise exception using message = '管理登录已失效';
  end if;

  if not exists (
    select 1 from bingo_private.participants
    where id = p_participant_id
      and active = true
  ) then
    raise exception using message = '参与者不存在';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception using message = '答案修改内容无效';
  end if;

  select count(*) into v_answer_count
  from jsonb_each(p_answers);

  if v_answer_count = 0 or v_answer_count > 25 then
    raise exception using message = '答案修改内容无效';
  end if;

  if exists (
    select 1
    from jsonb_each(p_answers) as change(topic_id, interested)
    where change.topic_id <> all(array[
      'r1c1','r1c2','r1c3','r1c4','r1c5',
      'r2c1','r2c2','r2c3','r2c4','r2c5',
      'r3c1','r3c2','r3c3','r3c4','r3c5',
      'r4c1','r4c2','r4c3','r4c4','r4c5',
      'r5c1','r5c2','r5c3','r5c4','r5c5'
    ]::text[])
      or jsonb_typeof(change.interested) <> 'boolean'
  ) then
    raise exception using message = '答案修改内容无效';
  end if;

  update bingo_private.answers a
  set
    interested = change.interested::text::boolean,
    updated_at = now()
  from jsonb_each(p_answers) as change(topic_id, interested)
  where a.participant_id = p_participant_id
    and a.topic_id = change.topic_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_answer_count then
    raise exception using message = '该参与者的答案数据不完整';
  end if;

  update bingo_private.submission_entries se
  set
    yes_correct = case
      when se.yes_participant_id = p_participant_id then a.interested
      else se.yes_correct
    end,
    no_correct = case
      when se.no_participant_id = p_participant_id then not a.interested
      else se.no_correct
    end
  from bingo_private.answers a
  where a.participant_id = p_participant_id
    and a.topic_id = se.topic_id
    and p_answers ? se.topic_id
    and (
      se.yes_participant_id = p_participant_id
      or se.no_participant_id = p_participant_id
    );

  with recalculated as (
    select
      se.submission_id,
      count(*) * 2 as total_count,
      count(*) filter (where se.yes_correct)
        + count(*) filter (where se.no_correct) as correct_count
    from bingo_private.submission_entries se
    group by se.submission_id
  )
  update bingo_private.submissions s
  set
    correct_count = r.correct_count,
    total_count = r.total_count,
    accuracy = r.correct_count::double precision / r.total_count,
    valid = r.correct_count >= ceil(r.total_count * 0.8)
  from recalculated r
  where r.submission_id = s.id;

  select jsonb_build_object(
    'participant', jsonb_build_object(
      'id', p.id,
      'nickname', p.nickname,
      'role', p.role
    ),
    'answers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'topic_id', a.topic_id,
        'interested', a.interested,
        'updated_at', a.updated_at
      ) order by a.topic_id), '[]'::jsonb)
      from bingo_private.answers a
      where a.participant_id = p.id
    )
  )
  into v_result
  from bingo_private.participants p
  where p.id = p_participant_id;

  return v_result;
end;
$$;

revoke all on function public.bingo_admin_update_answers(text, text, jsonb) from public;
grant execute on function public.bingo_admin_update_answers(text, text, jsonb) to anon;
