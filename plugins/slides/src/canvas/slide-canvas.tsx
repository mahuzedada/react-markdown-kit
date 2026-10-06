/**
 * `<SlideCanvas>`: a deck as a slide editor. The current slide fills a
 * canvas, every slide is a thumbnail in a strip (or a grid) below it, and
 * double-clicking a block edits its text in place. The deck stays one Markdown
 * string: every edit is a splice of `value`, reported through `onChange`.
 *
 * Pass a preset holding `slides()` from `@react-markdown-kit/slides/editor`
 * so the inline editor knows the slide syntax inside a slide (`--`,
 * `::right::`, directives); the canvas renders the deck with the same
 * preset. Without `onChange` the canvas is a viewer.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { Markdown, compileMarkdown, type MarkdownExtension, type MarkdownPreset } from '@react-markdown-kit/renderer'
import type { MarkdownEditorInstance } from '@react-markdown-kit/editor'
import { CanvasArticle } from './canvas-article.js'
import { CanvasContext, type CanvasState, type CanvasView, type CanvasZoom, type EditRequest, type SourceAccess } from './context.js'
import { duplicateSlide, insertSlide, moveSlide, removeSlide, moveBlock } from './edits.js'
import { SLIDE_CANVAS_LABELS, type SlideCanvasLabels } from './labels.js'
import { outlineDeck, type DeckOutline, type SourceSpan } from './outline.js'
import { useSourceHistory } from './use-source-history.js'

export interface SlideCanvasProps {
  /** The deck's Markdown */
  readonly value: string
  /** Every edit, as the whole deck. Without it the canvas only views. */
  readonly onChange?: (value: string) => void
  readonly preset?: MarkdownPreset
  readonly extensions?: readonly MarkdownExtension[]
  /** The current slide, zero-based, when the host controls it */
  readonly index?: number
  readonly defaultIndex?: number
  /** A new current slide, with where it sits in `value` */
  readonly onIndexChange?: (index: number, span: SourceSpan) => void
  /** Selected block's source range; undefined when returning to slide selection. */
  readonly onBlockSelect?: (span: SourceSpan | undefined) => void
  /** Optional host action to open and focus the selected source range. */
  readonly onRevealSource?: () => void
  /** Shows a Present button; called with the current slide */
  readonly onPresent?: (index: number) => void
  /** The host's own controls in the workspace view toolbar */
  readonly actions?: ReactNode
  readonly labels?: Partial<SlideCanvasLabels>
  readonly className?: string
  /** Rendered last inside the canvas, for the host's own overlays */
  readonly children?: ReactNode
}


const COMPONENTS = { article: CanvasArticle }

const EDITABLE_TARGET = 'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="dialog"]'

export function SlideCanvas(props: SlideCanvasProps): ReactElement {
  const { value, onChange, preset, extensions } = props
  const labels = useMemo<SlideCanvasLabels>(() => ({ ...SLIDE_CANVAS_LABELS, ...props.labels }), [props.labels])
  const document = useMemo(
    () => compileMarkdown(value, { ...(preset === undefined ? {} : { preset }), ...(extensions === undefined ? {} : { extensions }) }),
    [value, preset, extensions],
  )
  const outline = useMemo(() => outlineDeck(document.tree, value), [document, value])
  const canvasDocument = useMemo(() => ({ ...document, tree: { ...document.tree, data: { ...(document.tree.data as object | undefined), rmkCanvas: true } } }), [document])
  const history = useSourceHistory(value, onChange)
  const count = outline.slides.length

  const [ownIndex, setOwnIndex] = useState(props.defaultIndex ?? 0)
  const index = Math.max(0, Math.min(props.index ?? ownIndex, count - 1))
  const [editing, setEditing] = useState<EditRequest | undefined>(undefined)
  const [editor, setEditor] = useState<MarkdownEditorInstance | undefined>(undefined)
  const [selectedBlock, setSelectedBlock] = useState<number | undefined>(undefined)
  const [focused, setFocused] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [view, setView] = useState<CanvasView>('strip')
  const [stripOpen, setStripOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)
  const [zoom, setZoom] = useState<CanvasZoom>('fit')
  const [scale, setScale] = useState(1)
  const root = useRef<HTMLDivElement>(null)

  // What the canvas wrote last; any other new value is an edit from outside, which reloads the open fields.
  const latest = useRef({ value, outline, emitted: value })
  const [revision, setRevision] = useState(0)
  latest.current = { ...latest.current, value, outline }
  useEffect(() => {
    if (value !== latest.current.emitted) {
      setRevision((current) => current + 1)
      setSelectedBlock(undefined)
      setEditing(undefined)
    }
    latest.current.emitted = value
  }, [value])

  const onChangeRef = useRef(history.write)
  onChangeRef.current = history.write
  const source = useMemo<SourceAccess>(
    () => ({
      value: () => latest.current.value,
      outline: () => latest.current.outline,
      emit: (next, group) => {
        latest.current.emitted = next
        onChangeRef.current(next, group)
      },
    }),
    [],
  )

  const indexChange = useRef(props.onIndexChange)
  indexChange.current = props.onIndexChange
  const select = useCallback((next: number) => {
    setEditing(undefined)
    setSelectedBlock(undefined)
    setOwnIndex(next)
    const slide = latest.current.outline.slides[next]
    if (slide !== undefined) indexChange.current?.(next, { start: slide.start, end: slide.end })
  }, [])

  // A structural edit picks its slide once the new source has an outline, so the host hears where it is.
  const pending = useRef<number | undefined>(undefined)
  const restructure = useCallback(
    (edit: (value: string, outline: DeckOutline) => string, next: number) => {
      setEditing(undefined)
      setSelectedBlock(undefined)
      pending.current = next
      source.emit(edit(latest.current.value, latest.current.outline))
    },
    [source],
  )
  useEffect(() => {
    if (pending.current === undefined) return
    const next = Math.min(pending.current, outline.slides.length - 1)
    pending.current = undefined
    if (next >= 0) select(next)
  }, [outline, select])

  // A press outside the canvas ends inline editing, as one on the backdrop does.
  useEffect(() => {
    if (editing === undefined) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setEditing(undefined)
    }
    window.document.addEventListener('pointerdown', onPointerDown)
    return () => window.document.removeEventListener('pointerdown', onPointerDown)
  }, [editing])

  const blockSelect = useRef(props.onBlockSelect)
  blockSelect.current = props.onBlockSelect
  useEffect(() => { setSelectedBlock(undefined); setEditing(undefined) }, [index])
  useEffect(() => {
    blockSelect.current?.(selectedBlock === undefined ? undefined : outline.slides[index]?.blocks[selectedBlock]?.span)
  }, [selectedBlock, index, outline])

  const editable = onChange !== undefined
  const state: CanvasState = {
    labels,
    actions: props.actions,
    onPresent: props.onPresent,
    preset,
    extensions,
    editable,
    source,
    count,
    problems: document.diagnostics,
    index,
    select,
    selectedBlock,
    selectBlock: (block) => { setEditing(undefined); setSelectedBlock(block) },
    focused,
    setFocused,
    moveBlock: (from, to) => {
      if (!editable) return
      const next = moveBlock(source.value(), source.outline(), index, from, to)
      if (next === source.value()) return
      setEditing(undefined)
      setSelectedBlock(to)
      source.emit(next)
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-rmk-canvas-selected]')?.focus({ preventScroll: true }))
    },
    propertiesOpen,
    setPropertiesOpen: (open) => { if (open) setFocused(false); setPropertiesOpen(open) },
    revealSource: props.onRevealSource,
    editing,
    edit: (request) => {
      if (editable && count > 0) {
        if (request.block !== undefined) setSelectedBlock(request.block)
        setEditing({ ...request, ...(request.block !== undefined || selectedBlock === undefined ? {} : { block: selectedBlock }) })
      }
    },
    stopEditing: () => {
      setEditing(undefined)
      requestAnimationFrame(() => {
        const target = root.current?.querySelector<HTMLElement>('[data-rmk-canvas-selected]') ?? root.current?.querySelector<HTMLElement>('[data-rmk-canvas-frame]')
        target?.focus({ preventScroll: true })
      })
    },
    editor,
    setEditor,
    revision,
    view,
    setView: (next) => {
      setEditing(undefined)
      if (next === 'grid') setFocused(false)
      setView(next)
    },
    stripOpen,
    setStripOpen: (open) => { setFocused(false); setStripOpen(open) },
    notesOpen,
    setNotesOpen: (open) => { if (open) setFocused(false); setNotesOpen(open) },
    zoom,
    setZoom,
    scale,
    setScale,
    undo: () => { setEditing(undefined); setSelectedBlock(undefined); history.undo() },
    redo: () => { setEditing(undefined); setSelectedBlock(undefined); history.redo() },
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    addSlide: () => restructure((current, deck) => insertSlide(current, deck, index, labels.newSlide), count === 0 ? 0 : index + 1),
    duplicateSlide: (at) => restructure((current, deck) => duplicateSlide(current, deck, at), at + 1),
    removeSlide: (at) => restructure((current, deck) => removeSlide(current, deck, at), Math.max(0, at - 1)),
    moveSlide: (from, to) => restructure((current, deck) => moveSlide(current, deck, from, to), to),
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (editing !== undefined || (event.target as Element).closest(EDITABLE_TARGET)) return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) state.redo()
      else state.undo()
      return
    }
    if (event.key === 'Escape') {
      if (selectedBlock !== undefined) state.selectBlock(undefined)
      else setFocused(false)
      return
    }
    if (event.altKey && !event.metaKey && !event.ctrlKey && selectedBlock !== undefined && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      state.moveBlock(selectedBlock, selectedBlock + (event.key === 'ArrowUp' ? -1 : 1))
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const step = event.key === 'ArrowRight' || event.key === 'PageDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 0
    if (step !== 0) {
      event.preventDefault()
      select(Math.max(0, Math.min(index + step, count - 1)))
    } else if (event.key === 'Enter' && (event.target as Element).closest('[data-rmk-canvas-stage]')) {
      event.preventDefault()
      state.edit({})
    }
  }

  return (
    <div
      ref={root}
      role="region"
      aria-label={labels.canvas}
      className={props.className === undefined ? 'rmk-editor rmk-slide-canvas' : `rmk-editor rmk-slide-canvas ${props.className}`}
      data-rmk-canvas-view={view}
      data-rmk-canvas-focused={focused ? '' : undefined}
      onKeyDown={onKeyDown}
    >
      <CanvasContext.Provider value={state}>
        <Markdown document={canvasDocument} components={COMPONENTS} {...(preset === undefined ? {} : { preset })} {...(extensions === undefined ? {} : { extensions })} />
        {props.children}
      </CanvasContext.Provider>
    </div>
  )
}
