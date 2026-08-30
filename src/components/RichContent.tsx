import { Box, Typography } from '@mui/material'
import type { PaletteMode } from '@mui/material'
import { Highlight, themes } from 'prism-react-renderer'
import type { Language } from 'prism-react-renderer'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

const languageAliases: Record<string, Language> = {
  typescript: 'typescript', ts: 'typescript', javascript: 'javascript', js: 'javascript',
  python: 'python', py: 'python', 'c++': 'cpp', cpp: 'cpp', c: 'c', java: 'java',
  go: 'go', rust: 'rust', kotlin: 'kotlin', sql: 'sql', bash: 'bash', shell: 'bash',
}

export function SyntaxCode({ code, language, mode }: { code: string; language: string; mode: PaletteMode }) {
  const normalizedLanguage = languageAliases[language.trim().toLowerCase()] ?? 'text'
  return (
    <Highlight theme={mode === 'dark' ? themes.vsDark : themes.github} code={code} language={normalizedLanguage}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <Box component="pre" sx={{ m: 0, p: 2, overflow: 'auto', borderRadius: 1, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7 }} style={style}>
          {tokens.map((line, index) => (
            <Box component="div" key={index} {...getLineProps({ line })}>
              {line.map((token, tokenIndex) => <span key={tokenIndex} {...getTokenProps({ token })} />)}
            </Box>
          ))}
        </Box>
      )}
    </Highlight>
  )
}

export function MarkdownContent({ value, mode, empty = '暂无内容' }: { value: string; mode: PaletteMode; empty?: string }) {
  if (!value.trim()) return <Typography color="text.secondary">{empty}</Typography>
  const normalized = value
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expression: string) => `$${expression}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `$$${expression}$$`)
  return (
    <Box sx={{ lineHeight: 1.8, '& p': { my: 1 }, '& pre': { overflow: 'auto' }, '& code': { fontFamily: 'monospace' }, '& .katex-display': { overflowX: 'auto', overflowY: 'hidden' } }}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const language = /language-([\w+-]+)/.exec(className ?? '')?.[1]
            return language
              ? <SyntaxCode code={String(children).replace(/\n$/, '')} language={language} mode={mode} />
              : <Box component="code" sx={{ px: 0.5, borderRadius: 0.5, bgcolor: 'action.hover' }}>{children}</Box>
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </Box>
  )
}
