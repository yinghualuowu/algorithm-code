import { useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import type { Difficulty, Problem, ProblemStatus, Solution } from '../model'
import { createSolution } from '../model'
import { suggestTags } from '../data'

interface Props {
  value: Problem
  busy?: boolean
  onClose: () => void
  onSave: (problem: Problem) => void | Promise<void>
}

export default function ProblemEditor({ value, busy = false, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(value)
  const [tagInput, setTagInput] = useState(value.tags.join(', '))
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const update = <K extends keyof Problem>(key: K, next: Problem[K]) =>
    setDraft((old) => ({ ...old, [key]: next }))
  const updateSolution = (id: string, patch: Partial<Solution>) =>
    update('solutions', draft.solutions.map((solution) => solution.id === id ? { ...solution, ...patch } : solution))

  const submit = () => {
    if (!draft.title.trim()) return
    const tags = tagInput.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
    const withTags = { ...draft, tags }
    onSave({ ...withTags, tags: [...new Set([...tags, ...suggestTags(withTags)])] })
  }

  return (
    <Dialog open fullWidth maxWidth="md" fullScreen={fullScreen} onClose={onClose}>
      <DialogTitle>{value.title ? '编辑题目' : '记录新题目'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField autoFocus required label="题目名称" value={draft.title} onChange={(e) => update('title', e.target.value)} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
            <TextField label="题目来源" value={draft.source} onChange={(e) => update('source', e.target.value)} />
            <FormControl>
              <InputLabel>难度</InputLabel>
              <Select label="难度" value={draft.difficulty} onChange={(e) => update('difficulty', e.target.value as Difficulty)}>
                {['简单', '中等', '困难'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>状态</InputLabel>
              <Select label="状态" value={draft.status} onChange={(e) => update('status', e.target.value as ProblemStatus)}>
                <MenuItem value="solved">已解决</MenuItem>
                <MenuItem value="thinking">思考中</MenuItem>
                <MenuItem value="pending">待解决</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField label="题目链接" type="url" value={draft.url} onChange={(e) => update('url', e.target.value)} />
          <TextField label="题干" multiline minRows={4} value={draft.statement} onChange={(e) => update('statement', e.target.value)} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField label="输入" multiline minRows={3} value={draft.input} onChange={(e) => update('input', e.target.value)} />
            <TextField label="输出" multiline minRows={3} value={draft.output} onChange={(e) => update('output', e.target.value)} />
          </Box>
          <TextField label="知识点标签" helperText="多个标签用逗号分隔；父子层级使用 /" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
          <Divider />
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">代码方案</Typography>
            <Button startIcon={<AddIcon />} onClick={() => update('solutions', [...draft.solutions, createSolution()])}>新增语言</Button>
          </Stack>
          {draft.solutions.map((solution, index) => (
            <Box key={solution.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <Typography sx={{ flex: 1, fontWeight: 700 }}>方案 {index + 1}</Typography>
                <IconButton disabled={draft.solutions.length === 1} onClick={() => update('solutions', draft.solutions.filter((item) => item.id !== solution.id))}>
                  <DeleteIcon />
                </IconButton>
              </Stack>
              <Stack spacing={2}>
                <TextField label="代码语言" value={solution.language} onChange={(e) => updateSolution(solution.id, { language: e.target.value })} />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField label="时间复杂度" placeholder="例如 O(n)" value={solution.timeComplexity} onChange={(e) => updateSolution(solution.id, { timeComplexity: e.target.value })} />
                  <TextField label="空间复杂度" placeholder="例如 O(n)" value={solution.spaceComplexity} onChange={(e) => updateSolution(solution.id, { spaceComplexity: e.target.value })} />
                </Box>
                <TextField label="代码" multiline minRows={8} value={solution.code} onChange={(e) => updateSolution(solution.id, { code: e.target.value })} slotProps={{ htmlInput: { spellCheck: false } }} sx={{ '& textarea': { fontFamily: 'monospace' } }} />
              </Stack>
            </Box>
          ))}
          <Divider />
          <Typography variant="h6">渐进式提示</Typography>
          {draft.hints.map((hint, index) => (
            <TextField key={index} label={`第 ${index + 1} 步提示`} value={hint} onChange={(e) => {
              const hints = [...draft.hints] as [string, string, string]
              hints[index] = e.target.value
              update('hints', hints)
            }} />
          ))}
          <TextField
            label="备注与总结"
            multiline
            minRows={5}
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
            helperText="支持 Markdown 和 MathType 复制的 LaTeX；可使用 $...$、$$...$$、\(...\) 或 \[...\]"
            placeholder={'例如：状态转移方程为\n$$dp[i] = \\max(dp[i-1], dp[i-2] + nums[i])$$'}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy || !draft.title.trim()} onClick={submit}>{busy ? '正在同步…' : '保存题目'}</Button>
      </DialogActions>
    </Dialog>
  )
}
