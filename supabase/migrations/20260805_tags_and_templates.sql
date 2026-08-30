alter table public.problems rename column tags to custom_tags;
alter table public.problems add column algorithm_ids text[] not null default '{}';
drop index if exists public.problems_tags_idx;
create index problems_custom_tags_idx on public.problems using gin(custom_tags);
create index problems_algorithm_ids_idx on public.problems using gin(algorithm_ids);

create table public.code_templates (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  external_id text not null,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  custom_tags text[] not null default '{}',
  algorithm_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, external_id)
);

create table public.template_variants (
  user_id uuid not null,
  id uuid not null default gen_random_uuid(),
  template_id uuid not null,
  language text not null default 'C++',
  code text not null default '',
  position integer not null default 0 check (position >= 0),
  primary key (user_id, id),
  foreign key (user_id, template_id) references public.code_templates(user_id, id) on delete cascade
);

create index code_templates_user_updated_idx on public.code_templates(user_id, updated_at desc);
create index code_templates_custom_tags_idx on public.code_templates using gin(custom_tags);
create index code_templates_algorithm_ids_idx on public.code_templates using gin(algorithm_ids);
create index template_variants_parent_idx on public.template_variants(user_id, template_id, position);

comment on column public.problems.custom_tags is '用户自定义标签；由旧 tags 字段无损迁移，可批量重命名、合并或删除';
comment on column public.problems.algorithm_ids is '关联 algorithms.json 系统算法目录的稳定 ID 数组';
comment on table public.code_templates is '用户维护的代码模板主体；支持系统标签、自定义标签和多语言实现';
comment on column public.code_templates.user_id is '模板所属用户，用于 RLS 账户隔离';
comment on column public.code_templates.id is '数据库内部 UUID';
comment on column public.code_templates.external_id is '前端、缓存和 JSON 导入使用的稳定模板标识';
comment on column public.code_templates.title is '代码模板名称';
comment on column public.code_templates.description is '支持 Markdown 与 LaTeX 的模板解释和使用说明';
comment on column public.code_templates.custom_tags is '用户自定义标签数组';
comment on column public.code_templates.algorithm_ids is '关联 algorithms.json 系统算法目录的稳定 ID 数组';
comment on column public.code_templates.created_at is '模板创建时间';
comment on column public.code_templates.updated_at is '模板最近编辑时间';
comment on table public.template_variants is '代码模板的多语言实现';
comment on column public.template_variants.user_id is '实现所属用户，用于 RLS 账户隔离';
comment on column public.template_variants.id is '模板语言实现的稳定 UUID';
comment on column public.template_variants.template_id is '所属代码模板的内部 UUID';
comment on column public.template_variants.language is '编程语言名称';
comment on column public.template_variants.code is '模板源代码正文';
comment on column public.template_variants.position is '语言实现在详情页中的显示顺序';

create trigger code_templates_touch_updated_at
before update on public.code_templates
for each row execute function public.touch_problem_updated_at();

alter table public.code_templates enable row level security;
alter table public.template_variants enable row level security;

create policy "Users manage own templates" on public.code_templates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users manage own template variants" on public.template_variants
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.code_templates, public.template_variants from anon;
grant select, insert, update, delete on table public.code_templates, public.template_variants to authenticated;

create or replace function public.save_problem(p_problem jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_problem_id uuid;
  v_external_id text;
  solution jsonb;
  attempt jsonb;
  item_position integer := 0;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_problem->>'title', ''))) = 0 then raise exception 'Problem title is required'; end if;
  v_external_id := coalesce(nullif(trim(p_problem->>'id'), ''), gen_random_uuid()::text);
  v_problem_id := public.stable_import_uuid(v_external_id);
  insert into public.problems (
    user_id, id, external_id, title, url, source, difficulty, statement, input_text, output_text,
    custom_tags, algorithm_ids, hints, notes, status, created_at, updated_at
  ) values (
    current_user_id, v_problem_id, v_external_id, p_problem->>'title',
    coalesce(p_problem->>'url', ''), coalesce(p_problem->>'source', ''),
    case when p_problem->>'difficulty' in ('简单', '中等', '困难') then p_problem->>'difficulty' else '中等' end,
    coalesce(p_problem->>'statement', ''), coalesce(p_problem->>'input', ''), coalesce(p_problem->>'output', ''),
    array(select jsonb_array_elements_text(coalesce(p_problem->'customTags', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_problem->'algorithmIds', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_problem->'hints', '["", "", ""]'::jsonb))),
    coalesce(p_problem->>'notes', ''),
    case when p_problem->>'status' in ('solved', 'thinking', 'pending') then p_problem->>'status' else 'pending' end,
    coalesce((p_problem->>'createdAt')::timestamptz, now()), coalesce((p_problem->>'updatedAt')::timestamptz, now())
  )
  on conflict (user_id, external_id) do update set
    title=excluded.title, url=excluded.url, source=excluded.source, difficulty=excluded.difficulty,
    statement=excluded.statement, input_text=excluded.input_text, output_text=excluded.output_text,
    custom_tags=excluded.custom_tags, algorithm_ids=excluded.algorithm_ids, hints=excluded.hints,
    notes=excluded.notes, status=excluded.status, revision=public.problems.revision + 1, updated_at=now()
  returning id into v_problem_id;
  delete from public.problem_solutions where user_id=current_user_id and problem_id=v_problem_id;
  for solution in select value from jsonb_array_elements(coalesce(p_problem->'solutions', '[]'::jsonb)) loop
    insert into public.problem_solutions(user_id,id,problem_id,language,code,time_complexity,space_complexity,position)
    values(current_user_id,public.stable_import_uuid(v_problem_id::text || ':solution:' || coalesce(solution->>'id',item_position::text)),
      v_problem_id,coalesce(solution->>'language','TypeScript'),coalesce(solution->>'code',''),
      coalesce(solution->>'timeComplexity',''),coalesce(solution->>'spaceComplexity',''),item_position);
    item_position := item_position + 1;
  end loop;
  delete from public.problem_attempts where user_id=current_user_id and problem_id=v_problem_id;
  for attempt in select value from jsonb_array_elements(coalesce(p_problem->'attempts', '[]'::jsonb)) loop
    insert into public.problem_attempts(user_id,id,problem_id,attempted_at)
    values(current_user_id,public.stable_import_uuid(v_problem_id::text || ':attempt:' || coalesce(attempt->>'id',attempt->>'attemptedAt')),
      v_problem_id,coalesce((attempt->>'attemptedAt')::timestamptz,now()));
  end loop;
  return v_external_id;
end;
$$;

create or replace function public.save_code_template(p_template jsonb)
returns text language plpgsql security invoker set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_template_id uuid;
  v_external_id text;
  variant jsonb;
  item_position integer := 0;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_template->>'title',''))) = 0 then raise exception 'Template title is required'; end if;
  v_external_id := coalesce(nullif(trim(p_template->>'id'),''),gen_random_uuid()::text);
  v_template_id := public.stable_import_uuid(v_external_id);
  insert into public.code_templates(user_id,id,external_id,title,description,custom_tags,algorithm_ids,created_at,updated_at)
  values(current_user_id,v_template_id,v_external_id,p_template->>'title',coalesce(p_template->>'description',''),
    array(select jsonb_array_elements_text(coalesce(p_template->'customTags','[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_template->'algorithmIds','[]'::jsonb))),
    coalesce((p_template->>'createdAt')::timestamptz,now()),coalesce((p_template->>'updatedAt')::timestamptz,now()))
  on conflict(user_id,external_id) do update set title=excluded.title,description=excluded.description,
    custom_tags=excluded.custom_tags,algorithm_ids=excluded.algorithm_ids,updated_at=now()
  returning id into v_template_id;
  delete from public.template_variants where user_id=current_user_id and template_id=v_template_id;
  for variant in select value from jsonb_array_elements(coalesce(p_template->'variants','[]'::jsonb)) loop
    insert into public.template_variants(user_id,id,template_id,language,code,position)
    values(current_user_id,public.stable_import_uuid(v_template_id::text || ':variant:' || coalesce(variant->>'id',item_position::text)),
      v_template_id,coalesce(variant->>'language','C++'),coalesce(variant->>'code',''),item_position);
    item_position := item_position + 1;
  end loop;
  return v_external_id;
end;
$$;

revoke all on function public.save_code_template(jsonb) from public;
grant execute on function public.save_code_template(jsonb) to authenticated;
