import { describe, expect, it } from 'vitest'
import {
  buildTagTree, fingerprint, mergeImportPreview, parseDocument, parseStoredDocument, previewImports,
  previewProblemList, resolveLocalCloudMigration, updateCustomTag,
} from './data'
import { algorithms, buildAlgorithmTree, suggestAlgorithmIds } from './algorithmCatalog'

const legacy = {
  id: 'one',
  title: '旧题目',
  tags: ['数组/双指针'],
  language: 'C++',
  code: 'int main() {}',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

describe('data migration', () => {
  it('migrates legacy language and code to a solution', () => {
    const [problem] = parseDocument([legacy])
    expect(problem.status).toBe('pending')
    expect(problem.solutions).toHaveLength(1)
    expect(problem.solutions[0]).toMatchObject({ language: 'C++', code: 'int main() {}' })
    expect(problem.createdAt).toBe(legacy.createdAt)
    expect(problem.customTags).toEqual(['数组/双指针'])
    expect(problem.algorithmIds).toEqual([])
  })

  it('accepts a versioned backup document', () => {
    const [problem] = parseDocument({ schemaVersion: 2, problems: [legacy] })
    expect(problem.title).toBe('旧题目')
  })

  it('loads v3 templates and removes unknown system ids', () => {
    const document = parseStoredDocument({
      schemaVersion: 3,
      problems: [{ ...legacy, algorithmIds: [algorithms[0].id, 'missing'] }],
      templates: [{ id: 'template', title: '并查集', tags: ['旧模板标签'], variants: [{ language: 'C++', code: 'int f;' }] }],
    })
    expect(document.problems[0].algorithmIds).toEqual([algorithms[0].id])
    expect(document.templates[0].customTags).toEqual(['旧模板标签'])
    expect(document.templates[0].variants[0].language).toBe('C++')
  })
})

describe('tag tree', () => {
  it('builds nested nodes and aggregated counts', () => {
    const first = parseDocument([legacy])[0]
    const second = parseDocument([{ ...legacy, id: 'two', title: '另一题', tags: ['数组/排序'] }])[0]
    const tree = buildTagTree([first, second])
    expect(tree[0]).toMatchObject({ id: '数组', count: 2 })
    expect(tree[0].children.map((node) => node.id)).toEqual(['数组/排序', '数组/双指针'])
  })

  it('builds the system hierarchy and rewrites custom tag descendants', () => {
    const tree = buildAlgorithmTree([algorithms[0].id])
    expect(tree.some((node) => node.algorithmIds?.includes(algorithms[0].id))).toBe(true)
    const [updated] = updateCustomTag(parseDocument([legacy]), '数组', '线性结构')
    expect(updated.customTags).toEqual(['线性结构/双指针'])
  })

  it('suggests system tags from problem content without writing them automatically', () => {
    const segmentTree = algorithms.find((tag) => tag.name.includes('线段树'))
    expect(segmentTree).toBeTruthy()
    expect(suggestAlgorithmIds('使用线段树维护区间最大值')).toContain(segmentTree!.id)
  })
})

describe('multi-file import', () => {
  it('reports additions, duplicates, conflicts and invalid files', async () => {
    const local = parseDocument([legacy])
    const duplicate = new File([JSON.stringify([legacy])], 'duplicate.json')
    const changed = new File([JSON.stringify([{ ...legacy, title: '导入标题' }])], 'changed.json')
    const addition = new File([JSON.stringify([{ ...legacy, id: 'two', title: '新增题' }])], 'addition.json')
    const invalid = new File(['not json'], 'invalid.json')
    const preview = await previewImports([duplicate, changed, addition, invalid], local)
    expect(preview.skipped).toBe(1)
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.additions).toHaveLength(1)
    expect(preview.failedFiles).toEqual(['invalid.json'])
    const merged = mergeImportPreview(local, preview, { 0: 'incoming' })
    expect(merged.find((problem) => problem.id === 'one')?.title).toBe('导入标题')
    expect(merged.find((problem) => problem.id === 'two')?.title).toBe('新增题')
  })

  it('changes fingerprint whenever content changes', () => {
    const problems = parseDocument([legacy])
    expect(fingerprint(problems)).not.toBe(fingerprint([{ ...problems[0], status: 'solved' }]))
  })
})

describe('local and cloud conflict strategies', () => {
  const cloud = parseDocument([{
    ...legacy,
    notes: '云端笔记',
    tags: ['数组'],
    attempts: [{ id: 'cloud-attempt', attemptedAt: '2026-01-02T00:00:00.000Z' }],
  }])
  const local = parseDocument([{
    ...legacy,
    notes: '本地笔记',
    tags: ['哈希表'],
    attempts: [{ id: 'local-attempt', attemptedAt: '2026-01-03T00:00:00.000Z' }],
    updatedAt: '2026-01-04T00:00:00.000Z',
  }])
  const preview = previewProblemList(local, cloud)

  it('can keep cloud or overwrite with local data', () => {
    expect(resolveLocalCloudMigration(cloud, preview, 'cloud').problems[0].notes).toBe('云端笔记')
    expect(resolveLocalCloudMigration(cloud, preview, 'local').problems[0].notes).toBe('本地笔记')
  })

  it('merges collections and preserves both conflicting notes', () => {
    const merged = resolveLocalCloudMigration(cloud, preview, 'merge').problems[0]
    expect(merged.customTags).toEqual(['数组', '哈希表'])
    expect(merged.attempts).toHaveLength(2)
    expect(merged.notes).toContain('云端笔记')
    expect(merged.notes).toContain('本地笔记')
  })
})
