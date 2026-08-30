import { useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, TextField, Typography,
} from '@mui/material'
import type { CodeTemplate, TemplateVariant } from '../model'
import { createTemplateVariant } from '../model'
import AlgorithmSelector from './AlgorithmSelector'

export default function TemplateEditor({ value, customTagOptions, busy, onClose, onSave }: {
  value: CodeTemplate
  customTagOptions: string[]
  busy?: boolean
  onClose: () => void
  onSave: (template: CodeTemplate) => void | Promise<void>
}) {
  const [draft, setDraft] = useState(value)
  const update = <K extends keyof CodeTemplate>(key: K, next: CodeTemplate[K]) =>
    setDraft((old) => ({ ...old, [key]: next }))
  const updateVariant = (id: string, patch: Partial<TemplateVariant>) =>
    update('variants', draft.variants.map((variant) => variant.id === id ? { ...variant, ...patch } : variant))
  const submit = () => {
    if (!draft.title.trim()) return
    onSave({ ...draft, customTags: [...new Set(draft.customTags.map((tag) => tag.trim()).filter(Boolean))] })
  }

  return (
    <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : onClose}>
      <DialogTitle>{value.title ? '编辑代码模板' : '新增代码模板'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField autoFocus required label="模板名称" value={draft.title} onChange={(event) => update('title', event.target.value)} />
          <TextField
            multiline minRows={5} label="解释与使用说明" value={draft.description}
            onChange={(event) => update('description', event.target.value)}
            helperText="支持 Markdown、LaTeX 和代码围栏"
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>系统算法标签</Typography>
            <AlgorithmSelector compact value={draft.algorithmIds} onChange={(ids) => update('algorithmIds', ids)} />
          </Box>
          <Autocomplete
            multiple freeSolo options={customTagOptions} value={draft.customTags}
            onChange={(_, tags) => update('customTags', tags.map((tag) => tag.trim()).filter(Boolean))}
            renderInput={(params) => <TextField {...params} label="自定义标签" />}
          />
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">多语言实现</Typography>
            <Button startIcon={<AddIcon />} onClick={() => update('variants', [...draft.variants, createTemplateVariant()])}>新增语言</Button>
          </Stack>
          {draft.variants.map((variant, index) => (
            <Box key={variant.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                <TextField size="small" label={`语言 ${index + 1}`} value={variant.language} onChange={(event) => updateVariant(variant.id, { language: event.target.value })} sx={{ flex: 1 }} />
                <IconButton disabled={draft.variants.length === 1} onClick={() => update('variants', draft.variants.filter((item) => item.id !== variant.id))}><DeleteIcon /></IconButton>
              </Stack>
              <TextField
                fullWidth multiline minRows={10} label="代码" value={variant.code}
                onChange={(event) => updateVariant(variant.id, { code: event.target.value })}
                slotProps={{ htmlInput: { spellCheck: false } }}
                sx={{ '& textarea': { fontFamily: 'monospace' } }}
              />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy || !draft.title.trim()} onClick={submit}>{busy ? '正在同步…' : '保存模板'}</Button>
      </DialogActions>
    </Dialog>
  )
}
