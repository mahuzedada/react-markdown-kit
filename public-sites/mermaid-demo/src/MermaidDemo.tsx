import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { compileMarkdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import sites from '../../shared/sites.json'
import { badgeMarkdown, decodeShareHash, embedHtml, encodeShareHash, shareUrl } from './share'
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

/** How long after the last keystroke the URL hash follows the source. */
const HASH_DEBOUNCE_MS = 300

function wrap(code: string): string {
  return `\`\`\`mermaid\n${code}\n\`\`\`\n`
}

/** This page without its query, so a shared link opens the full site. */
function pageBase(): string {
  return `${location.origin}${location.pathname}`
}

interface ShareHash {
  /** The hash the current source encodes to, for the share panel. */
  readonly hash: string | undefined
  /** The page opened with a hash it could not read (corrupt, or `#pako:` without the streams API). */
  readonly unreadable: boolean
}

/**
 * The URL hash as the document: restored on load and on `hashchange`,
 * written back (debounced, `replaceState`) whenever the source changes. A
 * hash the page cannot read is left in the address bar untouched until the
 * user edits, so a link is never silently replaced by the default diagram.
 */
function useShareHash(code: string, setCode: (code: string) => void): ShareHash {
  const [hash, setHash] = useState<string | undefined>(undefined)
  // Nothing is written until the hash the page opened with has been read,
  // so the default diagram never overwrites a shared one.
  const [restored, setRestored] = useState(false)
  const [unreadable, setUnreadable] = useState(false)
  const written = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const restore = async (): Promise<void> => {
      const current = location.hash
      if (current !== '' && current.slice(1) !== written.current) {
        const source = await decodeShareHash(current)
        if (cancelled) return
        if (source === undefined) setUnreadable(true)
        else {
          setUnreadable(false)
          setCode(source)
        }
      }
      if (!cancelled) setRestored(true)
    }
    void restore()
    addEventListener('hashchange', restore)
    return () => {
      cancelled = true
      removeEventListener('hashchange', restore)
    }
  }, [setCode])

  useEffect(() => {
    if (!restored) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const next = await encodeShareHash(code)
      if (cancelled) return
      setHash(next)
      // The plain URL stays plain until the default diagram is edited, and
      // an unreadable hash stays until the user edits.
      if (code === CODE && (location.hash === '' || unreadable)) return
      written.current = next
      setUnreadable(false)
      history.replaceState(null, '', `#${next}`)
    }, HASH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [code, restored, unreadable])

  return { hash, unreadable }
}

/** Copies `text` and reports it for a moment. Falls back to selecting the field. */
function useCopy(): { readonly copied: string | undefined; readonly copy: (key: string, text: string, field?: HTMLInputElement | HTMLTextAreaElement | null) => void } {
  const [copied, setCopied] = useState<string | undefined>(undefined)
  const copy = useCallback((key: string, text: string, field?: HTMLInputElement | HTMLTextAreaElement | null) => {
    const done = (): void => {
      setCopied(key)
      setTimeout(() => setCopied((current) => (current === key ? undefined : current)), 1500)
    }
    if (typeof navigator.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(text).then(done, () => field?.select())
    } else {
      field?.select()
    }
  }, [])
  return { copied, copy }
}

export interface MermaidDemoProps {
  /** `?embed=1`: no site chrome, and a link back to the full editor. */
  readonly embed?: boolean
}

/**
 * The Mermaid live editor: Mermaid syntax on the left, the kit's drawing
 * canvas on the right. Both edit the same fenced block. Typing re-parses the
 * flowchart; dragging on the canvas writes Mermaid back with one
 * `%% rmk-layout v1` annotation, and the code pane shows exactly what would
 * be saved. The source also lives in the URL hash (src/share.ts), so a link
 * carries the diagram.
 */
export default function MermaidDemo({ embed = false }: MermaidDemoProps): ReactNode {
  const [code, setCode] = useState(CODE)
  const [shareOpen, setShareOpen] = useState(false)
  const { hash, unreadable } = useShareHash(code, setCode)
  const { copied, copy } = useCopy()
  const linkField = useRef<HTMLInputElement>(null)
  const badgeField = useRef<HTMLTextAreaElement>(null)
  const embedField = useRef<HTMLTextAreaElement>(null)

  const markdown = useMemo(() => wrap(code), [code])

  // The share targets follow the debounced hash; before it exists the buttons wait.
  const link = hash === undefined ? undefined : shareUrl(hash, pageBase())
  const badge = link === undefined ? undefined : badgeMarkdown(link)
  const iframe = link === undefined ? undefined : embedHtml(link)
  const fullEditor = hash === undefined ? sites.mermaidDemo : shareUrl(hash)

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
            <span className={styles.actions}>
              {status.kind === 'ok' ? (
                <span className={styles.badgeOk}>{status.hasLayout ? 'flowchart + rmk-layout v1' : 'flowchart, auto layout'}</span>
              ) : (
                <span className={styles.badgeWarn}>
                  {status.kind === 'invalid' ? 'cannot read' : status.kind === 'layout-invalid' ? 'layout rejected, auto layout' : 'not a flowchart'}
                </span>
              )}
              <button type="button" className={styles.action} disabled={link === undefined} onClick={() => link !== undefined && copy('link', link, linkField.current)}>
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </button>
              <button type="button" className={styles.action} aria-expanded={shareOpen} aria-controls="mermaid-share" onClick={() => setShareOpen((open) => !open)}>
                Share
              </button>
            </span>
          </div>
          {shareOpen ? (
            <div id="mermaid-share" className={styles.share}>
              <label className={styles.shareRow}>
                <span className={styles.shareLabel}>Link</span>
                <input ref={linkField} className={styles.shareField} readOnly value={link ?? ''} aria-label="Link to this diagram" onFocus={(event) => event.target.select()} />
                <button type="button" className={styles.action} disabled={link === undefined} onClick={() => link !== undefined && copy('link', link, linkField.current)}>
                  {copied === 'link' ? 'Copied' : 'Copy'}
                </button>
              </label>
              <label className={styles.shareRow}>
                <span className={styles.shareLabel}>Badge</span>
                <textarea ref={badgeField} className={styles.shareField} readOnly rows={2} value={badge ?? ''} aria-label="Badge Markdown for a README" onFocus={(event) => event.target.select()} />
                <button type="button" className={styles.action} disabled={badge === undefined} onClick={() => badge !== undefined && copy('badge', badge, badgeField.current)}>
                  {copied === 'badge' ? 'Copied' : 'Copy'}
                </button>
              </label>
              <label className={styles.shareRow}>
                <span className={styles.shareLabel}>Embed</span>
                <textarea ref={embedField} className={styles.shareField} readOnly rows={2} value={iframe ?? ''} aria-label="Embed HTML for a page" onFocus={(event) => event.target.select()} />
                <button type="button" className={styles.action} disabled={iframe === undefined} onClick={() => iframe !== undefined && copy('embed', iframe, embedField.current)}>
                  {copied === 'embed' ? 'Copied' : 'Copy'}
                </button>
              </label>
              <p className={styles.shareNote}>
                The diagram, layout comment included, is compressed into the URL hash. Nothing is uploaded. The badge is{' '}
                <a href="/badge.svg">/badge.svg</a>; the embed is this editor with <code>?embed=1</code>, without the site chrome.
              </p>
            </div>
          ) : null}
          <textarea
            className={styles.code}
            value={code}
            spellCheck={false}
            aria-label="Mermaid source"
            onChange={(event) => setCode(event.target.value)}
          />
          {unreadable ? (
            <p className={styles.problem}>
              This link could not be read in this browser, so the default diagram is shown. The address bar still holds the shared link;
              editing replaces it.
            </p>
          ) : null}
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
            {embed ? (
              <>
                Drag boxes, bind connectors, resize the canvas. Every change lands in the code pane as Mermaid.{' '}
                <a href={fullEditor} target="_blank" rel="noopener">
                  Open in the full editor
                </a>
              </>
            ) : (
              'Click the diagram to focus it, then pick a tool. Drag boxes, bind connectors, resize the canvas. Every change lands in the code pane as Mermaid.'
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
