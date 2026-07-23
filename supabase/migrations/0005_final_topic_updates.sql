begin;

-- 最终版题目：自然风光摄影
update bingo_private.answers a
set interested = p.nickname = any(array[
  '李美晔', '罗惠', '李韪呈', '肖培培', '陈瑾瑜', '方晨杰',
  '刘适奥', '杨显全', '李琦', '莫尚为', '李孜瑶', '陈锦洋',
  '唐子贻', '涂欢希', '刘斌', '李牧', '陈梦情', '曾祥瑞',
  '李诗思', '肖晴', '李恬', '胡蓝月', '欧阳嘉聪', '邹梓杰',
  '邹俊', '周娜', '张恩', '王湘梅', '蒋林珂', '罗诗娴'
]::text[])
from bingo_private.participants p
where a.participant_id = p.id
  and a.topic_id = 'r2c4';

-- 最终版题目：异国景致
update bingo_private.answers a
set interested = p.nickname = any(array[
  '曾祥瑞', '贺子轩', '李诗思', '刘斌', '孙诚', '张恩', '李牧'
]::text[])
from bingo_private.participants p
where a.participant_id = p.id
  and a.topic_id = 'r5c3';

-- 最终版题目：人文摄影
update bingo_private.answers a
set interested = p.nickname = any(array[
  '杨显全', '罗梓涵', '高千惠', '莫尚为', '陈梦情', '涂欢希', '颜孝祺'
]::text[])
from bingo_private.participants p
where a.participant_id = p.id
  and a.topic_id = 'r5c5';

-- 已有测试提交按最终答案重新计算。
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

create or replace function public.bingo_admin_participant_detail(
  p_token text,
  p_participant_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
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

  select jsonb_build_object(
    'participant', jsonb_build_object(
      'id', p.id,
      'nickname', p.nickname,
      'role', p.role,
      'status', case
        when s.id is not null then 'submitted'
        when d.participant_id is not null then 'draft'
        else 'not_started'
      end,
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
        (1,'r1c1','《哈利波特》',true),
        (2,'r1c2','无畏契约',false),
        (3,'r1c3','玄幻小说',false),
        (4,'r1c4','诺兰导演作品',false),
        (5,'r1c5','方大同',false),
        (6,'r2c1','宠物',false),
        (7,'r2c2','羽毛球',true),
        (8,'r2c3','周杰伦',false),
        (9,'r2c4','自然风光摄影',false),
        (10,'r2c5','油画',false),
        (11,'r3c1','舞蹈',false),
        (12,'r3c2','邓紫棋',false),
        (13,'r3c3','王者荣耀',true),
        (14,'r3c4','《十日终焉》',false),
        (15,'r3c5','西北川藏高原',false),
        (16,'r4c1','板绘',false),
        (17,'r4c2','《龙族》',false),
        (18,'r4c3','篮球',false),
        (19,'r4c4','孙燕姿',true),
        (20,'r4c5','言情小说',false),
        (21,'r5c1','林俊杰',false),
        (22,'r5c2','《紫罗兰永恒花园》',false),
        (23,'r5c3','异国景致',false),
        (24,'r5c4','乒乓球',false),
        (25,'r5c5','人文摄影',true)
      ) as topic(position,id,label,special)
      left join bingo_private.submission_entries se
        on se.submission_id = s.id and se.topic_id = topic.id
      left join bingo_private.participants yes_person
        on yes_person.id = coalesce(
          d.entries -> topic.id ->> 'yesParticipantId',
          se.yes_participant_id
        )
      left join bingo_private.participants no_person
        on no_person.id = coalesce(
          d.entries -> topic.id ->> 'noParticipantId',
          se.no_participant_id
        )
      left join bingo_private.answers yes_answer
        on yes_answer.participant_id = yes_person.id
       and yes_answer.topic_id = topic.id
      left join bingo_private.answers no_answer
        on no_answer.participant_id = no_person.id
       and no_answer.topic_id = topic.id
    )
  ) into v_result
  from bingo_private.participants p
  left join bingo_private.drafts d on d.participant_id = p.id
  left join bingo_private.submissions s on s.participant_id = p.id
  where p.id = p_participant_id and p.active = true;

  if v_result is null then
    raise exception using message = '参与者不存在';
  end if;
  return v_result;
end;
$$;

revoke all on function public.bingo_admin_participant_detail(text, text) from public;
grant execute on function public.bingo_admin_participant_detail(text, text) to anon;

commit;

select
  a.topic_id,
  count(*) filter (where a.interested) as yes_count,
  count(*) filter (where not a.interested) as no_count
from bingo_private.answers a
where a.topic_id in ('r2c4', 'r5c3', 'r5c5')
group by a.topic_id
order by a.topic_id;
