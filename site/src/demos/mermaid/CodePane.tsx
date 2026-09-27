import { useCallback, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode, type UIEvent } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'
import { tokenize, type TokenKind } from './highlight'

const INDENT = '    '

/*
 * The highlighted layer and the textarea share every metric below, so the
 * caret sits exactly over the coloured text: absolutely stacked, one padding
 * (the textarea adds the gutter on the left), the pane's font inherited.
 */
const STACKED = 'absolute inset-0 m-0 box-border border-0 py-(--code-pad) pr-(--code-pad) pl-0 [font:inherit] [tab-size:inherit] whitespace-pre'

/** Token colours, all derived from the theme's intent colours. */
const TOKEN_CLASSES = {
  comment: 'text-muted-foreground italic',
  string: 'text-success-text',
  label: 'text-success-text',
  edge: 'text-warning-text font-semibold',
  color: 'text-danger-text',
  keyword: 'text-primary-text font-semibold',
  direction: 'text-primary-text',
  bracket: 'text-muted-foreground',
} satisfies Record<Exclude<TokenKind, 'plain'>, string>

export interface CodePaneProps {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Accessible name of the textarea. */
  readonly label: string
  /** The detected diagram kind, which picks the keyword set. Default flowchart. */
  readonly kind?: string
}

/**
 * The Mermaid source with line numbers and syntax colours: a highlighted
 * layer under a transparent textarea, kept in step by sharing one font, one
 * padding and one scroll position. The colours follow the detected kind.
 * Tab indents, Enter keeps the indentation of the line above, as a code
 * editor does. No editor library is loaded.
 */
export default function CodePane({ value, onChange, label, kind = 'flowchart' }: CodePaneProps): ReactNode {
  const layer = useRef<HTMLPreElement>(null)
  const lines = useMemo(() => tokenize(value, kind), [value, kind])

  const onScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    const pre = layer.current
    if (pre === null) return
    pre.scrollTop = event.currentTarget.scrollTop
    pre.scrollLeft = event.currentTarget.scrollLeft
  }, [])

  // Tab indents, as in a code editor; Escape first lets the next Tab move focus on.
  const released = useRef(false)

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const field = event.currentTarget
      if (event.key === 'Escape') {
        released.current = true
        return
      }
      const release = released.current
      released.current = false
      if (event.key === 'Tab' && !release && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        field.setRangeText(INDENT, field.selectionStart, field.selectionEnd, 'end')
        onChange(field.value)
        return
      }
      if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const before = field.value.slice(0, field.selectionStart)
        const lineStart = before.lastIndexOf('\n') + 1
        const indent = /^[ \t]*/.exec(before.slice(lineStart))?.[0] ?? ''
        if (indent === '') return
        event.preventDefault()
        field.setRangeText(`\n${indent}`, field.selectionStart, field.selectionEnd, 'end')
        onChange(field.value)
      }
    },
    [onChange],
  )

  const onInput = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value), [onChange])

  return (
    <div className="relative min-h-0 flex-1 font-mono text-[12.5px] leading-[1.6] [tab-size:4] [--code-gutter:3rem] [--code-pad:0.75rem]">
      <pre ref={layer} className={cn(STACKED, 'pointer-events-none overflow-hidden bg-transparent text-foreground')} aria-hidden="true">
        {lines.map((tokens, index) => (
          <div key={index} className="flex min-w-max">
            <span className="flex-[0_0_var(--code-gutter)] pr-[0.9rem] text-right text-muted-foreground opacity-70 select-none">{index + 1}</span>
            <span className="flex-1">
              {tokens.map((token, position) =>
                token.kind === 'plain' ? token.text : (
                  <span key={position} className={TOKEN_CLASSES[token.kind]}>
                    {token.text}
                  </span>
                ),
              )}
              {'\n'}
            </span>
          </div>
        ))}
      </pre>
      <textarea
        className={cn(
          STACKED,
          'resize-none overflow-auto bg-transparent pl-(--code-gutter) text-transparent caret-foreground outline-none',
          'selection:bg-primary/30 placeholder:text-muted-foreground',
        )}
        value={value}
        onChange={onInput}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-label={label}
        aria-description="Tab indents. Press Escape, then Tab, to leave the editor."
        data-zui-tag="source"
      />
    </div>
  )
}
