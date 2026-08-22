-- 可在已执行 initial_schema 的项目中单独运行；COMMENT 语句可重复执行。
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
