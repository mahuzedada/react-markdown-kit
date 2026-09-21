import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { compileMarkdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import styles from './MermaidDemo.module.css'

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/mermaid/styles.css'

// The editor entry's `mermaid()` carries the canvas; the same preset also
// renders, because the renderer reads only the capabilities it understands.
const preset = defineMarkdownPreset({ extensions: [mermaid()] })

const CODE = `flowchart LR
    web["CLIENT<br/>Web App<br/>React"] -->|REST| api["SERVICE<br/>API<br/>Kotlin"]
    api --> db[(Postgres)]
    api -->|publish| q[[Events]]
    style web fill:#a5d8ff,stroke:#1971c2
    style api fill:#b2f2bb,stroke:#2f9e44
    style db fill:#d0bfff,stroke:#7048e8
    style q fill:#ffec99,stroke:#f08c00`

const FENCE = /```mermaid\n([\s\S]*?)\n```/

function wrap(code: string): string {
  return `\`\`\`mermaid\n${code}\n\`\`\`\n`
}

/**
 * The Mermaid live editor: Mermaid syntax on the left, the kit's drawing
 * canvas on the right. Both edit the same fenced block. Typing re-parses the
 * flowchart; dragging on the canvas writes Mermaid back with one
 * `%% rmk-layout v1` annotation, and the code pane shows exactly what would
 * be saved.
 */
export default function MermaidDemo(): ReactNode {
  const [code, setCode] = useState(CODE)

  const markdown = useMemo(() => wrap(code), [code])

  // What the parser makes of the code right now: a diagram node, or a plain
  // code block when it is not a flowchart, or a diagram with an error.
  const status = useMemo(() => {
    const document = compileMarkdown(markdown, { preset })
    const node = document.tree.children?.[0]
    const invalid = document.diagnostics.find((diagnostic) => diagnostic.code === 'DIAGRAM_INVALID')
    const layoutInvalid = document.diagnostics.find((diagnostic) => diagnostic.code === 'DIAGRAM_LAYOUT_INVALID')
    if (node?.type === 'code') return { kind: 'not-flowchart' as const, message: 'Not a flowchart: only `flowchart` and `graph` diagrams open on the canvas. Other Mermaid types stay code blocks.' }
    if (invalid !== undefined) return { kind: 'invalid' as const, message: invalid.message }
    if (layoutInvalid !== undefined) return { kind: 'layout-invalid' as const, message: layoutInvalid.message }
    const hasLayout = /^\s*%%\s+rmk-layout\s/m.test(code)
    return { kind: 'ok' as const, hasLayout }
  }, [markdown, code])

  // The canvas edited the block: keep only the fence body, which is Mermaid
  // syntax plus the layout annotation the canvas wrote.
  const onEditorChange = useCallback((next: string) => {
    const body = FENCE.exec(next)?.[1]
    if (body !== undefined) setCode(body)
  }, [])

  return (
    <div className={styles.shell}>
      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.colHead}>
            <span>Mermaid code</span>
            {status.kind === 'ok' ? (
              <span className={styles.badgeOk}>{status.hasLayout ? 'flowchart + rmk-layout v1' : 'flowchart, auto layout'}</span>
            ) : (
              <span className={styles.badgeWarn}>
                {status.kind === 'invalid' ? 'cannot read' : status.kind === 'layout-invalid' ? 'layout rejected, auto layout' : 'not a flowchart'}
              </span>
            )}
          </div>
          <textarea
            className={styles.code}
            value={code}
            spellCheck={false}
            aria-label="Mermaid source"
            onChange={(event) => setCode(event.target.value)}
          />
          {status.kind === 'ok' ? null : <p className={styles.problem}>{status.message}</p>}
        </div>

        <div className={styles.col}>
          <div className={styles.colHead}>
            <span>Visual editor</span>
            <span className={styles.badgeOk}>drag to edit, writes Mermaid back</span>
          </div>
          <div className={styles.editorWrap}>
            <MarkdownEditor preset={preset} value={markdown} onChange={onEditorChange} toolbar={false} aria-label="Diagram canvas" />
          </div>
          <div className={styles.hint}>
            Click the diagram to focus it, then pick a tool. Drag boxes, bind connectors, resize the canvas. Every change lands in the code pane as Mermaid.
          </div>
        </div>
      </div>
    </div>
  )
}
