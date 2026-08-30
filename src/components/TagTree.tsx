import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { Box, Chip, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useState } from 'react'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import type { TagNode } from '../model'

export default function TagTree({ customNodes, systemNodes, onCustomTag, onSystemTag }: {
  customNodes: TagNode[]
  systemNodes: TagNode[]
  onCustomTag: (tag: string) => void
  onSystemTag: (ids: string[]) => void
}) {
  const [tab, setTab] = useState(0)
  const [expanded, setExpanded] = useState<string[]>([])
  const nodes = tab === 0 ? systemNodes : customNodes
  const renderNode = (node: TagNode) => (
    <TreeItem
      key={node.id}
      itemId={node.id}
      label={<Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
        <span>{node.label}</span>
        <Chip size="small" label={node.count} />
      </Stack>}
      onClick={(event) => {
        event.stopPropagation()
        if (node.children.length) {
          setExpanded((items) => items.includes(node.id) ? items.filter((id) => id !== node.id) : [...items, node.id])
          return
        }
        if (tab === 0) onSystemTag(node.algorithmIds ?? [])
        else onCustomTag(node.id)
      }}
    >
      {node.children.map(renderNode)}
    </TreeItem>
  )
  return (
    <Box>
      <Typography variant="overline" color="primary">KNOWLEDGE MAP</Typography>
      <Typography variant="h3" sx={{ mb: 1 }}>标签中心</Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>系统标签来自算法目录；点击有子项的节点展开，点击末级标签查看对应题目。</Typography>
      <Paper variant="outlined" sx={{ maxWidth: 720, p: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}><AccountTreeIcon color="primary" /><Typography variant="h6">全部标签</Typography></Stack>
        <Tabs value={tab} onChange={(_, value) => { setTab(value); setExpanded([]) }} sx={{ mb: 2 }}><Tab label="系统算法标签" /><Tab label="自定义标签" /></Tabs>
        <SimpleTreeView
          key={tab}
          expansionTrigger="iconContainer"
          expandedItems={expanded}
          onExpandedItemsChange={(_, items) => setExpanded(items)}
        >
          {nodes.map(renderNode)}
        </SimpleTreeView>
        {!nodes.length && <Typography color="text.secondary">{tab === 0 ? '题目和模板还没有关联系统标签' : '还没有自定义标签'}</Typography>}
      </Paper>
    </Box>
  )
}
