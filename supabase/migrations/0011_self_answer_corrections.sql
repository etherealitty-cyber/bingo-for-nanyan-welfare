begin;

alter table bingo_private.answers
  add column if not exists self_edit_used boolean not null default false,
  add column if not exists self_edited_at timestamptz;

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
    'interested', a.interested,
    'updated_at', a.updated_at,
    'self_edit_used', a.self_edit_used,
    'self_edited_at', a.self_edited_at
  ) order by a.topic_id), '[]'::jsonb)
  into v_answers
  from bingo_private.answers a
  where a.participant_id = v_participant_id;

  return jsonb_build_object('answers', v_answers);
end;
$$;

create or replace function public.bingo_update_my_answer(
  p_token text,
  p_topic_id text,
  p_interested boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id text;
  v_answers jsonb;
  v_updated_count integer;
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

  if p_interested is null or p_topic_id is null or p_topic_id <> all(array[
    'r1c1','r1c2','r1c3','r1c4','r1c5',
    'r2c1','r2c2','r2c3','r2c4','r2c5',
    'r3c1','r3c2','r3c3','r3c4','r3c5',
    'r4c1','r4c2','r4c3','r4c4','r4c5',
    'r5c1','r5c2','r5c3','r5c4','r5c5'
  ]::text[]) then
    raise exception using message = '兴趣格无效';
  end if;

  update bingo_private.answers
  set
    interested = p_interested,
    self_edit_used = true,
    self_edited_at = now(),
    updated_at = now()
  where participant_id = v_participant_id
    and topic_id = p_topic_id
    and self_edit_used = false
    and interested is distinct from p_interested;

  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    if not exists (
      select 1 from bingo_private.answers
      where participant_id = v_participant_id and topic_id = p_topic_id
    ) then
      raise exception using message = '你的问卷答案尚未配置完整，请联系工作人员';
    elsif exists (
      select 1 from bingo_private.answers
      where participant_id = v_participant_id
        and topic_id = p_topic_id
        and self_edit_used = true
    ) then
      raise exception using message = '这个兴趣格的修改机会已经使用';
    else
      raise exception using message = '请选择与当前判定不同的答案';
    end if;
  end if;

  update bingo_private.submission_entries se
  set
    yes_correct = case
      when se.yes_participant_id = v_participant_id then p_interested
      else se.yes_correct
    end,
    no_correct = case
      when se.no_participant_id = v_participant_id then not p_interested
      else se.no_correct
    end
  where se.topic_id = p_topic_id
    and (
      se.yes_participant_id = v_participant_id
      or se.no_participant_id = v_participant_id
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'topic_id', a.topic_id,
    'interested', a.interested,
    'updated_at', a.updated_at,
    'self_edit_used', a.self_edit_used,
    'self_edited_at', a.self_edited_at
  ) order by a.topic_id), '[]'::jsonb)
  into v_answers
  from bingo_private.answers a
  where a.participant_id = v_participant_id;

  return jsonb_build_object('answers', v_answers);
end;
$$;

revoke all on function public.bingo_my_answers(text) from public;
grant execute on function public.bingo_my_answers(text) to anon;
revoke all on function public.bingo_update_my_answer(text, text, boolean) from public;
grant execute on function public.bingo_update_my_answer(text, text, boolean) to anon;

commit;
