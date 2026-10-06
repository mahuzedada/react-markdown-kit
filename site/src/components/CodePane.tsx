import { useCallback, useEffect, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode, type UIEvent } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'

const INDENT = '    '

/*
 * The highlighted layer and the textarea share every metric below, so the
 * caret sits exactly over the coloured text: absolutely stacked, one padding
 * (the textarea adds the gutter on the left), the pane's font inherited.
 */
const STACKED = 'absolute inset-0 m-0 box-border border-0 py-(--code-pad) pr-(--code-pad) pl-0 [font:inherit] [tab-size:inherit] whitespace-pre'

export interface CodeToken<Kind extends string> {
  readonly kind: Kind | 'plain'
  readonly text: string
}

export interface CodePaneProps<Kind extends string> {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Accessible name of the textarea. */
  readonly label: string
  /** `value`, one token list per line; every character must land in a token so the layers line up. */
  readonly lines: readonly (readonly CodeToken<Kind>[])[]
  /** The utility classes each token kind is drawn with. */
  readonly tokenClasses: Readonly<Record<Kind, string>>
  /** Character offsets whose lines are marked, such as the slide on screen. */
  readonly highlight?: { readonly start: number; readonly end: number }
  /** A new value scrolls the highlighted lines into view. */
  readonly highlightKey?: unknown
  /** Explicit request to focus and select the highlighted source range. */
  readonly revealKey?: number | undefined
  /** Cursor position in the source, for linked previews. */
  readonly onSelectionChange?: (offset: number) => void
}

function lineOf(value: string, offset: number): number {
  let line = 0
  for (let index = value.indexOf('\n'); index !== -1 && index < offset; index = value.indexOf('\n', index + 1)) line += 1
  return line
}

/**
 * A source editor with line numbers and syntax colours: a highlighted layer
 * under a transparent textarea, kept in step by sharing one font, one
 * padding and one scroll position. The caller tokenizes, so each demo brings
 * its own language. Tab indents, Enter keeps the indentation of the line
 * above, as a code editor does. No editor library is loaded.
 */
export default function CodePane<Kind extends string>({ value, onChange, label, lines, tokenClasses, highlight, highlightKey, revealKey, onSelectionChange }: CodePaneProps<Kind>): ReactNode {
  const layer = useRef<HTMLPreElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const first = highlight === undefined ? -1 : lineOf(value, highlight.start)
  const last = highlight === undefined ? -1 : lineOf(value, highlight.end)

  // Only a new key scrolls: typing inside the highlighted lines keeps the reader where they are.
  const firstLine = useRef(first)
  firstLine.current = first
  useEffect(() => {
    const area = field.current
    if (area === null || firstLine.current < 0 || document.activeElement === area) return
    const lineHeight = Number.parseFloat(getComputedStyle(area).lineHeight) || 20
    area.scrollTop = Math.max(0, (firstLine.current - 2) * lineHeight)
  }, [highlightKey])

  const highlighted = useRef(highlight)
  highlighted.current = highlight
  useEffect(() => {
    const area = field.current
    const span = highlighted.current
    if (!revealKey || area === null || span === undefined) return
    area.focus({ preventScroll: true })
    area.setSelectionRange(span.start, span.end)
    const lineHeight = Number.parseFloat(getComputedStyle(area).lineHeight) || 20
    area.scrollTop = Math.max(0, (firstLine.current - 2) * lineHeight)
  }, [revealKey])

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
          <div key={index} className={cn('flex min-w-max', index >= first && index <= last && 'bg-primary/8')}>
            <span className="flex-[0_0_var(--code-gutter)] pr-[0.9rem] text-right text-muted-foreground opacity-70 select-none">{index + 1}</span>
            <span className="flex-1">
              {tokens.map((token, position) =>
                token.kind === 'plain' ? token.text : (
                  <span key={position} className={tokenClasses[token.kind as Kind]}>
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
        ref={field}
        className={cn(
          STACKED,
          'resize-none overflow-auto bg-transparent pl-(--code-gutter) text-transparent caret-foreground outline-none',
          'selection:bg-primary/30 placeholder:text-muted-foreground',
        )}
        value={value}
        onChange={onInput}
        onSelect={(event) => onSelectionChange?.(event.currentTarget.selectionStart)}
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
