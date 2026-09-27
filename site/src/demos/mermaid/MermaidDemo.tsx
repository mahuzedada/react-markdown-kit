import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { scrollToDocs } from '../../components/DemoStrip'
import { useCopy } from '../../lib/use-copy'
import { useShareLink } from '../../lib/use-share-link'
import { compileMarkdown } from '@react-markdown-kit/renderer'
import { MermaidCanvas } from '@react-markdown-kit/mermaid/canvas'
import mermaidPackage from '@react-markdown-kit/mermaid/package.json'
import { docsUrl, sites } from '../../sites'
import { useTheme } from '../../lib/useTheme'
import { mermaidLiveUrl, shareUrl, sourceFromShared } from './share'
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
import '@react-markdown-kit/mermaid/styles.css'
import { ActivityScope } from '@zuilib/primitives/activity'
import Button from '@zuilib/primitives/button'
import Separator from '@zuilib/primitives/separator'
import Text from '@zuilib/primitives/text'
import { cn } from '@zuilib/primitives/lib/cn'

/*
 * Chrome for the Mermaid visual editor, laid out like Excalidraw: the canvas
 * is the whole window and everything else floats over it as an island (a card
 * with a soft shadow and no frame). The stage declares the geometry every
 * island reads (--gap, --island-radius, --island-shadow, --top-band,
 * --panel-width); colours come from the theme tokens. Narrow is the same
 * 900px as NARROW below.
 */
const STAGE =
  'relative h-[var(--rmk-demo-height,100dvh)] bg-background text-foreground [--island-radius:12px] [--island-shadow:0_0_0_1px_color-mix(in_oklab,var(--border)_70%,transparent),var(--shadow-2)] max-[900px]:[--panel-width:calc(100%_-_2_*_var(--gap))]'
const STAGE_PAGE = 'min-h-[32rem] [--gap:1rem] [--top-band:4.25rem] [--panel-width:24rem]'
const STAGE_EMBED = 'min-h-0 [--gap:0.625rem] [--top-band:3.75rem] [--panel-width:20rem]'
/** Fullscreen through the API paints the element alone; the fallback pins it. */
const STAGE_FULL = '[&:not(:fullscreen)]:fixed [&:not(:fullscreen)]:inset-0 [&:not(:fullscreen)]:z-50'

/*
 * The canvas: the page background under a dotted grid, the plugin's tool
 * island under the top band, and the free room it centres a diagram in (the
 * padding below) clear of every island.
 *
 * The plugin's stylesheet is unlayered, so it outranks these layered
 * utilities. The island and grid properties and min-h-0 lose to its
 * `.rmk-editor.rmk-mermaid-canvas` defaults, exactly as the single-class
 * module rule did before; the tools-top and background properties are not
 * declared by the plugin and apply. The padding rules carry `!` to outrank
 * the plugin's own padding for the same elements, as the doubled class did.
 */
const CANVAS = cn(
  '[--rmk-mermaid-island-gap:var(--gap)] [--rmk-mermaid-island-radius:var(--island-radius)] [--rmk-mermaid-island-shadow:var(--island-shadow)]',
  '[--rmk-mermaid-tools-top:var(--top-band)] [--rmk-mermaid-canvas-background:var(--background)]',
  '[--rmk-diagram-grid:color-mix(in_oklab,var(--foreground)_13%,transparent)]',
  'min-h-0 [--room-left:7rem] max-[900px]:[--room-left:6.5rem]',
  '[&_.rmk-diagram-stage:not(.rmk-sequence-stage)]:[padding:var(--top-band)_var(--room-right)_4rem_var(--room-left)]!',
  '[&[data-rmk-mermaid-toolbar]_.rmk-sequence-viewport]:[padding:var(--top-band)_var(--room-right)_4rem_var(--room-left)]!',
  '[&_.rmk-mermaid-canvas-static]:[padding:var(--top-band)_var(--room-right)_4rem_var(--room-left)]!',
  '[&_.rmk-diagram-source-pre]:[padding:var(--top-band)_var(--room-right)_4rem_var(--room-left)]!',
)
const CANVAS_ROOM = '[--room-right:2rem]'
const CANVAS_ROOM_PANEL = '[--room-right:calc(var(--panel-width)_+_2_*_var(--gap))] max-[900px]:[--room-right:1rem]'

/** A floating island; each one adds its corner, gap and padding. */
const ISLAND = 'absolute z-4 box-border flex min-h-[2.75rem] items-center rounded-(--island-radius) bg-card [box-shadow:var(--island-shadow)]'
const ISLAND_TOOLS = 'gap-[0.15rem] p-1'

const DIVIDER = 'mx-1 h-5 self-center'

/** The code panel: an island down the right edge, under the top band. */
const PANEL =
  'absolute top-(--top-band) right-(--gap) bottom-(--gap) z-4 flex w-(--panel-width) max-w-[calc(100%_-_2_*_var(--gap))] flex-col overflow-hidden rounded-(--island-radius) bg-card [box-shadow:var(--island-shadow)] [&[hidden]]:hidden'
const SECTION = 'flex min-h-0 flex-col border-t border-border first:border-t-0'
const SECTION_HEAD = 'box-border flex min-h-10 items-center gap-2 py-1 pr-2 pl-3 text-[0.85rem] font-semibold text-foreground'
/** A section head that folds its section: a full-width ghost button with an inset focus ring. */
const SECTION_TOGGLE =
  'h-auto w-full justify-start rounded-none text-left focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid'
const PROBLEM = 'm-0 border-t border-border bg-warning/8 px-3 py-2'
/* Radii on a Button carry `!`: tailwind-merge doesn't know zui's `rounded-button`, keeps both, and that one sorts later. */
const CHIP = 'h-[1.875rem] rounded-[9px]! px-[0.7rem] text-[0.76rem] font-medium'
const ACTION_GRID = 'grid grid-cols-3 gap-[0.4rem] [&>*]:min-w-0'
const CHEVRON = 'size-4 transition-transform duration-(--duration-normal)'

const ZOOM_STEP = 1.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

function wrap(code: string): string {
  return `\`\`\`mermaid\n${code}\n\`\`\`\n`
}

type Copy = (key: string, text: string, field?: HTMLInputElement | HTMLTextAreaElement | null) => void

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
  // A mermaid.live hash pointed at this host opens too: its JSON state carries the code (share.ts).
  const restore = useCallback((payload: string) => setCode(sourceFromShared(payload)), [])
  const { hash, link, unreadable } = useShareLink({ source: code, setSource: restore, pristine: code === DEFAULT_CODE })
  const { copied, copy: copyText, done } = useCopy()
  // Where the clipboard is blocked, the field holding the text is selected for a manual copy.
  const copy = useCallback<Copy>(
    (key, text, field) => {
      void copyText(key, text).then((ok) => {
        if (!ok) field?.select()
      })
    },
    [copyText],
  )
  const { theme, toggle: toggleTheme } = useTheme()
  const stage = useRef<HTMLElement>(null)
  const fullscreen = useFullscreen(stage)

  const markdown = useMemo(() => wrap(code), [code])

  // The share targets follow the debounced hash; before it exists the buttons wait.
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
        setExportProblem('There’s nothing to export. This diagram type is shown as source, so there’s no SVG to save.')
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
        className={cn(STAGE, embed ? STAGE_EMBED : STAGE_PAGE, fullscreen.active && STAGE_FULL)}
        aria-label="Mermaid visual editor"
      >
        <MermaidCanvas
          className={cn(CANVAS, panelOpen ? CANVAS_ROOM_PANEL : CANVAS_ROOM)}
          value={code}
          onChange={setCode}
          kinds={KINDS}
          drawingStyle="ink"
          align="center"
          toolbar="left"
          zoom={zoom}
        >
          <nav className={cn(ISLAND, ISLAND_TOOLS, 'top-(--gap) right-(--gap)')} aria-label="Editor">
            {embed ? (
              <Button as="a" href={fullEditor} target="_blank" rel="noopener" variant="ghost" size="sm" track="open-full-editor">
                <ExternalIcon />
                Full editor
              </Button>
            ) : (
              <>
                <Button as="a" href={docsUrl('/docs/mermaid')} variant="ghost" size="sm" track="docs">
                  <BookIcon />
                  <span className="max-[600px]:sr-only">Docs</span>
                </Button>
                <Button as="a" href={sites.github} variant="ghost" size="icon" track="github" aria-label="GitHub repository">
                  <GitHubIcon />
                </Button>
                <Separator orientation="vertical" decorative className={DIVIDER} />
                <Button variant="ghost" size="sm" className="max-[900px]:hidden" track="copy-link" disabled={link === undefined} onClick={() => link !== undefined && copy('link', link)}>
                  {copyLabel('link', 'Copy link')}
                </Button>
                <Button variant="solid" tone="primary" size="sm" track="share" onClick={() => setShareOpen(true)}>
                  <ShareIcon />
                  Share
                </Button>
              </>
            )}
            {/* The page's navbar holds the theme toggle; an embed has no navbar, so it gets its own. */}
            {embed ? (
              <>
                <Separator orientation="vertical" decorative className={DIVIDER} />
                <Button variant="ghost" size="icon" track="theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </Button>
              </>
            ) : null}
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

          <aside id="mermaid-code-panel" className={PANEL} hidden={!panelOpen} aria-label="Mermaid code">
            <section className={cn(SECTION, 'min-h-48 flex-[1_1_auto]')} aria-label="Code">
              <div className={SECTION_HEAD}>
                <CodeIcon />
                <span className="flex-1">Mermaid</span>
                <Button variant="ghost" size="sm" className="h-7" track="copy-mermaid" onClick={() => copy('mermaid', code)}>
                  {copyLabel('mermaid', 'Copy')}
                </Button>
              </div>
              <CodePane value={code} onChange={setCode} label="Mermaid source" kind={status.kind} />
              {unreadable ? (
                <Text size="sm" tone="warning" className={PROBLEM}>
                  This browser couldn&rsquo;t read the link, so you&rsquo;re seeing the default diagram instead. The shared link is still in the address
                  bar, and editing will replace it.
                </Text>
              ) : null}
              {status.tone === 'ok' ? null : (
                <Text size="sm" tone="warning" className={PROBLEM}>
                  {status.message === undefined ? status.label : `${status.label}: ${status.message}`}
                </Text>
              )}
            </section>

            <section className={cn(SECTION, 'flex-none')} aria-label="Sample diagrams">
              <Button variant="ghost" track="samples-toggle" className={cn(SECTION_HEAD, SECTION_TOGGLE)} aria-expanded={samplesOpen} onClick={() => setSamplesOpen((open) => !open)}>
                <SamplesIcon className="size-4" />
                <span className="flex-1">Samples</span>
                <ChevronIcon className={cn(CHEVRON, samplesOpen && 'rotate-180')} />
              </Button>
              {samplesOpen
                ? SAMPLE_GROUPS.map((group) => (
                    <div key={group.label} className="px-3 py-1" role="group" aria-label={group.label}>
                      <Text as="span" size="sm" weight="medium" className="mb-[0.4rem] block">
                        {group.label}
                      </Text>
                      <div className="flex flex-wrap gap-[0.4rem] pb-2">
                        {group.samples.map((sample) => (
                          <Button
                            key={sample.id}
                            variant={code === sample.code ? 'solid' : 'outline'}
                            tone="primary"
                            size="sm"
                            className={CHIP}
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

            <section className={cn(SECTION, 'flex-none')} aria-label="Export">
              <Button variant="ghost" track="actions-toggle" className={cn(SECTION_HEAD, SECTION_TOGGLE)} aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)}>
                <ActionsIcon className="size-4" />
                <span className="flex-1">Export</span>
                <ChevronIcon className={cn(CHEVRON, actionsOpen && 'rotate-180')} />
              </Button>
              {actionsOpen ? (
                <div className="flex flex-col gap-2 px-3 pt-1 pb-3">
                  <div className="flex items-center gap-[0.6rem]">
                    <Text as="span" size="sm" weight="medium">
                      PNG scale
                    </Text>
                    <span className="inline-flex gap-1" role="group" aria-label="PNG scale">
                      {[1, 2, 3].map((scale) => (
                        <Button key={scale} variant={pngScale === scale ? 'solid' : 'outline'} tone="primary" size="sm" className={CHIP} track={`png-scale-${scale}`} aria-pressed={pngScale === scale} onClick={() => setPngScale(scale)}>
                          {scale}×
                        </Button>
                      ))}
                    </span>
                  </div>
                  <div className={ACTION_GRID}>
                    <Button variant="outline" tone="primary" size="sm" className={CHIP} track="download-png" onClick={() => void downloadPng()}>
                      {copied === 'png' ? <CheckIcon /> : <DownloadIcon />}
                      PNG
                    </Button>
                    <Button variant="outline" tone="primary" size="sm" className={CHIP} track="download-svg" onClick={() => void downloadSvg()}>
                      {copied === 'svg' ? <CheckIcon /> : <DownloadIcon />}
                      SVG
                    </Button>
                    <Button variant="outline" tone="primary" size="sm" className={CHIP} track="copy-image" onClick={() => void copyPng()}>
                      {copied === 'image' ? <CheckIcon /> : <ImageIcon />}
                      {copied === 'image' ? 'Copied' : 'Image'}
                    </Button>
                  </div>
                  <div className={ACTION_GRID}>
                    <Button variant="outline" tone="primary" size="sm" className={CHIP} track="copy-markdown" onClick={() => copy('markdown', markdown)}>
                      {copyLabel('markdown', 'Markdown')}
                    </Button>
                    <Button as="a" href={liveUrl ?? '#'} target="_blank" rel="noopener" variant="outline" size="sm" className={CHIP} track="open-mermaid-live" disabled={liveUrl === undefined}>
                      <ExternalIcon />
                      mermaid.live
                    </Button>
                    <Button variant="outline" size="sm" className={CHIP} track="reset" disabled={code === DEFAULT_CODE} onClick={() => setCode(DEFAULT_CODE)}>
                      <ResetIcon />
                      Reset
                    </Button>
                  </div>
                  {exportProblem === undefined ? null : (
                    <Text size="sm" tone="warning" className="m-0">
                      {exportProblem}
                    </Text>
                  )}
                </div>
              ) : null}
            </section>
          </aside>

          <div className={cn(ISLAND, ISLAND_TOOLS, 'bottom-(--gap) left-(--gap)')} role="group" aria-label="Zoom">
            <Button variant="ghost" size="icon" track="zoom-out" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => zoomTo(zoom / ZOOM_STEP)}>
              <ZoomOutIcon />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              track="zoom-reset"
              className="h-8 min-w-[3.25rem] rounded-[8px]! px-1 text-[0.8rem] font-normal tabular-nums"
              aria-label="Reset zoom"
              title="Reset zoom"
              onClick={() => setZoom(1)}
            >
              {Math.round(zoom * 100)}%
            </Button>
            <Button variant="ghost" size="icon" track="zoom-in" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => zoomTo(zoom * ZOOM_STEP)}>
              <ZoomInIcon />
            </Button>
            <Separator orientation="vertical" decorative className={DIVIDER} />
            <Button variant="ghost" size="icon" track="fullscreen" aria-pressed={fullscreen.active} aria-label={fullscreen.active ? 'Exit fullscreen' : 'Fullscreen'} onClick={fullscreen.toggle}>
              <FullscreenIcon />
            </Button>
          </div>

          {embed || fullscreen.active ? null : (
            <a
              className={cn(
                ISLAND,
                'bottom-(--gap) left-1/2 -translate-x-1/2 gap-[0.4rem] px-[0.9rem] py-0 text-[0.8rem] font-medium whitespace-nowrap text-muted-foreground no-underline hover:text-foreground max-[900px]:hidden',
              )}
              href="#docs"
              onClick={scrollToDocs}
              data-zui-tag="scroll-to-docs"
            >
              <ArrowDownIcon />
              Docs and FAQ below
            </a>
          )}

          {/* With the code panel closed its warnings can't be seen, so the corner says there is one. */}
          {!panelOpen && (unreadable || status.tone !== 'ok') ? (
            <Button
              variant="outline"
              size="sm"
              track="show-problem"
              className={cn(ISLAND, 'right-(--gap) bottom-(--gap) h-auto max-w-[calc(100%_-_2_*_var(--gap)_-_13rem)] rounded-(--island-radius)! px-3 text-warning-text')}
              aria-controls="mermaid-code-panel"
              onClick={() => setPanelOpen(true)}
            >
              <span className="truncate">{unreadable ? 'Couldn’t read the link' : status.label}</span>
            </Button>
          ) : (
            <div
              className={cn(
                ISLAND,
                'bottom-(--gap) px-3 py-0',
                panelOpen ? 'right-[calc(var(--panel-width)_+_2_*_var(--gap))] max-[900px]:hidden' : 'right-(--gap)',
              )}
            >
              <a className="text-xs text-muted-foreground no-underline hover:text-foreground" href={docsUrl('/docs/mermaid')} data-zui-tag="version">
                v{mermaidPackage.version}
              </a>
            </div>
          )}
        </MermaidCanvas>
      </section>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} link={link} liveUrl={liveUrl} copied={copied} copy={copy} />
    </ActivityScope>
  )
}
