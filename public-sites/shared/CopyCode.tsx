import { useEffect, useRef, useState, type ReactNode } from 'react'
import Button from '@zuilib/primitives/button'

export function CopyCode({ code, label = 'Copy' }: { readonly code: string; readonly label?: string }): ReactNode {
  const ref = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const select = (): void => {
    const el = ref.current
    const selection = typeof window === 'undefined' ? null : window.getSelection()
    if (el === null || selection === null) return
    const range = document.createRange()
    range.selectNodeContents(el)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const copy = (): void => {
    if (typeof navigator.clipboard?.writeText !== 'function') {
      select()
      return
    }
    navigator.clipboard.writeText(code).then(() => setCopied(true), select)
  }

  return (
    <div data-copy-code className="relative mb-6">
      <pre className="m-0 overflow-x-auto rounded-md border border-border bg-muted p-4 pr-20 font-mono text-sm leading-normal text-foreground">
        <code ref={ref}>{code}</code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        track="copy-code"
        className="absolute top-2 right-2"
        aria-label={copied ? 'Copied' : `${label} to clipboard`}
        onClick={copy}
      >
        {copied ? 'Copied' : label}
      </Button>
    </div>
  )
}
