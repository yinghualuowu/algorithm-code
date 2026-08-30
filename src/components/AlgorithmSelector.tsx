import { useMemo, useState } from 'react'
import { Box, Checkbox, Chip, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import { algorithmById, algorithmPath, algorithms, buildAlgorithmTree } from '../algorithmCatalog'
import type { TagNode } from '../model'

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
  compact?: boolean
}

export default function AlgorithmSelector({ value, onChange, compact = false }: Props) {
  const [query, setQuery] = useState('')
  const selected = useMemo(() => new Set(value), [value])
  const tree = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return buildAlgorithmTree()
    const ids = algorithms
      .filter((tag) => algorithmPath(tag).toLowerCase().includes(needle) || tag.level.toLowerCase().includes(needle))
      .map((tag) => tag.id)
    return buildAlgorithmTree(ids).filter((node) => node.count > 0)
  }, [query])

  const toggle = (ids: string[]) => {
    const next = new Set(value)
    const allSelected = ids.every((id) => next.has(id))
    ids.forEach((id) => allSelected ? next.delete(id) : next.add(id))
    onChange([...next])
  }
  const renderNode = (node: TagNode) => {
    const ids = node.algorithmIds ?? []
    if (query && node.count === 0) return null
    const checked = ids.length > 0 && ids.every((id) => selected.has(id))
    const partial = !checked && ids.some((id) => selected.has(id))
    return (
      <TreeItem
        key={node.id}
        itemId={node.id}
        label={
          <Stack direction="row" sx={{ alignItems: 'center', py: 0.25 }}>
            <Checkbox
              size="small"
              checked={checked}
              indeterminate={partial}
              onClick={(event) => { event.stopPropagation(); toggle(ids) }}
            />
            <Typography variant="body2" sx={{ flex: 1 }}>{node.label}</Typography>
            <Typography variant="caption" color="text.secondary">{node.count}</Typography>
          </Stack>
        }
      >
        {node.children.map(renderNode)}
      </TreeItem>
    )
  }

  return (
    <Stack spacing={1.5}>
      <TextField
        size="small"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索系统算法、分类或等级"
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      />
      {!!value.length && (
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {value.map((id) => {
            const tag = algorithmById.get(id)
            return tag ? <Chip key={id} size="small" color="primary" label={tag.name} onDelete={() => onChange(value.filter((item) => item !== id))} /> : null
          })}
        </Stack>
      )}
      <Paper variant="outlined" sx={{ p: 1, maxHeight: compact ? 260 : 420, overflow: 'auto' }}>
        <SimpleTreeView>{tree.map(renderNode)}</SimpleTreeView>
      </Paper>
    </Stack>
  )
}
