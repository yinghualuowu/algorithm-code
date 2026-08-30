import rawAlgorithms from '../algorithms.json'
import type { AlgorithmTag, TagNode } from './model'

export const algorithms = rawAlgorithms as AlgorithmTag[]
export const algorithmById = new Map(algorithms.map((tag) => [tag.id, tag]))
export const algorithmLevels = [...new Set(algorithms.map((tag) => tag.level))].filter(Boolean)

export function validAlgorithmIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && algorithmById.has(id)))]
}

export function algorithmPath(tag: AlgorithmTag) {
  return [...new Set([tag.category, tag.group, tag.name].map((part) => part.trim()).filter(Boolean))].join('/')
}

export function buildAlgorithmTree(usedIds?: string[], onlyUsed = false): TagNode[] {
  const roots: TagNode[] = []
  const byPath = new Map<string, TagNode>()
  const used = usedIds ? new Set(usedIds) : null

  for (const tag of algorithms) {
    if (onlyUsed && used && !used.has(tag.id)) continue
    const segments = [...new Set([tag.category, tag.group, tag.name].map((part) => part.trim()).filter(Boolean))]
    segments.forEach((label, index) => {
      const path = segments.slice(0, index + 1).join('/')
      let node = byPath.get(path)
      if (!node) {
        node = { id: path, label, count: 0, algorithmIds: [], children: [] }
        byPath.set(path, node)
        if (index === 0) roots.push(node)
        else byPath.get(segments.slice(0, index).join('/'))?.children.push(node)
      }
      if (!node.algorithmIds?.includes(tag.id)) node.algorithmIds?.push(tag.id)
      if (!used || used.has(tag.id)) node.count += 1
    })
  }

  const sort = (nodes: TagNode[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
    nodes.forEach((node) => sort(node.children))
  }
  sort(roots)
  return roots
}

export function algorithmLabels(ids: string[]) {
  return ids.flatMap((id) => {
    const tag = algorithmById.get(id)
    return tag ? [tag.name] : []
  })
}

export function suggestAlgorithmIds(source: string, limit = 8): string[] {
  const normalized = source.toLowerCase()
  return algorithms
    .flatMap((tag) => {
      const names = [
        tag.name,
        tag.name.replace(/\s*[（(].*?[）)]\s*/g, ''),
      ].map((name) => name.trim().toLowerCase()).filter((name) => name.length >= 2)
      const matched = names.some((name) => normalized.includes(name))
      if (!matched) return []
      const longest = Math.max(...names.filter((name) => normalized.includes(name)).map((name) => name.length))
      return [{ id: tag.id, score: longest }]
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.id)
}
