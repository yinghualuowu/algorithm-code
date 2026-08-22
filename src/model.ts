export type Difficulty = '简单' | '中等' | '困难'
export type ProblemStatus = 'solved' | 'thinking' | 'pending'
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'cached' | 'error'

export interface Solution {
  id: string
  language: string
  code: string
  timeComplexity: string
  spaceComplexity: string
}

export interface Attempt {
  id: string
  attemptedAt: string
}

export interface Problem {
  id: string
  title: string
  url: string
  source: string
  difficulty: Difficulty
  statement: string
  input: string
  output: string
  tags: string[]
  solutions: Solution[]
  status: ProblemStatus
  attempts: Attempt[]
  hints: [string, string, string]
  notes: string
  createdAt: string
  updatedAt: string
}

export interface StoredDocument {
  schemaVersion: 2
  problems: Problem[]
}

export interface ImportConflict {
  id: string
  local: Problem
  incoming: Problem
  sourceFile: string
}

export interface ImportPreview {
  additions: Problem[]
  conflicts: ImportConflict[]
  skipped: number
  failedFiles: string[]
  totalFiles: number
}

export interface TagNode {
  id: string
  label: string
  count: number
  children: TagNode[]
}

export const statusMeta: Record<ProblemStatus, { label: string; color: 'success' | 'warning' | 'default' }> = {
  solved: { label: '已解决', color: 'success' },
  thinking: { label: '思考中', color: 'warning' },
  pending: { label: '待解决', color: 'default' },
}

export const createSolution = (): Solution => ({
  id: crypto.randomUUID(),
  language: 'TypeScript',
  code: '',
  timeComplexity: '',
  spaceComplexity: '',
})

export const createProblem = (): Problem => {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: '',
    url: '',
    source: '',
    difficulty: '中等',
    statement: '',
    input: '',
    output: '',
    tags: [],
    solutions: [createSolution()],
    status: 'pending',
    attempts: [],
    hints: ['', '', ''],
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}
