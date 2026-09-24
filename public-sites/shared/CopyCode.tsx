import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A code block with a Copy button: every install command and snippet on the
 * home page and the demos, so each one pastes into a terminal or an editor
 * as it stands. Without a clipboard (an insecure origin, an old browser) the
 * button selects the code instead, ready for Cmd/Ctrl+C.
 */
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
    <div className="site-code-block">
      <pre className="site-code">
        <code ref={ref}>{code}</code>
      </pre>
      <button type="button" className="site-code-copy" data-zui-tag="copy-code" aria-label={copied ? 'Copied' : `${label} to clipboard`} onClick={copy}>
        {copied ? 'Copied' : label}
      </button>
    </div>
  )
}
