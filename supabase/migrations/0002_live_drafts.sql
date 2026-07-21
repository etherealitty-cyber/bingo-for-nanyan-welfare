create table if not exists bingo_private.drafts (
  participant_id text primary key references bingo_private.participants(id) on delete cascade,
  entries jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table bingo_private.drafts enable row level security;
revoke all on table bingo_private.drafts from public, anon, authenticated;

create or replace function public.bingo_get_draft(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_participant_id text; v_entries jsonb; v_updated_at timestamptz;
begin
  select p.id into v_participant_id
  from bingo_private.sessions s
  join bingo_private.participants p on p.id = s.participant_id
  where s.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
    and s.expires_at > now() and p.active = true;
  if not found then raise exception using message = '请重新登录'; end if;

  select entries, updated_at into v_entries, v_updated_at
  from bingo_private.drafts where participant_id = v_participant_id;

  return jsonb_build_object(
    'entries', coalesce(v_entries, '{}'::jsonb),
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.bingo_save_draft(p_token text, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id text;
  v_updated_at timestamptz := now();
begin
  select p.id into v_participant_id
  from bingo_private.sessions s
  join bingo_private.participants p on p.id = s.participant_id
  where s.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
    and s.expires_at > now() and p.active = true;
  if not found then raise exception using message = '请重新登录'; end if;

  if exists (select 1 from bingo_private.submissions where participant_id = v_participant_id) then
    raise exception using message = '正式提交后不能修改棋盘';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'object' then
    raise exception using message = '草稿格式无效';
  end if;
  if pg_catalog.pg_column_size(p_entries) > 100000 then
    raise exception using message = '草稿内容过大';
  end if;

  insert into bingo_private.drafts(participant_id, entries, updated_at)
  values (v_participant_id, p_entries, v_updated_at)
  on conflict (participant_id) do update
    set entries = excluded.entries, updated_at = excluded.updated_at;

  return jsonb_build_object('updatedAt', v_updated_at);
end;
$$;

create or replace function public.bingo_admin_participants(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_participants jsonb;
begin
  if not exists (
    select 1 from bingo_private.admin_sessions
    where token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
      and expires_at > now()
  ) then raise exception using message = '管理登录已失效'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'role', p.role,
    'status', case when s.id is not null then 'submitted' when d.participant_id is not null then 'draft' else 'not_started' end,
    'filled_count', (select count(*) from jsonb_object_keys(coalesce(d.entries, '{}'::jsonb))) * 2,
    'updated_at', coalesce(s.submitted_at, d.updated_at),
    'line_id', s.line_id,
    'accuracy', s.accuracy,
    'valid', s.valid
  ) order by
    case when s.id is not null then 0 when d.participant_id is not null then 1 else 2 end,
    coalesce(s.submitted_at, d.updated_at) desc nulls last,
    p.nickname), '[]'::jsonb)
  into v_participants
  from bingo_private.participants p
  left join bingo_private.drafts d on d.participant_id = p.id
  left join bingo_private.submissions s on s.participant_id = p.id
  where p.active = true;

  return jsonb_build_object('participants', v_participants);
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
        'free', topic.free,
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
        (1,'r1c1','王者荣耀',false,false),(2,'r1c2','林俊杰',false,false),(3,'r1c3','西北旅行',false,false),(4,'r1c4','原神',false,false),(5,'r1c5','星空摄影',true,false),
        (6,'r2c1','厦门旅行',false,false),(7,'r2c2','阿瓦隆',false,false),(8,'r2c3','孙燕姿',false,false),(9,'r2c4','羽毛球',true,false),(10,'r2c5','血染钟楼',false,false),
        (11,'r3c1','第五人格',false,false),(12,'r3c2','自然风光',false,false),(13,'r3c3','免费格',false,true),(14,'r3c4','周杰伦',false,false),(15,'r3c5','绘画',false,false),
        (16,'r4c1','邓紫棋',false,false),(17,'r4c2','剧本杀',true,false),(18,'r4c3','土耳其旅行',false,false),(19,'r4c4','无畏契约',false,false),(20,'r4c5','言情小说',false,false),
        (21,'r5c1','西藏旅行',true,false),(22,'r5c2','薇尔莉特',false,false),(23,'r5c3','猫和老鼠',false,false),(24,'r5c4','饥荒联机',false,false),(25,'r5c5','书法',false,false)
      ) as topic(position,id,label,special,free)
      left join bingo_private.submission_entries se on se.submission_id = s.id and se.topic_id = topic.id
      left join bingo_private.participants yes_person on yes_person.id = coalesce(
        d.entries -> topic.id ->> 'yesParticipantId', se.yes_participant_id
      )
      left join bingo_private.participants no_person on no_person.id = coalesce(
        d.entries -> topic.id ->> 'noParticipantId', se.no_participant_id
      )
      left join bingo_private.answers yes_answer on yes_answer.participant_id = yes_person.id and yes_answer.topic_id = topic.id
      left join bingo_private.answers no_answer on no_answer.participant_id = no_person.id and no_answer.topic_id = topic.id
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

revoke all on function public.bingo_get_draft(text) from public;
revoke all on function public.bingo_save_draft(text, jsonb) from public;
revoke all on function public.bingo_admin_participants(text) from public;
revoke all on function public.bingo_admin_participant_detail(text, text) from public;
grant execute on function public.bingo_get_draft(text) to anon;
grant execute on function public.bingo_save_draft(text, jsonb) to anon;
grant execute on function public.bingo_admin_participants(text) to anon;
grant execute on function public.bingo_admin_participant_detail(text, text) to anon;
