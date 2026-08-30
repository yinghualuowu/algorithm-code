import { useMemo, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import FilterListIcon from '@mui/icons-material/FilterList'
import {
  Alert, Autocomplete, Box, Button, Card, CardActionArea, CardContent, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, Drawer, FormControl, InputLabel, MenuItem,
  Select, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import type { PaletteMode } from '@mui/material'
import type { CodeTemplate } from '../model'
import { algorithmById, algorithmLabels, algorithmLevels } from '../algorithmCatalog'
import AlgorithmSelector from './AlgorithmSelector'
import { MarkdownContent, SyntaxCode } from './RichContent'

export default function TemplateLibrary({ templates, query, mode, readOnly, onAdd, onEdit, onDelete }: {
  templates: CodeTemplate[]
  query: string
  mode: PaletteMode
  readOnly?: boolean
  onAdd: () => void
  onEdit: (template: CodeTemplate) => void
  onDelete: (template: CodeTemplate) => void
}) {
  const [selected, setSelected] = useState<CodeTemplate | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [algorithmIds, setAlgorithmIds] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [language, setLanguage] = useState('all')
  const allCustomTags = useMemo(() => [...new Set(templates.flatMap((item) => item.customTags))].sort(), [templates])
  const languages = useMemo(() => [...new Set(templates.flatMap((item) => item.variants.map((variant) => variant.language)).filter(Boolean))].sort(), [templates])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return templates.filter((template) => {
      const systemTags = template.algorithmIds.flatMap((id) => {
        const tag = algorithmById.get(id)
        return tag ? [tag.name, tag.category, tag.group, tag.level] : []
      })
      const haystack = [template.title, template.description, ...template.customTags, ...systemTags, ...template.variants.flatMap((item) => [item.language, item.code])].join(' ').toLowerCase()
      const matchesAlgorithms = !algorithmIds.length || algorithmIds.some((id) => template.algorithmIds.includes(id))
      const matchesCustom = !customTags.length || customTags.some((tag) => template.customTags.includes(tag))
      const matchesLevel = !levels.length || template.algorithmIds.some((id) => levels.includes(algorithmById.get(id)?.level ?? ''))
      const matchesLanguage = language === 'all' || template.variants.some((variant) => variant.language === language)
      return (!needle || haystack.includes(needle)) && matchesAlgorithms && matchesCustom && matchesLevel && matchesLanguage
    })
  }, [algorithmIds, customTags, language, levels, query, templates])
  const clearFilters = () => { setAlgorithmIds([]); setCustomTags([]); setLevels([]); setLanguage('all') }
  const activeCount = algorithmIds.length + customTags.length + levels.length + (language === 'all' ? 0 : 1)

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 2 }}>
        <Box><Typography variant="overline" color="primary">CODE TEMPLATES</Typography><Typography variant="h3">代码模板库</Typography><Typography color="text.secondary">同一模板集中维护多种语言实现和使用说明。</Typography></Box>
        <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1 }}>
          <Button startIcon={<FilterListIcon />} variant={activeCount ? 'contained' : 'outlined'} onClick={() => setFilterOpen(true)}>筛选{activeCount ? ` (${activeCount})` : ''}</Button>
          <Button disabled={readOnly} startIcon={<AddIcon />} variant="contained" onClick={onAdd}>新增模板</Button>
        </Stack>
      </Stack>
      <Typography color="text.secondary">共 {templates.length} 个模板，当前显示 {filtered.length} 个</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', xl: 'repeat(3,minmax(0,1fr))' }, gap: 2 }}>
        {filtered.map((template) => (
          <Card key={template.id} variant="outlined">
            <CardActionArea onClick={() => setSelected(template)} sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6">{template.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ my: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{template.description || '暂无解释'}</Typography>
                <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                  {algorithmLabels(template.algorithmIds).slice(0, 3).map((tag) => <Chip key={tag} size="small" color="primary" label={tag} />)}
                  {template.customTags.slice(0, 2).map((tag) => <Chip key={tag} size="small" variant="outlined" label={`#${tag}`} />)}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>{template.variants.map((variant) => variant.language).join(' / ')}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
      {!filtered.length && <Alert severity="info" action={<Button onClick={clearFilters}>清除筛选</Button>}>没有符合条件的模板</Alert>}
      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)}>
        <Stack spacing={2} sx={{ width: { xs: 320, sm: 420 }, p: 2.5 }}>
          <Typography variant="h6">模板筛选</Typography>
          <AlgorithmSelector compact value={algorithmIds} onChange={setAlgorithmIds} />
          <Autocomplete multiple options={allCustomTags} value={customTags} onChange={(_, value) => setCustomTags(value)} renderInput={(params) => <TextField {...params} label="自定义标签" />} />
          <Autocomplete multiple options={algorithmLevels} value={levels} onChange={(_, value) => setLevels(value)} renderInput={(params) => <TextField {...params} label="算法等级" />} />
          <FormControl><InputLabel>语言</InputLabel><Select label="语言" value={language} onChange={(event) => setLanguage(event.target.value)}><MenuItem value="all">全部语言</MenuItem>{languages.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          <Button onClick={clearFilters}>清除全部</Button>
          <Button variant="contained" onClick={() => setFilterOpen(false)}>查看结果</Button>
        </Stack>
      </Drawer>
      {selected && <TemplateDetail template={selected} mode={mode} readOnly={readOnly} onClose={() => setSelected(null)} onEdit={() => { setSelected(null); onEdit(selected) }} onDelete={() => { setSelected(null); onDelete(selected) }} />}
    </Stack>
  )
}

function TemplateDetail({ template, mode, readOnly, onClose, onEdit, onDelete }: {
  template: CodeTemplate; mode: PaletteMode; readOnly?: boolean
  onClose: () => void; onEdit: () => void; onDelete: () => void
}) {
  const [tab, setTab] = useState(0)
  const variant = template.variants[Math.min(tab, template.variants.length - 1)]
  return (
    <Dialog open fullWidth maxWidth="lg" onClose={onClose}>
      <DialogTitle>{template.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
            {template.algorithmIds.map((id) => {
              const tag = algorithmById.get(id)
              return tag ? <Chip key={id} color="primary" label={`${tag.category} / ${tag.name}`} /> : null
            })}
            {template.customTags.map((tag) => <Chip key={tag} variant="outlined" label={`#${tag}`} />)}
          </Stack>
          <MarkdownContent value={template.description} mode={mode} empty="暂无解释" />
          <Box>
            <Tabs value={Math.min(tab, template.variants.length - 1)} onChange={(_, value) => setTab(value)} variant="scrollable">
              {template.variants.map((item) => <Tab key={item.id} label={item.language || '未命名'} />)}
            </Tabs>
            {variant && <Box sx={{ mt: 2 }}><SyntaxCode code={variant.code || '// 暂无代码'} language={variant.language} mode={mode} /></Box>}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" disabled={readOnly} startIcon={<DeleteIcon />} onClick={onDelete}>删除</Button>
        <Button disabled={readOnly} startIcon={<EditIcon />} onClick={onEdit}>编辑</Button>
        <Button variant="contained" onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  )
}
