# AlgoLog 算法学习志

一个可直接使用浏览器本地数据、也可登录 Supabase 跨设备同步的算法学习记录网站。

## 功能

- 记录题目链接、来源、难度、状态、题干、输入输出、做题历史及三步提示
- 为一道题保存多种语言代码、时间复杂度和空间复杂度
- 笔记支持 Markdown、MathType/LaTeX 数学公式，代码支持语法高亮
- 使用 `algorithms.json` 系统目录与用户自定义标签组成双轨标签体系，并根据题目内容提供系统标签联想候选
- 以可搜索层级树筛选题目，集中重命名、合并或删除自定义标签
- 管理支持 Markdown 解释、搜索筛选和多语言实现的代码模板
- 全文搜索题目、代码、标签和笔记
- 根据题干、标签和总结发现相似题目
- 多文件 JSON 冲突合并、单题导出、完整数据备份及未备份提醒
- 支持明暗主题并记忆用户选择
- 支持免登录本地模式，并为每道题显示仅本地、同步中、已同步、离线缓存或同步失败状态

## 在 VS Code 中运行

1. 安装 Node.js 20 或更高版本。
2. 在项目目录打开终端，执行：

```bash
npm install
npm run dev
```

3. 打开终端中显示的本地网址（通常为 `http://localhost:5173`）。

不登录时，数据只保存在当前浏览器的 `localStorage` 中；登录后 Supabase 成为主数据源，并在本机保留离线快照。仍建议定期使用右上角的“备份”按钮导出 JSON。

## Supabase 配置

登录不是使用应用的前置条件；只有跨设备同步和云端备份需要账户。注册和登录统一使用 Supabase 邮箱验证码，无需设置密码；首次验证码验证成功后会自动创建账户。Row Level Security 会隔离每个用户的数据。浏览器只应使用公开的 anon key，禁止将 `service_role` key 放入前端。

1. 在 Supabase Dashboard 创建项目。
2. 打开 SQL Editor：
   - 新项目先完整执行 [`supabase/migrations/20260723_initial_schema.sql`](supabase/migrations/20260723_initial_schema.sql)。
   - 按文件名顺序继续执行 [`supabase/migrations/20260723_add_schema_comments.sql`](supabase/migrations/20260723_add_schema_comments.sql) 和 [`supabase/migrations/20260805_tags_and_templates.sql`](supabase/migrations/20260805_tags_and_templates.sql)。
3. 复制 `.env.example` 为 `.env.local`，填写项目配置：

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. 在 Supabase 的 Authentication 设置中：
   - 启用 Email provider。
   - 在 Email Templates 的 Confirm signup 和 Magic Link 模板中使用 `{{ .Token }}`，确保邮件正文展示验证码。
   - 首次验证码验证会自动创建并确认账户，不需要密码或第二次邮件确认。
   - 将 Site URL 设置为实际部署地址；本地开发可使用 `http://localhost:5173`。
5. 重启 `npm run dev`。环境变量只在 Vite 启动时读取。

`.env.local` 已被 Git 忽略。可提交的只有 `.env.example`，不要提交真实密钥。

登录后，云端数据库是主数据源。每次成功加载都会写入按用户隔离的 localStorage 快照；网络不可用时应用会进入离线只读模式。首次登录如果检测到旧版本地数据，会提示选择“强制云端”“本地覆盖”或“智能合并”；处理完成后展示报告，并始终保留原本地数据作为安全备份。

## 外部 JSON 导入模板

推荐使用下面的完整备份格式。将内容保存为 UTF-8 编码的 `.json` 文件，然后点击页面右上角的“导入”按钮。文件选择器支持同时选择多个 JSON 文件。

```json
{
  "schemaVersion": 3,
  "problems": [
    {
      "id": "external-two-sum",
      "title": "两数之和",
      "url": "https://leetcode.cn/problems/two-sum/",
      "source": "LeetCode",
      "difficulty": "简单",
      "statement": "给定一个整数数组和目标值，返回和为目标值的两个元素下标。",
      "input": "nums = [2,7,11,15], target = 9",
      "output": "[0,1]",
      "customTags": [
        "数组/哈希表",
        "经典题"
      ],
      "solutions": [
        {
          "id": "external-two-sum-typescript",
          "language": "TypeScript",
          "code": "function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>()\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i]\n    if (seen.has(need)) return [seen.get(need)!, i]\n    seen.set(nums[i], i)\n  }\n  return []\n}",
          "timeComplexity": "O(n)",
          "spaceComplexity": "O(n)"
        },
        {
          "id": "external-two-sum-python",
          "language": "Python",
          "code": "def two_sum(nums, target):\n    seen = {}\n    for i, value in enumerate(nums):\n        if target - value in seen:\n            return [seen[target - value], i]\n        seen[value] = i",
          "timeComplexity": "O(n)",
          "spaceComplexity": "O(n)"
        }
      ],
      "status": "solved",
      "attempts": [
        {
          "id": "external-two-sum-attempt-1",
          "attemptedAt": "2026-07-23T08:30:00.000Z"
        }
      ],
      "hints": [
        "暴力枚举所有数对需要 O(n²)。",
        "遍历时记录已经见过的数字。",
        "检查 target - nums[i] 是否已经出现。"
      ],
      "notes": "目标关系为 $a+b=target$。也支持独立公式：\n\n$$T(n)=O(n)$$",
      "createdAt": "2026-07-23T08:30:00.000Z",
      "updatedAt": "2026-07-23T09:00:00.000Z"
    }
  ],
  "templates": []
}
```

字段说明：

- `id`：题目唯一标识。建议使用 UUID 或稳定且不重复的字符串；相同 ID 会触发导入冲突选择。
- `difficulty`：只能填写 `简单`、`中等` 或 `困难`。
- `status`：`solved` 表示已解决，`thinking` 表示思考中，`pending` 表示待解决。
- `customTags`：用户自定义标签，支持 `父级/子级` 形式；旧 `tags` 字段导入时会自动迁移到这里。
- `algorithmIds`：`algorithms.json` 系统目录中的稳定 ID 数组；目录本身随前端发布，不需要写入数据库。
- `solutions`：可包含多个代码方案。代码中的换行在 JSON 字符串内写作 `\n`。
- `attempts`：每次做题记录一个 ISO 8601 时间；没有记录时填写空数组 `[]`。
- `hints`：最多三个渐进式提示，不足三个时可以使用空字符串补齐。
- `notes`：支持 Markdown、围栏代码和 LaTeX 数学公式，也兼容 MathType 复制出的 `\(...\)` 与 `\[...\]`。
- `createdAt`、`updatedAt`、`attemptedAt`：推荐使用 ISO 8601 格式，例如 `2026-07-23T09:00:00.000Z`。

导入器也接受以下简化顶层格式：

- 直接使用题目数组：`[{ ... }, { ... }]`
- 仅导入一道题：`{ ... }`

除 `title` 外的缺失字段会在导入时补充默认值，但外部工具最好按完整模板生成，以便保留全部信息。

完整备份中的 `templates` 保存代码模板；每个模板包含 `title`、`description`、`customTags`、`algorithmIds` 和多个 `{ id, language, code }` `variants`。登录模式下题目只在数据库保存标签 ID，系统标签的名称、分类和等级统一由当前版本的 `algorithms.json` 解析。
