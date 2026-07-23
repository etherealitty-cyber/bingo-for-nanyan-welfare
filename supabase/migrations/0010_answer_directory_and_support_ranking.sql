begin;

create or replace function public.bingo_leaderboard()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'rankings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'rank', ranked.rank,
        'nickname', ranked.nickname,
        'accuracy', ranked.accuracy,
        'submitted_at', ranked.submitted_at
      ) order by ranked.rank), '[]'::jsonb)
      from (
        select
          row_number() over (order by s.submitted_at)::integer as rank,
          p.nickname,
          s.accuracy,
          s.submitted_at
        from bingo_private.submissions s
        join bingo_private.participants p on p.id = s.participant_id
        where s.valid = true
          and p.role = 'camper'
          and p.eligible_for_prize = true
        order by s.submitted_at
        limit 10
      ) ranked
    ),
    'supportRankings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'rank', ranked.rank,
        'nickname', ranked.nickname,
        'role', ranked.role,
        'accuracy', ranked.accuracy,
        'valid', ranked.valid,
        'submitted_at', ranked.submitted_at
      ) order by ranked.rank), '[]'::jsonb)
      from (
        select
          row_number() over (order by s.submitted_at)::integer as rank,
          p.nickname,
          p.role,
          s.accuracy,
          s.valid,
          s.submitted_at
        from bingo_private.submissions s
        join bingo_private.participants p on p.id = s.participant_id
        where p.role in ('counselor', 'staff')
        order by s.submitted_at
      ) ranked
    )
  );
$$;

create or replace function public.bingo_answer_directory(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id text;
  v_topics jsonb;
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

  if not exists (
    select 1 from bingo_private.submissions
    where participant_id = v_participant_id
  ) then
    raise exception using message = '正式提交后才能查看完整答案册';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'topic_id', grouped.topic_id,
    'yes', grouped.yes_people,
    'no', grouped.no_people
  ) order by grouped.topic_id), '[]'::jsonb)
  into v_topics
  from (
    select
      a.topic_id,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'role', p.role
      ) order by
        case p.role when 'counselor' then 0 when 'staff' then 1 else 2 end,
        p.nickname
      ) filter (where a.interested), '[]'::jsonb) as yes_people,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'role', p.role
      ) order by
        case p.role when 'counselor' then 0 when 'staff' then 1 else 2 end,
        p.nickname
      ) filter (where not a.interested), '[]'::jsonb) as no_people
    from bingo_private.answers a
    join bingo_private.participants p on p.id = a.participant_id
    where p.active = true
    group by a.topic_id
  ) grouped;

  return jsonb_build_object('topics', v_topics);
end;
$$;

revoke all on function public.bingo_leaderboard() from public;
revoke all on function public.bingo_answer_directory(text) from public;

grant execute on function public.bingo_leaderboard() to anon;
grant execute on function public.bingo_answer_directory(text) to anon;

commit;
