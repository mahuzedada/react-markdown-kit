import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { compileMarkdown, defineMarkdownPreset } from '@react-markdown-kit/renderer'
import { MarkdownEditor } from '@react-markdown-kit/editor'
import { mermaid } from '@react-markdown-kit/mermaid/editor'
import mermaidPackage from '@react-markdown-kit/mermaid/package.json'
import { docsUrl, sites, useTheme } from '../../shared/Shell'
import { decodeShareHash, encodeShareHash, mermaidLiveUrl, shareUrl, sourceFromShared } from './share'
import { DEFAULT_CODE, SAMPLES } from './samples'
import CodePane from './CodePane'
import ShareDialog from './ShareDialog'
import { copyImage, diagramFileName, diagramSvg, download, svgToPng } from './export'
import {
  ActionsIcon,
  BookIcon,
  CheckIcon,
  ChevronIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  ExternalIcon,
  FitIcon,
  FullscreenIcon,
  GitHubIcon,
  ImageIcon,
  LinkIcon,
  MoonIcon,
  ResetIcon,
  SamplesIcon,
  ShareIcon,
  SunIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './icons'
import styles from './MermaidDemo.module.css'

import '@react-markdown-kit/renderer/styles.css'
import '@react-markdown-kit/editor/styles.css'
import '@react-markdown-kit/mermaid/styles.css'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import { cn } from '@zuilib/primitives/lib/cn'

// The editor entry's `mermaid()` carries the canvas; the same preset also
// renders, because the renderer reads only the capabilities it understands.
// `ink` draws hand-drawn strokes on the canvas (index.html loads Recursive,
// the face the ink style uses); the static SVG the exports and the renderer
// draw is the clean style, which the plugin's renderer has alone.
const preset = defineMarkdownPreset({ extensions: [mermaid({ style: 'ink' })] })

const FENCE = /```mermaid\n([\s\S]*?)\n```/

/** How long after the last keystroke the URL hash follows the source. */
const HASH_DEBOUNCE_MS = 300

const ZOOM_STEP = 1.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

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
 * A mermaid.live hash pointed at this host opens too (share.ts).
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
        const payload = await decodeShareHash(current)
        if (cancelled) return
        if (payload === undefined) setUnreadable(true)
        else {
          setUnreadable(false)
          setCode(sourceFromShared(payload))
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
      if (code === DEFAULT_CODE && (location.hash === '' || unreadable)) return
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

type Copy = (key: string, text: string, field?: HTMLInputElement | HTMLTextAreaElement | null) => void

/** Copies `text` and reports it for a moment. Falls back to selecting the field. */
function useCopy(): { readonly copied: string | undefined; readonly copy: Copy; readonly done: (key: string) => void } {
  const [copied, setCopied] = useState<string | undefined>(undefined)
  const done = useCallback((key: string): void => {
    setCopied(key)
    setTimeout(() => setCopied((current) => (current === key ? undefined : current)), 1500)
  }, [])
  const copy = useCallback<Copy>(
    (key, text, field) => {
      if (typeof navigator.clipboard?.writeText === 'function') {
        navigator.clipboard.writeText(text).then(() => done(key), () => field?.select())
      } else {
        field?.select()
      }
    },
    [done],
  )
  return { copied, copy, done }
}

/** The view pane in the browser's fullscreen mode, with a fixed-position fallback where the API is missing. */
function useFullscreen(target: React.RefObject<HTMLElement | null>): { readonly active: boolean; readonly toggle: () => void } {
  const [active, setActive] = useState(false)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const sync = (): void => setActive(document.fullscreenElement !== null && document.fullscreenElement === target.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [target])

  useEffect(() => {
    if (!fallback) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setFallback(false)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [fallback])

  const toggle = useCallback((): void => {
    const element = target.current
    if (element === null) return
    if (typeof element.requestFullscreen === 'function' && typeof document.exitFullscreen === 'function') {
      if (document.fullscreenElement === element) void document.exitFullscreen()
      else void element.requestFullscreen().catch(() => setFallback((current) => !current))
      return
    }
    setFallback((current) => !current)
  }, [target])

  return { active: active || fallback, toggle }
}

/**
 * The canvas at `zoom`. The editor fills the pane (its width and height are
 * set from the pane's, so the drawing surface is the pane) and is scaled
 * with a transform; the canvas reads pointer positions through the SVG's
 * screen matrix, so dragging stays exact at any zoom. A spacer takes the
 * scaled size so the pane scrolls to the whole drawing.
 */
function useZoomBox(pane: React.RefObject<HTMLDivElement | null>): { readonly paneWidth: number; readonly paneHeight: number } {
  const [size, setSize] = useState({ paneWidth: 0, paneHeight: 0 })

  useEffect(() => {
    const scroller = pane.current
    if (scroller === null) return
    const measure = (): void => setSize({ paneWidth: scroller.clientWidth, paneHeight: scroller.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [pane])

  return size
}

export interface MermaidDemoProps {
  /** `?embed=1`: no site chrome, and a link back to the full editor. */
  readonly embed?: boolean
}

/**
 * The Mermaid visual editor, laid out like mermaid.live: a column of cards
 * on the left (the code with line numbers and colours, sample diagrams,
 * actions) and the drawing on the right with zoom and fullscreen controls.
 * Typing re-parses the flowchart; dragging on the canvas writes Mermaid
 * back with one `%% rmk-layout v1` annotation, and the code pane shows
 * exactly what would be saved. The source also lives in the URL hash
 * (src/share.ts), so a link carries the diagram.
 */
export default function MermaidDemo({ embed = false }: MermaidDemoProps): ReactNode {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [shareOpen, setShareOpen] = useState(false)
  const [samplesOpen, setSamplesOpen] = useState(!embed)
  const [actionsOpen, setActionsOpen] = useState(!embed)
  const [zoom, setZoom] = useState(1)
  const [pngScale, setPngScale] = useState(2)
  const [exportProblem, setExportProblem] = useState<string | undefined>(undefined)
  const [liveUrl, setLiveUrl] = useState<string | undefined>(undefined)
  const { hash, unreadable } = useShareHash(code, setCode)
  const { copied, copy, done } = useCopy()
  const { theme, toggle: toggleTheme } = useTheme()
  const view = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(view)
  const { paneWidth, paneHeight } = useZoomBox(scroller)

  const markdown = useMemo(() => wrap(code), [code])

  // The share targets follow the debounced hash; before it exists the buttons wait.
  const link = hash === undefined ? undefined : shareUrl(hash, pageBase())
  const fullEditor = hash === undefined ? sites.mermaidDemo : shareUrl(hash)

  useEffect(() => {
    if (hash === undefined) return
    let cancelled = false
    void mermaidLiveUrl(code).then((url) => {
      if (!cancelled) setLiveUrl(url)
    })
    return () => {
      cancelled = true
    }
    // The hash is the debounced signal that the code settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  // What the parser makes of the code right now: a diagram node, or a plain
  // code block when it is not a flowchart, or a diagram with an error.
  const status = useMemo(() => {
    const document = compileMarkdown(markdown, { preset })
    const node = document.tree.children?.[0]
    const invalid = document.diagnostics.find((diagnostic) => diagnostic.code === 'DIAGRAM_INVALID')
    const layoutInvalid = document.diagnostics.find((diagnostic) => diagnostic.code === 'DIAGRAM_LAYOUT_INVALID')
    if (node?.type === 'code')
      return { kind: 'not-flowchart' as const, label: 'Not a flowchart', message: 'Only `flowchart` and `graph` diagrams open on the canvas. Other Mermaid types stay code blocks.' }
    if (invalid !== undefined) return { kind: 'invalid' as const, label: 'Syntax error', message: invalid.message }
    if (layoutInvalid !== undefined) return { kind: 'layout-invalid' as const, label: 'Layout rejected', message: layoutInvalid.message }
    const hasLayout = /^\s*%%\s+rmk-layout\s/m.test(code)
    return { kind: 'ok' as const, label: hasLayout ? 'Flowchart · rmk-layout v1' : 'Flowchart · auto layout', message: undefined }
  }, [markdown, code])

  // The canvas edited the block: keep only the fence body, which is Mermaid
  // syntax plus the layout annotation the canvas wrote.
  const onEditorChange = useCallback((next: string) => {
    const body = FENCE.exec(next)?.[1]
    if (body !== undefined) setCode(body)
  }, [])

  const svg = useCallback((): string | undefined => diagramSvg(markdown, preset), [markdown])

  const withExport = useCallback(
    async (key: string, work: (svg: string) => Promise<void>): Promise<void> => {
      const image = svg()
      if (image === undefined) {
        setExportProblem('Nothing to export: the code is not a flowchart the canvas can draw.')
        return
      }
      try {
        await work(image)
        setExportProblem(undefined)
        done(key)
      } catch (cause) {
        setExportProblem(cause instanceof Error ? cause.message : 'Export failed')
      }
    },
    [svg, done],
  )

  const downloadSvg = (): Promise<void> =>
    withExport('svg', async (image) => download(new Blob([image], { type: 'image/svg+xml' }), diagramFileName(code, 'svg')))
  const downloadPng = (): Promise<void> =>
    withExport('png', async (image) => download(await svgToPng(image, pngScale), diagramFileName(code, 'png')))
  const copyPng = (): Promise<void> => withExport('image', async (image) => copyImage(await svgToPng(image, pngScale)))

  const zoomTo = (next: number): void => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)))

  const copyLabel = (key: string, label: string): ReactNode => (
    <>
      {copied === key ? <CheckIcon /> : key === 'link' ? <LinkIcon /> : <CopyIcon />}
      {copied === key ? 'Copied' : label}
    </>
  )

  const themeButton = (
    <Button variant="ghost" size="icon" track="theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  )

  return (
    <ActivityScope feature="mermaid-editor">
      <div className={cn(styles.shell, embed && styles.shellEmbed)}>
        {embed ? null : (
          <header className={styles.nav}>
            <a className={styles.brand} href="/" data-zui-tag="brand">
              <img src="/logo.svg" alt="" />
              <span>Mermaid Visual Editor</span>
            </a>
            <span className={styles.by}>
              by <a href={sites.home}>React Markdown Kit</a>
            </span>
            <nav className={styles.navActions} aria-label="Editor">
              <a className={styles.version} href={docsUrl('/docs/mermaid')} data-zui-tag="version">
                v{mermaidPackage.version}
              </a>
              <Button as="a" href={docsUrl('/docs/mermaid')} variant="ghost" size="sm" track="docs">
                <BookIcon />
                Docs
              </Button>
              <Button as="a" href={sites.github} variant="ghost" size="icon" track="github" aria-label="GitHub repository">
                <GitHubIcon />
              </Button>
              {themeButton}
              <span className={styles.navDivider} aria-hidden="true" />
              <Button variant="outline" tone="primary" size="sm" className={cn(styles.navCopyLink)} track="copy-link" disabled={link === undefined} onClick={() => link !== undefined && copy('link', link)}>
                {copyLabel('link', 'Copy link')}
              </Button>
              <Button variant="solid" tone="primary" size="sm" track="share" onClick={() => setShareOpen(true)}>
                <ShareIcon />
                Share
              </Button>
            </nav>
          </header>
        )}

        <div className={styles.body}>
          <aside className={styles.side}>
            <section className={cn(styles.card, styles.codeCard)} aria-label="Mermaid code">
              <div className={styles.cardHead}>
                <span className={styles.tab} aria-current="true">
                  <CodeIcon />
                  Code
                </span>
                <span className={cn(styles.status, status.kind === 'ok' ? styles.statusOk : styles.statusWarn)}>{status.label}</span>
                <a className={styles.headLink} href={docsUrl('/docs/mermaid')} data-zui-tag="docs-syntax">
                  <BookIcon />
                  Docs
                </a>
              </div>
              <CodePane value={code} onChange={setCode} label="Mermaid source" />
              {unreadable ? (
                <p className={styles.problem}>
                  This link could not be read in this browser, so the default diagram is shown. The address bar still holds the shared link; editing
                  replaces it.
                </p>
              ) : null}
              {status.message === undefined ? null : <p className={styles.problem}>{status.message}</p>}
            </section>

            <section className={styles.card} aria-label="Sample diagrams">
              <button type="button" className={cn(styles.cardHead, styles.cardToggle)} aria-expanded={samplesOpen} onClick={() => setSamplesOpen((open) => !open)} data-zui-tag="samples-toggle">
                <SamplesIcon />
                <span className={styles.cardTitle}>Sample diagrams</span>
                <ChevronIcon className={cn(styles.chevron, samplesOpen && styles.chevronOpen)} />
              </button>
              {samplesOpen ? (
                <div className={styles.chips}>
                  {SAMPLES.map((sample) => (
                    <Button
                      key={sample.id}
                      variant={code === sample.code ? 'solid' : 'outline'}
                      tone="primary"
                      size="sm"
                      className={cn(styles.chip)}
                      track={`sample-${sample.id}`}
                      aria-pressed={code === sample.code}
                      onClick={() => setCode(sample.code)}
                    >
                      {sample.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={styles.card} aria-label="Actions">
              <button type="button" className={cn(styles.cardHead, styles.cardToggle)} aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)} data-zui-tag="actions-toggle">
                <ActionsIcon />
                <span className={styles.cardTitle}>Actions</span>
                <ChevronIcon className={cn(styles.chevron, actionsOpen && styles.chevronOpen)} />
              </button>
              {actionsOpen ? (
                <div className={styles.actions}>
                  <div className={styles.actionRow}>
                    <span className={styles.actionLabel}>PNG scale</span>
                    <span className={styles.segment} role="group" aria-label="PNG scale">
                      {[1, 2, 3].map((scale) => (
                        <Button key={scale} variant={pngScale === scale ? 'solid' : 'outline'} tone="primary" size="sm" className={cn(styles.chip)} track={`png-scale-${scale}`} aria-pressed={pngScale === scale} onClick={() => setPngScale(scale)}>
                          {scale}×
                        </Button>
                      ))}
                    </span>
                  </div>
                  <div className={styles.actionGrid}>
                    <Button variant="outline" tone="primary" size="sm" className={cn(styles.chip)} track="download-png" onClick={() => void downloadPng()}>
                      {copied === 'png' ? <CheckIcon /> : <DownloadIcon />}
                      PNG
                    </Button>
                    <Button variant="outline" tone="primary" size="sm" className={cn(styles.chip)} track="download-svg" onClick={() => void downloadSvg()}>
                      {copied === 'svg' ? <CheckIcon /> : <DownloadIcon />}
                      SVG
                    </Button>
                    <Button variant="outline" tone="primary" size="sm" className={cn(styles.chip)} track="copy-image" onClick={() => void copyPng()}>
                      {copied === 'image' ? <CheckIcon /> : <ImageIcon />}
                      {copied === 'image' ? 'Copied' : 'Copy image'}
                    </Button>
                  </div>
                  <div className={styles.actionGrid}>
                    <Button variant="outline" tone="primary" size="sm" className={cn(styles.chip)} track="copy-mermaid" onClick={() => copy('mermaid', code)}>
                      {copyLabel('mermaid', 'Copy Mermaid')}
                    </Button>
                    <Button variant="outline" tone="primary" size="sm" className={cn(styles.chip)} track="copy-markdown" onClick={() => copy('markdown', markdown)}>
                      {copyLabel('markdown', 'Copy Markdown')}
                    </Button>
                    <Button variant="outline" tone="primary" size="sm" className={cn(styles.chip)} track="copy-link-actions" disabled={link === undefined} onClick={() => link !== undefined && copy('link', link)}>
                      {copyLabel('link', 'Copy link')}
                    </Button>
                  </div>
                  <div className={styles.actionGrid}>
                    <Button as="a" href={liveUrl ?? '#'} target="_blank" rel="noopener" variant="outline" size="sm" className={cn(styles.chip)} track="open-mermaid-live" disabled={liveUrl === undefined}>
                      <ExternalIcon />
                      mermaid.live
                    </Button>
                    <Button variant="outline" size="sm" className={cn(styles.chip)} track="reset" disabled={code === DEFAULT_CODE} onClick={() => setCode(DEFAULT_CODE)}>
                      <ResetIcon />
                      Reset
                    </Button>
                  </div>
                  {exportProblem === undefined ? null : <p className={styles.actionProblem}>{exportProblem}</p>}
                </div>
              ) : null}
            </section>
          </aside>

          <section ref={view} className={cn(styles.view, fullscreen.active && styles.viewFull)} aria-label="Visual editor">
            <div ref={scroller} className={styles.viewScroll}>
              <div className={styles.zoomBox} style={{ width: paneWidth * zoom || undefined, height: paneHeight * zoom || undefined }}>
                <div className={styles.zoomInner} style={{ width: paneWidth || undefined, height: paneHeight || undefined, transform: `scale(${zoom})` }}>
                  <MarkdownEditor preset={preset} value={markdown} onChange={onEditorChange} toolbar={false} aria-label="Diagram canvas" />
                </div>
              </div>
            </div>

            <div className={styles.floats}>
              <div className={styles.float} role="group" aria-label="View">
                <Button variant="ghost" size="icon" track="fullscreen" aria-pressed={fullscreen.active} aria-label={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'} onClick={fullscreen.toggle}>
                  <FullscreenIcon />
                </Button>
                <Button variant="ghost" size="icon" track="zoom-out" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => zoomTo(zoom / ZOOM_STEP)}>
                  <ZoomOutIcon />
                </Button>
                <span className={styles.floatText} aria-live="polite">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="ghost" size="icon" track="zoom-in" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => zoomTo(zoom * ZOOM_STEP)}>
                  <ZoomInIcon />
                </Button>
                <Button variant="ghost" size="icon" track="zoom-reset" aria-label="Reset zoom" disabled={zoom === 1} onClick={() => setZoom(1)}>
                  <FitIcon />
                </Button>
              </div>
              {embed ? (
                <div className={styles.float}>
                  <a className={styles.floatLink} href={fullEditor} target="_blank" rel="noopener" data-zui-tag="open-full-editor">
                    <ExternalIcon />
                    Open in the full editor
                  </a>
                  {themeButton}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} link={link} liveUrl={liveUrl} copied={copied} copy={copy} />
    </ActivityScope>
  )
}
