import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import {
  Alert, Avatar, Box, Button, Paper, Stack, TextField, Typography,
} from '@mui/material'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const PENDING_OTP_KEY = 'algolog.pending-email-otp'
const PENDING_OTP_MAX_AGE = 15 * 60 * 1000

function readPendingOtp() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_OTP_KEY) ?? 'null') as { email?: string; sentAt?: number } | null
    if (value?.email && value.sentAt && Date.now() - value.sentAt < PENDING_OTP_MAX_AGE) return value
    sessionStorage.removeItem(PENDING_OTP_KEY)
  } catch {
    sessionStorage.removeItem(PENDING_OTP_KEY)
  }
  return null
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Supabase 会把 session 持久化；监听器同时覆盖首次恢复、登录和退出。
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export function AuthPanel({ onCancel }: { onCancel?: () => void }) {
  const [pendingOtp] = useState(readPendingOtp)
  const [email, setEmail] = useState(pendingOtp?.email ?? '')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(Boolean(pendingOtp))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(pendingOtp ? '验证码已发送，请输入邮件中的验证码。' : '')

  const sendCode = async () => {
    setError('')
    setNotice('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('请输入有效邮箱。')
      return
    }
    setBusy(true)
    try {
      // 首次使用的邮箱会自动创建账户；已有账户直接发送登录验证码。
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })
      if (authError) throw authError
      sessionStorage.setItem(PENDING_OTP_KEY, JSON.stringify({ email: email.trim(), sentAt: Date.now() }))
      setCodeSent(true)
      setNotice('验证码已发送；首次使用会在验证后自动完成注册。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async () => {
    setError('')
    setNotice('')
    if (!code.trim()) {
      setError('请输入邮箱中的验证码。')
      return
    }
    setBusy(true)
    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      })
      if (authError) throw authError
      sessionStorage.removeItem(PENDING_OTP_KEY)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码无效或已过期。')
    } finally {
      setBusy(false)
    }
  }

  return (
      <Paper variant="outlined" sx={{ width: '100%', p: 4 }}>
        <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}><LockOutlinedIcon /></Avatar>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>AlgoLog</Typography>
            <Typography color="text.secondary">登录后同步你的算法学习记录</Typography>
          </Box>
          {!isSupabaseConfigured && (
            <Alert severity="error">尚未配置 Supabase。请根据 README 创建 `.env.local` 后重启开发服务器。</Alert>
          )}
          <TextField
            fullWidth disabled={codeSent} type="email" label="邮箱" autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !codeSent) void sendCode() }}
          />
          {codeSent && (
            <TextField
              fullWidth autoFocus label="邮箱验证码" value={code}
              onChange={(event) => setCode(event.target.value.replace(/\s/g, ''))}
              onKeyDown={(event) => { if (event.key === 'Enter') void verifyCode() }}
              slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code' } }}
            />
          )}
          {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
          {notice && <Alert severity="success" sx={{ width: '100%' }}>{notice}</Alert>}
          <Button fullWidth variant="contained" size="large" disabled={busy || !isSupabaseConfigured} onClick={() => void (codeSent ? verifyCode() : sendCode())}>
            {busy ? '处理中…' : codeSent ? '验证并登录' : '发送验证码'}
          </Button>
          {codeSent && (
            <Stack direction="row" spacing={1}>
              <Button disabled={busy} onClick={() => {
                sessionStorage.removeItem(PENDING_OTP_KEY)
                setCodeSent(false)
                setCode('')
                setNotice('')
                setError('')
              }}>修改邮箱</Button>
              <Button disabled={busy} onClick={() => void sendCode()}>重新发送</Button>
            </Stack>
          )}
          {onCancel && <Button fullWidth onClick={onCancel}>继续使用本地模式</Button>}
        </Stack>
      </Paper>
  )
}
