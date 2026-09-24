/**
 * Ported from @zuilib/text-editor (MIT). The drawing canvas: the interactive
 * SVG surface of one flowchart block, with its tool row, selection, inline
 * text editing and height grip. Local state during a gesture, committed to
 * the Lexical node on release.
 *
 * The canvas is the block's `flowchart` editor, written to the
 * `DiagramKindEditorProps` contract: its input is the parse of the node's
 * source, and a gesture goes out as source through the kind's `write` with
 * the lines the parser read through. What the block hands back is the
 * model of that source, so the canvas remembers that model as its last
 * commit and its own echo never resets a gesture. "Copy as Mermaid" writes
 * the same way, from the same payload, so the clipboard holds what a commit
 * would put in the document: title, description, width and retained lines
 * included. The block owns the lossy lock: it mounts the canvas with
 * `readOnly` while the author has not accepted the loss, so the first
 * commit can only happen after that.
 *
 * The block commits discretely, like every other editing path of the
 * package, so the document read right after a gesture is the gesture's
 * result. That is why `updateShapes` applies its updater to a ref instead
 * of React's queue: a discrete update runs Lexical's listeners at once,
 * which must not happen inside a state updater React may run while
 * rendering.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import type { BlockWidth } from '../core/block-width.js'
import { bindEndpoints, nodeShapeOutline, findNodeShapeAt, createBinding, resolveBindings } from '../core/bindings.js'
import { connectorPoints } from '../core/connectors.js'
import { bbox, normalize, textBoxSize, type Rect } from '../core/geometry.js'
import { NODE_SHAPE_DEFINITIONS, type TextField } from '../core/shapes/definitions.js'
import {
  createShapeId,
  FILL_COLORS,
  FONT_SIZE,
  isNodeShapeType,
  isConnectorType,
  LINE_HEIGHT,
  serializeDrawingData,
  SMALL_FONT_SIZE,
  STROKE_COLORS,
  withBindings,
  type DrawingData,
  type DrawingShape,
  type Point,
  type StrokeStyle,
} from '../core/drawing-data.js'
import { COLOR_PRESETS, type ColorName } from '../core/skeleton.js'
import type { DiagramKind } from '../core/kind.js'
import { parseDiagramSource } from '../extension.js'
import { Icon, UI_ICONS } from './icons.js'
import {
  applyDrag,
  CLICK_TOLERANCE,
  marqueeRect,
  moveGroup,
  omitFields,
  pointInRect,
  selectionBounds,
  shapesWithin,
  translateShapes,
  type DragState,
  type GroupHandle,
} from './interaction.js'
import { useCanvasHost, useDiagramLabels } from './host.js'
import type { DiagramKindEditorProps } from './options.js'
import { PropertyBar, type HeadChoice } from './property-bar.js'
import { GroupSelectionOverlay, MarqueeOverlay, SelectionOverlay } from './selection-overlay.js'
import { HitArea, ShapeView, slotAt, slotLayout } from './shape-view.js'
import { TextEditOverlay } from './text-edit-overlay.js'
import { createTextMeasure, linesSize, TextMeasureContext, wrapLines, type TextMeasure } from './text-measure.js'
import { DiagramToolbar, type Tool } from './toolbar.js'
import { useToolbarHost } from './toolbar-slot.js'

const MIN_HEIGHT = 120
const MAX_HEIGHT = 1200

/** Block width → canvas class; the stylesheet keys the column layout off it */
const WIDTH_CLASS: Record<BlockWidth, string> = {
  full: '',
  text: 'is-text-width',
  content: 'is-content-width',
}
/** Content-width canvas: never narrower than this … */
const MIN_CONTENT_WIDTH = 240
/** … and this much room to the right of the rightmost shape */
const CONTENT_WIDTH_PADDING = 40

const EMPTY_SET: ReadonlySet<string> = new Set()

/** Arrow keys as the unit step they nudge the selection by */
const NUDGE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function classes(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ')
}

/** Copy of `shape` with `field` set, or removed when the text is blank */
function withText(shape: DrawingShape, field: TextField, value: string): DrawingShape {
  if (value.trim() === '') return omitFields(shape, [field])
  switch (field) {
    case 'label':
      return { ...shape, label: value }
    case 'footer':
      return { ...shape, footer: value }
    case 'text':
      return { ...shape, text: value }
  }
}

/**
 * A box grown downwards until its text slots fit its text area, as
 * Excalidraw grows a container while its text gains lines. It never
 * shrinks: a box drawn roomy stays roomy.
 */
function grownToFitText(shape: DrawingShape, measure: TextMeasure | null): DrawingShape {
  if (isConnectorType(shape.type) || shape.type === 'text') return shape
  const { area, slots } = slotLayout(shape)
  const heights = slots.flatMap((slot) => {
    const value = shape[slot]
    if (!value) return []
    const fontSize = slot === 'text' ? FONT_SIZE : SMALL_FONT_SIZE
    const lines = wrapLines(value, Math.max(area.w, 20), fontSize, measure, slot === 'label' ? 600 : undefined)
    return [lines.length * fontSize * LINE_HEIGHT]
  })
  const needed = heights.reduce((sum, h) => sum + h, 0) + Math.max(0, heights.length - 1) * TEXT_SLOT_GAP
  if (needed <= area.h || area.h <= 0) return shape
  // The text area scales with the box on every shape type
  return { ...shape, height: Math.ceil((shape.height * needed) / area.h) }
}

const TEXT_SLOT_GAP = 6

/** The ink style's letter spacing (styles.css, `.is-ink`) */
const INK_LETTER_SPACING_EM = 0.015

/** How far a duplicate lands from its original, down and right (Excalidraw's offset) */
const DUPLICATE_OFFSET = 10

/**
 * Copies of the shapes in `ids` with fresh ids, moved by `offset`.
 * Bindings follow a copied box to its copy and are dropped when the box
 * stays behind.
 */
function duplicateShapes(shapes: readonly DrawingShape[], ids: ReadonlySet<string>, offset: number): DrawingShape[] {
  const copyIds = new Map<string, string>()
  for (const shape of shapes) if (ids.has(shape.id)) copyIds.set(shape.id, createShapeId())
  const rebind = (binding: DrawingShape['startBinding']): DrawingShape['startBinding'] => {
    const id = binding === undefined ? undefined : copyIds.get(binding.id)
    return binding === undefined || id === undefined ? undefined : { ...binding, id }
  }
  return shapes.flatMap((shape) => {
    const id = copyIds.get(shape.id)
    if (id === undefined) return []
    const moved: DrawingShape = {
      ...shape,
      id,
      x: shape.x + offset,
      y: shape.y + offset,
      ...(shape.waypoints === undefined ? {} : { waypoints: shape.waypoints.map((p) => ({ x: p.x + offset, y: p.y + offset })) }),
    }
    return [isConnectorType(shape.type) ? withBindings(moved, rebind(shape.startBinding), rebind(shape.endBinding)) : moved]
  })
}

type OverlayMapping = Readonly<{ x: number; y: number; scale: number }>

/**
 * Where the SVG's user space sits in the stage's own pixels: its screen
 * matrix relative to the stage's padding box, divided by any zoom a host
 * puts around the editor (the overlay sits inside that zoom). Null without
 * layout.
 */
function svgToStage(svg: SVGSVGElement, stage: HTMLElement): OverlayMapping | null {
  const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null
  if (!ctm || stage.offsetWidth === 0) return null
  const rect = stage.getBoundingClientRect()
  const zoom = rect.width / stage.offsetWidth
  if (!(zoom > 0)) return null
  return {
    x: Math.round((ctm.e - rect.left) / zoom - stage.clientLeft),
    y: Math.round((ctm.f - rect.top) / zoom - stage.clientTop),
    scale: ctm.a / zoom,
  }
}

/** Width that fits every shape (measured from the canvas origin) */
function contentWidth(shapes: readonly DrawingShape[], paths: ReadonlyMap<string, readonly Point[]>): number {
  let right = 0
  for (const shape of shapes) {
    if (isConnectorType(shape.type)) {
      for (const p of paths.get(shape.id) ?? []) right = Math.max(right, p.x)
    } else {
      const b = bbox(shape)
      right = Math.max(right, b.x + b.w)
    }
  }
  return Math.max(MIN_CONTENT_WIDTH, Math.ceil(right + CONTENT_WIDTH_PADDING))
}

const ZERO: Point = { x: 0, y: 0 }

/**
 * The offset that puts the drawing in the middle of a surface `w` by `h`
 * (an `align: 'center'` canvas): on each axis the drawing is centred when
 * it fits and left where it is otherwise, so a drawing too large for the
 * surface starts at its own origin, the way an aligned-to-start canvas
 * shows it.
 */
function centeredOffset(shapes: readonly DrawingShape[], paths: ReadonlyMap<string, readonly Point[]>, w: number, h: number): Point {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const shape of shapes) {
    if (isConnectorType(shape.type)) {
      for (const p of paths.get(shape.id) ?? []) {
        left = Math.min(left, p.x)
        top = Math.min(top, p.y)
        right = Math.max(right, p.x)
        bottom = Math.max(bottom, p.y)
      }
    } else {
      const b = bbox(shape)
      left = Math.min(left, b.x)
      top = Math.min(top, b.y)
      right = Math.max(right, b.x + b.w)
      bottom = Math.max(bottom, b.y + b.h)
    }
  }
  if (!Number.isFinite(left) || !Number.isFinite(top)) return ZERO
  const width = right - left
  const height = bottom - top
  return {
    x: width >= w ? 0 : Math.round((w - width) / 2 - left),
    y: height >= h ? 0 : Math.round((h - height) / 2 - top),
  }
}

function computePaths(shapes: readonly DrawingShape[]): Map<string, Point[]> {
  const paths = new Map<string, Point[]>()
  for (const shape of shapes) {
    if (isConnectorType(shape.type)) paths.set(shape.id, connectorPoints(shape, shapes))
  }
  return paths
}

/**
 * True for a key pressed on one of the canvas's own controls (the tool row,
 * the property bar, a select or a field) rather than on the root: Enter
 * activates that control and Backspace edits it, so the canvas leaves the
 * key alone.
 */
export function isControlKey(e: KeyboardEvent, root: HTMLElement): boolean {
  const target = e.target
  if (!(target instanceof Element) || target === root) return false
  return target.closest('button, select, input, textarea, [role="toolbar"]') !== null
}

export function DiagramCanvas({ nodeKey, kind, parse, readOnly, commit: commitSource }: DiagramKindEditorProps): ReactElement {
  const host = useCanvasHost()
  const isEditable = !readOnly
  const data = parse.model as DrawingData
  const { retained } = parse

  const [shapes, setShapes] = useState<readonly DrawingShape[]>(data.shapes)
  const [canvasHeight, setCanvasHeight] = useState(data.canvasHeight)
  const [width, setWidth] = useState<BlockWidth>(data.width ?? 'full')
  const options = host.options
  const ink = options.style === 'ink'
  const optionsRef = useRef(options)
  optionsRef.current = options
  const kindRef = useRef(kind as DiagramKind<DrawingData>)
  kindRef.current = kind as DiagramKind<DrawingData>
  const retainedRef = useRef(retained)
  retainedRef.current = retained
  const labels = useDiagramLabels()
  const [tool, setTool] = useState<Tool>('select')
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [editingText, setEditingText] = useState<{ id: string; field: TextField } | null>(null)
  // The open text field's value as typed, before it commits
  const [draftText, setDraftText] = useState<string | null>(null)
  const [stroke, setStroke] = useState<string>(STROKE_COLORS[0])
  const [fill, setFill] = useState<string>(FILL_COLORS[0])
  const [hoverBoxId, setHoverBoxId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<{ origin: Point; current: Point } | null>(null)
  const [scale, setScale] = useState(1)
  /** The shapes a centred canvas is centred on: the last model adopted from outside, so a gesture never re-centres the drawing under the pointer. */
  const [anchorShapes, setAnchorShapes] = useState<readonly DrawingShape[]>(data.shapes)
  /** The room the stage gives the surface, in CSS pixels (its content box, which a host that fixes the stage's height caps), measured for a centred canvas; null until measured or while the canvas aligns to start. */
  const [surface, setSurface] = useState<{ readonly w: number; readonly h: number } | null>(null)
  /** Focus is in the canvas or in its tool row, wherever that row renders. */
  const [active, setActive] = useState(false)
  const slot = useToolbarHost(host.scope, nodeKey, isEditable, active)

  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState | null>(null)
  /** Text shape created on pointerdown whose editor opens on pointerup */
  const pendingTextEditRef = useRef<string | null>(null)
  const pendingPointRef = useRef<Point | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastCommittedRef = useRef(serializeDrawingData(data))
  /** The local shapes, written by `updateShapes` and the adopt effect only; `shapes` mirrors it for rendering. */
  const shapesRef = useRef(shapes)
  const heightRef = useRef(canvasHeight)
  heightRef.current = canvasHeight
  const widthRef = useRef(width)
  widthRef.current = width
  const selectedRef = useRef(selectedIds)
  selectedRef.current = selectedIds

  const paths = useMemo(() => computePaths(shapes), [shapes])
  const pathsRef = useRef(paths)
  pathsRef.current = paths
  const canvasWidth = data.canvasWidth

  // Width of the stage the surface sits in: a drawing wider than its pane
  // (a phone, a sidebar) scales down to it instead of being clipped
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageWidth, setStageWidth] = useState<number | null>(null)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const update = (): void => setStageWidth(stage.clientWidth || null)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])
  // Measured on the committed shapes, so the fit holds still during a drag
  const committedWidth = useMemo(() => contentWidth(data.shapes, computePaths(data.shapes)), [data.shapes])
  const fitWidth = stageWidth !== null && committedWidth > stageWidth ? committedWidth : null
  // A centred canvas also fits a drawing taller than its surface: a logical
  // width in the surface's own proportions scales the viewBox down to the
  // surface's height, and the SVG's alignment centres it.
  const centered = options.align === 'center'
  const fitHeightWidth =
    centered && surface !== null && canvasHeight > surface.h ? Math.ceil((canvasHeight * surface.w) / surface.h) : null
  const fitBoxWidth = fitWidth === null ? fitHeightWidth : fitHeightWidth === null ? fitWidth : Math.max(fitWidth, fitHeightWidth)

  // Scaled canvases: an explicit logical width, a content-width canvas
  // that is wider than the editor, or any drawing wider than its pane. All
  // render through a viewBox so the drawing shrinks to fit instead of
  // being clipped.
  const logicalWidth = canvasWidth ?? (width === 'content' ? contentWidth(shapes, paths) : fitBoxWidth)

  // Adopt external changes (undo/redo, collaborative edits) without
  // clobbering in-progress local edits we just committed ourselves.
  useEffect(() => {
    const incoming = serializeDrawingData(data)
    if (incoming !== lastCommittedRef.current) {
      lastCommittedRef.current = incoming
      shapesRef.current = data.shapes
      setShapes(data.shapes)
      setAnchorShapes(data.shapes)
      setCanvasHeight(data.canvasHeight)
      setWidth(data.width ?? 'full')
      setSelectedIds(EMPTY_SET)
      setEditingText(null)
    }
  }, [data])

  // A centred canvas measures the stage's content box untransformed (the
  // observer's rect, never a client rect, for the same reason the overlays
  // are): the surface fills it when the drawing is smaller, and a host
  // that fixes the stage's height, as a page-as-canvas editor does, caps
  // it there. The drawing is offset to the middle of the viewBox: the box
  // itself when unscaled, the logical canvas when scaled, where the SVG's
  // own alignment then centres that canvas in the box, an offset the HTML
  // overlay adds in pixels.
  useEffect(() => {
    const stage = stageRef.current
    if (!centered || !stage || typeof ResizeObserver === 'undefined') {
      setSurface(null)
      return
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect
      if (box !== undefined && box.width > 0 && box.height > 0) setSurface({ w: box.width, h: box.height })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [centered])
  const offset = useMemo((): Point => {
    if (!centered) return ZERO
    if (logicalWidth !== null) return centeredOffset(anchorShapes, computePaths(anchorShapes), logicalWidth, canvasHeight)
    return surface === null ? ZERO : centeredOffset(anchorShapes, computePaths(anchorShapes), surface.w, surface.h)
  }, [centered, surface, logicalWidth, canvasHeight, anchorShapes])
  const viewBox =
    logicalWidth !== null
      ? `${-offset.x} ${-offset.y} ${logicalWidth} ${canvasHeight}`
      : centered && surface !== null
        ? `${-offset.x} ${-offset.y} ${surface.w} ${surface.h}`
        : undefined
  const overlayOffset = useMemo((): Point => {
    if (logicalWidth === null) return offset
    const fit = Math.min(surface?.w ?? logicalWidth, logicalWidth) / logicalWidth
    const box = centered && surface !== null ? { x: (surface.w - logicalWidth * fit) / 2, y: (surface.h - canvasHeight * fit) / 2 } : ZERO
    return { x: Math.round(box.x + offset.x * fit), y: Math.round(box.y + offset.y * fit) }
  }, [centered, surface, logicalWidth, canvasHeight, offset])

  // Scaled canvases need the HTML overlays and the height grip scaled too.
  // The width is measured untransformed (`offsetWidth`, never a client
  // rect): the overlays sit inside any zoom transform a host puts around
  // the editor, so that transform must not scale them a second time. The
  // surface is as wide as its logical width, capped by the stage.
  useEffect(() => {
    const stage = stageRef.current
    if (!logicalWidth || !stage || typeof ResizeObserver === 'undefined') {
      setScale(1)
      return
    }
    const update = (): void => {
      const width = Math.min(stage.offsetWidth, logicalWidth)
      setScale(width > 0 ? width / logicalWidth : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [logicalWidth])

  // The model a commit writes: the local state over the fields the canvas
  // does not edit (title, description, logical width).
  const payloadOf = useCallback(
    (nextShapes: readonly DrawingShape[], options?: { height?: number; width?: BlockWidth }): DrawingData => {
      const nextWidth = options?.width ?? widthRef.current
      // `full` stays implicit when picked from the toolbar; an explicit
      // `full` already in the payload (insertion default, hand-written
      // source) survives edits that don't touch the width.
      const explicitFull = options?.width === undefined && data.width !== undefined
      return {
        version: 3,
        ...(canvasWidth ? { canvasWidth } : {}),
        canvasHeight: options?.height ?? heightRef.current,
        ...(nextWidth !== 'full' || explicitFull ? { width: nextWidth } : {}),
        ...(data.title ? { title: data.title } : {}),
        ...(data.description ? { description: data.description } : {}),
        shapes: nextShapes,
      }
    },
    [canvasWidth, data.width, data.title, data.description],
  )

  // The source of a payload through the kind's writer, with the lines the
  // parser read through; undefined when the kind does not write.
  const writeSource = useCallback((payload: DrawingData): string | undefined => {
    return kindRef.current.write?.(payload, { retained: retainedRef.current })
  }, [])

  const commit = useCallback(
    (nextShapes: readonly DrawingShape[], options?: { height?: number; width?: BlockWidth; merge?: boolean }) => {
      const payload = payloadOf(nextShapes, options)
      const json = serializeDrawingData(payload)
      if (json === lastCommittedRef.current) return
      const written = writeSource(payload)
      if (written === undefined) return
      // The node stores source: remember the model that source parses to,
      // which is what comes back as the parse, then hand the block the text.
      const reparsed = parseDiagramSource(optionsRef.current.kinds, kindRef.current.name, written)
      lastCommittedRef.current =
        reparsed !== undefined && !('error' in reparsed) ? serializeDrawingData(reparsed.model as DrawingData) : json
      commitSource(written, options?.merge ? { merge: true } : undefined)
    },
    [commitSource, payloadOf, writeSource],
  )

  // Updates chain through `shapesRef`, so consecutive calls in one handler
  // compose the way functional updaters would, and a commit runs in the
  // handler, never inside React's render.
  const updateShapes = useCallback(
    (updater: (prev: readonly DrawingShape[]) => readonly DrawingShape[], options?: { commit?: boolean; merge?: boolean }) => {
      // Re-resolve bindings after every change so bound connectors track
      // the boxes they're attached to (resolveBindings is idempotent)
      const next = resolveBindings(updater(shapesRef.current))
      shapesRef.current = next
      setShapes(next)
      if (options?.commit) commit(next, options.merge ? { merge: true } : undefined)
    },
    [commit],
  )

  const getPoint = useCallback((e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null
    if (!ctm) {
      const rect = svg.getBoundingClientRect()
      return { x: e.clientX - rect.left - offset.x, y: e.clientY - rect.top - offset.y }
    }
    const inverse = ctm.inverse()
    return {
      x: inverse.a * e.clientX + inverse.c * e.clientY + inverse.e,
      y: inverse.b * e.clientX + inverse.d * e.clientY + inverse.f,
    }
  }, [offset])

  const selection = useMemo(() => shapes.filter((s) => selectedIds.has(s.id)), [shapes, selectedIds])
  const single = selection.length === 1 ? (selection[0] ?? null) : null

  const startTextEditing = useCallback((id: string, field: TextField) => {
    setDraftText(null)
    setEditingText({ id, field })
    setSelectedIds(new Set([id]))
  }, [])

  const capture = (e: ReactPointerEvent): void => {
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const handleBackgroundPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!isEditable || editingText || e.button !== 0) return
      const point = getPoint(e)
      capture(e)

      if (tool === 'select') {
        // A drag anywhere inside a multi-selection's frame moves it, as in
        // Excalidraw: the gaps between the shapes belong to the group
        const selected = selectedRef.current
        if (!e.shiftKey && selected.size > 1) {
          const group = shapesRef.current.filter((s) => selected.has(s.id))
          if (pointInRect(point, selectionBounds(group, pathsRef.current), 8)) {
            const [first] = selected
            dragRef.current = {
              mode: 'move',
              clickedId: first ?? '',
              origin: point,
              origs: moveGroup(shapesRef.current, selected, first ?? ''),
              wasSelected: false,
            }
            return
          }
        }
        if (!e.shiftKey) setSelectedIds(EMPTY_SET)
        dragRef.current = { mode: 'marquee', origin: point, current: point, additive: e.shiftKey }
        return
      }

      if (tool === 'text') {
        const id = createShapeId()
        const size = textBoxSize('')
        updateShapes((prev) => [
          ...prev,
          {
            id,
            type: 'text',
            x: point.x,
            y: point.y - FONT_SIZE / 2,
            width: size.w,
            height: size.h,
            stroke,
            fill: 'transparent',
            strokeWidth: 2,
            text: '',
          },
        ])
        setTool('select')
        setSelectedIds(new Set([id]))
        // Open the editor on pointerup: opening it now would get the
        // textarea blurred by this click's own focus change
        pendingTextEditRef.current = id
        return
      }

      const id = createShapeId()
      const def = isNodeShapeType(tool) ? NODE_SHAPE_DEFINITIONS[tool] : null
      const shapeFill = def ? (fill === 'transparent' && def.defaultFill ? def.defaultFill : fill) : 'transparent'
      dragRef.current = { mode: 'draw', id, origin: point }
      setSelectedIds(EMPTY_SET)
      updateShapes((prev) => [
        ...prev,
        {
          id,
          type: tool,
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          stroke,
          fill: shapeFill,
          strokeWidth: 2,
          // Square like Mermaid's default `[text]`; Round in the property bar writes `(text)`
          ...(tool === 'rect' ? { corners: 'sharp' as const } : {}),
        },
      ])
    },
    [isEditable, editingText, getPoint, tool, stroke, fill, updateShapes],
  )

  const handleShapePointerDown = useCallback(
    (e: ReactPointerEvent, shape: DrawingShape) => {
      if (!isEditable || tool !== 'select' || editingText || e.button !== 0) return
      e.stopPropagation()
      const point = getPoint(e)
      capture(e)
      const selected = selectedRef.current
      if (e.shiftKey) {
        // Shift toggles membership; removing never starts a drag
        if (selected.has(shape.id)) {
          const next = new Set(selected)
          next.delete(shape.id)
          setSelectedIds(next)
          return
        }
        const next = new Set(selected).add(shape.id)
        setSelectedIds(next)
        dragRef.current = {
          mode: 'move',
          clickedId: shape.id,
          origin: point,
          origs: moveGroup(shapesRef.current, next, shape.id),
          wasSelected: false,
        }
        return
      }
      const wasSelected = selected.size === 1 && selected.has(shape.id)
      const group = selected.has(shape.id) ? selected : new Set([shape.id])
      if (!selected.has(shape.id)) setSelectedIds(group)
      dragRef.current = {
        mode: 'move',
        clickedId: shape.id,
        origin: point,
        origs: moveGroup(shapesRef.current, group, shape.id),
        wasSelected,
        collapseOnClick: selected.size > 1 && selected.has(shape.id),
      }
    },
    [isEditable, tool, editingText, getPoint],
  )

  const handleHandlePointerDown = useCallback(
    (e: ReactPointerEvent, drag: DragState) => {
      if (!isEditable || e.button !== 0) return
      e.stopPropagation()
      capture(e)
      dragRef.current = drag
      // Dragging an endpoint detaches it, otherwise the binding resolver
      // would snap it straight back to the box outline
      if (drag.mode === 'endpoint') {
        const key = drag.end === 'start' ? 'startBinding' : 'endBinding'
        updateShapes((prev) => prev.map((s) => (s.id === drag.id ? omitFields(s, [key]) : s)))
      }
    },
    [isEditable, updateShapes],
  )

  const handleGroupHandlePointerDown = useCallback(
    (e: ReactPointerEvent, handle: GroupHandle, bounds: Rect) => {
      if (!isEditable || e.button !== 0) return
      e.stopPropagation()
      capture(e)
      const selected = selectedRef.current
      dragRef.current = {
        mode: 'group-resize',
        handle,
        bounds,
        origs: new Map(shapesRef.current.filter((s) => selected.has(s.id)).map((s) => [s.id, s])),
        fromCenter: e.altKey,
      }
    },
    [isEditable],
  )

  const flushPointer = useCallback(() => {
    frameRef.current = null
    const point = pendingPointRef.current
    const drag = dragRef.current
    if (!point || !drag) return
    if (drag.mode === 'marquee') {
      drag.current = point
      setMarquee({ origin: drag.origin, current: point })
      return
    }
    updateShapes((prev) => applyDrag(prev, drag, point))
    // Highlight the box a dragged endpoint would bind to
    if (
      drag.mode === 'endpoint' ||
      (drag.mode === 'draw' && isConnectorType(shapesRef.current.find((s) => s.id === drag.id)?.type ?? ''))
    ) {
      const box = findNodeShapeAt(shapesRef.current, point, drag.id)
      setHoverBoxId((prev) => (prev === (box?.id ?? null) ? prev : (box?.id ?? null)))
    }
  }, [updateShapes])

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!dragRef.current) return
      pendingPointRef.current = getPoint(e)
      // Coalesce pointer moves to one update per frame
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(flushPointer)
      }
    },
    [getPoint, flushPointer],
  )

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      dragRef.current = null
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      pendingPointRef.current = null
      setHoverBoxId(null)
      if (pendingTextEditRef.current) {
        const id = pendingTextEditRef.current
        pendingTextEditRef.current = null
        startTextEditing(id, 'text')
        return
      }
      if (!drag) return
      const point = getPoint(e)
      // The release point is the gesture's last word: a move still waiting
      // for its animation frame (a quick flick, a throttled window) would
      // otherwise be lost
      if (drag.mode !== 'marquee') updateShapes((prev) => applyDrag(prev, drag, point))

      if (drag.mode === 'marquee') {
        setMarquee(null)
        const rect = marqueeRect(drag.origin, point)
        if (rect.w < CLICK_TOLERANCE && rect.h < CLICK_TOLERANCE) return
        const ids = shapesWithin(shapesRef.current, rect, paths)
        setSelectedIds((prev) => (drag.additive ? new Set([...prev, ...ids]) : new Set(ids)))
        return
      }

      if (drag.mode === 'move' && drag.collapseOnClick) {
        const moved =
          Math.abs(point.x - drag.origin.x) > CLICK_TOLERANCE || Math.abs(point.y - drag.origin.y) > CLICK_TOLERANCE
        if (!moved) {
          updateShapes((prev) => applyDrag(prev, drag, drag.origin))
          setSelectedIds(new Set([drag.clickedId]))
          return
        }
      }

      // Clicking an already-selected shape without dragging opens the text
      // editor for the slot under the cursor
      if (drag.mode === 'move' && drag.wasSelected) {
        const moved =
          Math.abs(point.x - drag.origin.x) > CLICK_TOLERANCE || Math.abs(point.y - drag.origin.y) > CLICK_TOLERANCE
        const current = shapesRef.current.find((s) => s.id === drag.clickedId)
        if (!moved && current) {
          updateShapes((prev) => applyDrag(prev, drag, drag.origin))
          if (current.type === 'text' || isConnectorType(current.type)) {
            startTextEditing(current.id, 'text')
          } else {
            startTextEditing(current.id, slotAt(current, drag.origin.y))
          }
          return
        }
      }

      // A click that did not move anything changes nothing, so it writes
      // nothing: the author's source stays as they typed it
      if (drag.mode === 'move') {
        const moved =
          Math.abs(point.x - drag.origin.x) > CLICK_TOLERANCE || Math.abs(point.y - drag.origin.y) > CLICK_TOLERANCE
        if (!moved) {
          updateShapes((prev) => applyDrag(prev, drag, drag.origin))
          return
        }
      }

      if (drag.mode === 'draw') {
        const drawn = shapesRef.current.find((s) => s.id === drag.id)
        if (drawn && Math.abs(drawn.width) < 4 && Math.abs(drawn.height) < 4) {
          // A click with a box tool drops a default-sized shape; with a
          // connector tool it's discarded
          if (isNodeShapeType(drawn.type)) {
            const size = NODE_SHAPE_DEFINITIONS[drawn.type].defaultSize
            updateShapes(
              (prev) =>
                prev.map((s) =>
                  s.id === drag.id
                    ? { ...s, x: s.x - size.w / 2, y: s.y - size.h / 2, width: size.w, height: size.h }
                    : s,
                ),
              { commit: true },
            )
            setTool('select')
            setSelectedIds(new Set([drag.id]))
          } else {
            updateShapes((prev) => prev.filter((s) => s.id !== drag.id))
          }
          return
        }
        if (drawn && isConnectorType(drawn.type)) {
          updateShapes((prev) => prev.map((s) => (s.id === drag.id ? bindEndpoints(s, prev) : s)))
        }
        setTool('select')
        setSelectedIds(new Set([drag.id]))
      }

      // Re-evaluate the dropped endpoint's binding: attach when released on
      // a box, stay detached otherwise
      if (drag.mode === 'endpoint') {
        updateShapes((prev) =>
          prev.map((s) => {
            if (s.id !== drag.id) return s
            const end = drag.end === 'start' ? { x: s.x, y: s.y } : { x: s.x + s.width, y: s.y + s.height }
            const box = findNodeShapeAt(prev, end, s.id)
            const other = drag.end === 'start' ? s.endBinding : s.startBinding
            if (box && box.id === other?.id) return s
            const binding = box ? createBinding(box, end) : undefined
            return drag.end === 'start'
              ? withBindings(s, binding, s.endBinding)
              : withBindings(s, s.startBinding, binding)
          }),
        )
      }

      updateShapes((prev) => prev.map(normalize), { commit: true })
    },
    [getPoint, paths, updateShapes, startTextEditing],
  )

  const deleteSelection = useCallback(() => {
    const ids = selectedRef.current
    if (!ids.size) return
    setEditingText(null)
    setSelectedIds(EMPTY_SET)
    // Connectors attached to a deleted box go with it
    updateShapes(
      (prev) =>
        prev.filter(
          (s) =>
            !ids.has(s.id) &&
            !(s.startBinding && ids.has(s.startBinding.id)) &&
            !(s.endBinding && ids.has(s.endBinding.id)),
        ),
      { commit: true },
    )
  }, [updateShapes])

  // Copies of the selection a little down and right, selected in its
  // place. A copied connector keeps a binding only when its box was copied
  // too; otherwise it would sit on top of the original.
  const duplicateSelection = useCallback(() => {
    const ids = selectedRef.current
    if (!ids.size) return
    const copies = duplicateShapes(shapesRef.current, ids, DUPLICATE_OFFSET)
    setSelectedIds(new Set(copies.map((s) => s.id)))
    updateShapes((prev) => [...prev, ...copies], { commit: true })
  }, [updateShapes])

  // Native listener: shortcuts must be handled (and stopped) before they
  // bubble to Lexical's root, which owns the same keys for the document
  const editingRef = useRef(editingText)
  editingRef.current = editingText
  useEffect(() => {
    const root = rootRef.current
    if (!root || !isEditable) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (editingRef.current || isControlKey(e, root)) return
      const ids = selectedRef.current
      if ((e.key === 'Delete' || e.key === 'Backspace') && ids.size) {
        e.preventDefault()
        e.stopPropagation()
        deleteSelection()
      } else if (e.key === 'Enter' && ids.size === 1) {
        const [id] = ids
        const shape = shapesRef.current.find((s) => s.id === id)
        if (shape) {
          e.preventDefault()
          e.stopPropagation()
          startTextEditing(shape.id, 'text')
        }
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && ids.size) {
        e.preventDefault()
        e.stopPropagation()
        duplicateSelection()
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIds(new Set(shapesRef.current.map((s) => s.id)))
      } else if (e.key === 'Escape') {
        e.stopPropagation()
        setSelectedIds(EMPTY_SET)
        setTool('select')
      } else if (NUDGE_KEYS[e.key] !== undefined && ids.size && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Arrow keys move the selection together: 1px, or 10px with Shift
        e.preventDefault()
        e.stopPropagation()
        const [ux, uy] = NUDGE_KEYS[e.key] ?? [0, 0]
        const step = e.shiftKey ? 10 : 1
        updateShapes((prev) => translateShapes(prev, ids, ux * step, uy * step), { commit: true, merge: true })
      }
    }
    root.addEventListener('keydown', onKeyDown)
    return () => root.removeEventListener('keydown', onKeyDown)
  }, [isEditable, deleteSelection, duplicateSelection, startTextEditing, updateShapes])

  const applyToSelection = useCallback(
    (patch: (shape: DrawingShape) => DrawingShape, options?: { merge?: boolean }) => {
      const ids = selectedRef.current
      if (!ids.size) return
      updateShapes((prev) => prev.map((s) => (ids.has(s.id) ? patch(s) : s)), { commit: true, merge: options?.merge === true })
    },
    [updateShapes],
  )

  // One color setting: the preset's stroke, plus its fill on boxes
  const applyColor = useCallback(
    (name: ColorName) => {
      const preset = COLOR_PRESETS[name]
      setStroke(preset.stroke)
      setFill(preset.fill)
      // A preset sets the text colour too: it drops any custom one
      applyToSelection((s) =>
        isNodeShapeType(s.type)
          ? { ...omitFields(s, ['color']), stroke: preset.stroke, fill: preset.fill }
          : // Connectors and text have nothing but their stroke to show
            { ...omitFields(s, ['color']), stroke: preset.stroke === 'transparent' ? STROKE_COLORS[0] : preset.stroke },
      )
    },
    [applyToSelection],
  )

  // A pick in the native colour picker updates live; `continued` folds
  // the updates after the first into one undo step
  const applyCustomFill = useCallback(
    (color: string, continued: boolean) =>
      applyToSelection((s) => (isNodeShapeType(s.type) ? { ...s, fill: color } : s), { merge: continued }),
    [applyToSelection],
  )

  const applyCustomText = useCallback(
    (color: string, continued: boolean) =>
      applyToSelection((s) => (isNodeShapeType(s.type) || s.type === 'text' ? { ...s, color } : s), { merge: continued }),
    [applyToSelection],
  )

  const applyStrokeWidth = useCallback(
    (strokeWidth: number) => applyToSelection((s) => (s.type === 'text' ? s : { ...s, strokeWidth })),
    [applyToSelection],
  )

  const applyStrokeStyle = useCallback(
    (strokeStyle: StrokeStyle | undefined) =>
      applyToSelection((s) => {
        if (s.type === 'text') return s
        return strokeStyle === undefined ? omitFields(s, ['strokeStyle']) : { ...s, strokeStyle }
      }),
    [applyToSelection],
  )

  const applyCorners = useCallback(
    (sharp: boolean) =>
      applyToSelection((s) => {
        if (s.type !== 'rect') return s
        return sharp ? { ...s, corners: 'sharp' } : omitFields(s, ['corners'])
      }),
    [applyToSelection],
  )

  // `none` makes the connector a line; any head makes it an arrow
  const applyHead = useCallback(
    (head: HeadChoice) =>
      applyToSelection((s) => {
        if (!isConnectorType(s.type)) return s
        if (head === 'none') return { ...omitFields(s, ['head', 'bidirectional']), type: 'line' }
        const arrow: DrawingShape = { ...omitFields(s, ['head']), type: 'arrow' }
        return head === 'arrow' ? arrow : { ...arrow, head }
      }),
    [applyToSelection],
  )

  const applyRouting = useCallback(
    (elbow: boolean) =>
      applyToSelection((s) => {
        if (!isConnectorType(s.type)) return s
        const cleared = omitFields(s, ['routing', 'elbow', 'waypoints'])
        return elbow ? { ...cleared, routing: 'elbow' } : cleared
      }),
    [applyToSelection],
  )

  const applyDirection = useCallback(
    (bidirectional: boolean) =>
      applyToSelection((s) => {
        if (s.type !== 'arrow') return s
        return bidirectional ? { ...s, bidirectional: true } : omitFields(s, ['bidirectional'])
      }),
    [applyToSelection],
  )

  const applyWidth = useCallback(
    (next: BlockWidth) => {
      setWidth(next)
      commit(shapesRef.current, { width: next })
    },
    [commit],
  )

  const addWaypoint = useCallback(
    (e: ReactPointerEvent, shapeId: string, segmentIndex: number, point: Point) => {
      if (!isEditable || e.button !== 0) return
      e.stopPropagation()
      capture(e)
      updateShapes((prev) =>
        prev.map((s) => {
          if (s.id !== shapeId || !isConnectorType(s.type)) return s
          // Materialize the current path (including routed corners) as
          // explicit waypoints, with the new point inserted on its segment
          const interior = connectorPoints(s, prev).slice(1, -1)
          const waypoints = [...interior.slice(0, segmentIndex), point, ...interior.slice(segmentIndex)]
          return { ...omitFields(s, ['routing', 'elbow']), waypoints }
        }),
      )
      dragRef.current = { mode: 'waypoint', id: shapeId, index: segmentIndex }
    },
    [isEditable, updateShapes],
  )

  const removeWaypoint = useCallback(
    (shapeId: string, index: number) => {
      updateShapes(
        (prev) =>
          prev.map((s) => {
            if (s.id !== shapeId || !s.waypoints) return s
            const waypoints = s.waypoints.filter((_, i) => i !== index)
            return waypoints.length ? { ...s, waypoints } : omitFields(s, ['waypoints'])
          }),
        { commit: true },
      )
    },
    [updateShapes],
  )

  const commitText = useCallback(
    (id: string, field: TextField, value: string) => {
      setEditingText(null)
      setDraftText(null)
      // Keep keyboard shortcuts working once the textarea is gone
      rootRef.current?.focus({ preventScroll: true })
      updateShapes(
        (prev) =>
          prev.flatMap((s) => {
            if (s.id !== id) return [s]
            // Standalone text shapes ARE their text: empty deletes them
            if (s.type === 'text') {
              if (value.trim() === '') return []
              const size = linesSize(value.split('\n'), FONT_SIZE, textMeasureRef.current)
              return [{ ...s, text: value, width: size.w, height: size.h }]
            }
            return [grownToFitText(withText(s, field, value), textMeasureRef.current)]
          }),
        { commit: true },
      )
    },
    [updateShapes],
  )

  // What a commit of the current state would write, retained lines and all.
  const copyMermaid = useCallback(async () => {
    const written = writeSource(payloadOf(shapesRef.current))
    if (written === undefined) return false
    try {
      await navigator.clipboard.writeText(written)
      return true
    } catch {
      return false
    }
  }, [payloadOf, writeSource])


  // Real font widths for text wrapping once the surface has its font, and
  // again when web fonts finish loading (the fallback measures differently)
  const [textMeasure, setTextMeasure] = useState<TextMeasure | null>(null)
  const textMeasureRef = useRef(textMeasure)
  textMeasureRef.current = textMeasure
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = (): void => setTextMeasure(() => createTextMeasure(svg, ink ? INK_LETTER_SPACING_EM : 0))
    update()
    // A surface mounted hidden has no font to measure until it is shown
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (textMeasureRef.current === null) update()
          })
    observer?.observe(svg)
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    let live = true
    void fonts?.ready.then(() => live && update())
    fonts?.addEventListener?.('loadingdone', update)
    return () => {
      live = false
      observer?.disconnect()
      fonts?.removeEventListener?.('loadingdone', update)
    }
  }, [ink])

  // The text field's overlay, placed from the SVG's own user-space mapping
  // while one is open: the stage's padding and the surface's CSS placement
  // (a host that centres it) are then part of the offset, which the
  // computed one cannot see. Without layout (no size) it keeps that one.
  const [measuredOverlay, setMeasuredOverlay] = useState<OverlayMapping | null>(null)
  const isEditingText = editingText !== null
  useLayoutEffect(() => {
    const svg = svgRef.current
    const stage = stageRef.current
    if (!isEditingText || !svg || !stage) return
    const measure = (): void => {
      const next = svgToStage(svg, stage)
      setMeasuredOverlay((prev) =>
        prev !== null && next !== null && prev.x === next.x && prev.y === next.y && prev.scale === next.scale ? prev : next,
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [isEditingText, viewBox])
  const overlay = measuredOverlay ?? { ...overlayOffset, scale }

  // What the surface shows: while a box's text is being typed, the box
  // grows to fit it as it will on commit (and its connectors follow)
  const shownShapes = useMemo(() => {
    if (editingText === null || draftText === null) return shapes
    return resolveBindings(
      shapes.map((s) =>
        s.id === editingText.id ? grownToFitText(withText(s, editingText.field, draftText), textMeasure) : s,
      ),
    )
  }, [shapes, editingText, draftText, textMeasure])
  const shownPaths = useMemo(() => (shownShapes === shapes ? paths : computePaths(shownShapes)), [shownShapes, shapes, paths])
  const editingShape = shownShapes.find((s) => s.id === editingText?.id) ?? null
  const hoverBox = hoverBoxId ? shapes.find((s) => s.id === hoverBoxId) : null
  const propStroke = single?.stroke ?? selection[0]?.stroke ?? stroke
  const propFill = single?.fill ?? selection[0]?.fill ?? fill
  const canvasCursor: CSSProperties['cursor'] = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair'

  // The tool row, along the top edge or in the host's <DiagramToolbar>. A
  // detached row still belongs to the canvas: focus in it keeps the canvas
  // active (React events cross the portal, so the root's handlers hear
  // them) and `is-active` shows the property bar where `:focus-within`
  // no longer can.
  const toolbar = isEditable && (
    <div className={classes('rmk-diagram-toolbar', active && 'is-active', slot.detached && 'is-detached')} onPointerDown={(e) => e.stopPropagation()}>
      <DiagramToolbar
        tool={tool}
        onToolChange={(t) => {
          setTool(t)
          if (t !== 'select') setSelectedIds(EMPTY_SET)
        }}
        width={width}
        onWidthChange={applyWidth}
        onCopyMermaid={copyMermaid}
        properties={
          // Inline in the same row (so the stage never shifts); shown
          // only while the canvas has focus (see .rmk-diagram-props-host)
          <div className="rmk-diagram-props-host">
            <PropertyBar
              selection={selection}
              stroke={propStroke}
              fill={propFill}
              onColor={applyColor}
              onCustomFill={applyCustomFill}
              onCustomText={applyCustomText}
              onStrokeWidth={applyStrokeWidth}
              onStrokeStyle={applyStrokeStyle}
              onCorners={applyCorners}
              onHead={applyHead}
              onRouting={applyRouting}
              onDirection={applyDirection}
              onDuplicate={duplicateSelection}
              onDelete={deleteSelection}
            />
          </div>
        }
      />
    </div>
  )

  return (
    <TextMeasureContext.Provider value={textMeasure}>
    <div
      ref={rootRef}
      className={classes('rmk-diagram-canvas', WIDTH_CLASS[width], isEditable && 'is-editable', ink && 'is-ink')}
      tabIndex={isEditable ? 0 : undefined}
      onFocus={() => {
        setActive(true)
        host.onFocusChange(nodeKey)
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null
        if (rootRef.current?.contains(next) || slot.host?.contains(next)) return
        setActive(false)
        host.onFocusChange(null)
      }}
    >
      {!slot.detached ? toolbar : slot.host !== null && toolbar !== false ? createPortal(toolbar, slot.host) : null}

      <div ref={stageRef} className="rmk-diagram-stage">
        <svg
          ref={svgRef}
          className="rmk-diagram-surface"
          role="img"
          aria-label={data.title ?? labels.canvas}
          aria-description={data.description}
          style={{
            ...(logicalWidth ? { width: logicalWidth, aspectRatio: `${logicalWidth} / ${canvasHeight}` } : { height: canvasHeight }),
            maxWidth: '100%',
            cursor: canvasCursor,
          }}
          viewBox={viewBox}
          preserveAspectRatio={centered ? 'xMidYMid meet' : 'xMinYMin meet'}
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => {
            if (!isEditable) return
            const target = (e.target as Element).closest('[data-shape-id]')
            const id = target?.getAttribute('data-shape-id')
            const shape = id ? shapes.find((s) => s.id === id) : null
            if (!shape) return
            if (shape.type === 'text' || isConnectorType(shape.type)) {
              startTextEditing(shape.id, 'text')
            } else {
              startTextEditing(shape.id, slotAt(shape, getPoint(e).y))
            }
          }}
        >
          {shownShapes.map((shape) => (
            <g
              key={shape.id}
              data-shape-id={shape.id}
              className={classes('rmk-diagram-shape', selectedIds.has(shape.id) && 'is-selected')}
              style={isEditable && tool === 'select' ? { cursor: 'move' } : undefined}
              onPointerDown={(e) => handleShapePointerDown(e, shape)}
            >
              <HitArea shape={shape} points={shownPaths.get(shape.id)} />
              {shape.id === editingText?.id && shape.type === 'text' ? null : (
                <ShapeView
                  shape={shape}
                  ink={ink}
                  points={shownPaths.get(shape.id)}
                  hideField={shape.id === editingText?.id ? editingText.field : null}
                  showHints={isEditable && tool === 'select' && single?.id === shape.id && shape.id !== editingText?.id}
                />
              )}
            </g>
          ))}

          {hoverBox && (
            <polygon
              className="rmk-diagram-selection rmk-diagram-bind-target"
              points={nodeShapeOutline(hoverBox)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')}
              fill="currentColor"
              fillOpacity={0.06}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {single && isEditable && !editingText && (
            <SelectionOverlay
              shape={single}
              points={paths.get(single.id) ?? []}
              onHandlePointerDown={handleHandlePointerDown}
              onWaypointAdd={addWaypoint}
              onWaypointRemove={removeWaypoint}
            />
          )}
          {selection.length > 1 && isEditable && !editingText && (
            <GroupSelectionOverlay shapes={selection} paths={paths} onHandlePointerDown={handleGroupHandlePointerDown} />
          )}
          {marquee && <MarqueeOverlay rect={marqueeRect(marquee.origin, marquee.current)} />}
        </svg>

        {isEditable && shapes.length === 0 && (
          <div className="rmk-diagram-empty" aria-hidden="true">
            {labels.empty}
          </div>
        )}

        {editingShape && editingText && (
          <div
            className="rmk-diagram-overlay"
            style={{
              transform:
                overlay.x === 0 && overlay.y === 0
                  ? `scale(${overlay.scale})`
                  : `translate(${overlay.x}px, ${overlay.y}px) scale(${overlay.scale})`,
              ...(logicalWidth ? { width: logicalWidth, height: canvasHeight } : {}),
            }}
          >
            <TextEditOverlay
              key={`${editingShape.id}:${editingText.field}`}
              shape={editingShape}
              field={editingText.field}
              points={shownPaths.get(editingShape.id)}
              onChange={setDraftText}
              onCommit={commitText}
            />
          </div>
        )}

        {isEditable && host.chrome === 'block' && (
          <HeightHandle
            height={canvasHeight}
            scale={scale}
            onChange={setCanvasHeight}
            onCommit={(h) => commit(shapesRef.current, { height: h })}
          />
        )}
      </div>
    </div>
    </TextMeasureContext.Provider>
  )
}

function HeightHandle({
  height,
  scale,
  onChange,
  onCommit,
}: {
  height: number
  scale: number
  onChange: (height: number) => void
  onCommit: (height: number) => void
}): ReactElement {
  const dragRef = useRef<{ startY: number; orig: number } | null>(null)
  const latestRef = useRef(height)
  latestRef.current = height
  const clamp = (h: number): number => Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h)))
  const title = useDiagramLabels().resize
  return (
    <div
      className="rmk-diagram-resize"
      title={title}
      role="separator"
      aria-orientation="horizontal"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = { startY: e.clientY, orig: height }
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current
        if (!drag) return
        onChange(clamp(drag.orig + (e.clientY - drag.startY) / Math.max(scale, 0.05)))
      }}
      onPointerUp={() => {
        if (!dragRef.current) return
        dragRef.current = null
        onCommit(latestRef.current)
      }}
    >
      <Icon size={14}>{UI_ICONS.grip}</Icon>
    </div>
  )
}
