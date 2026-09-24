import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { compileMarkdown } from '@react-markdown-kit/renderer'
import { MermaidCanvas } from '@react-markdown-kit/mermaid/canvas'
import mermaidPackage from '@react-markdown-kit/mermaid/package.json'
import { docsUrl, sites, useTheme } from '../../shared/Shell'
import { decodeShareHash, encodeShareHash, mermaidLiveUrl, shareUrl, sourceFromShared } from './share'
import { DEFAULT_CODE, SAMPLE_GROUPS } from './samples'
import { KINDS, preset } from './preset'
import { diagramStatus } from './status'
import CodePane from './CodePane'
import ShareDialog from './ShareDialog'
import { copyImage, diagramFileName, diagramSvg, download, svgToPng } from './export'
import {
  ActionsIcon,
  ArrowDownIcon,
  BookIcon,
  CheckIcon,
  ChevronIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  ExternalIcon,
  FullscreenIcon,
  GitHubIcon,
  ImageIcon,
  LinkIcon,
  PanelIcon,
  MoonIcon,
  ResetIcon,
  SamplesIcon,
  ShareIcon,
  SunIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './icons'
import styles from './MermaidDemo.module.css'

import '@react-markdown-kit/mermaid/styles.css'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import { cn } from '@zuilib/primitives/lib/cn'

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

/** The editor in the browser's fullscreen mode, with a fixed-position fallback where the API is missing. */
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

export interface MermaidDemoProps {
  /** `?embed=1`: no site chrome, and a link back to the full editor. */
  readonly embed?: boolean
}

/** Below this width the code panel starts closed, so the canvas has the screen. */
const NARROW = 900

function startsNarrow(): boolean {
  return typeof matchMedia === 'function' && matchMedia(`(max-width: ${NARROW}px)`).matches
}

/**
 * The Mermaid visual editor, laid out like Excalidraw: the canvas is the
 * whole window and everything else floats over it as islands. The plugin's
 * standalone `<MermaidCanvas>` fills the stage and floats its own tools
 * down the left edge (the properties of the selection join them); the page
 * adds the brand top left, the links and Share top right, the Mermaid code
 * with samples and export in a panel on the right, zoom bottom left and
 * the version bottom right. The stage is exactly one window tall, so the
 * documentation below it is a scroll away. Typing re-parses the diagram; a
 * gesture on either canvas writes Mermaid back (a flowchart's with one
 * `%% rmk-layout v1` annotation), and the code panel shows exactly what
 * would be saved. The source also lives in the URL hash (src/share.ts), so
 * a link carries the diagram.
 */
export default function MermaidDemo({ embed = false }: MermaidDemoProps): ReactNode {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [shareOpen, setShareOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => !startsNarrow())
  const [samplesOpen, setSamplesOpen] = useState(!embed)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pngScale, setPngScale] = useState(2)
  const [exportProblem, setExportProblem] = useState<string | undefined>(undefined)
  const [liveUrl, setLiveUrl] = useState<string | undefined>(undefined)
  const { hash, unreadable } = useShareHash(code, setCode)
  const { copied, copy, done } = useCopy()
  const { theme, toggle: toggleTheme } = useTheme()
  const stage = useRef<HTMLElement>(null)
  const fullscreen = useFullscreen(stage)

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

  // What the plugin makes of the code right now: which kind, whether it
  // renders, and the first statement Mermaid itself would reject.
  const status = useMemo(() => diagramStatus(compileMarkdown(markdown, { preset }), KINDS), [markdown])

  const svg = useCallback((): string | undefined => diagramSvg(markdown, preset), [markdown])

  const withExport = useCallback(
    async (key: string, work: (svg: string) => Promise<void>): Promise<void> => {
      const image = svg()
      if (image === undefined) {
        setExportProblem('Nothing to export: this diagram type is shown as source, so there is no SVG to save.')
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

  return (
    <ActivityScope feature="mermaid-editor">
      <section
        ref={stage}
        className={cn(styles.stage, embed && styles.stageEmbed, fullscreen.active && styles.stageFull, panelOpen && styles.panelOpen)}
        aria-label="Mermaid visual editor"
      >
        <MermaidCanvas
          className={cn(styles.canvas)}
          value={code}
          onChange={setCode}
          kinds={KINDS}
          drawingStyle="ink"
          align="center"
          toolbar="left"
          zoom={zoom}
        >
          <div className={cn(styles.island, styles.topLeft)}>
            {embed ? (
              <span className={cn(styles.brand)}>
                <img src="/logo.svg" alt="" />
                <span>Mermaid Visual Editor</span>
              </span>
            ) : (
              <a className={cn(styles.brand)} href="/" data-zui-tag="brand">
                <img src="/logo.svg" alt="" />
                <span>Mermaid Visual Editor</span>
              </a>
            )}
            <span className={cn(styles.status, status.tone === 'ok' ? styles.statusOk : styles.statusWarn)} title={status.message}>
              {status.label}
            </span>
          </div>

          <nav className={cn(styles.island, styles.topRight)} aria-label="Editor">
            {embed ? (
              <Button as="a" href={fullEditor} target="_blank" rel="noopener" variant="ghost" size="sm" track="open-full-editor">
                <ExternalIcon />
                Full editor
              </Button>
            ) : (
              <>
                <Button as="a" href={docsUrl('/docs/mermaid')} variant="ghost" size="sm" track="docs">
                  <BookIcon />
                  Docs
                </Button>
                <Button as="a" href={sites.github} variant="ghost" size="icon" track="github" aria-label="GitHub repository">
                  <GitHubIcon />
                </Button>
                <span className={cn(styles.divider)} aria-hidden="true" />
                <Button variant="ghost" size="sm" className={cn(styles.hideNarrow)} track="copy-link" disabled={link === undefined} onClick={() => link !== undefined && copy('link', link)}>
                  {copyLabel('link', 'Copy link')}
                </Button>
                <Button variant="solid" tone="primary" size="sm" track="share" onClick={() => setShareOpen(true)}>
                  <ShareIcon />
                  Share
                </Button>
              </>
            )}
            <span className={cn(styles.divider)} aria-hidden="true" />
            <Button variant="ghost" size="icon" track="theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              variant={panelOpen ? 'outline' : 'ghost'}
              tone="primary"
              size="icon"
              track="code-panel"
              aria-pressed={panelOpen}
              aria-controls="mermaid-code-panel"
              aria-label={panelOpen ? 'Hide the code panel' : 'Show the code panel'}
              onClick={() => setPanelOpen((open) => !open)}
            >
              <PanelIcon />
            </Button>
          </nav>

          <aside id="mermaid-code-panel" className={cn(styles.panel)} hidden={!panelOpen} aria-label="Mermaid code">
            <section className={cn(styles.section, styles.codeSection)} aria-label="Code">
              <div className={cn(styles.sectionHead)}>
                <CodeIcon />
                <span className={cn(styles.sectionTitle)}>Mermaid</span>
                <Button variant="ghost" size="sm" className={cn(styles.headButton)} track="copy-mermaid" onClick={() => copy('mermaid', code)}>
                  {copyLabel('mermaid', 'Copy')}
                </Button>
              </div>
              <CodePane value={code} onChange={setCode} label="Mermaid source" kind={status.kind} />
              {unreadable ? (
                <p className={cn(styles.problem)}>
                  This link could not be read in this browser, so the default diagram is shown. The address bar still holds the shared link; editing
                  replaces it.
                </p>
              ) : null}
              {status.message === undefined ? null : <p className={cn(styles.problem)}>{status.message}</p>}
            </section>

            <section className={cn(styles.section)} aria-label="Sample diagrams">
              <button type="button" className={cn(styles.sectionHead, styles.sectionToggle)} aria-expanded={samplesOpen} onClick={() => setSamplesOpen((open) => !open)} data-zui-tag="samples-toggle">
                <SamplesIcon />
                <span className={cn(styles.sectionTitle)}>Samples</span>
                <ChevronIcon className={cn(styles.chevron, samplesOpen && styles.chevronOpen)} />
              </button>
              {samplesOpen
                ? SAMPLE_GROUPS.map((group) => (
                    <div key={group.label} className={cn(styles.chipGroup)} role="group" aria-label={group.label}>
                      <span className={cn(styles.chipsHeading)}>{group.label}</span>
                      <div className={cn(styles.chips)}>
                        {group.samples.map((sample) => (
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
                    </div>
                  ))
                : null}
            </section>

            <section className={cn(styles.section)} aria-label="Export">
              <button type="button" className={cn(styles.sectionHead, styles.sectionToggle)} aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)} data-zui-tag="actions-toggle">
                <ActionsIcon />
                <span className={cn(styles.sectionTitle)}>Export</span>
                <ChevronIcon className={cn(styles.chevron, actionsOpen && styles.chevronOpen)} />
              </button>
              {actionsOpen ? (
                <div className={cn(styles.actions)}>
                  <div className={cn(styles.actionRow)}>
                    <span className={cn(styles.actionLabel)}>PNG scale</span>
                    <span className={cn(styles.segment)} role="group" aria-label="PNG scale">
                      {[1, 2, 3].map((scale) => (
                        <Button key={scale} variant={pngScale === scale ? 'solid' : 'outline'} tone="primary" size="sm" className={cn(styles.chip)} track={`png-scale-${scale}`} aria-pressed={pngScale === scale} onClick={() => setPngScale(scale)}>
                          {scale}×
                        </Button>
                      ))}
                    </span>
                  </div>
                  <div className={cn(styles.actionGrid)}>
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
                      {copied === 'image' ? 'Copied' : 'Image'}
                    </Button>
                  </div>
                  <div className={cn(styles.actionGrid)}>
                    <Button variant="outline" tone="primary" size="sm" className={cn(styles.chip)} track="copy-markdown" onClick={() => copy('markdown', markdown)}>
                      {copyLabel('markdown', 'Markdown')}
                    </Button>
                    <Button as="a" href={liveUrl ?? '#'} target="_blank" rel="noopener" variant="outline" size="sm" className={cn(styles.chip)} track="open-mermaid-live" disabled={liveUrl === undefined}>
                      <ExternalIcon />
                      mermaid.live
                    </Button>
                    <Button variant="outline" size="sm" className={cn(styles.chip)} track="reset" disabled={code === DEFAULT_CODE} onClick={() => setCode(DEFAULT_CODE)}>
                      <ResetIcon />
                      Reset
                    </Button>
                  </div>
                  {exportProblem === undefined ? null : <p className={cn(styles.actionProblem)}>{exportProblem}</p>}
                </div>
              ) : null}
            </section>
          </aside>

          <div className={cn(styles.island, styles.bottomLeft)} role="group" aria-label="Zoom">
            <Button variant="ghost" size="icon" track="zoom-out" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => zoomTo(zoom / ZOOM_STEP)}>
              <ZoomOutIcon />
            </Button>
            <button type="button" className={cn(styles.zoomText)} aria-label="Reset zoom" title="Reset zoom" onClick={() => setZoom(1)} data-zui-tag="zoom-reset">
              {Math.round(zoom * 100)}%
            </button>
            <Button variant="ghost" size="icon" track="zoom-in" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => zoomTo(zoom * ZOOM_STEP)}>
              <ZoomInIcon />
            </Button>
            <span className={cn(styles.divider)} aria-hidden="true" />
            <Button variant="ghost" size="icon" track="fullscreen" aria-pressed={fullscreen.active} aria-label={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'} onClick={fullscreen.toggle}>
              <FullscreenIcon />
            </Button>
          </div>

          {embed || fullscreen.active ? null : (
            <a className={cn(styles.island, styles.bottomCenter)} href="#docs" data-zui-tag="scroll-to-docs">
              <ArrowDownIcon />
              Docs and FAQ below
            </a>
          )}

          <div className={cn(styles.island, styles.bottomRight)}>
            <a className={cn(styles.version)} href={docsUrl('/docs/mermaid')} data-zui-tag="version">
              v{mermaidPackage.version}
            </a>
          </div>
        </MermaidCanvas>
      </section>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} link={link} liveUrl={liveUrl} copied={copied} copy={copy} />
    </ActivityScope>
  )
}
