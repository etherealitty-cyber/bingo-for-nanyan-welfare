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
        'submitted_at', ranked.submitted_at
      ) order by ranked.rank), '[]'::jsonb)
      from (
        select
          row_number() over (order by s.submitted_at)::integer as rank,
          p.nickname,
          p.role,
          s.accuracy,
          s.submitted_at
        from bingo_private.submissions s
        join bingo_private.participants p on p.id = s.participant_id
        where s.valid = true
          and p.role in ('counselor', 'staff')
        order by s.submitted_at
      ) ranked
    )
  );
$$;

revoke all on function public.bingo_leaderboard() from public;
grant execute on function public.bingo_leaderboard() to anon;
