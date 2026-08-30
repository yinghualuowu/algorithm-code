import type { Problem, Solution, Attempt, CodeTemplate } from './model'
import { migrateProblem, migrateTemplate, parseDocument } from './data'
import { supabase } from './lib/supabase'

export interface DbSolutionRow {
  id: string
  language: string
  code: string
  time_complexity: string
  space_complexity: string
  position: number
}

export interface DbAttemptRow {
  id: string
  attempted_at: string
}

export interface DbProblemRow {
  external_id: string
  title: string
  url: string
  source: string
  difficulty: Problem['difficulty']
  statement: string
  input_text: string
  output_text: string
  custom_tags: string[]
  algorithm_ids: string[]
  hints: string[]
  notes: string
  status: Problem['status']
  created_at: string
  updated_at: string
  problem_solutions: DbSolutionRow[]
  problem_attempts: DbAttemptRow[]
}

export interface CloudLoadResult {
  problems: Problem[]
  offline: boolean
  error?: string
}

const cacheKey = (userId: string) => `algolog.cloud-cache.v1.${userId}`
const migrationKey = (userId: string) => `algolog.local-migrated.v1.${userId}`

export function rowToProblem(row: DbProblemRow): Problem {
  // 数据库使用 snake_case 与关系数组，页面模型保持原有 camelCase JSON 结构。
  const hints = [...(row.hints ?? [])].slice(0, 3)
  while (hints.length < 3) hints.push('')
  const solutions: Solution[] = [...(row.problem_solutions ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      language: item.language,
      code: item.code,
      timeComplexity: item.time_complexity,
      spaceComplexity: item.space_complexity,
    }))
  const attempts: Attempt[] = [...(row.problem_attempts ?? [])]
    .sort((a, b) => a.attempted_at.localeCompare(b.attempted_at))
    .map((item) => ({ id: item.id, attemptedAt: item.attempted_at }))
  return migrateProblem({
    id: row.external_id,
    title: row.title,
    url: row.url,
    source: row.source,
    difficulty: row.difficulty,
    statement: row.statement,
    input: row.input_text,
    output: row.output_text,
    customTags: row.custom_tags,
    algorithmIds: row.algorithm_ids,
    hints,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    solutions,
    attempts,
  })
}

export function problemToRpcPayload(problem: Problem) {
  return {
    id: problem.id,
    title: problem.title,
    url: problem.url,
    source: problem.source,
    difficulty: problem.difficulty,
    statement: problem.statement,
    input: problem.input,
    output: problem.output,
    customTags: problem.customTags,
    algorithmIds: problem.algorithmIds,
    hints: problem.hints,
    notes: problem.notes,
    status: problem.status,
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
    solutions: problem.solutions,
    attempts: problem.attempts,
  }
}

export async function fetchCloudProblems(userId: string): Promise<Problem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select(`
      external_id, title, url, source, difficulty, statement, input_text, output_text,
      custom_tags, algorithm_ids, hints, notes, status, created_at, updated_at,
      problem_solutions (id, language, code, time_complexity, space_complexity, position),
      problem_attempts (id, attempted_at)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as DbProblemRow[]).map(rowToProblem)
}

export function readCloudCache(userId: string): Problem[] {
  try {
    const value = localStorage.getItem(cacheKey(userId))
    return value ? parseDocument(JSON.parse(value)) : []
  } catch {
    return []
  }
}

export function writeCloudCache(userId: string, problems: Problem[]) {
  localStorage.setItem(cacheKey(userId), JSON.stringify({ schemaVersion: 3, problems, templates: [] }))
}

export async function loadCloudProblems(userId: string): Promise<CloudLoadResult> {
  try {
    const problems = await fetchCloudProblems(userId)
    writeCloudCache(userId, problems)
    return { problems, offline: false }
  } catch (reason) {
    // 缓存只用于断网阅读；写操作由界面在 offline 状态下统一禁用。
    const cached = readCloudCache(userId)
    if (localStorage.getItem(cacheKey(userId))) {
      return {
        problems: cached,
        offline: true,
        error: reason instanceof Error ? reason.message : '无法连接 Supabase，正在显示离线缓存。',
      }
    }
    throw reason
  }
}

export async function saveCloudProblem(problem: Problem) {
  // RPC 在 PostgreSQL 单个事务中保存主表及两个子表。
  const { data, error } = await supabase.rpc('save_problem', { p_problem: problemToRpcPayload(problem) })
  if (error) throw error
  return data as string
}

export async function saveCloudProblems(problems: Problem[]) {
  for (const problem of problems) await saveCloudProblem(problem)
}

export async function deleteCloudProblem(problemId: string) {
  const { error } = await supabase.from('problems').delete().eq('external_id', problemId)
  if (error) throw error
}

export interface DbTemplateRow {
  external_id: string
  title: string
  description: string
  custom_tags: string[]
  algorithm_ids: string[]
  created_at: string
  updated_at: string
  template_variants: Array<{ id: string; language: string; code: string; position: number }>
}

const templateCacheKey = (userId: string) => `algolog.template-cache.v1.${userId}`

export function rowToTemplate(row: DbTemplateRow): CodeTemplate {
  return migrateTemplate({
    id: row.external_id,
    title: row.title,
    description: row.description,
    customTags: row.custom_tags,
    algorithmIds: row.algorithm_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants: [...(row.template_variants ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ id: item.id, language: item.language, code: item.code })),
  })
}

export function templateToRpcPayload(template: CodeTemplate) {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    customTags: template.customTags,
    algorithmIds: template.algorithmIds,
    variants: template.variants,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export async function fetchCloudTemplates(userId: string): Promise<CodeTemplate[]> {
  const { data, error } = await supabase
    .from('code_templates')
    .select('external_id, title, description, custom_tags, algorithm_ids, created_at, updated_at, template_variants (id, language, code, position)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as DbTemplateRow[]).map(rowToTemplate)
}

export function readTemplateCache(userId: string): CodeTemplate[] {
  try {
    const value = localStorage.getItem(templateCacheKey(userId))
    const parsed: unknown = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.map(migrateTemplate) : []
  } catch {
    return []
  }
}

export async function loadCloudTemplates(userId: string, offline = false): Promise<CodeTemplate[]> {
  if (offline) return readTemplateCache(userId)
  try {
    const templates = await fetchCloudTemplates(userId)
    localStorage.setItem(templateCacheKey(userId), JSON.stringify(templates))
    return templates
  } catch {
    const cached = readTemplateCache(userId)
    if (localStorage.getItem(templateCacheKey(userId))) return cached
    throw new Error('无法加载云端模板。请确认已执行最新 Supabase migration。')
  }
}

export async function saveCloudTemplate(template: CodeTemplate) {
  const { data, error } = await supabase.rpc('save_code_template', { p_template: templateToRpcPayload(template) })
  if (error) throw error
  return data as string
}

export async function saveCloudTemplates(templates: CodeTemplate[]) {
  for (const template of templates) await saveCloudTemplate(template)
}

export async function deleteCloudTemplate(templateId: string) {
  const { error } = await supabase.from('code_templates').delete().eq('external_id', templateId)
  if (error) throw error
}

export function localMigrationCompleted(userId: string) {
  return localStorage.getItem(migrationKey(userId)) === 'done'
}

export function markLocalMigrationCompleted(userId: string) {
  localStorage.setItem(migrationKey(userId), 'done')
}
