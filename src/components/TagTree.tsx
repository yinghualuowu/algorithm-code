import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import type { TagNode } from '../model'

export default function TagTree({ nodes, onTag }: { nodes: TagNode[]; onTag: (tag: string) => void }) {
  const expandedItems = (items: TagNode[]): string[] =>
    items.flatMap((item) => item.children.length ? [item.id, ...expandedItems(item.children)] : [])
  const renderNode = (node: TagNode) => (
    <TreeItem
      key={node.id}
      itemId={node.id}
      label={<Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}><span>{node.label}</span><Chip size="small" label={node.count} /></Stack>}
      onClick={(event) => {
        event.stopPropagation()
        onTag(node.id)
      }}
    >
      {node.children.map(renderNode)}
    </TreeItem>
  )
  return (
    <Box>
      <Typography variant="overline" color="primary">KNOWLEDGE MAP</Typography>
      <Typography variant="h3" sx={{ mb: 1 }}>知识点目录树</Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>点击任意节点查看对应题目，进入列表后可直接切换其他标签。</Typography>
      <Paper variant="outlined" sx={{ maxWidth: 720, p: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}><AccountTreeIcon color="primary" /><Typography variant="h6">全部知识点</Typography></Stack>
        <SimpleTreeView defaultExpandedItems={expandedItems(nodes)}>{nodes.map(renderNode)}</SimpleTreeView>
        {!nodes.length && <Typography color="text.secondary">还没有标签</Typography>}
      </Paper>
    </Box>
  )
}
