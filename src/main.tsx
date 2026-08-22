import React, { useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { zhCN } from '@mui/material/locale'
import type { PaletteMode } from '@mui/material'
import App from './App.tsx'
import { AuthProvider } from './auth'
import 'katex/dist/katex.min.css'
import './styles.css'

const COLOR_MODE_KEY = 'algolog.color-mode'

function Root() {
  const [mode, setMode] = useState<PaletteMode>(() => {
    const saved = localStorage.getItem(COLOR_MODE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const theme = useMemo(() => createTheme({
    palette: mode === 'light'
      ? {
          mode,
          primary: { main: '#174d3b' },
          secondary: { main: '#d86935' },
          background: { default: '#f5f3ed', paper: '#fbfaf6' },
        }
      : {
          mode,
          primary: { main: '#7fc9aa' },
          secondary: { main: '#f09a6d' },
          background: { default: '#111714', paper: '#18211d' },
        },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Noto Sans SC", system-ui, sans-serif',
      h3: { fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3rem)' },
    },
  }, zhCN), [mode])

  const toggleMode = () => {
    setMode((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      localStorage.setItem(COLOR_MODE_KEY, next)
      return next
    })
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <AuthProvider>
        <App mode={mode} onToggleMode={toggleMode} />
      </AuthProvider>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
