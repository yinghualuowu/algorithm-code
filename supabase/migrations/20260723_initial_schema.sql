create extension if not exists "uuid-ossp" with schema extensions;

create table public.problems (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  external_id text not null,
  title text not null check (length(trim(title)) > 0),
  url text not null default '',
  source text not null default '',
  difficulty text not null default '中等' check (difficulty in ('简单', '中等', '困难')),
  statement text not null default '',
  input_text text not null default '',
  output_text text not null default '',
  tags text[] not null default '{}',
  hints text[] not null default array['', '', '']::text[] check (cardinality(hints) <= 3),
  notes text not null default '',
  status text not null default 'pending' check (status in ('solved', 'thinking', 'pending')),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, external_id)
);

create table public.problem_solutions (
  user_id uuid not null,
  id uuid not null default gen_random_uuid(),
  problem_id uuid not null,
  language text not null default 'TypeScript',
  code text not null default '',
  time_complexity text not null default '',
  space_complexity text not null default '',
  position integer not null default 0 check (position >= 0),
  primary key (user_id, id),
  foreign key (user_id, problem_id)
    references public.problems(user_id, id)
    on delete cascade
);

create table public.problem_attempts (
  user_id uuid not null,
  id uuid not null default gen_random_uuid(),
  problem_id uuid not null,
  attempted_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, problem_id)
    references public.problems(user_id, id)
    on delete cascade
);

comment on table public.problems is '用户的算法题目主体；通过 user_id 与 RLS 实现账户隔离';
comment on column public.problems.user_id is 'Supabase Auth 用户 ID';
comment on column public.problems.id is '数据库内部 UUID，由 external_id 稳定映射';
comment on column public.problems.external_id is '前端及 JSON 导入使用的稳定题目标识';
comment on column public.problems.title is '题目名称';
comment on column public.problems.url is '原题链接';
comment on column public.problems.source is '题目来源，例如 LeetCode 或洛谷';
comment on column public.problems.difficulty is '难度：简单、中等、困难';
comment on column public.problems.statement is '题目描述正文';
comment on column public.problems.input_text is '输入说明或示例';
comment on column public.problems.output_text is '输出说明或示例';
comment on column public.problems.tags is '支持父级/子级格式的知识标签数组';
comment on column public.problems.hints is '最多三个渐进式提示';
comment on column public.problems.notes is '支持 Markdown 与 LaTeX 的题目笔记';
comment on column public.problems.status is '解题状态：solved、thinking、pending';
comment on column public.problems.revision is '每次云端更新递增的版本号';
comment on column public.problems.created_at is '题目首次加入时间';
comment on column public.problems.updated_at is '题目最近编辑时间';

comment on table public.problem_solutions is '题目的多语言代码方案';
comment on column public.problem_solutions.user_id is '方案所属用户，用于直接执行 RLS';
comment on column public.problem_solutions.id is '代码方案 UUID';
comment on column public.problem_solutions.problem_id is '所属题目的内部 UUID';
comment on column public.problem_solutions.language is '编程语言名称';
comment on column public.problem_solutions.code is '源代码正文';
comment on column public.problem_solutions.time_complexity is '时间复杂度说明';
comment on column public.problem_solutions.space_complexity is '空间复杂度说明';
comment on column public.problem_solutions.position is '方案在详情页中的显示顺序';

comment on table public.problem_attempts is '题目的历次做题记录';
comment on column public.problem_attempts.user_id is '记录所属用户，用于直接执行 RLS';
comment on column public.problem_attempts.id is '做题记录 UUID';
comment on column public.problem_attempts.problem_id is '所属题目的内部 UUID';
comment on column public.problem_attempts.attempted_at is '本次做题发生时间';

create index problems_user_updated_idx on public.problems(user_id, updated_at desc);
create index problems_tags_idx on public.problems using gin(tags);
create index problem_solutions_parent_idx on public.problem_solutions(user_id, problem_id, position);
create index problem_attempts_parent_idx on public.problem_attempts(user_id, problem_id, attempted_at desc);

create or replace function public.touch_problem_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger problems_touch_updated_at
before update on public.problems
for each row execute function public.touch_problem_updated_at();

alter table public.problems enable row level security;
alter table public.problem_solutions enable row level security;
alter table public.problem_attempts enable row level security;

-- 每张表都直接校验 auth.uid()，即使绕过父表查询也无法读取其他用户的数据。
create policy "Users read own problems"
  on public.problems for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own problems"
  on public.problems for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own problems"
  on public.problems for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own problems"
  on public.problems for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read own solutions"
  on public.problem_solutions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own solutions"
  on public.problem_solutions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own solutions"
  on public.problem_solutions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own solutions"
  on public.problem_solutions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read own attempts"
  on public.problem_attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own attempts"
  on public.problem_attempts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own attempts"
  on public.problem_attempts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own attempts"
  on public.problem_attempts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.problems, public.problem_solutions, public.problem_attempts from anon;
grant select, insert, update, delete on table
  public.problems, public.problem_solutions, public.problem_attempts
  to authenticated;

create or replace function public.stable_import_uuid(source_id text)
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  if source_id is null or trim(source_id) = '' then
    return gen_random_uuid();
  end if;
  if source_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return source_id::uuid;
  end if;
  return extensions.uuid_generate_v5(extensions.uuid_ns_url(), source_id);
end;
$$;

create or replace function public.save_problem(p_problem jsonb)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_problem_id uuid;
  v_external_id text;
  solution jsonb;
  attempt jsonb;
  item_position integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(coalesce(p_problem->>'title', ''))) = 0 then
    raise exception 'Problem title is required';
  end if;

  v_external_id := coalesce(nullif(trim(p_problem->>'id'), ''), gen_random_uuid()::text);
  v_problem_id := public.stable_import_uuid(v_external_id);

  -- 主表、代码方案和做题记录在同一事务内替换，避免客户端多请求造成部分写入。
  insert into public.problems (
    user_id, id, external_id, title, url, source, difficulty, statement, input_text, output_text,
    tags, hints, notes, status, created_at, updated_at
  )
  values (
    current_user_id,
    v_problem_id,
    v_external_id,
    p_problem->>'title',
    coalesce(p_problem->>'url', ''),
    coalesce(p_problem->>'source', ''),
    case when p_problem->>'difficulty' in ('简单', '中等', '困难') then p_problem->>'difficulty' else '中等' end,
    coalesce(p_problem->>'statement', ''),
    coalesce(p_problem->>'input', ''),
    coalesce(p_problem->>'output', ''),
    array(select jsonb_array_elements_text(coalesce(p_problem->'tags', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_problem->'hints', '["", "", ""]'::jsonb))),
    coalesce(p_problem->>'notes', ''),
    case when p_problem->>'status' in ('solved', 'thinking', 'pending') then p_problem->>'status' else 'pending' end,
    coalesce((p_problem->>'createdAt')::timestamptz, now()),
    coalesce((p_problem->>'updatedAt')::timestamptz, now())
  )
  on conflict (user_id, external_id) do update set
    title = excluded.title,
    url = excluded.url,
    source = excluded.source,
    difficulty = excluded.difficulty,
    statement = excluded.statement,
    input_text = excluded.input_text,
    output_text = excluded.output_text,
    tags = excluded.tags,
    hints = excluded.hints,
    notes = excluded.notes,
    status = excluded.status,
    revision = public.problems.revision + 1,
    updated_at = now()
  returning id into v_problem_id;

  delete from public.problem_solutions
  where user_id = current_user_id and problem_id = v_problem_id;

  for solution in
    select value from jsonb_array_elements(coalesce(p_problem->'solutions', '[]'::jsonb))
  loop
    insert into public.problem_solutions (
      user_id, id, problem_id, language, code, time_complexity, space_complexity, position
    )
    values (
      current_user_id,
      public.stable_import_uuid(v_problem_id::text || ':solution:' || coalesce(solution->>'id', item_position::text)),
      v_problem_id,
      coalesce(solution->>'language', 'TypeScript'),
      coalesce(solution->>'code', ''),
      coalesce(solution->>'timeComplexity', ''),
      coalesce(solution->>'spaceComplexity', ''),
      item_position
    );
    item_position := item_position + 1;
  end loop;

  delete from public.problem_attempts
  where user_id = current_user_id and problem_id = v_problem_id;

  for attempt in
    select value from jsonb_array_elements(coalesce(p_problem->'attempts', '[]'::jsonb))
  loop
    insert into public.problem_attempts (user_id, id, problem_id, attempted_at)
    values (
      current_user_id,
      public.stable_import_uuid(v_problem_id::text || ':attempt:' || coalesce(attempt->>'id', attempt->>'attemptedAt')),
      v_problem_id,
      coalesce((attempt->>'attemptedAt')::timestamptz, now())
    );
  end loop;

  return v_external_id;
end;
$$;

revoke all on function public.stable_import_uuid(text) from public;
grant execute on function public.stable_import_uuid(text) to authenticated;
revoke all on function public.save_problem(jsonb) from public;
grant execute on function public.save_problem(jsonb) to authenticated;
