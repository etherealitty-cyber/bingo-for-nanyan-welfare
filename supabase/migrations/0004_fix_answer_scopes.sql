begin;

-- 玄幻小说：尊重问卷中自报“玄幻”的答案，同时补入明确属于
-- 玄幻/中式或网络奇幻、但填报时写作“幻想/奇幻/克苏鲁”的作品。
update bingo_private.answers a
set interested = p.nickname = any(array[
  '李美晔', '刘宇', '李韪呈', '谭宇轩', '邬伊人', '李琦', '孙诚',
  '陈锦洋', '陈梦情', '邹梓杰', '吴双', '唐嘉龙', '颜孝祺'
]::text[])
from bingo_private.participants p
where a.participant_id = p.id
  and a.topic_id = 'r1c3';

-- 诺兰导演作品：写出诺兰本人或任一诺兰执导作品均为“是”。
update bingo_private.answers a
set interested = p.nickname = any(array[
  '李韪呈', '贺子轩', '陈梦情', '曾祥瑞', '李诗思', '邹梓杰'
]::text[])
from bingo_private.participants p
where a.participant_id = p.id
  and a.topic_id = 'r1c4';

-- 江南水乡采用广义江南口径：本次问卷中明确位于沪、苏南或浙北
-- 的南京、上海、杭州、苏州、安吉及相关景点均计为“是”。
update bingo_private.answers a
set interested = p.nickname = any(array[
  '李馨怡', '罗惠', '杨显全', '李琦', '唐子贻', '夏婉仪',
  '罗梓涵', '孟学思', '高千惠', '王瑜', '周娜', '尹琳'
]::text[])
from bingo_private.participants p
where a.participant_id = p.id
  and a.topic_id = 'r5c3';

-- 若测试期间已经有人提交过，按新标准同步刷新逐格正确性和总成绩。
update bingo_private.submission_entries se
set
  yes_correct = yes_answer.interested,
  no_correct = not no_answer.interested
from bingo_private.answers yes_answer,
     bingo_private.answers no_answer
where yes_answer.participant_id = se.yes_participant_id
  and yes_answer.topic_id = se.topic_id
  and no_answer.participant_id = se.no_participant_id
  and no_answer.topic_id = se.topic_id;

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

commit;

select
  a.topic_id,
  count(*) filter (where a.interested) as yes_count,
  count(*) filter (where not a.interested) as no_count
from bingo_private.answers a
where a.topic_id in ('r1c3', 'r1c4', 'r5c3')
group by a.topic_id
order by a.topic_id;
