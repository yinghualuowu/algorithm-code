import { useState } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import LaunchIcon from '@mui/icons-material/Launch'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import ReplayIcon from '@mui/icons-material/Replay'
import {
  Box, Button, Chip, Divider, IconButton, List, ListItem, ListItemText, Paper, Stack, Tab,
  Tabs, Typography,
} from '@mui/material'
import type { PaletteMode } from '@mui/material'
import type { Problem, SyncStatus } from '../model'
import { statusMeta } from '../model'
import { downloadJson } from '../data'
import { algorithmById } from '../algorithmCatalog'
import { MarkdownContent, SyntaxCode } from './RichContent'

interface Props {
  problem: Problem
  mode: PaletteMode
  readOnly?: boolean
  syncStatus?: SyncStatus
  related: Problem[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onAttempt: () => void
  onTag: (tag: string) => void
  onSelect: (problem: Problem) => void
}

const dateTime = (value: string) => new Date(value).toLocaleString('zh-CN')
const syncStatusLabel: Record<SyncStatus, string> = {
  local: '仅本地',
  syncing: '同步中',
  synced: '已同步',
  cached: '离线缓存',
  error: '同步失败',
}
const syncStatusColor: Record<SyncStatus, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  local: 'default',
  syncing: 'info',
  synced: 'success',
  cached: 'warning',
  error: 'error',
}

export default function ProblemDetail({ problem, mode, readOnly = false, syncStatus = 'local', related, onBack, onEdit, onDelete, onAttempt, onTag, onSelect }: Props) {
  const [solutionIndex, setSolutionIndex] = useState(0)
  const [hintStep, setHintStep] = useState(0)
  const solution = problem.solutions[Math.min(solutionIndex, problem.solutions.length - 1)]
  const availableHints = problem.hints.filter((hint) => hint.trim())
  return (
    <Stack spacing={3}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start' }}>返回题目库</Button>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip size="small" label={problem.difficulty} />
            <Chip size="small" color={statusMeta[problem.status].color} label={statusMeta[problem.status].label} />
            <Chip size="small" variant="outlined" color={syncStatusColor[syncStatus]} label={syncStatusLabel[syncStatus]} />
          </Stack>
          <Typography variant="h3">{problem.title}</Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {problem.algorithmIds.map((id) => {
              const tag = algorithmById.get(id)
              return tag ? <Chip key={id} color="primary" size="small" label={tag.name} /> : null
            })}
            {problem.customTags.map((tag) => <Chip key={tag} clickable variant="outlined" size="small" label={`#${tag}`} onClick={() => onTag(tag)} />)}
          </Stack>
        </Box>
        <Stack direction="row" sx={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          {problem.url && <Button component="a" href={problem.url} target="_blank" startIcon={<LaunchIcon />}>原题</Button>}
          <Button startIcon={<FileDownloadIcon />} onClick={() => downloadJson(problem, `${problem.title}.json`)}>导出本题</Button>
          <Button disabled={readOnly} variant="outlined" startIcon={<ReplayIcon />} onClick={onAttempt}>记录一次做题</Button>
          <Button disabled={readOnly} variant="contained" startIcon={<EditIcon />} onClick={onEdit}>编辑</Button>
          <IconButton disabled={readOnly} color="error" onClick={onDelete}><DeleteIcon /></IconButton>
        </Stack>
      </Stack>
      <Divider />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' }, gap: 4 }}>
        <Stack spacing={3}>
          <Section title="题目描述"><Typography sx={{ whiteSpace: 'pre-wrap' }}>{problem.statement || '暂无描述'}</Typography></Section>
          <Section title="输入 / 输出">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <CodePaper label="INPUT" value={problem.input} />
              <CodePaper label="OUTPUT" value={problem.output} />
            </Box>
          </Section>
          <Section title="代码方案">
            <Tabs value={Math.min(solutionIndex, problem.solutions.length - 1)} onChange={(_, value) => setSolutionIndex(value)} variant="scrollable">
              {problem.solutions.map((item) => <Tab key={item.id} label={item.language || '未命名'} />)}
            </Tabs>
            {solution && (
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1}>
                  <Chip label={`时间 ${solution.timeComplexity || '未填写'}`} />
                  <Chip label={`空间 ${solution.spaceComplexity || '未填写'}`} />
                </Stack>
                <SyntaxCode code={solution.code || '// 暂无代码'} language={solution.language} mode={mode} />
              </Stack>
            )}
          </Section>
          <Section title="备注与总结"><MarkdownContent value={problem.notes} mode={mode} empty="暂无总结" /></Section>
        </Stack>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <LightbulbIcon color="warning" />
              <Typography sx={{ fontWeight: 700 }}>渐进式提示</Typography>
            </Stack>
            {!availableHints.length ? (
              <Typography variant="body2" color="text.secondary">这道题还没有填写提示</Typography>
            ) : (
              <Stack spacing={1.5}>
                {availableHints.slice(0, hintStep).map((hint, index) => (
                  <AlertHint key={index} index={index} hint={hint} />
                ))}
                {hintStep < availableHints.length && (
                  <Button variant="outlined" onClick={() => setHintStep((step) => step + 1)}>
                    {hintStep ? '显示下一步提示' : '显示第一步提示'}
                  </Button>
                )}
                {hintStep === availableHints.length && (
                  <Button size="small" onClick={() => setHintStep(0)}>重新隐藏提示</Button>
                )}
              </Stack>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>记录信息</Typography>
            <Typography variant="body2">加入：{dateTime(problem.createdAt)}</Typography>
            <Typography variant="body2">编辑：{dateTime(problem.updatedAt)}</Typography>
            <Typography variant="body2">做题次数：{problem.attempts.length}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>做题记录</Typography>
            <List dense>
              {[...problem.attempts].reverse().map((attempt, index) => (
                <ListItem key={attempt.id} disableGutters><ListItemText primary={`第 ${problem.attempts.length - index} 次`} secondary={dateTime(attempt.attemptedAt)} /></ListItem>
              ))}
              {!problem.attempts.length && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>还没有做题记录</Typography>}
            </List>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>相似题目</Typography>
            <Stack>
              {related.map((item) => <Button key={item.id} onClick={() => onSelect(item)} sx={{ justifyContent: 'flex-start' }}>{item.title}</Button>)}
              {!related.length && <Typography variant="body2" color="text.secondary">暂无匹配题目</Typography>}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Box><Typography variant="h6" sx={{ mb: 1.5 }}>{title}</Typography>{children}</Box>
}

function CodePaper({ label, value }: { label: string; value: string }) {
  return <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{value || '—'}</Box></Paper>
}

function AlertHint({ index, hint }: { index: number; hint: string }) {
  return (
    <Box className="view-enter" sx={{ p: 1.5, borderRadius: 1, bgcolor: 'warning.50' }}>
      <Typography variant="caption" color="warning.dark">提示 {index + 1}</Typography>
      <Typography variant="body2">{hint}</Typography>
    </Box>
  )
}

