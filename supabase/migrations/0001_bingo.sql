create extension if not exists pgcrypto with schema extensions;
create schema if not exists bingo_private;

create table if not exists bingo_private.participants (
  id text primary key,
  nickname text not null unique,
  role text not null check (role in ('camper', 'counselor', 'staff')),
  invite_code_hash text not null unique,
  eligible_for_prize boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists bingo_private.answers (
  participant_id text not null references bingo_private.participants(id) on delete cascade,
  topic_id text not null,
  interested boolean not null,
  primary key (participant_id, topic_id)
);

create table if not exists bingo_private.sessions (
  token_hash text primary key,
  participant_id text not null references bingo_private.participants(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists bingo_private.submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null unique references bingo_private.participants(id) on delete restrict,
  line_id text not null,
  correct_count integer not null,
  total_count integer not null,
  accuracy double precision not null,
  valid boolean not null,
  submitted_at timestamptz not null default now()
);

create table if not exists bingo_private.submission_entries (
  submission_id uuid not null references bingo_private.submissions(id) on delete cascade,
  topic_id text not null,
  yes_participant_id text not null references bingo_private.participants(id) on delete restrict,
  no_participant_id text not null references bingo_private.participants(id) on delete restrict,
  yes_correct boolean not null,
  no_correct boolean not null,
  primary key (submission_id, topic_id)
);

create table if not exists bingo_private.admin_config (
  singleton boolean primary key default true check (singleton),
  password_hash text not null
);

create table if not exists bingo_private.admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists answers_topic_idx on bingo_private.answers(topic_id, participant_id);
create index if not exists submissions_ranking_idx on bingo_private.submissions(valid, submitted_at);
create index if not exists sessions_participant_idx on bingo_private.sessions(participant_id);

alter table bingo_private.participants enable row level security;
alter table bingo_private.answers enable row level security;
alter table bingo_private.sessions enable row level security;
alter table bingo_private.submissions enable row level security;
alter table bingo_private.submission_entries enable row level security;
alter table bingo_private.admin_config enable row level security;
alter table bingo_private.admin_sessions enable row level security;

revoke all on schema bingo_private from public, anon, authenticated;
revoke all on all tables in schema bingo_private from public, anon, authenticated;

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
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception using message = '请输入6位邀请码';
  end if;

  select * into v_participant
  from bingo_private.participants
  where invite_code_hash = encode(extensions.digest(convert_to(p_code, 'UTF8'), 'sha256'), 'hex')
    and active = true;

  if not found then
    raise exception using message = '邀请码无效，请联系工作人员';
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

create or replace function public.bingo_game(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant bingo_private.participants%rowtype;
  v_people jsonb;
  v_submission jsonb;
begin
  select p.* into v_participant
  from bingo_private.sessions s
  join bingo_private.participants p on p.id = s.participant_id
  where s.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
    and s.expires_at > now() and p.active = true;

  if not found then raise exception using message = '请重新登录'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'nickname', nickname, 'role', role,
    'roleLabel', case role when 'camper' then '营员' when 'counselor' then '辅导员' else '工作人员' end
  ) order by nickname), '[]'::jsonb)
  into v_people from bingo_private.participants where active = true;

  select jsonb_build_object(
    'line_id', line_id, 'correct_count', correct_count, 'total_count', total_count,
    'accuracy', accuracy, 'valid', valid, 'submitted_at', submitted_at
  ) into v_submission
  from bingo_private.submissions where participant_id = v_participant.id;

  return jsonb_build_object(
    'participant', jsonb_build_object(
      'id', v_participant.id, 'nickname', v_participant.nickname, 'role', v_participant.role,
      'eligible_for_prize', v_participant.eligible_for_prize,
      'roleLabel', case v_participant.role when 'camper' then '营员' when 'counselor' then '辅导员' else '工作人员' end
    ),
    'people', v_people,
    'submission', v_submission
  );
end;
$$;

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
  v_yes_correct boolean;
  v_no_correct boolean;
  v_correct integer := 0;
  v_total integer;
  v_valid boolean;
  v_submission_id uuid := gen_random_uuid();
  v_submitted_at timestamptz := now();
begin
  select p.id into v_participant_id
  from bingo_private.sessions s join bingo_private.participants p on p.id = s.participant_id
  where s.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
    and s.expires_at > now() and p.active = true;
  if not found then raise exception using message = '请重新登录'; end if;

  if exists (select 1 from bingo_private.submissions where participant_id = v_participant_id) then
    raise exception using message = '你已经正式提交，成绩已锁定';
  end if;

  select cells, label into v_cells, v_line_label from (values
    ('row-1', array['r1c1','r1c2','r1c3','r1c4','r1c5']::text[], '第 1 横行'),
    ('row-2', array['r2c1','r2c2','r2c3','r2c4','r2c5']::text[], '第 2 横行'),
    ('row-3', array['r3c1','r3c2','r3c4','r3c5']::text[], '第 3 横行'),
    ('row-4', array['r4c1','r4c2','r4c3','r4c4','r4c5']::text[], '第 4 横行'),
    ('row-5', array['r5c1','r5c2','r5c3','r5c4','r5c5']::text[], '第 5 横行'),
    ('column-1', array['r1c1','r2c1','r3c1','r4c1','r5c1']::text[], '第 1 竖列'),
    ('column-2', array['r1c2','r2c2','r3c2','r4c2','r5c2']::text[], '第 2 竖列'),
    ('column-3', array['r1c3','r2c3','r4c3','r5c3']::text[], '第 3 竖列'),
    ('column-4', array['r1c4','r2c4','r3c4','r4c4','r5c4']::text[], '第 4 竖列'),
    ('column-5', array['r1c5','r2c5','r3c5','r4c5','r5c5']::text[], '第 5 竖列'),
    ('diagonal-main', array['r1c1','r2c2','r4c4','r5c5']::text[], '左上至右下对角线')
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
    if v_topic = any(array['r1c5','r2c4','r4c2','r5c1']::text[]) and exists (
      select 1 from bingo_private.participants where id in (v_yes_id, v_no_id) and role = 'camper'
    ) then
      raise exception using message = '蓝色特殊格只能填写辅导员或工作人员';
    end if;

    select interested into v_yes_answer from bingo_private.answers where participant_id = v_yes_id and topic_id = v_topic;
    if not found then raise exception using message = '有人未回答该兴趣题，请更换填写人员'; end if;
    select interested into v_no_answer from bingo_private.answers where participant_id = v_no_id and topic_id = v_topic;
    if not found then raise exception using message = '有人未回答该兴趣题，请更换填写人员'; end if;
    v_yes_correct := v_yes_answer = true;
    v_no_correct := v_no_answer = false;
    v_correct := v_correct + v_yes_correct::integer + v_no_correct::integer;
  end loop;

  v_total := cardinality(v_cells) * 2;
  v_valid := v_correct >= ceil(v_total * 0.8);
  begin
    insert into bingo_private.submissions(id, participant_id, line_id, correct_count, total_count, accuracy, valid, submitted_at)
    values (v_submission_id, v_participant_id, p_line_id, v_correct, v_total, v_correct::double precision / v_total, v_valid, v_submitted_at);
  exception when unique_violation then
    raise exception using message = '你已经正式提交，成绩已锁定';
  end;

  foreach v_topic in array v_cells loop
    v_entry := p_entries -> v_topic;
    v_yes_id := v_entry ->> 'yesParticipantId';
    v_no_id := v_entry ->> 'noParticipantId';
    select interested into v_yes_answer from bingo_private.answers where participant_id = v_yes_id and topic_id = v_topic;
    select interested into v_no_answer from bingo_private.answers where participant_id = v_no_id and topic_id = v_topic;
    insert into bingo_private.submission_entries
      (submission_id, topic_id, yes_participant_id, no_participant_id, yes_correct, no_correct)
    values (v_submission_id, v_topic, v_yes_id, v_no_id, v_yes_answer = true, v_no_answer = false);
  end loop;

  return jsonb_build_object('submission', jsonb_build_object(
    'lineId', p_line_id, 'lineLabel', v_line_label, 'correctCount', v_correct,
    'totalCount', v_total, 'accuracy', v_correct::double precision / v_total,
    'valid', v_valid, 'submittedAt', v_submitted_at
  ));
end;
$$;

create or replace function public.bingo_leaderboard()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'rankings', coalesce(jsonb_agg(jsonb_build_object(
      'rank', ranked.rank, 'nickname', ranked.nickname,
      'accuracy', ranked.accuracy, 'submitted_at', ranked.submitted_at
    ) order by ranked.rank), '[]'::jsonb)
  )
  from (
    select row_number() over (order by s.submitted_at)::integer as rank,
      p.nickname, s.accuracy, s.submitted_at
    from bingo_private.submissions s join bingo_private.participants p on p.id = s.participant_id
    where s.valid = true and p.role = 'camper' and p.eligible_for_prize = true
    order by s.submitted_at limit 10
  ) ranked;
$$;

create or replace function public.bingo_admin_login(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_token text;
begin
  if not exists (
    select 1 from bingo_private.admin_config
    where password_hash = encode(extensions.digest(convert_to(coalesce(p_password, ''), 'UTF8'), 'sha256'), 'hex')
  ) then raise exception using message = '管理密码错误'; end if;
  delete from bingo_private.admin_sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into bingo_private.admin_sessions(token_hash, expires_at)
  values (encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), now() + interval '8 hours');
  return jsonb_build_object('token', v_token);
end;
$$;

create or replace function public.bingo_admin_overview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_stats jsonb; v_submissions jsonb;
begin
  if not exists (
    select 1 from bingo_private.admin_sessions
    where token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
      and expires_at > now()
  ) then raise exception using message = '管理登录已失效'; end if;

  select jsonb_build_object(
    'participant_count', (select count(*) from bingo_private.participants where active = true),
    'submission_count', (select count(*) from bingo_private.submissions),
    'valid_count', (select count(*) from bingo_private.submissions where valid = true)
  ) into v_stats;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'nickname', p.nickname, 'role', p.role, 'line_id', s.line_id,
    'correct_count', s.correct_count, 'total_count', s.total_count,
    'accuracy', s.accuracy, 'valid', s.valid, 'submitted_at', s.submitted_at
  ) order by s.submitted_at), '[]'::jsonb) into v_submissions
  from bingo_private.submissions s join bingo_private.participants p on p.id = s.participant_id;
  return jsonb_build_object('stats', v_stats, 'submissions', v_submissions);
end;
$$;

revoke all on function public.bingo_login(text) from public;
revoke all on function public.bingo_game(text) from public;
revoke all on function public.bingo_submit(text, text, jsonb) from public;
revoke all on function public.bingo_leaderboard() from public;
revoke all on function public.bingo_admin_login(text) from public;
revoke all on function public.bingo_admin_overview(text) from public;
grant execute on function public.bingo_login(text) to anon;
grant execute on function public.bingo_game(text) to anon;
grant execute on function public.bingo_submit(text, text, jsonb) to anon;
grant execute on function public.bingo_leaderboard() to anon;
grant execute on function public.bingo_admin_login(text) to anon;
grant execute on function public.bingo_admin_overview(text) to anon;
