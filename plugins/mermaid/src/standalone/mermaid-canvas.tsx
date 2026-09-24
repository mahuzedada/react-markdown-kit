/**
 * The standalone canvas (docs/MERMAID_PLATFORM.md section 9.7): the same
 * canvas components the editor's block mounts, hosted by a component that
 * needs no Markdown editor. The source is a Mermaid string, in and out: a
 * flowchart or a sequence diagram is edited on its canvas, every other kind
 * is shown through its `render` (or as source), and a source a canvas edit
 * would flatten is locked behind the same notice the block shows.
 *
 * The component fills its container, the way Excalidraw's canvas fills the
 * page: the drawing surface is the whole box and the tools float over it,
 * down the left edge (`toolbar="left"`, the default) or along the top
 * (`"top"`). It keeps its own undo history (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z
 * or Ctrl+Y), merging commits under the 300 ms rule the block uses, and a
 * `value` changed from outside is one more entry in it.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { DrawingStyle } from '../core/ink.js'
import type { DiagramKind } from '../core/kind.js'
import { defaultKinds, validateKinds } from '../core/kinds.js'
import { detectDiagramKind } from '../core/detect.js'
import { parseDiagramSource } from '../extension.js'
import { DiagramCanvas } from '../canvas/drawing-canvas.js'
import { SequenceCanvas } from '../canvas/sequence/sequence-canvas.js'
import { DiagramCanvasHostProvider, type DiagramCanvasHost } from '../canvas/host.js'
import { DIAGRAM_LABEL_PREFIX, resolveDiagramLabels, type DiagramLabels } from '../canvas/labels.js'
import type { DiagramAlign, DiagramCanvasOptions, DiagramKindEditors } from '../canvas/options.js'
import { ToolbarSlotHost } from '../canvas/toolbar-slot.js'
import { Icon, UI_ICONS } from '../canvas/icons.js'

/** Commits closer together than this merge into one history entry when the canvas asks. */
const HISTORY_MERGE_WINDOW = 300
/** Undo keeps this many entries. */
const HISTORY_LIMIT = 200

export type MermaidCanvasToolbar = 'left' | 'top' | 'none'

export interface MermaidCanvasProps {
  /** The Mermaid source, controlled. Pair with `onChange`. */
  readonly value?: string
  /** The initial source when uncontrolled. Default: an empty flowchart. */
  readonly defaultValue?: string
  /** Every edit, as the new Mermaid source (a flowchart's with its `%% rmk-layout v1` line). */
  readonly onChange?: (source: string) => void
  /** Diagram kinds in detection order. Default `[flowchart(), sequenceDiagram()]`. */
  readonly kinds?: readonly DiagramKind[]
  /** Canvas components by kind name; a built-in name replaces the built-in component. */
  readonly editors?: DiagramKindEditors
  /** How the flowchart canvas draws shapes: `clean` (default) or hand-drawn `ink`. */
  readonly drawingStyle?: DrawingStyle
  /** Where a drawing smaller than the surface sits. Default `center`. */
  readonly align?: DiagramAlign
  /** Where the tools float: down the left edge (default), along the top, or not at all. */
  readonly toolbar?: MermaidCanvasToolbar
  /** Scales the drawing (not the tools). Default 1; the surface scrolls when the drawing outgrows it. */
  readonly zoom?: number
  /** Shows the diagram without tools or editing. */
  readonly readOnly?: boolean
  /** UI strings by key (`select`, `copyMermaid`, …), over the English defaults. */
  readonly labels?: Readonly<Partial<Record<keyof DiagramLabels, string>>>
  /** Accessible name of a diagram whose model has no `title`. Default "Diagram". */
  readonly fallbackTitle?: string
  /** Called with `true` when focus enters the canvas or its tools, `false` when it leaves. */
  readonly onFocusChange?: (focused: boolean) => void
  readonly className?: string
  readonly style?: CSSProperties
  /** Host chrome layered over the surface (menus, zoom controls). Place it with CSS. */
  readonly children?: ReactNode
}

const BUILT_IN_EDITORS: DiagramKindEditors = { flowchart: DiagramCanvas, sequenceDiagram: SequenceCanvas }
const EMPTY_FLOWCHART = 'flowchart TD'

function classes(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ')
}

/** True for a key typed into a field, whose own undo must win. */
function isTextTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select') !== null)
}

interface History {
  entries: string[]
  index: number
  /** When the canvas last committed; 0 once anything else changed the source. */
  lastCommitAt: number
}

/**
 * Undo history over the source. `commit` is the canvas's write, `adopt`
 * takes an outside change, `step` moves through the entries. Refs, not
 * state, so the sequence canvas can undo several entries in one handler.
 */
function useSourceHistory(initial: string, onChange: ((source: string) => void) | undefined) {
  const [source, setSource] = useState(initial)
  const history = useRef<History>({ entries: [initial], index: 0, lastCommitAt: 0 })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const current = (): string => history.current.entries[history.current.index] ?? ''

  const push = (next: string, merge: boolean): void => {
    const h = history.current
    h.entries = h.entries.slice(0, h.index + 1)
    if (merge && h.index > 0) h.entries[h.index] = next
    else h.entries.push(next)
    if (h.entries.length > HISTORY_LIMIT) h.entries.splice(0, h.entries.length - HISTORY_LIMIT)
    h.index = h.entries.length - 1
  }

  const commit = useCallback((next: string, options?: { readonly merge?: boolean }): void => {
    const h = history.current
    if (next === current()) return
    const now = Date.now()
    const merge = options?.merge === true && now - h.lastCommitAt < HISTORY_MERGE_WINDOW
    push(next, merge)
    h.lastCommitAt = now
    setSource(next)
    onChangeRef.current?.(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const adopt = useCallback((next: string): void => {
    const h = history.current
    if (next === current()) return
    push(next, false)
    h.lastCommitAt = 0
    setSource(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step = useCallback((delta: -1 | 1): boolean => {
    const h = history.current
    const index = h.index + delta
    if (index < 0 || index >= h.entries.length) return false
    h.index = index
    h.lastCommitAt = 0
    const next = h.entries[index] ?? ''
    setSource(next)
    onChangeRef.current?.(next)
    return true
  }, [])

  return { source, commit, adopt, step }
}

/**
 * A Mermaid diagram on a full-surface canvas, without a Markdown editor.
 * Give its container a size; the canvas fills it.
 */
export function MermaidCanvas(props: MermaidCanvasProps): ReactElement {
  const {
    value,
    defaultValue,
    onChange,
    drawingStyle = 'clean',
    align = 'center',
    toolbar = 'left',
    zoom = 1,
    readOnly = false,
    fallbackTitle = 'Diagram',
    onFocusChange,
    className,
    style,
    children,
  } = props
  const [defaults] = useState(() => defaultKinds())
  const kinds = props.kinds ?? defaults
  useMemo(() => validateKinds(kinds), [kinds])
  const editors = useMemo(() => ({ ...BUILT_IN_EDITORS, ...props.editors }), [props.editors])
  const { source, commit, adopt, step } = useSourceHistory(value ?? defaultValue ?? EMPTY_FLOWCHART, onChange)

  // A controlled value that is not the last thing emitted came from outside.
  useEffect(() => {
    if (value !== undefined) adopt(value)
  }, [value, adopt])

  const [scope] = useState(() => ({}))
  const focusRef = useRef(onFocusChange)
  focusRef.current = onFocusChange

  const labelOverrides = props.labels
  const labels = useMemo(() => {
    if (labelOverrides === undefined) return resolveDiagramLabels(undefined)
    const prefixed: Record<string, string> = {}
    for (const [key, text] of Object.entries(labelOverrides)) if (typeof text === 'string') prefixed[`${DIAGRAM_LABEL_PREFIX}${key}`] = text
    return resolveDiagramLabels(prefixed)
  }, [labelOverrides])

  const options = useMemo(
    (): DiagramCanvasOptions => ({
      style: drawingStyle,
      newBlockWidth: undefined,
      kinds,
      editors,
      sourceEditor: false,
      align,
      fallbackTitle,
    }),
    [drawingStyle, kinds, editors, align, fallbackTitle],
  )

  const host = useMemo(
    (): DiagramCanvasHost => ({
      scope,
      options,
      labels,
      chrome: 'app',
      toolbarOrientation: toolbar === 'left' ? 'vertical' : 'horizontal',
      onFocusChange: (id) => focusRef.current?.(id !== null),
      undo: () => {
        step(-1)
      },
    }),
    [scope, options, labels, toolbar, step],
  )

  const detected = detectDiagramKind(source, kinds)
  const registered = detected.registered
  const parsed = registered === undefined ? undefined : parseDiagramSource(kinds, registered.name, source)
  const model = parsed !== undefined && !('error' in parsed) ? parsed : undefined
  const CanvasEditor = registered !== undefined && registered.write !== undefined ? editors[registered.name] : undefined

  // The lossy features the author accepted; another set locks the canvas again.
  const [acknowledged, setAcknowledged] = useState<string | null>(null)
  const lossyKey = (model?.lossy ?? []).join(', ')
  const locked = lossyKey !== '' && acknowledged !== lossyKey

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (readOnly || isTextTarget(e.target) || !(e.metaKey || e.ctrlKey) || e.altKey) return
    const key = e.key.toLowerCase()
    const redo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)
    if (key !== 'z' && !redo) return
    e.preventDefault()
    step(redo ? 1 : -1)
  }

  // A key per source kind: switching kinds remounts the canvas instead of
  // handing one kind's component another kind's model.
  const surfaceKey = registered?.name ?? 'none'
  let surface: ReactNode
  if (!readOnly && CanvasEditor !== undefined && registered !== undefined && model !== undefined) {
    surface = (
      <CanvasEditor key={surfaceKey} nodeKey="canvas" kind={registered} source={source} parse={model} readOnly={locked} commit={commit} />
    )
  } else if (registered?.render !== undefined && model !== undefined) {
    surface = <StaticDiagram kind={registered} model={model.model} fallbackTitle={fallbackTitle} />
  } else {
    surface = (
      <pre className="rmk-diagram-source-pre">
        <code>{source}</code>
      </pre>
    )
  }

  const problem = parsed !== undefined && 'error' in parsed ? parsed.error : undefined

  return (
    <DiagramCanvasHostProvider host={host}>
      <div
        className={classes('rmk-editor', 'rmk-mermaid-canvas', readOnly && 'is-read-only', className)}
        data-rmk-mermaid-toolbar={toolbar}
        data-rmk-diagram-kind={detected.kind}
        style={style}
        onKeyDown={onKeyDown}
      >
        <div className="rmk-mermaid-canvas-viewport">
          <div className="rmk-mermaid-canvas-zoom" style={zoom === 1 ? undefined : { width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
            <div
              className="rmk-mermaid-canvas-surface"
              style={zoom === 1 ? undefined : { width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})` }}
            >
              {surface}
            </div>
          </div>
        </div>
        {!readOnly && toolbar !== 'none' && CanvasEditor !== undefined && model !== undefined && (
          <ToolbarSlotHost scope={scope} className="rmk-mermaid-canvas-tools" />
        )}
        {!readOnly && locked && model !== undefined && (
          <div className="rmk-diagram-lossy rmk-mermaid-canvas-notice" role="status">
            <Icon>{UI_ICONS.warning}</Icon>
            <span className="rmk-diagram-lossy-text">
              {labels.lossyNotice} {model.lossy?.join(', ')}
            </span>
            <button type="button" className="rmk-diagram-lossy-action" onClick={() => setAcknowledged(lossyKey)}>
              {labels.editOnCanvas}
            </button>
          </div>
        )}
        {problem !== undefined && (
          <div className="rmk-mermaid-canvas-notice rmk-mermaid-canvas-problem" role="status">
            {problem}
          </div>
        )}
        {children}
      </div>
    </DiagramCanvasHostProvider>
  )
}

function StaticDiagram({ kind, model, fallbackTitle }: { kind: DiagramKind; model: unknown; fallbackTitle: string }): ReactElement {
  const rendered = useMemo<ReactNode>(() => {
    if (kind.render === undefined) return null
    return toJsxRuntime(kind.render(model, { fallbackTitle }), { Fragment, jsx, jsxs, passKeys: true })
  }, [kind, model, fallbackTitle])
  return <div className="rmk-mermaid-canvas-static">{rendered}</div>
}
