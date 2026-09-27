import { useState, type ReactNode } from 'react'
import { Highlight, Prism, type PrismTheme } from 'prism-react-renderer'
import Button from '@zuilib/primitives/button'

/*
 * A highlighted code block with a copy button. Token colours are CSS
 * variables (`--code-*` in theme.css), so the server-rendered HTML is right
 * in both colour modes before any script runs.
 */

// Prism's bundle has no shell or diff grammar; these cover the site's blocks.
Prism.languages['bash'] = {
  comment: { pattern: /(^|\s)#.*/, lookbehind: true },
  string: /(["'])(?:\\.|(?!\1)[^\\])*\1/,
  function: { pattern: /(^|[;&|]\s*)[\w-]+/m, lookbehind: true },
  operator: /&&|\|\|?|[<>]/,
}
Prism.languages['diff'] = {
  deleted: /^[-<].*$/m,
  inserted: /^[+>].*$/m,
  comment: /^@@.*@@.*$/m,
}

const color = (name: string) => ({ color: `var(--code-${name})` })

const THEME: PrismTheme = {
  plain: {},
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { ...color('comment'), fontStyle: 'italic' } },
    { types: ['keyword', 'operator', 'important', 'atrule', 'selector'], style: color('keyword') },
    { types: ['string', 'char', 'regex', 'url', 'attr-value'], style: color('string') },
    { types: ['function', 'class-name', 'builtin'], style: color('function') },
    { types: ['number', 'boolean', 'constant', 'symbol'], style: color('number') },
    { types: ['tag'], style: color('tag') },
    { types: ['attr-name', 'property'], style: color('attr') },
    { types: ['inserted'], style: color('inserted') },
    { types: ['deleted'], style: color('deleted') },
  ],
}

const ALIASES: Record<string, string> = { md: 'markdown', txt: 'text', sh: 'bash', shell: 'bash' }

export interface CodeBlockProps {
  readonly children: string
  readonly language?: string
}

export default function CodeBlock({ children, language = 'text' }: CodeBlockProps): ReactNode {
  const code = children.replace(/\n$/, '')
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="group relative" data-copy-code="">
      <Highlight code={code} language={ALIASES[language] ?? language} theme={THEME}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="m-0 overflow-x-auto rounded-(--radius) bg-muted p-4 font-mono leading-normal">
            <code className="text-[0.875em]">
              {tokens.map((line, index) => (
                <span key={index} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                  {index < tokens.length - 1 ? '\n' : null}
                </span>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
      <Button
        variant="outline"
        size="sm"
        track="code-block:copy"
        onClick={copy}
        className="absolute top-2 right-2 bg-background opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
