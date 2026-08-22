import { beforeEach, describe, expect, it } from 'vitest'
import { parseDocument } from './data'
import {
  localMigrationCompleted, markLocalMigrationCompleted, problemToRpcPayload, readCloudCache,
  rowToProblem, writeCloudCache,
} from './repository'
import type { DbProblemRow } from './repository'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  },
})

beforeEach(() => values.clear())

describe('Supabase model mapping', () => {
  it('maps nested database rows into a Problem', () => {
    const row: DbProblemRow = {
      external_id: 'external-id',
      title: '云端题目',
      url: '',
      source: 'LeetCode',
      difficulty: '中等',
      statement: 'statement',
      input_text: 'input',
      output_text: 'output',
      tags: ['数组/双指针'],
      hints: ['one', 'two', 'three'],
      notes: '$O(n)$',
      status: 'thinking',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      problem_solutions: [{
        id: 'solution-id',
        language: 'TypeScript',
        code: 'return true',
        time_complexity: 'O(n)',
        space_complexity: 'O(1)',
        position: 0,
      }],
      problem_attempts: [{ id: 'attempt-id', attempted_at: '2026-01-03T00:00:00.000Z' }],
    }
    const problem = rowToProblem(row)
    expect(problem).toMatchObject({ id: 'external-id', input: 'input', output: 'output', status: 'thinking' })
    expect(problem.solutions[0].timeComplexity).toBe('O(n)')
    expect(problem.attempts[0].attemptedAt).toBe('2026-01-03T00:00:00.000Z')
  })

  it('creates the RPC payload without database-only fields', () => {
    const problem = parseDocument([{ id: 'one', title: '题目', tags: [] }])[0]
    expect(problemToRpcPayload(problem)).toMatchObject({
      id: 'one',
      title: '题目',
      solutions: expect.any(Array),
      attempts: [],
    })
  })
})

describe('per-user offline cache', () => {
  it('isolates cached snapshots by user id', () => {
    const first = parseDocument([{ id: 'one', title: '用户一题目', tags: [] }])
    const second = parseDocument([{ id: 'two', title: '用户二题目', tags: [] }])
    writeCloudCache('user-1', first)
    writeCloudCache('user-2', second)
    expect(readCloudCache('user-1')[0].title).toBe('用户一题目')
    expect(readCloudCache('user-2')[0].title).toBe('用户二题目')
  })

  it('tracks local migration independently for each account', () => {
    markLocalMigrationCompleted('user-1')
    expect(localMigrationCompleted('user-1')).toBe(true)
    expect(localMigrationCompleted('user-2')).toBe(false)
  })
})
