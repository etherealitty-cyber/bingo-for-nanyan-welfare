create or replace function public.bingo_submit(p_token text, p_line_id text, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id text;
  v_cells text[];
  v_line_label text;
  v_topic text;
  v_entry jsonb;
  v_yes_id text;
  v_no_id text;
  v_ids text[] := array[]::text[];
  v_yes_answer boolean;
  v_no_answer boolean;
  v_correct integer := 0;
  v_total integer;
  v_valid boolean;
  v_submission_id uuid := gen_random_uuid();
  v_submitted_at timestamptz := now();
begin
  select p.id into v_participant_id
  from bingo_private.sessions s
  join bingo_private.participants p on p.id = s.participant_id
  where s.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
    and s.expires_at > now() and p.active = true;
  if not found then raise exception using message = '请重新登录'; end if;

  if exists (select 1 from bingo_private.submissions where participant_id = v_participant_id) then
    raise exception using message = '你已经正式提交，成绩已锁定';
  end if;

  select cells, label into v_cells, v_line_label from (values
    ('row-1', array['r1c1','r1c2','r1c3','r1c4','r1c5']::text[], '第 1 横行'),
    ('row-2', array['r2c1','r2c2','r2c3','r2c4','r2c5']::text[], '第 2 横行'),
    ('row-3', array['r3c1','r3c2','r3c3','r3c4','r3c5']::text[], '第 3 横行'),
    ('row-4', array['r4c1','r4c2','r4c3','r4c4','r4c5']::text[], '第 4 横行'),
    ('row-5', array['r5c1','r5c2','r5c3','r5c4','r5c5']::text[], '第 5 横行'),
    ('column-1', array['r1c1','r2c1','r3c1','r4c1','r5c1']::text[], '第 1 竖列'),
    ('column-2', array['r1c2','r2c2','r3c2','r4c2','r5c2']::text[], '第 2 竖列'),
    ('column-3', array['r1c3','r2c3','r3c3','r4c3','r5c3']::text[], '第 3 竖列'),
    ('column-4', array['r1c4','r2c4','r3c4','r4c4','r5c4']::text[], '第 4 竖列'),
    ('column-5', array['r1c5','r2c5','r3c5','r4c5','r5c5']::text[], '第 5 竖列'),
    ('diagonal-secondary', array['r1c5','r2c4','r3c3','r4c2','r5c1']::text[], '右上至左下对角线')
  ) as lines(id, cells, label) where id = p_line_id;
  if v_cells is null then raise exception using message = '参赛线路无效'; end if;

  foreach v_topic in array v_cells loop
    v_entry := p_entries -> v_topic;
    v_yes_id := v_entry ->> 'yesParticipantId';
    v_no_id := v_entry ->> 'noParticipantId';
    if v_yes_id is null or v_no_id is null or v_yes_id = '' or v_no_id = '' then
      raise exception using message = '参赛线路尚未填写完整';
    end if;
    v_ids := array_append(array_append(v_ids, v_yes_id), v_no_id);
  end loop;

  if cardinality(v_ids) <> (select count(distinct value) from unnest(v_ids) as ids(value)) then
    raise exception using message = '同一条参赛线路不能重复填写同一个人';
  end if;
  if cardinality(v_ids) <> (select count(*) from bingo_private.participants where active = true and id = any(v_ids)) then
    raise exception using message = '填写人员不存在或已停用';
  end if;

  foreach v_topic in array v_cells loop
    v_entry := p_entries -> v_topic;
    v_yes_id := v_entry ->> 'yesParticipantId';
    v_no_id := v_entry ->> 'noParticipantId';
    if v_topic = any(array['r1c1','r2c2','r3c3','r4c4','r5c5']::text[]) and exists (
      select 1 from bingo_private.participants where id in (v_yes_id, v_no_id) and role = 'camper'
    ) then
      raise exception using message = '蓝色特殊格只能填写辅导员或工作人员';
    end if;

    select interested into v_yes_answer
    from bingo_private.answers where participant_id = v_yes_id and topic_id = v_topic;
    if not found then raise exception using message = '有人未回答该兴趣题，请更换填写人员'; end if;
    select interested into v_no_answer
    from bingo_private.answers where participant_id = v_no_id and topic_id = v_topic;
    if not found then raise exception using message = '有人未回答该兴趣题，请更换填写人员'; end if;
    v_correct := v_correct + (v_yes_answer = true)::integer + (v_no_answer = false)::integer;
  end loop;

  v_total := cardinality(v_cells) * 2;
  v_valid := v_correct >= ceil(v_total * 0.8);
  begin
    insert into bingo_private.submissions
      (id, participant_id, line_id, correct_count, total_count, accuracy, valid, submitted_at)
    values
      (v_submission_id, v_participant_id, p_line_id, v_correct, v_total,
       v_correct::double precision / v_total, v_valid, v_submitted_at);
  exception when unique_violation then
    raise exception using message = '你已经正式提交，成绩已锁定';
  end;

  foreach v_topic in array v_cells loop
    v_entry := p_entries -> v_topic;
    v_yes_id := v_entry ->> 'yesParticipantId';
    v_no_id := v_entry ->> 'noParticipantId';
    select interested into v_yes_answer
    from bingo_private.answers where participant_id = v_yes_id and topic_id = v_topic;
    select interested into v_no_answer
    from bingo_private.answers where participant_id = v_no_id and topic_id = v_topic;
    insert into bingo_private.submission_entries
      (submission_id, topic_id, yes_participant_id, no_participant_id, yes_correct, no_correct)
    values
      (v_submission_id, v_topic, v_yes_id, v_no_id, v_yes_answer = true, v_no_answer = false);
  end loop;

  return jsonb_build_object('submission', jsonb_build_object(
    'lineId', p_line_id,
    'lineLabel', v_line_label,
    'correctCount', v_correct,
    'totalCount', v_total,
    'accuracy', v_correct::double precision / v_total,
    'valid', v_valid,
    'submittedAt', v_submitted_at
  ));
end;
$$;

create or replace function public.bingo_admin_participant_detail(p_token text, p_participant_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not exists (
    select 1 from bingo_private.admin_sessions
    where token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
      and expires_at > now()
  ) then raise exception using message = '管理登录已失效'; end if;

  select jsonb_build_object(
    'participant', jsonb_build_object(
      'id', p.id,
      'nickname', p.nickname,
      'role', p.role,
      'status', case when s.id is not null then 'submitted' when d.participant_id is not null then 'draft' else 'not_started' end,
      'updated_at', coalesce(s.submitted_at, d.updated_at),
      'line_id', s.line_id,
      'accuracy', s.accuracy,
      'valid', s.valid
    ),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'topic_id', topic.id,
        'label', topic.label,
        'special', topic.special,
        'free', false,
        'yes', case when yes_person.id is null then null else jsonb_build_object(
          'participant_id', yes_person.id,
          'nickname', yes_person.nickname,
          'correct', yes_answer.interested = true
        ) end,
        'no', case when no_person.id is null then null else jsonb_build_object(
          'participant_id', no_person.id,
          'nickname', no_person.nickname,
          'correct', no_answer.interested = false
        ) end
      ) order by topic.position), '[]'::jsonb)
      from (values
        (1,'r1c1','《哈利波特》',true),(2,'r1c2','无畏契约',false),(3,'r1c3','玄幻小说',false),(4,'r1c4','诺兰导演作品',false),(5,'r1c5','方大同',false),
        (6,'r2c1','宠物',false),(7,'r2c2','羽毛球',true),(8,'r2c3','周杰伦',false),(9,'r2c4','自然风光',false),(10,'r2c5','油画',false),
        (11,'r3c1','舞蹈',false),(12,'r3c2','邓紫棋',false),(13,'r3c3','王者荣耀',true),(14,'r3c4','《十日终焉》',false),(15,'r3c5','西北川藏高原',false),
        (16,'r4c1','板绘',false),(17,'r4c2','《龙族》',false),(18,'r4c3','篮球',false),(19,'r4c4','孙燕姿',true),(20,'r4c5','言情小说',false),
        (21,'r5c1','林俊杰',false),(22,'r5c2','《紫罗兰永恒花园》',false),(23,'r5c3','江南水乡',false),(24,'r5c4','乒乓球',false),(25,'r5c5','摄影',true)
      ) as topic(position,id,label,special)
      left join bingo_private.submission_entries se on se.submission_id = s.id and se.topic_id = topic.id
      left join bingo_private.participants yes_person on yes_person.id = coalesce(
        d.entries -> topic.id ->> 'yesParticipantId', se.yes_participant_id
      )
      left join bingo_private.participants no_person on no_person.id = coalesce(
        d.entries -> topic.id ->> 'noParticipantId', se.no_participant_id
      )
      left join bingo_private.answers yes_answer
        on yes_answer.participant_id = yes_person.id and yes_answer.topic_id = topic.id
      left join bingo_private.answers no_answer
        on no_answer.participant_id = no_person.id and no_answer.topic_id = topic.id
    )
  ) into v_result
  from bingo_private.participants p
  left join bingo_private.drafts d on d.participant_id = p.id
  left join bingo_private.submissions s on s.participant_id = p.id
  where p.id = p_participant_id and p.active = true;

  if v_result is null then raise exception using message = '参与者不存在'; end if;
  return v_result;
end;
$$;

revoke all on function public.bingo_submit(text, text, jsonb) from public;
revoke all on function public.bingo_admin_participant_detail(text, text) from public;
grant execute on function public.bingo_submit(text, text, jsonb) to anon;
grant execute on function public.bingo_admin_participant_detail(text, text) to anon;
