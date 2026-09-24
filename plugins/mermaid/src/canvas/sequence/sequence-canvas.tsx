/**
 * The sequence canvas (docs/MERMAID_PLATFORM.md section 9.5): the block's
 * `sequenceDiagram` editor, written to the `DiagramKindEditorProps`
 * contract like the flowchart canvas. The picture is the kind's own static
 * render of the section 8.3 layout, drawn through `hast-util-to-jsx-runtime`,
 * so what is edited is exactly what a reader sees; an SVG interaction layer
 * with the same viewBox sits on top and reads the layout's hit geometry.
 * Pointer positions go through the layer's screen matrix, so the maths
 * stays exact under a host's zoom transform.
 *
 * Every gesture is one pure operation of `core/sequence/operations.ts` on
 * the local model. The result is written with the kind's `write` and the
 * lines the parser read through, and handed to the block's `commit`; the
 * model that written text parses to becomes the local model, so the picture
 * always equals the document, and its serialisation is remembered so the
 * block's echo of the commit never resets a selection. A structural change
 * is one history entry; an inline label edit commits on every keystroke
 * with `merge`, so a burst of typing undoes as one step under the block's
 * 300 ms rule, and Escape takes the burst back through Lexical's undo, so
 * a cancelled edit leaves no entry behind. The block owns the lossy lock:
 * with `readOnly` the canvas draws the picture and nothing else.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { FONT_SIZE, LINE_HEIGHT, SMALL_FONT_SIZE, type Point } from '../../core/drawing-data.js'
import { textBoxSize, type Rect } from '../../core/geometry.js'
import type { DiagramKind } from '../../core/kind.js'
import {
  columnAt,
  columnRect,
  frameTabWidth,
  insertionAt,
  layoutSequence,
  sectionRect,
  SEQUENCE_METRICS,
  type LayoutFrame,
  type LayoutMessage,
  type SequenceLayout,
} from '../../core/sequence/layout.js'
import { flattenItems, type SequenceModel } from '../../core/sequence/model.js'
import {
  addMessage,
  addNote,
  addParticipant,
  addSection,
  areSiblings,
  extendFrame,
  frameNeighbours,
  removeItem,
  removeParticipant,
  renameParticipant,
  reorderItem,
  reorderParticipant,
  setActivation,
  setMessageStyle,
  setNotePlacement,
  setNumbering,
  setParticipantKind,
  setSectionLabel,
  setText,
  siblingRange,
  swapEnds,
  unwrapFrame,
  wrapInFrame,
  type FrameKind,
  type Insertion,
  type RenameParticipantOptions,
} from '../../core/sequence/operations.js'
import { parseDiagramSource } from '../../extension.js'
import { isControlKey } from '../drawing-canvas.js'
import { CLICK_TOLERANCE } from '../interaction.js'
import { useCanvasHost, useDiagramLabels } from '../host.js'
import type { DiagramKindEditorProps } from '../options.js'
import { gapAt, hitAt, insertionPointY, insertionY, itemRect, rowAtY, sameInsertion } from './hit.js'
import { LabelOverlay } from './label-overlay.js'
import { selectionRange, type SequenceEditing, type SequenceSelection } from './selection.js'
import { SequencePropertyBar, type SequencePropertyActions } from './sequence-property-bar.js'
import { SequenceToolbar } from './sequence-toolbar.js'
import { useToolbarHost } from '../toolbar-slot.js'

const M = SEQUENCE_METRICS
const LINE_H = FONT_SIZE * LINE_HEIGHT
/** The block's rule: a commit this close to the previous one merges into its history entry when asked. */
const HISTORY_MERGE_WINDOW = 300

type Drag =
  | { readonly mode: 'column'; readonly column: number; readonly origin: Point; readonly target: number; readonly moved: boolean }
  | { readonly mode: 'row'; readonly index: number; readonly origin: Point; readonly row: number; readonly moved: boolean }
  | { readonly mode: 'draw'; readonly column: number; readonly origin: Point; readonly current: Point; readonly target: number | undefined; readonly at: Insertion }
  | { readonly mode: 'extend'; readonly index: number; readonly origin: Point; readonly current: Point; readonly delta: number }

interface Gap {
  readonly column: number
  readonly at: Insertion
}

/**
 * The commits of one inline edit: the model shown before the first, the
 * history entries the commits made under the block's 300 ms rule
 * (mirrored here from the same clock) and when the last one was.
 */
interface EditBurst {
  readonly start: SequenceModel
  entries: number
  lastAt: number
}

function classes(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ')
}

function serialize(model: SequenceModel): string {
  return JSON.stringify(model)
}

function moved(origin: Point, current: Point): boolean {
  return Math.abs(current.x - origin.x) > CLICK_TOLERANCE || Math.abs(current.y - origin.y) > CLICK_TOLERANCE
}

/** The column whose box the point is over horizontally, for dropping a drawn message on it. */
function dropColumn(layout: SequenceLayout, x: number): number | undefined {
  const column = columnAt(layout, x)
  const c = layout.columns[column]
  return c !== undefined && Math.abs(c.x - x) <= c.width / 2 ? column : undefined
}

/** The `extendFrame` delta a pointer at `y` asks for: siblings above it join, items of the last section below it leave. */
function extendDelta(model: SequenceModel, layout: SequenceLayout, index: number, y: number): number {
  const { following, lastSection } = frameNeighbours(model, index)
  const joining = following.filter((row) => (layout.rows[row] ?? Number.POSITIVE_INFINITY) < y).length
  if (joining > 0) return joining
  return -lastSection.filter((row) => (layout.rows[row] ?? Number.NEGATIVE_INFINITY) > y).length
}

export function SequenceCanvas({ nodeKey, kind, parse, readOnly, commit: commitSource }: DiagramKindEditorProps): ReactElement {
  const host = useCanvasHost()
  const options = host.options
  const labels = useDiagramLabels()
  const editable = !readOnly
  const incoming = parse.model as SequenceModel
  const { retained } = parse

  const [model, setModel] = useState<SequenceModel>(incoming)
  const modelRef = useRef(model)
  const [selection, setSelection] = useState<SequenceSelection | null>(null)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const [editing, setEditing] = useState<SequenceEditing | null>(null)
  const editingRef = useRef(editing)
  editingRef.current = editing
  /** Set once the current inline edit has committed a change: later ones merge into it, never into the entry before. */
  const editBurstRef = useRef<EditBurst | null>(null)
  /** The rename options for the participant edit that is open, decided when it opened. */
  const renameRef = useRef<RenameParticipantOptions | undefined>(undefined)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [gap, setGap] = useState<Gap | null>(null)
  const [scale, setScale] = useState(1)
  /** Focus is in the canvas or in its tool row, wherever that row renders. */
  const [active, setActive] = useState(false)
  const slot = useToolbarHost(host.scope, nodeKey, editable, active)
  const lastCommittedRef = useRef(serialize(incoming))
  const kindRef = useRef(kind as DiagramKind<SequenceModel>)
  kindRef.current = kind as DiagramKind<SequenceModel>
  const retainedRef = useRef(retained)
  retainedRef.current = retained
  const optionsRef = useRef(options)
  optionsRef.current = options

  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<SVGSVGElement>(null)

  const layout = useMemo(() => layoutSequence(model), [model])

  // A centred canvas (`align: 'center'`) fits a picture taller than the
  // room its viewport gives it: the stage takes the width at which the
  // picture's own proportions meet the viewport's content height, measured
  // untransformed. Where the picture sits in that room is the host's CSS.
  const centered = options.align === 'center'
  const [room, setRoom] = useState<{ readonly w: number; readonly h: number } | null>(null)
  useEffect(() => {
    const viewport = viewportRef.current
    if (!centered || !viewport || typeof ResizeObserver === 'undefined') {
      setRoom(null)
      return
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect
      if (box !== undefined && box.width > 0 && box.height > 0) setRoom({ w: box.width, h: box.height })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [centered])
  const stageWidth =
    room !== null && layout.height > room.h ? Math.min(layout.width, Math.floor((layout.width * room.h) / layout.height)) : layout.width
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // An undo, a text edit or a collaborator changed the node: adopt it and
  // drop the selection. The block's echo of this canvas's own commit is
  // what it last remembered and changes nothing.
  useEffect(() => {
    const next = serialize(incoming)
    if (next === lastCommittedRef.current) return
    lastCommittedRef.current = next
    modelRef.current = incoming
    setModel(incoming)
    setSelection(null)
    setEditing(null)
    editBurstRef.current = null
  }, [incoming])

  // The HTML overlay (the inline field) scales with the picture. The stage
  // is measured untransformed (`offsetWidth`, never a client rect): the
  // overlay sits inside any zoom transform a host puts around the editor,
  // so that transform must not scale it a second time.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') {
      setScale(1)
      return
    }
    const update = (): void => {
      const width = stage.offsetWidth
      setScale(width > 0 ? width / layout.width : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [layout.width])

  const picture = useMemo<ReactNode>(() => {
    const render = kind.render
    if (render === undefined) return null
    return toJsxRuntime(render(model, { fallbackTitle: options.fallbackTitle }), { Fragment, jsx, jsxs, passKeys: true })
  }, [kind, model, options.fallbackTitle])

  /**
   * Commits a model: writes it, remembers what the written text parses to
   * (that is what comes back as the parse) and shows that same model.
   */
  const apply = useCallback(
    (next: SequenceModel, commitOptions?: { readonly merge?: boolean }): SequenceModel => {
      if (next === modelRef.current) return next
      const write = kindRef.current.write
      if (write === undefined) return modelRef.current
      const written = write(next, { retained: retainedRef.current })
      const reparsed = parseDiagramSource(optionsRef.current.kinds, kindRef.current.name, written)
      const shown = reparsed !== undefined && !('error' in reparsed) ? (reparsed.model as SequenceModel) : next
      lastCommittedRef.current = serialize(shown)
      modelRef.current = shown
      setModel(shown)
      commitSource(written, commitOptions)
      return shown
    },
    [commitSource],
  )

  const getPoint = useCallback((e: { clientX: number; clientY: number }): Point => {
    const svg = layerRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null
    if (!ctm) {
      const rect = svg.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const inverse = ctm.inverse()
    return { x: inverse.a * e.clientX + inverse.c * e.clientY + inverse.e, y: inverse.b * e.clientX + inverse.d * e.clientY + inverse.f }
  }, [])

  const capture = (e: ReactPointerEvent): void => {
    const svg = layerRef.current
    if (svg && typeof svg.setPointerCapture === 'function') svg.setPointerCapture(e.pointerId)
  }

  const updateDrag = (next: Drag | null): void => {
    dragRef.current = next
    setDrag(next)
  }

  const focusRoot = (): void => rootRef.current?.focus({ preventScroll: true })

  /**
   * Opens a participant's label for editing. Whether the id follows the
   * label is decided here, once: the edit commits every keystroke, and a
   * decision per keystroke would stop following as soon as an intermediate
   * label was taken or a keyword.
   */
  const editParticipant = (column: number): void => {
    const participant = modelRef.current.participants[column]
    renameRef.current = participant === undefined ? undefined : { follow: participant.label === participant.id, originalId: participant.id }
    setEditing({ target: 'participant', column })
  }

  /**
   * Selects an item where an operation's result put it. The index is read
   * off the operation's own model, since what `apply` then shows is the
   * reparse of the written text, same rows but new objects.
   */
  const selectItemOf = (next: SequenceModel, item: SequenceModel['items'][number] | undefined, section?: number): void => {
    const index = item === undefined ? -1 : flattenItems(next.items).indexOf(item)
    setSelection(index < 0 ? null : section === undefined ? { kind: 'item', index } : { kind: 'item', index, section })
  }

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (!editable || editingRef.current || e.button !== 0) return
    const point = getPoint(e)
    const current = layoutRef.current
    const hit = hitAt(current, point.x, point.y)
    capture(e)
    setGap(null)
    if (hit === undefined) {
      setSelection(null)
      return
    }
    switch (hit.kind) {
      case 'participant':
        setSelection({ kind: 'participant', column: hit.column })
        updateDrag({ mode: 'column', column: hit.column, origin: point, target: hit.column, moved: false })
        return
      case 'message':
      case 'note': {
        const previous = selectionRef.current
        if (e.shiftKey && previous !== null && previous.kind === 'item' && areSiblings(modelRef.current, previous.anchor ?? previous.index, hit.index)) {
          setSelection({ kind: 'item', index: hit.index, anchor: previous.anchor ?? previous.index })
          return
        }
        setSelection({ kind: 'item', index: hit.index })
        updateDrag({ mode: 'row', index: hit.index, origin: point, row: hit.index, moved: false })
        return
      }
      case 'section':
        setSelection({ kind: 'item', index: hit.index, section: hit.section })
        return
      case 'frame-bottom':
        setSelection({ kind: 'item', index: hit.index })
        updateDrag({ mode: 'extend', index: hit.index, origin: point, current: point, delta: 0 })
        return
      case 'lifeline':
        setSelection(null)
        updateDrag({ mode: 'draw', column: hit.column, origin: point, current: point, target: undefined, at: insertionAt(current, point.y) })
        return
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (!editable || editingRef.current) return
    const point = getPoint(e)
    const current = layoutRef.current
    const active = dragRef.current
    if (active === null) {
      const next = gapAt(current, point.x, point.y)
      setGap((previous) => (previous !== null && next !== undefined && previous.column === next.column && sameInsertion(previous.at, next.at) ? previous : (next ?? null)))
      return
    }
    switch (active.mode) {
      case 'column':
        updateDrag({ ...active, target: columnAt(current, point.x), moved: active.moved || moved(active.origin, point) })
        return
      case 'row':
        updateDrag({ ...active, row: rowAtY(current, point.y), moved: active.moved || moved(active.origin, point) })
        return
      case 'draw':
        updateDrag({ ...active, current: point, target: dropColumn(current, point.x) })
        return
      case 'extend':
        updateDrag({ ...active, current: point, delta: extendDelta(modelRef.current, current, active.index, point.y) })
        return
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const active = dragRef.current
    updateDrag(null)
    if (active === null) return
    const point = getPoint(e)
    const model = modelRef.current
    switch (active.mode) {
      case 'column': {
        if (!active.moved) return
        const participant = model.participants[active.column]
        if (participant === undefined) return
        const shown = apply(reorderParticipant(model, participant.id, columnAt(layoutRef.current, point.x)))
        const column = shown.participants.findIndex((p) => p.id === participant.id)
        setSelection(column < 0 ? null : { kind: 'participant', column })
        return
      }
      case 'row': {
        if (!active.moved) return
        const item = flattenItems(model.items)[active.index]
        const next = reorderItem(model, active.index, rowAtY(layoutRef.current, point.y))
        apply(next)
        selectItemOf(next, item)
        return
      }
      case 'draw': {
        // A click on a lifeline selects nothing; a message needs a drag.
        if (!moved(active.origin, point)) return
        const target = dropColumn(layoutRef.current, point.x)
        const from = model.participants[active.column]
        const to = target === undefined ? undefined : model.participants[target]
        if (from === undefined || to === undefined) return
        const added = addMessage(model, from.id, to.id, active.at)
        apply(added.model)
        setSelection({ kind: 'item', index: added.index })
        setEditing({ target: 'item', index: added.index })
        return
      }
      case 'extend': {
        if (active.delta === 0) return
        const item = flattenItems(model.items)[active.index]
        const next = extendFrame(model, active.index, active.delta)
        apply(next)
        selectItemOf(next, item)
        return
      }
    }
  }

  const handleDoubleClick = (e: ReactPointerEvent<SVGSVGElement> | { clientX: number; clientY: number }): void => {
    if (!editable) return
    const point = getPoint(e)
    const hit = hitAt(layoutRef.current, point.x, point.y)
    if (hit === undefined) return
    if (hit.kind === 'participant') {
      setSelection({ kind: 'participant', column: hit.column })
      editParticipant(hit.column)
    } else if (hit.kind === 'message' || hit.kind === 'note') {
      setSelection({ kind: 'item', index: hit.index })
      setEditing({ target: 'item', index: hit.index })
    } else if (hit.kind === 'section') {
      setSelection({ kind: 'item', index: hit.index, section: hit.section })
      setEditing({ target: 'section', index: hit.index, section: hit.section })
    }
  }

  const editSelection = useCallback((): void => {
    const current = selectionRef.current
    if (current === null) return
    if (current.kind === 'participant') {
      editParticipant(current.column)
      return
    }
    const item = flattenItems(modelRef.current.items)[current.index]
    if (item === undefined) return
    setEditing(item.type === 'frame' ? { target: 'section', index: current.index, section: current.section ?? 0 } : { target: 'item', index: current.index })
  }, [])

  const deleteSelection = useCallback((): void => {
    const current = selectionRef.current
    const model = modelRef.current
    if (current === null) return
    setEditing(null)
    setSelection(null)
    if (current.kind === 'participant') {
      const participant = model.participants[current.column]
      if (participant !== undefined) apply(removeParticipant(model, participant.id))
      return
    }
    apply(removeItem(model, current.index))
  }, [apply])

  // Native listener: the keys are handled (and stopped) before they bubble
  // to Lexical's root, which owns the same keys for the document. A key on
  // one of the canvas's own controls is that control's.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !editable) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (editingRef.current || isControlKey(e, root)) return
      const current = selectionRef.current
      if ((e.key === 'Delete' || e.key === 'Backspace') && current !== null) {
        e.preventDefault()
        e.stopPropagation()
        deleteSelection()
      } else if (e.key === 'Enter' && current !== null) {
        e.preventDefault()
        e.stopPropagation()
        editSelection()
      } else if (e.key === 'Escape') {
        e.stopPropagation()
        setSelection(null)
      }
    }
    root.addEventListener('keydown', onKeyDown)
    return () => root.removeEventListener('keydown', onKeyDown)
  }, [editable, deleteSelection, editSelection])

  const addNoteAt = (at: Gap): void => {
    const model = modelRef.current
    const participant = model.participants[at.column]
    if (participant === undefined) return
    const added = addNote(model, participant.id, at.at)
    apply(added.model)
    setGap(null)
    setSelection({ kind: 'item', index: added.index })
    setEditing({ target: 'item', index: added.index })
  }

  /** Applies an operation to the selected item; the selection follows the item, or stays put when the operation rebuilt it in place. */
  const withSelectedItem = (fn: (model: SequenceModel, index: number) => SequenceModel): void => {
    const current = selectionRef.current
    if (current === null || current.kind !== 'item') return
    const model = modelRef.current
    const item = flattenItems(model.items)[current.index]
    const next = fn(model, current.index)
    if (next === model) return
    apply(next)
    const moved = item === undefined ? -1 : flattenItems(next.items).indexOf(item)
    const index = moved < 0 ? current.index : moved
    setSelection(current.section === undefined ? { kind: 'item', index } : { kind: 'item', index, section: current.section })
  }

  const actions: SequencePropertyActions = {
    onParticipantKind: (participantKind) => {
      const current = selectionRef.current
      if (current === null || current.kind !== 'participant') return
      const participant = modelRef.current.participants[current.column]
      if (participant !== undefined) apply(setParticipantKind(modelRef.current, participant.id, participantKind))
    },
    onLine: (line) => withSelectedItem((model, index) => setMessageStyle(model, index, { line })),
    onHead: (head) => withSelectedItem((model, index) => setMessageStyle(model, index, { head })),
    onTwoWay: (bidirectional) => withSelectedItem((model, index) => setMessageStyle(model, index, { bidirectional })),
    onActivation: (suffix) => withSelectedItem((model, index) => setActivation(model, index, suffix)),
    onSwapEnds: () => withSelectedItem((model, index) => swapEnds(model, index)),
    onNotePlacement: (placement, second) => withSelectedItem((model, index) => setNotePlacement(model, index, placement, second)),
    onWrap: (frameKind: FrameKind) => {
      const current = selectionRef.current
      if (current === null || current.kind !== 'item') return
      const range = selectionRange(current)
      if (range === undefined) return
      const wrapped = wrapInFrame(modelRef.current, range[0], range[1], frameKind)
      if (wrapped === undefined) return
      apply(wrapped.model)
      setSelection({ kind: 'item', index: wrapped.index, section: 0 })
      setEditing({ target: 'section', index: wrapped.index, section: 0 })
    },
    onAddSection: () => {
      const current = selectionRef.current
      if (current === null || current.kind !== 'item') return
      const model = modelRef.current
      const frame = flattenItems(model.items)[current.index]
      if (frame === undefined || frame.type !== 'frame') return
      const after = current.section ?? frame.sections.length - 1
      const shown = apply(addSection(model, current.index, after))
      if (shown === model) return
      setSelection({ kind: 'item', index: current.index, section: after + 1 })
      setEditing({ target: 'section', index: current.index, section: after + 1 })
    },
    onUnwrap: () => {
      const current = selectionRef.current
      if (current === null || current.kind !== 'item') return
      setSelection(null)
      apply(unwrapFrame(modelRef.current, current.index))
    },
    onDelete: deleteSelection,
  }

  const addNewParticipant = (participantKind: 'participant' | 'actor'): void => {
    const added = addParticipant(modelRef.current, participantKind)
    const shown = apply(added.model)
    const column = shown.participants.findIndex((p) => p.id === added.id)
    setSelection(column < 0 ? null : { kind: 'participant', column })
    focusRoot()
  }

  const copyMermaid = async (): Promise<boolean> => {
    const written = kindRef.current.write?.(modelRef.current, { retained: retainedRef.current })
    if (written === undefined) return false
    try {
      await navigator.clipboard.writeText(written)
      return true
    } catch {
      return false
    }
  }

  // The first change of an inline edit is a new history entry, so it never
  // folds into the structural change that opened the field; the rest of
  // the burst merges into it under the block's 300 ms rule. The entries
  // the burst makes are counted here by the same rule, for a cancel.
  const onEditChange = (value: string): void => {
    const target = editingRef.current
    const model = modelRef.current
    if (target === null) return
    const next =
      target.target === 'participant'
        ? renameOf(model, target.column, value, renameRef.current)
        : target.target === 'item'
          ? setText(model, target.index, value)
          : setSectionLabel(model, target.index, target.section, value)
    if (next === model) return
    const now = Date.now()
    const burst = editBurstRef.current
    if (burst === null) {
      editBurstRef.current = { start: model, entries: 1, lastAt: now }
      apply(next)
      return
    }
    if (now - burst.lastAt >= HISTORY_MERGE_WINDOW) burst.entries += 1
    burst.lastAt = now
    apply(next, { merge: true })
  }

  /**
   * Escape: the burst's entries are undone, so the document, the picture
   * and the history are as they were when the field opened, and nothing
   * is committed. The undo's echo is what this canvas remembers, so the
   * selection survives; with nothing typed there is nothing to take back.
   */
  const cancelEdit = (): void => {
    const burst = editBurstRef.current
    if (burst === null) return
    modelRef.current = burst.start
    lastCommittedRef.current = serialize(burst.start)
    setModel(burst.start)
    for (let i = 0; i < burst.entries; i += 1) host.undo()
  }

  const onEditFinish = (cancelled: boolean): void => {
    if (cancelled) cancelEdit()
    editBurstRef.current = null
    renameRef.current = undefined
    setEditing(null)
    focusRoot()
  }

  const field = editing === null ? null : editField(layout, model, editing, labels)
  const range = selection !== null && selection.kind === 'item' ? siblingRange(model, selection.anchor ?? selection.index, selection.index) : []

  // The tool row, along the top edge or in the host's <DiagramToolbar>; as
  // on the flowchart canvas, a detached row keeps the canvas active and
  // `is-active` shows the property bar where `:focus-within` cannot.
  const toolbar = editable && (
    <div className={classes('rmk-diagram-toolbar', active && 'is-active', slot.detached && 'is-detached')} onPointerDown={(e) => e.stopPropagation()}>
      <SequenceToolbar
        numbering={model.numbering !== undefined}
        onAddParticipant={() => addNewParticipant('participant')}
        onAddActor={() => addNewParticipant('actor')}
        onNumbering={(on) => apply(setNumbering(modelRef.current, on))}
        onCopyMermaid={copyMermaid}
        properties={
          <div className="rmk-diagram-props-host">
            <SequencePropertyBar model={model} selection={selection} actions={actions} />
          </div>
        }
      />
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={classes('rmk-diagram-canvas', 'rmk-sequence-canvas', editable && 'is-editable')}
      tabIndex={editable ? 0 : undefined}
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

      <div ref={viewportRef} className="rmk-sequence-viewport">
        <div ref={stageRef} className="rmk-diagram-stage rmk-sequence-stage" style={{ width: stageWidth, maxWidth: '100%' }}>
          <div className="rmk-sequence-picture" aria-label={model.title ?? labels.sequenceCanvas}>
            {picture}
          </div>

          {editable && (
            <svg
              ref={layerRef}
              className="rmk-sequence-layer"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              preserveAspectRatio="xMinYMin meet"
              aria-hidden="true"
              focusable="false"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={() => {
                if (dragRef.current === null) setGap(null)
              }}
              onDoubleClick={handleDoubleClick}
            >
              <rect className="rmk-sequence-hit" x={0} y={0} width={layout.width} height={layout.height} fill="transparent" />
              {selection !== null && !editing && <SelectionOutline layout={layout} selection={selection} range={range} />}
              {drag !== null && <DragFeedback layout={layout} drag={drag} />}
              {gap !== null && drag === null && !editing && (
                <AddNoteAffordance layout={layout} gap={gap} label={labels.addNote} onAdd={() => addNoteAt(gap)} />
              )}
            </svg>
          )}

          {field !== null && editing !== null && (
            <div className="rmk-diagram-overlay" style={{ transform: `scale(${scale})`, width: layout.width, height: layout.height }}>
              <LabelOverlay
                key={editingKey(editing)}
                rect={field.rect}
                value={field.value}
                fontSize={field.fontSize}
                align={field.align}
                placeholder={field.placeholder}
                onChange={onEditChange}
                onFinish={onEditFinish}
              />
            </div>
          )}
        </div>

        {editable && model.participants.length === 0 && (
          <div className="rmk-diagram-empty" aria-hidden="true">
            {labels.sequenceEmpty}
          </div>
        )}
      </div>
    </div>
  )
}

function renameOf(model: SequenceModel, column: number, label: string, options: RenameParticipantOptions | undefined): SequenceModel {
  const participant = model.participants[column]
  return participant === undefined ? model : renameParticipant(model, participant.id, label, options)
}

function editingKey(editing: SequenceEditing): string {
  return editing.target === 'participant' ? `participant:${editing.column}` : editing.target === 'item' ? `item:${editing.index}` : `section:${editing.index}:${editing.section}`
}

interface EditField {
  readonly rect: Rect
  readonly value: string
  readonly fontSize: number
  readonly align: 'start' | 'center'
  readonly placeholder: string
}

/** Where the inline field sits for the label being edited, on the current layout. */
function editField(layout: SequenceLayout, model: SequenceModel, editing: SequenceEditing, labels: ReturnType<typeof useDiagramLabels>): EditField | null {
  if (editing.target === 'participant') {
    const column = layout.columns[editing.column]
    const participant = model.participants[editing.column]
    if (column === undefined || participant === undefined) return null
    const box = columnRect(column)
    const h = Math.max(1, participant.label.split('\n').length) * LINE_H + 4
    return {
      rect: { x: box.x + 4, y: box.y + box.h - M.participantHeight / 2 - h / 2, w: box.w - 8, h },
      value: participant.label,
      fontSize: FONT_SIZE,
      align: 'center',
      placeholder: labels.labelPlaceholder,
    }
  }
  if (editing.target === 'item') {
    const message = layout.messages.find((m) => m.index === editing.index)
    if (message !== undefined) return messageField(message, labels.textPlaceholder)
    const note = layout.notes.find((n) => n.index === editing.index)
    if (note === undefined) return null
    return {
      rect: { x: note.x + 2, y: note.y + 2, w: Math.max(note.width - 4, M.noteMinWidth), h: note.height - 4 },
      value: note.note.text,
      fontSize: FONT_SIZE,
      align: 'center',
      placeholder: labels.textPlaceholder,
    }
  }
  const frame = layout.frames.find((f) => f.index === editing.index)
  if (frame === undefined) return null
  return sectionField(frame, editing.section, labels.frameLabelPlaceholder)
}

function messageField(message: LayoutMessage, placeholder: string): EditField {
  const text = message.message.text
  const size = textBoxSize(text || ' ')
  const lines = Math.max(1, message.lines.length)
  const h = lines * LINE_H + 2
  if (message.self) {
    const x = message.fromX + M.selfLoopWidth + M.textPad / 2
    return { rect: { x, y: message.y + M.selfLoopHeight / 2 - h / 2, w: Math.max(120, size.w + 20), h }, value: text, fontSize: FONT_SIZE, align: 'start', placeholder }
  }
  const cx = (message.fromX + message.toX) / 2
  const w = Math.max(120, size.w + 20)
  return { rect: { x: cx - w / 2, y: message.y - 6 - h + 4, w, h }, value: text, fontSize: FONT_SIZE, align: 'center', placeholder }
}

function sectionField(frame: LayoutFrame, section: number, placeholder: string): EditField | null {
  const current = frame.sections[section]
  if (current === undefined) return null
  const strip = sectionRect(frame, section)
  const offset = frame.frame.kind === 'rect' ? 8 : section === 0 ? frameTabWidth(frame.frame.kind) + 8 : 8
  const h = SMALL_FONT_SIZE * LINE_HEIGHT + 2
  return {
    rect: { x: frame.x + offset, y: strip.y + strip.h / 2 - h / 2, w: Math.max(80, Math.min(frame.width - offset - 4, 240)), h },
    value: current.label,
    fontSize: SMALL_FONT_SIZE,
    align: 'start',
    placeholder,
  }
}

function SelectionOutline({ layout, selection, range }: { layout: SequenceLayout; selection: SequenceSelection; range: readonly number[] }): ReactElement | null {
  if (selection.kind === 'participant') {
    const column = layout.columns[selection.column]
    if (column === undefined) return null
    const box = columnRect(column)
    return <OutlineRect rect={box} pad={4} />
  }
  const rects = range.map((index) => itemRect(layout, index)).filter((rect): rect is Rect => rect !== undefined)
  if (rects.length === 0) return null
  return (
    <g className="rmk-diagram-selection">
      {rects.map((rect, i) => (
        <OutlineRect key={i} rect={rect} pad={3} />
      ))}
    </g>
  )
}

function OutlineRect({ rect, pad }: { rect: Rect; pad: number }): ReactElement {
  return (
    <rect
      className="rmk-diagram-selection rmk-sequence-outline"
      x={rect.x - pad}
      y={rect.y - pad}
      width={rect.w + pad * 2}
      height={rect.h + pad * 2}
      rx={4}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeDasharray="5 4"
      pointerEvents="none"
    />
  )
}

function DragFeedback({ layout, drag }: { layout: SequenceLayout; drag: Drag }): ReactElement | null {
  const stroke = { stroke: 'currentColor', strokeWidth: 1.5, pointerEvents: 'none' as const }
  switch (drag.mode) {
    case 'column': {
      if (!drag.moved) return null
      const column = layout.columns[drag.target]
      if (column === undefined) return null
      const box = columnRect(column)
      return <rect className="rmk-diagram-selection rmk-sequence-drop" x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill="currentColor" fillOpacity={0.12} {...stroke} />
    }
    case 'row': {
      if (!drag.moved) return null
      const y = insertionY(layout, drag.row)
      return <line className="rmk-diagram-selection rmk-sequence-drop" x1={M.margin} y1={y} x2={layout.width - M.margin} y2={y} strokeDasharray="4 3" {...stroke} />
    }
    case 'draw': {
      const from = layout.columns[drag.column]
      if (from === undefined) return null
      const y = insertionPointY(layout, drag.at)
      const target = drag.target === undefined ? undefined : layout.columns[drag.target]
      return (
        <g className="rmk-diagram-selection rmk-sequence-drop">
          <line x1={from.x} y1={y} x2={target?.x ?? drag.current.x} y2={y} strokeDasharray="4 3" {...stroke} />
          {target !== undefined && <line x1={target.x} y1={layout.lifelineTop} x2={target.x} y2={layout.lifelineBottom} strokeOpacity={0.5} {...stroke} />}
        </g>
      )
    }
    case 'extend': {
      const frame = layout.frames.find((f) => f.index === drag.index)
      if (frame === undefined) return null
      return <line className="rmk-diagram-selection rmk-sequence-drop" x1={frame.x} y1={drag.current.y} x2={frame.x + frame.width} y2={drag.current.y} strokeDasharray="4 3" {...stroke} />
    }
  }
}

function AddNoteAffordance({ layout, gap, label, onAdd }: { layout: SequenceLayout; gap: Gap; label: string; onAdd: () => void }): ReactElement | null {
  const column = layout.columns[gap.column]
  if (column === undefined) return null
  const y = insertionPointY(layout, gap.at)
  return (
    <g
      className="rmk-diagram-selection rmk-sequence-add-note"
      transform={`translate(${column.x} ${y})`}
      style={{ cursor: 'copy' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        e.preventDefault()
        onAdd()
      }}
    >
      <title>{label}</title>
      <circle className="rmk-diagram-handle" r={8} strokeWidth={1.5} />
      <path d="M-4 0h8M0 -4v8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  )
}
