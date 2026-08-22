import type { ImportPreview, Problem, StoredDocument, TagNode } from './model'
import { createProblem, createSolution } from './model'

export const STORAGE_KEY = 'algolog.document.v2'
export const LEGACY_STORAGE_KEY = 'algolog.problems.v1'
export const BACKUP_FINGERPRINT_KEY = 'algolog.backup-fingerprint.v2'

const legacySeeds = [
  {
    id: 'seed-two-sum',
    title: '两数之和',
    url: 'https://leetcode.cn/problems/two-sum/',
    source: 'LeetCode',
    difficulty: '简单',
    statement: '给定一个整数数组 nums 和一个整数目标值 target，请在数组中找出和为目标值的两个整数。',
    input: 'nums = [2,7,11,15], target = 9',
    output: '[0,1]',
    tags: ['数组/哈希表', '经典题'],
    solutions: [
      {
        id: 'seed-two-sum-ts',
        language: 'TypeScript',
        code: 'function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>()\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i]\n    if (seen.has(need)) return [seen.get(need)!, i]\n    seen.set(nums[i], i)\n  }\n  return []\n}',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
      },
      {
        id: 'seed-two-sum-python',
        language: 'Python',
        code: 'def two_sum(nums, target):\n    seen = {}\n    for i, value in enumerate(nums):\n        if target - value in seen:\n            return [seen[target - value], i]\n        seen[value] = i',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
      },
    ],
    status: 'solved',
    attempts: [{ id: 'seed-two-sum-attempt-1', attemptedAt: '2026-07-18T09:30:00.000Z' }],
    hints: ['暴力枚举需要 O(n²)。', '遍历时记录见过的数字。', '查询 target - nums[i] 是否出现。'],
    notes: '用空间换时间。目标关系是 $a+b=target$，所以遍历到 $b$ 时只需查找 $target-b$。\n\n注意先查询再写入，避免重复使用同一个元素。',
    createdAt: '2026-07-18T09:30:00.000Z',
    updatedAt: '2026-07-18T09:30:00.000Z',
  },
  {
    id: 'seed-three-sum',
    title: '三数之和',
    url: 'https://leetcode.cn/problems/3sum/',
    source: 'LeetCode',
    difficulty: '中等',
    statement: '找出数组中所有和为 0 且不重复的三元组。',
    input: 'nums = [-1,0,1,2,-1,-4]',
    output: '[[-1,-1,2],[-1,0,1]]',
    tags: ['数组/双指针', '排序', '经典题'],
    solutions: [{
      id: 'seed-three-sum-ts',
      language: 'TypeScript',
      code: 'function threeSum(nums: number[]): number[][] {\n  nums.sort((a, b) => a - b)\n  const result: number[][] = []\n  for (let i = 0; i < nums.length - 2; i++) {\n    if (i > 0 && nums[i] === nums[i - 1]) continue\n    let left = i + 1, right = nums.length - 1\n    while (left < right) {\n      const sum = nums[i] + nums[left] + nums[right]\n      if (sum < 0) left++\n      else if (sum > 0) right--\n      else {\n        result.push([nums[i], nums[left++], nums[right--]])\n        while (left < right && nums[left] === nums[left - 1]) left++\n        while (left < right && nums[right] === nums[right + 1]) right--\n      }\n    }\n  }\n  return result\n}',
      timeComplexity: 'O(n²)',
      spaceComplexity: 'O(1)',
    }],
    status: 'thinking',
    attempts: [
      { id: 'seed-three-sum-attempt-1', attemptedAt: '2026-07-20T10:00:00.000Z' },
      { id: 'seed-three-sum-attempt-2', attemptedAt: '2026-07-21T14:20:00.000Z' },
    ],
    hints: ['先排序，固定三元组中的第一个数。', '剩余区间可以转化成有序数组的两数之和。', '移动左右指针，并在每一层跳过重复值。'],
    notes: '固定 $a$ 后，需要在右侧寻找：\n\n$$b+c=-a$$\n\n排序使双指针移动与去重都变得可行。',
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-21T14:20:00.000Z',
  },
  {
    id: 'seed-lru',
    title: 'LRU 缓存',
    url: 'https://leetcode.cn/problems/lru-cache/',
    source: 'LeetCode',
    difficulty: '中等',
    statement: '设计并实现一个满足最近最少使用淘汰策略的缓存。',
    input: 'LRUCache(capacity), get(key), put(key, value)',
    output: 'get 返回对应值或 -1',
    tags: ['设计/缓存', '链表/双向链表', '哈希表'],
    solutions: [{
      id: 'seed-lru-ts',
      language: 'TypeScript',
      code: '// 哈希表负责 O(1) 定位，双向链表负责 O(1) 移动与删除',
      timeComplexity: 'O(1)',
      spaceComplexity: 'O(capacity)',
    }],
    status: 'pending',
    attempts: [],
    hints: ['快速查询需要哈希表。', '还需要快速维护元素的新旧顺序。', '组合哈希表和双向链表，并使用虚拟头尾节点。'],
    notes: '容量为 $C$ 时最多保存 $C$ 个节点，因此空间复杂度为 $O(C)$。',
    createdAt: '2026-07-22T08:30:00.000Z',
    updatedAt: '2026-07-22T08:30:00.000Z',
  },
]

export function getDemoProblems() {
  return legacySeeds.map(migrateProblem)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback

export function migrateProblem(value: unknown): Problem {
  // 所有外部 JSON 和旧 localStorage 都先经过此入口，集中补齐 v2 默认字段。
  if (!isRecord(value) || !text(value.title).trim()) throw new Error('题目缺少名称')
  const base = createProblem()
  const problemId = text(value.id) || crypto.randomUUID()
  const rawSolutions = Array.isArray(value.solutions) ? value.solutions : []
  const solutions = rawSolutions.length
    ? rawSolutions.map((item, index) => {
        if (!isRecord(item)) throw new Error('代码方案格式错误')
        return {
          ...createSolution(),
          id: text(item.id) || `${problemId}-solution-${index + 1}`,
          language: text(item.language, 'TypeScript'),
          code: text(item.code),
          timeComplexity: text(item.timeComplexity),
          spaceComplexity: text(item.spaceComplexity),
        }
      })
    : [{
        ...createSolution(),
        id: `${problemId}-solution-1`,
        language: text(value.language, 'TypeScript'),
        code: text(value.code),
      }]
  const hints = Array.isArray(value.hints) ? value.hints.slice(0, 3).map((item) => text(item)) : []
  while (hints.length < 3) hints.push('')
  const status = value.status === 'solved' || value.status === 'thinking' || value.status === 'pending'
    ? value.status
    : 'pending'
  const attempts = Array.isArray(value.attempts)
    ? value.attempts.flatMap((item, index) => isRecord(item) && text(item.attemptedAt)
      ? [{ id: text(item.id) || `${problemId}-attempt-${index + 1}`, attemptedAt: text(item.attemptedAt) }]
      : [])
    : []
  return {
    ...base,
    id: problemId,
    title: text(value.title),
    url: text(value.url),
    source: text(value.source),
    difficulty: value.difficulty === '简单' || value.difficulty === '困难' ? value.difficulty : '中等',
    statement: text(value.statement),
    input: text(value.input),
    output: text(value.output),
    tags: Array.isArray(value.tags) ? value.tags.map((tag) => text(tag)).filter(Boolean) : [],
    solutions,
    status,
    attempts,
    hints: hints as [string, string, string],
    notes: text(value.notes),
    createdAt: text(value.createdAt) || base.createdAt,
    updatedAt: text(value.updatedAt) || text(value.createdAt) || base.updatedAt,
  }
}

export function parseDocument(value: unknown): Problem[] {
  const source = isRecord(value) && Array.isArray(value.problems) ? value.problems : value
  const list = Array.isArray(source) ? source : [source]
  return list.map(migrateProblem)
}

export function loadProblems(): { problems: Problem[]; error?: string } {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) return { problems: parseDocument(JSON.parse(current)) }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) return { problems: parseDocument(JSON.parse(legacy)) }
    return { problems: getDemoProblems() }
  } catch {
    return { problems: getDemoProblems(), error: '本地数据无法读取，已显示示例数据；原数据未被覆盖。' }
  }
}

export function loadLocalMigrationProblems(): Problem[] {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) return parseDocument(JSON.parse(current))
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    return legacy ? parseDocument(JSON.parse(legacy)) : []
  } catch {
    return []
  }
}

export function saveProblems(problems: Problem[]) {
  const document: StoredDocument = { schemaVersion: 2, problems }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(document))
}

export function fingerprint(problems: Problem[]) {
  return JSON.stringify(problems)
}

export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function previewImports(files: File[], local: Problem[]): Promise<ImportPreview> {
  const additions: Problem[] = []
  const conflicts: ImportPreview['conflicts'] = []
  const failedFiles: string[] = []
  let skipped = 0
  const known = new Map(local.map((problem) => [problem.id, problem]))

  for (const file of files) {
    try {
      const incoming = parseDocument(JSON.parse(await file.text()))
      const preview = previewProblemList(incoming, [...known.values()], file.name)
      additions.push(...preview.additions)
      conflicts.push(...preview.conflicts)
      skipped += preview.skipped
      preview.additions.forEach((problem) => known.set(problem.id, problem))
    } catch {
      failedFiles.push(file.name)
    }
  }
  return { additions, conflicts, skipped, failedFiles, totalFiles: files.length }
}

export function previewProblemList(incoming: Problem[], local: Problem[], sourceFile = '本地数据'): ImportPreview {
  const additions: Problem[] = []
  const conflicts: ImportPreview['conflicts'] = []
  let skipped = 0
  const known = new Map(local.map((problem) => [problem.id, problem]))
  for (const problem of incoming) {
    const existing = known.get(problem.id)
    if (!existing) {
      additions.push(problem)
      known.set(problem.id, problem)
    } else if (fingerprint([existing]) === fingerprint([problem])) {
      skipped += 1
    } else {
      conflicts.push({ id: problem.id, local: existing, incoming: problem, sourceFile })
    }
  }
  return { additions, conflicts, skipped, failedFiles: [], totalFiles: 1 }
}

export function mergeImportPreview(
  local: Problem[],
  preview: ImportPreview,
  choices: Record<number, 'local' | 'incoming'>,
) {
  const merged = new Map(local.map((problem) => [problem.id, problem]))
  preview.additions.forEach((problem) => merged.set(problem.id, problem))
  preview.conflicts.forEach((conflict, index) => {
    if (choices[index] === 'incoming') merged.set(conflict.id, conflict.incoming)
  })
  return [...merged.values()]
}

export type MigrationStrategy = 'cloud' | 'local' | 'merge'

export interface MigrationResolution {
  problems: Problem[]
  report: string[]
}

export function resolveLocalCloudMigration(
  cloudProblems: Problem[],
  preview: ImportPreview,
  strategy: MigrationStrategy,
): MigrationResolution {
  if (strategy === 'cloud') {
    return {
      problems: cloudProblems,
      report: [`已保留全部云端数据，忽略 ${preview.additions.length + preview.conflicts.length} 道本地题目。`],
    }
  }

  const resolved = new Map(cloudProblems.map((problem) => [problem.id, problem]))
  preview.additions.forEach((problem) => resolved.set(problem.id, problem))
  const report = [`新增 ${preview.additions.length} 道仅存在于本地的题目。`]

  preview.conflicts.forEach((conflict) => {
    if (strategy === 'local') {
      resolved.set(conflict.id, conflict.incoming)
    } else {
      resolved.set(conflict.id, mergeProblemVersions(conflict.local, conflict.incoming))
    }
  })
  report.push(strategy === 'local'
    ? `使用本地版本覆盖 ${preview.conflicts.length} 道冲突题目。`
    : `智能合并 ${preview.conflicts.length} 道冲突题目；标签、代码方案和做题记录取并集，文本冲突保留双方内容。`)
  return { problems: [...resolved.values()], report }
}

function mergeProblemVersions(cloud: Problem, local: Problem): Problem {
  const localIsNewer = Date.parse(local.updatedAt) >= Date.parse(cloud.updatedAt)
  const newer = localIsNewer ? local : cloud
  const older = localIsNewer ? cloud : local
  const chooseText = <K extends keyof Problem>(key: K) => newer[key] || older[key]
  const solutions = new Map(cloud.solutions.map((solution) => [solution.id, solution]))
  local.solutions.forEach((solution) => {
    if (!solutions.has(solution.id) || localIsNewer) solutions.set(solution.id, solution)
  })
  const attempts = new Map(cloud.attempts.map((attempt) => [attempt.id || attempt.attemptedAt, attempt]))
  local.attempts.forEach((attempt) => attempts.set(attempt.id || attempt.attemptedAt, attempt))
  const notes = cloud.notes === local.notes
    ? cloud.notes
    : [cloud.notes && `## 云端笔记\n${cloud.notes}`, local.notes && `## 本地笔记\n${local.notes}`].filter(Boolean).join('\n\n---\n\n')

  return {
    ...newer,
    id: cloud.id,
    title: chooseText('title') as string,
    url: chooseText('url') as string,
    source: chooseText('source') as string,
    statement: chooseText('statement') as string,
    input: chooseText('input') as string,
    output: chooseText('output') as string,
    tags: [...new Set([...cloud.tags, ...local.tags])],
    solutions: [...solutions.values()],
    attempts: [...attempts.values()].sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt)),
    hints: cloud.hints.map((hint, index) => (localIsNewer ? local.hints[index] || hint : hint || local.hints[index])) as [string, string, string],
    notes,
    createdAt: new Date(Math.min(Date.parse(cloud.createdAt), Date.parse(local.createdAt))).toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function buildTagTree(problems: Problem[]): TagNode[] {
  const roots: TagNode[] = []
  const byPath = new Map<string, TagNode>()
  for (const problem of problems) {
    for (const tag of problem.tags) {
      const segments = tag.split('/').map((part) => part.trim()).filter(Boolean)
      segments.forEach((label, index) => {
        const path = segments.slice(0, index + 1).join('/')
        let node = byPath.get(path)
        if (!node) {
          node = { id: path, label, count: 0, children: [] }
          byPath.set(path, node)
          if (index === 0) roots.push(node)
          else byPath.get(segments.slice(0, index).join('/'))?.children.push(node)
        }
        node.count += 1
      })
    }
  }
  const sort = (nodes: TagNode[]) => nodes.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')).forEach((node) => sort(node.children))
  sort(roots)
  return roots
}

const tagRules: Array<[RegExp, string]> = [
  [/数组|array|nums/i, '数组'],
  [/双指针|two pointers?/i, '数组/双指针'],
  [/哈希|hash|map|set/i, '哈希表'],
  [/链表|linked list/i, '链表'],
  [/二叉树|binary tree/i, '树/二叉树'],
  [/动态规划|dp\b|状态转移/i, '动态规划'],
  [/回溯|backtrack/i, '搜索/回溯'],
  [/排序|sort/i, '排序'],
]

export function suggestTags(problem: Problem) {
  const code = problem.solutions.map((solution) => solution.code).join(' ')
  const source = [problem.title, problem.statement, problem.input, problem.output, code, problem.notes].join(' ')
  return tagRules.filter(([pattern]) => pattern.test(source)).map(([, tag]) => tag)
}
