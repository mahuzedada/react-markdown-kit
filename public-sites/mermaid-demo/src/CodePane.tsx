import { useCallback, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode, type UIEvent } from 'react'
import { tokenize } from './highlight'
import styles from './CodePane.module.css'

const INDENT = '    '

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

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const field = event.currentTarget
      if (event.key === 'Tab' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
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
    <div className={styles.pane}>
      <pre ref={layer} className={styles.layer} aria-hidden="true">
        {lines.map((tokens, index) => (
          <div key={index} className={styles.line}>
            <span className={styles.number}>{index + 1}</span>
            <span className={styles.text}>
              {tokens.map((token, position) =>
                token.kind === 'plain' ? token.text : (
                  <span key={position} className={styles[token.kind]}>
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
        className={styles.input}
        value={value}
        onChange={onInput}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-label={label}
        data-zui-tag="source"
      />
    </div>
  )
}
