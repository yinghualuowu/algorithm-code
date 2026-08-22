import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import BackupIcon from '@mui/icons-material/Backup'
import BookIcon from '@mui/icons-material/Book'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import InsightsIcon from '@mui/icons-material/Insights'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert, AppBar, Autocomplete, Badge, Box, Breadcrumbs, Button, Card, CardActionArea, CardContent, CircularProgress,
  Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControl, IconButton,
  InputAdornment, InputLabel, Link, List, ListItemButton, ListItemIcon, ListItemText, MenuItem,
  Select, Snackbar, Stack, TextField, Toolbar, Tooltip, Typography,
} from '@mui/material'
import type { PaletteMode } from '@mui/material'
import type { ImportPreview, Problem, ProblemStatus, StoredDocument, SyncStatus } from './model'
import { createProblem, statusMeta } from './model'
import {
  BACKUP_FINGERPRINT_KEY, buildTagTree, downloadJson, fingerprint, getDemoProblems, loadProblems,
  loadLocalMigrationProblems, mergeImportPreview, previewImports, previewProblemList,
  resolveLocalCloudMigration, saveProblems,
} from './data'
import type { MigrationStrategy } from './data'
import { AuthPanel, useAuth } from './auth'
import {
  deleteCloudProblem, loadCloudProblems, localMigrationCompleted, markLocalMigrationCompleted,
  saveCloudProblem, saveCloudProblems,
} from './repository'
import ProblemDetail from './components/ProblemDetail'
import ProblemEditor from './components/ProblemEditor'
import TagTree from './components/TagTree'

type View = 'problems' | 'tags' | 'insights'
const drawerWidth = 248

function similarity(a: Problem, b: Problem) {
  const first = new Set([...a.tags, ...a.title.toLowerCase().split(/\s+/)])
  const second = new Set([...b.tags, ...b.title.toLowerCase().split(/\s+/)])
  return [...first].filter((value) => second.has(value)).length / Math.max(new Set([...first, ...second]).size, 1)
}

interface AppProps {
  mode: PaletteMode
  onToggleMode: () => void
}

export default function App(props: AppProps) {
  const { session, loading } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    if (session) setAuthOpen(false)
  }, [session])

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>

  return (
    <>
      <Workspace
        {...props}
        userId={session?.user.id}
        email={session?.user.email ?? ''}
        onRequestLogin={() => setAuthOpen(true)}
      />
      <Dialog open={authOpen && !session} fullWidth maxWidth="xs" onClose={() => setAuthOpen(false)}>
        <DialogContent sx={{ p: 0 }}><AuthPanel onCancel={() => setAuthOpen(false)} /></DialogContent>
      </Dialog>
    </>
  )
}

function Workspace({ mode, onToggleMode, userId, email, onRequestLogin }: AppProps & {
  userId?: string
  email: string
  onRequestLogin: () => void
}) {
  const { signOut } = useAuth()
  const localMode = !userId
  const [problems, setProblems] = useState<Problem[]>(() => localMode ? loadProblems().problems : [])
  const [view, setView] = useState<View>('problems')
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProblemStatus | 'all'>('all')
  const [selected, setSelected] = useState<Problem | null>(null)
  const [editing, setEditing] = useState<Problem | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [operationBusy, setOperationBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [migrationProblems, setMigrationProblems] = useState<Problem[]>([])
  const [migrationKind, setMigrationKind] = useState<'local' | 'demo'>('local')
  const [migrationImport, setMigrationImport] = useState(false)
  const [mergeReport, setMergeReport] = useState<string[]>([])
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [conflictChoices, setConflictChoices] = useState<Record<number, 'local' | 'incoming'>>({})
  const [syncStates, setSyncStates] = useState<Record<string, SyncStatus>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const tagTree = useMemo(() => buildTagTree(problems), [problems])
  const allTags = useMemo(() => [...new Set(problems.flatMap((problem) => problem.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [problems])
  const backupKey = `${BACKUP_FINGERPRINT_KEY}.${userId ?? 'local'}`
  const isDirty = localStorage.getItem(backupKey) !== fingerprint(problems)

  const refreshCloud = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setLoadError('')
    if (!userId) {
      // 游客模式完全使用原有 localStorage，不触发任何 Supabase 请求。
      const local = loadProblems()
      setProblems(local.problems)
      setOffline(false)
      setSyncStates(Object.fromEntries(local.problems.map((problem) => [problem.id, 'local'])))
      if (local.error) setLoadError(local.error)
      if (showLoading) setLoading(false)
      return { problems: local.problems, offline: false, error: local.error }
    }
    try {
      const result = await loadCloudProblems(userId)
      setProblems(result.problems)
      setOffline(result.offline)
      setSyncStates(Object.fromEntries(result.problems.map((problem) => [problem.id, result.offline ? 'cached' : 'synced'])))
      if (result.error) setLoadError(result.error)
      return result
    } catch (reason) {
      setOffline(true)
      setLoadError(reason instanceof Error ? reason.message : '无法加载云端数据。')
      return {
        problems: [],
        offline: true,
        error: reason instanceof Error ? reason.message : '无法加载云端数据。',
      }
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void (async () => {
      const cloud = await refreshCloud()
      setSelected(null)
      if (!userId) {
        setMigrationProblems([])
        return
      }
      // 登录后只提示一次迁移；确认云端全部写入成功前不会设置完成标记。
      if (userId && !localMigrationCompleted(userId)) {
        const local = loadLocalMigrationProblems()
        if (local.length) {
          setMigrationKind('local')
          setMigrationProblems(local)
        } else if (!cloud.offline && cloud.problems.length === 0) {
          setMigrationKind('demo')
          setMigrationProblems(getDemoProblems())
        } else {
          markLocalMigrationCompleted(userId)
        }
      }
    })()
  }, [refreshCloud, userId])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const openTag = (tag: string) => {
    setActiveTag(tag)
    setView('problems')
    setSelected(null)
    setMobileOpen(false)
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return problems.filter((problem) => {
      const matchesTag = !activeTag || problem.tags.some((tag) => tag === activeTag || tag.startsWith(`${activeTag}/`))
      const matchesStatus = statusFilter === 'all' || problem.status === statusFilter
      const solutions = problem.solutions.flatMap((solution) => [solution.language, solution.code, solution.timeComplexity, solution.spaceComplexity])
      const haystack = [problem.title, problem.source, problem.statement, problem.notes, problem.tags.join(' '), statusMeta[problem.status].label, ...solutions].join(' ').toLowerCase()
      return matchesTag && matchesStatus && (!needle || haystack.includes(needle))
    })
  }, [activeTag, problems, query, statusFilter])

  const backup = () => {
    const document: StoredDocument = { schemaVersion: 2, problems }
    downloadJson(document, `algolog-backup-${new Date().toISOString().slice(0, 10)}.json`)
    localStorage.setItem(backupKey, fingerprint(problems))
    setMessage('完整备份已下载')
  }

  const chooseFiles = async (files: File[]) => {
    if (!files.length) return
    const preview = await previewImports(files, problems)
    setImportPreview(preview)
    setConflictChoices({})
    if (fileRef.current) fileRef.current.value = ''
  }

  const markSync = (ids: string[], status: SyncStatus) => {
    setSyncStates((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, status])) }))
  }

  const commitImport = async () => {
    if (!importPreview || offline) return
    const merged = mergeImportPreview(problems, importPreview, conflictChoices)
    const currentById = new Map(problems.map((problem) => [problem.id, problem]))
    const changed = merged.filter((problem) => {
      const current = currentById.get(problem.id)
      return !current || fingerprint([current]) !== fingerprint([problem])
    })
    if (localMode) {
      saveProblems(merged)
      setProblems(merged)
      markSync(merged.map((problem) => problem.id), 'local')
      setMessage(`已导入本机：写入 ${changed.length}，跳过 ${importPreview.skipped}`)
      setImportPreview(null)
      return
    }
    setOperationBusy(true)
    // 云端写入成功后重新拉取数据库快照，不在客户端假设 RPC 的最终结果。
    markSync(changed.map((problem) => problem.id), 'syncing')
    try {
      await saveCloudProblems(changed)
      await refreshCloud(false)
      if (migrationImport && userId) {
        markLocalMigrationCompleted(userId)
        setMigrationProblems([])
        setMigrationImport(false)
      }
      setMessage(`导入完成：写入 ${changed.length}，跳过 ${importPreview.skipped}，失败文件 ${importPreview.failedFiles.length}`)
      setImportPreview(null)
    } catch (reason) {
      markSync(changed.map((problem) => problem.id), 'error')
      setMessage(reason instanceof Error ? reason.message : '云端导入失败，未删除本地数据。')
    } finally {
      setOperationBusy(false)
    }
  }

  const commitMigration = async (strategy: MigrationStrategy) => {
    if (!importPreview || !userId || offline) return
    const resolution = resolveLocalCloudMigration(problems, importPreview, strategy)
    const currentById = new Map(problems.map((problem) => [problem.id, problem]))
    const changed = resolution.problems.filter((problem) => {
      const current = currentById.get(problem.id)
      return !current || fingerprint([current]) !== fingerprint([problem])
    })
    setOperationBusy(true)
    markSync(changed.map((problem) => problem.id), 'syncing')
    try {
      if (changed.length) await saveCloudProblems(changed)
      await refreshCloud(false)
      markLocalMigrationCompleted(userId)
      setMigrationImport(false)
      setImportPreview(null)
      setMergeReport([...resolution.report, `云端写入 ${changed.length} 道题目，迁移流程已完成。`])
    } catch (reason) {
      markSync(changed.map((problem) => problem.id), 'error')
      setMessage(reason instanceof Error ? reason.message : '冲突处理失败，本地数据仍然保留。')
    } finally {
      setOperationBusy(false)
    }
  }

  const saveProblem = async (problem: Problem) => {
    if (offline) return
    const saved = { ...problem, updatedAt: new Date().toISOString() }
    if (localMode) {
      const exists = problems.some((item) => item.id === saved.id)
      const next = exists ? problems.map((item) => item.id === saved.id ? saved : item) : [saved, ...problems]
      saveProblems(next)
      setProblems(next)
      markSync([saved.id], 'local')
      setSelected(saved)
      setEditing(null)
      setMessage('题目已保存在本机；登录后可同步到云端')
      return
    }
    setOperationBusy(true)
    markSync([saved.id], 'syncing')
    try {
      const savedId = await saveCloudProblem(saved)
      const next = (await refreshCloud(false)).problems
      setSelected(next.find((item) => item.id === savedId) ?? null)
      setEditing(null)
      setMessage('题目已同步到云端')
    } catch (reason) {
      markSync([saved.id], 'error')
      setMessage(reason instanceof Error ? reason.message : '保存失败，请重试。')
    } finally {
      setOperationBusy(false)
    }
  }

  const beginLocalMigration = () => {
    setMigrationImport(true)
    setImportPreview(previewProblemList(migrationProblems, problems, migrationKind === 'local' ? '浏览器本地数据' : '演示题目'))
    setConflictChoices({})
    setMigrationProblems([])
  }

  const getSyncStatus = (problemId: string): SyncStatus =>
    syncStates[problemId] ?? (localMode ? 'local' : offline ? 'cached' : 'synced')

  const drawer = (
    <Box sx={{ width: drawerWidth, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar><Typography variant="h6" sx={{ fontWeight: 800 }}>AlgoLog</Typography></Toolbar>
      <Divider />
      <List>
        {([
          ['problems', '题目库', <BookIcon />],
          ['tags', '知识树', <AccountTreeIcon />],
          ['insights', '相似归纳', <InsightsIcon />],
        ] as const).map(([id, label, icon]) => (
          <ListItemButton key={id} selected={view === id} onClick={() => { setView(id); setSelected(null); setMobileOpen(false) }}>
            <ListItemIcon>{icon}</ListItemIcon><ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ px: 2, py: 2 }}><Typography variant="overline">常用标签</Typography></Box>
      <List dense sx={{ overflow: 'auto' }}>
        {allTags.filter((tag) => !tag.includes('/')).slice(0, 8).map((tag) => (
          <ListItemButton key={tag} onClick={() => openTag(tag)}><ListItemText primary={`# ${tag}`} /></ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: 'auto', p: 2 }}>
        <Alert severity={localMode || offline ? 'warning' : isDirty ? 'info' : 'success'}>
          {localMode ? '本地模式：登录后可同步' : offline ? '离线缓存：当前只读' : isDirty ? '云端已同步，尚未备份' : '云端已同步并备份'}
        </Alert>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` } }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton sx={{ display: { md: 'none' } }} onClick={() => setMobileOpen(true)}><MenuIcon /></IconButton>
          <TextField
            size="small" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索题目、代码、复杂度或标签"
            sx={{ flex: 1, maxWidth: 540 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
          />
          <Box sx={{ flex: 1 }} />
          <input hidden multiple ref={fileRef} type="file" accept=".json,application/json" onChange={(event) => chooseFiles([...event.target.files ?? []])} />
          <Button disabled={offline || operationBusy} startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>导入</Button>
          <Badge color="warning" variant="dot" invisible={!isDirty}>
            <Button startIcon={<BackupIcon />} onClick={backup} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>备份</Button>
          </Badge>
          <Tooltip title={mode === 'light' ? '切换到深色模式' : '切换到浅色模式'}>
            <IconButton onClick={onToggleMode} color="inherit">
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
          {!localMode && <Tooltip title="重新加载云端数据"><IconButton disabled={operationBusy} onClick={() => void refreshCloud()}><RefreshIcon /></IconButton></Tooltip>}
          {!localMode && <Typography variant="caption" sx={{ display: { xs: 'none', xl: 'block' }, maxWidth: 150 }} noWrap>{email}</Typography>}
          {localMode ? (
            <Button startIcon={<LoginIcon />} onClick={onRequestLogin}>登录同步</Button>
          ) : (
            <Tooltip title="退出登录"><IconButton onClick={() => void signOut().catch((reason) => setMessage(reason.message))}><LogoutIcon /></IconButton></Tooltip>
          )}
          <Button disabled={offline || operationBusy} variant="contained" startIcon={<AddIcon />} onClick={() => setEditing(createProblem())}>添加题目</Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }}>{drawer}</Drawer>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` }, p: { xs: 2, sm: 4 }, pt: { xs: 11, sm: 13 } }}>
        <Box key={selected?.id ?? `${view}-${activeTag}`} className="view-enter">
          {loading ? (
            <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
          ) : (
            <>
              {localMode && (
                <Alert severity="info" sx={{ mb: 3 }} action={<Button onClick={onRequestLogin}>登录或注册</Button>}>
                  当前使用本地数据，所有修改仅保存在此浏览器。登录后可迁移并同步到云端。
                </Alert>
              )}
              {loadError && <Alert severity={offline ? 'warning' : 'error'} sx={{ mb: 3 }} action={<Button onClick={() => void refreshCloud()}>重试</Button>}>{loadError}</Alert>}
              {selected ? (
          <ProblemDetail
            problem={selected}
            mode={mode}
            readOnly={offline || operationBusy}
            syncStatus={getSyncStatus(selected.id)}
            related={problems.filter((item) => item.id !== selected.id).sort((a, b) => similarity(selected, b) - similarity(selected, a)).slice(0, 3)}
            onBack={() => setSelected(null)}
            onEdit={() => { if (!offline) setEditing(selected) }}
            onDelete={() => {
              if (!offline && window.confirm(`确定删除“${selected.title}”吗？`)) {
                if (localMode) {
                  const next = problems.filter((item) => item.id !== selected.id)
                  saveProblems(next)
                  setProblems(next)
                  setSelected(null)
                  setMessage('题目已从本机删除')
                  return
                }
                void (async () => {
                setOperationBusy(true)
                markSync([selected.id], 'syncing')
                try {
                  await deleteCloudProblem(selected.id)
                  await refreshCloud(false)
                  setSelected(null)
                  setMessage('题目已从云端删除')
                } catch (reason) {
                  markSync([selected.id], 'error')
                  setMessage(reason instanceof Error ? reason.message : '删除失败')
                } finally {
                  setOperationBusy(false)
                }
                })()
              }
            }}
            onAttempt={() => {
              if (offline) return
              const changed = { ...selected, attempts: [...selected.attempts, { id: crypto.randomUUID(), attemptedAt: new Date().toISOString() }], updatedAt: new Date().toISOString() }
              if (localMode) {
                const next = problems.map((item) => item.id === changed.id ? changed : item)
                saveProblems(next)
                setProblems(next)
                setSelected(changed)
                markSync([changed.id], 'local')
                return
              }
              void (async () => {
                setOperationBusy(true)
                markSync([changed.id], 'syncing')
                try {
                  const savedId = await saveCloudProblem(changed)
                  const next = (await refreshCloud(false)).problems
                  setSelected(next.find((item) => item.id === savedId) ?? null)
                } catch (reason) {
                  markSync([changed.id], 'error')
                  setMessage(reason instanceof Error ? reason.message : '做题记录同步失败')
                } finally {
                  setOperationBusy(false)
                }
              })()
            }}
            onTag={openTag}
            onSelect={setSelected}
          />
        ) : view === 'tags' ? (
          <TagTree nodes={tagTree} onTag={openTag} />
        ) : view === 'insights' ? (
          <Insights problems={problems} onSelect={setSelected} />
        ) : (
          <ProblemLibrary
            problems={filtered} total={problems.length} allTags={allTags} activeTag={activeTag}
            syncStatus={getSyncStatus}
            statusFilter={statusFilter} onStatus={setStatusFilter} onTag={openTag}
            onClearTag={() => setActiveTag('')} onSelect={setSelected} onAdd={() => { if (!offline) setEditing(createProblem()) }}
          />
              )}
            </>
          )}
        </Box>
      </Box>
      {editing && <ProblemEditor value={editing} busy={operationBusy} onClose={() => setEditing(null)} onSave={saveProblem} />}
      <MigrationDialog kind={migrationKind} problems={migrationProblems} busy={operationBusy} onLater={() => setMigrationProblems([])} onImport={beginLocalMigration} />
      <ImportDialog
        preview={importPreview} busy={operationBusy} migration={migrationImport}
        choices={conflictChoices}
        onChoice={(index, choice) => setConflictChoices((old) => ({ ...old, [index]: choice }))}
        onClose={() => { setImportPreview(null); setMigrationImport(false) }}
        onCommit={commitImport}
        onMigrationStrategy={commitMigration}
      />
      <MergeReportDialog report={mergeReport} onClose={() => setMergeReport([])} />
      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage('')} message={message} />
    </Box>
  )
}

function ProblemLibrary({ problems, total, allTags, activeTag, statusFilter, syncStatus, onStatus, onTag, onClearTag, onSelect, onAdd }: {
  problems: Problem[]; total: number; allTags: string[]; activeTag: string; statusFilter: ProblemStatus | 'all'
  syncStatus: (problemId: string) => SyncStatus
  onStatus: (value: ProblemStatus | 'all') => void; onTag: (tag: string) => void; onClearTag: () => void
  onSelect: (problem: Problem) => void; onAdd: () => void
}) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" color="primary">PROBLEM LIBRARY</Typography>
        <Typography variant="h3">我的题目库</Typography>
        <Typography color="text.secondary">记录思路，而不只是记录答案。</Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
        <Breadcrumbs sx={{ flex: 1 }}>
          <Link component="button" underline="hover" onClick={onClearTag}>全部题目</Link>
          {activeTag.split('/').filter(Boolean).map((_, index, segments) => {
            const path = segments.slice(0, index + 1).join('/')
            return <Link component="button" underline="hover" key={path} onClick={() => onTag(path)}>{segments[index]}</Link>
          })}
        </Breadcrumbs>
        <Autocomplete size="small" sx={{ minWidth: 220 }} options={allTags} value={activeTag || null} onChange={(_, value) => value ? onTag(value) : onClearTag()} renderInput={(params) => <TextField {...params} label="快捷切换 TAG" />} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>状态</InputLabel>
          <Select label="状态" value={statusFilter} onChange={(e) => onStatus(e.target.value as ProblemStatus | 'all')}>
            <MenuItem value="all">全部状态</MenuItem>
            <MenuItem value="solved">已解决</MenuItem>
            <MenuItem value="thinking">思考中</MenuItem>
            <MenuItem value="pending">待解决</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Typography color="text.secondary">共 {total} 题，当前显示 {problems.length} 题</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', xl: 'repeat(3, minmax(0,1fr))' }, gap: 2 }}>
        {problems.map((problem) => (
          <Card key={problem.id} variant="outlined" className="problem-card">
            <CardActionArea onClick={() => onSelect(problem)} sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption">{problem.source || '未注明来源'}</Typography>
                  <Stack direction="row" spacing={0.5}><SyncChip status={syncStatus(problem.id)} /><Chip size="small" color={statusMeta[problem.status].color} label={statusMeta[problem.status].label} /></Stack>
                </Stack>
                <Typography variant="h6">{problem.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{problem.statement || '暂无题目描述'}</Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>{problem.tags.slice(0, 4).map((tag) => <Chip key={tag} size="small" label={`#${tag}`} />)}</Stack>
                <Box sx={{ flex: 1 }} />
                <Divider />
                <Typography variant="caption" color="text.secondary">{problem.solutions.map((solution) => solution.language).join(' / ')} · 做题 {problem.attempts.length} 次 · 编辑于 {new Date(problem.updatedAt).toLocaleDateString('zh-CN')}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
      {!problems.length && <Alert severity="info" action={<Button onClick={onAdd}>添加题目</Button>}>没有符合条件的题目</Alert>}
    </Stack>
  )
}

const syncMeta: Record<SyncStatus, { label: string; color: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  local: { label: '仅本地', color: 'default' },
  syncing: { label: '同步中', color: 'info' },
  synced: { label: '已同步', color: 'success' },
  cached: { label: '离线缓存', color: 'warning' },
  error: { label: '同步失败', color: 'error' },
}

function SyncChip({ status }: { status: SyncStatus }) {
  const meta = syncMeta[status]
  return <Chip size="small" variant="outlined" color={meta.color} label={meta.label} />
}

function Insights({ problems, onSelect }: { problems: Problem[]; onSelect: (problem: Problem) => void }) {
  const pairs = problems.flatMap((a, index) => problems.slice(index + 1).map((b) => ({ a, b, score: similarity(a, b) }))).filter((pair) => pair.score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
  return <Stack spacing={2}><Typography variant="h3">相似题目归纳</Typography>{pairs.map(({ a, b, score }) => <Card variant="outlined" key={`${a.id}-${b.id}`}><CardContent><Typography color="primary" sx={{ fontWeight: 700 }}>{Math.round(score * 100)}% 相关</Typography><Button onClick={() => onSelect(a)}>{a.title}</Button> ↔ <Button onClick={() => onSelect(b)}>{b.title}</Button></CardContent></Card>)}{!pairs.length && <Alert severity="info">继续添加标签和题目后，这里会显示相似关系。</Alert>}</Stack>
}

function MigrationDialog({ kind, problems, busy, onLater, onImport }: {
  kind: 'local' | 'demo'; problems: Problem[]; busy: boolean; onLater: () => void; onImport: () => void
}) {
  return (
    <Dialog open={!!problems.length}>
      <DialogTitle>{kind === 'local' ? '发现浏览器本地数据' : '添加演示题目'}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          {kind === 'local'
            ? `检测到 ${problems.length} 道本地题目。可以安全迁移到当前账户，原 localStorage 数据不会被删除。`
            : `当前账户还没有题目，可以导入 ${problems.length} 道示例来体验完整功能。`}
        </Alert>
        <Typography color="text.secondary">{kind === 'local' ? '迁移时会检查同 ID 题目，并提供云端优先、本地覆盖或智能合并三种策略。' : '示例题可以像普通题目一样编辑或删除。'}</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onLater}>暂不处理</Button>
        <Button disabled={busy} variant="contained" onClick={onImport}>{kind === 'local' ? '导入云端' : '添加示例'}</Button>
      </DialogActions>
    </Dialog>
  )
}

function ImportDialog({ preview, busy, migration, choices, onChoice, onClose, onCommit, onMigrationStrategy }: {
  preview: ImportPreview | null; busy: boolean; migration: boolean; choices: Record<number, 'local' | 'incoming'>
  onChoice: (index: number, choice: 'local' | 'incoming') => void; onClose: () => void; onCommit: () => void | Promise<void>
  onMigrationStrategy: (strategy: MigrationStrategy) => void | Promise<void>
}) {
  if (!preview) return null
  if (migration) {
    return (
      <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose}>
        <DialogTitle>选择本地与云端数据处理方式</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            检测到 {preview.conflicts.length} 道冲突题目，另有 {preview.additions.length} 道题目仅存在于本地。
          </Alert>
          <Stack spacing={2}>
            <Box><Typography sx={{ fontWeight: 700 }}>强制使用云端</Typography><Typography variant="body2" color="text.secondary">忽略本地题目，不修改任何云端数据。</Typography></Box>
            <Box><Typography sx={{ fontWeight: 700 }}>强制使用本地覆盖</Typography><Typography variant="body2" color="text.secondary">本地同 ID 题目完整覆盖云端版本，并上传本地新增题目。</Typography></Box>
            <Box><Typography sx={{ fontWeight: 700 }}>智能冲突解决</Typography><Typography variant="body2" color="text.secondary">保留较新的基础字段，合并标签、代码方案和做题记录；不同笔记会同时保留。</Typography></Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap' }}>
          <Button disabled={busy} onClick={onClose}>取消</Button>
          <Button disabled={busy} onClick={() => void onMigrationStrategy('cloud')}>强制云端</Button>
          <Button disabled={busy} color="warning" onClick={() => void onMigrationStrategy('local')}>本地覆盖</Button>
          <Button disabled={busy} variant="contained" onClick={() => void onMigrationStrategy('merge')}>{busy ? '处理中…' : '智能合并'}</Button>
        </DialogActions>
      </Dialog>
    )
  }
  return (
    <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : onClose}>
      <DialogTitle>确认导入 {preview.totalFiles} 个 JSON 文件</DialogTitle>
      <DialogContent dividers>
        <Alert severity={preview.failedFiles.length ? 'warning' : 'info'} sx={{ mb: 2 }}>
          新增 {preview.additions.length}，重复跳过 {preview.skipped}，冲突 {preview.conflicts.length}，失败文件 {preview.failedFiles.length}
        </Alert>
        {!!preview.failedFiles.length && <Typography color="error" sx={{ mb: 2 }}>失败：{preview.failedFiles.join('、')}</Typography>}
        <Stack spacing={2}>
          {preview.conflicts.map((conflict, index) => (
            <Card variant="outlined" key={`${conflict.id}-${index}`}><CardContent>
              <Typography sx={{ fontWeight: 700 }}>{conflict.local.title}</Typography>
              <Typography variant="caption" color="text.secondary">来源：{conflict.sourceFile}</Typography>
              <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                <InputLabel>冲突处理</InputLabel>
                <Select label="冲突处理" value={choices[index] ?? 'local'} onChange={(e) => onChoice(index, e.target.value as 'local' | 'incoming')}>
                  <MenuItem value="local">保留本地版本（编辑于 {new Date(conflict.local.updatedAt).toLocaleString('zh-CN')}）</MenuItem>
                  <MenuItem value="incoming">使用导入版本（编辑于 {new Date(conflict.incoming.updatedAt).toLocaleString('zh-CN')}）</MenuItem>
                </Select>
              </FormControl>
            </CardContent></Card>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={onClose}>取消</Button><Button disabled={busy} variant="contained" onClick={() => void onCommit()}>{busy ? '正在写入…' : '确认并写入'}</Button></DialogActions>
    </Dialog>
  )
}

function MergeReportDialog({ report, onClose }: { report: string[]; onClose: () => void }) {
  return (
    <Dialog open={!!report.length} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>本地与云端数据处理完成</DialogTitle>
      <DialogContent dividers>
        <Alert severity="success" sx={{ mb: 2 }}>数据处理已完成，原浏览器本地数据仍然保留。</Alert>
        <Stack component="ul" spacing={1} sx={{ pl: 3 }}>
          {report.map((line, index) => <Typography component="li" key={index}>{line}</Typography>)}
        </Stack>
      </DialogContent>
      <DialogActions><Button variant="contained" onClick={onClose}>知道了</Button></DialogActions>
    </Dialog>
  )
}
