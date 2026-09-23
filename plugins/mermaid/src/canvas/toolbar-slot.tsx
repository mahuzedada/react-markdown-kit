/**
 * The detached tool row (docs/MERMAID_PLATFORM.md section 9.6). A host that
 * builds its own chrome around the editor, the way the editor package's
 * composable route lets it build its own formatting toolbar, mounts
 * `<DiagramToolbar>` wherever the tools should sit; every canvas of that
 * editor then renders its tool row into it instead of along its own top
 * edge. Without a mounted `<DiagramToolbar>` nothing changes.
 *
 * One slot per editor, keyed on the `LexicalEditor` like the block options,
 * so nothing here is module state. The slot shows one canvas's tools at a
 * time: the canvas that last had focus, or, before any has, the first one
 * that mounted; when the owner unmounts (the block was deleted, switched to
 * text or changed kind) the oldest remaining canvas takes over. The other
 * canvases show no row of their own while the slot is mounted: their tools
 * appear in it once they have focus. A canvas under the lossy lock renders
 * no tool row and never takes the slot.
 */
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import type { LexicalEditor, NodeKey } from 'lexical'
import { useOptionalMarkdownEditorContext, type MarkdownEditorInstance } from '@react-markdown-kit/editor'

interface SlotState {
  /** The element the owner portals its tool row into; null while no `<DiagramToolbar>` is mounted. */
  readonly host: HTMLElement | null
  /** Every canvas that would take the slot, in mount order. */
  readonly mounted: readonly NodeKey[]
  /** The canvas whose tool row the slot shows. */
  readonly owner: NodeKey | null
}

const EMPTY: SlotState = { host: null, mounted: [], owner: null }

const states = new WeakMap<LexicalEditor, SlotState>()
const listeners = new WeakMap<LexicalEditor, Set<() => void>>()

function stateOf(editor: LexicalEditor): SlotState {
  return states.get(editor) ?? EMPTY
}

function update(editor: LexicalEditor, next: SlotState): void {
  states.set(editor, next)
  for (const listener of listeners.get(editor) ?? []) listener()
}

function subscribe(editor: LexicalEditor, listener: () => void): () => void {
  let set = listeners.get(editor)
  if (set === undefined) {
    set = new Set()
    listeners.set(editor, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

function useSlotState(editor: LexicalEditor): SlotState {
  const subscribeTo = useCallback((listener: () => void) => subscribe(editor, listener), [editor])
  const read = useCallback(() => stateOf(editor), [editor])
  return useSyncExternalStore(subscribeTo, read, read)
}

/** Registers the element the owner's tool row renders into; returns the function that removes it. */
function setToolbarHost(editor: LexicalEditor, host: HTMLElement): () => void {
  update(editor, { ...stateOf(editor), host })
  return () => {
    const state = stateOf(editor)
    if (state.host === host) update(editor, { ...state, host: null })
  }
}

function mountCanvas(editor: LexicalEditor, key: NodeKey): () => void {
  const state = stateOf(editor)
  if (!state.mounted.includes(key)) {
    update(editor, { ...state, mounted: [...state.mounted, key], owner: state.owner ?? key })
  }
  return () => {
    const current = stateOf(editor)
    const mounted = current.mounted.filter((candidate) => candidate !== key)
    update(editor, { ...current, mounted, owner: current.owner === key ? (mounted[0] ?? null) : current.owner })
  }
}

function claimToolbar(editor: LexicalEditor, key: NodeKey): void {
  const state = stateOf(editor)
  if (state.owner !== key && state.mounted.includes(key)) update(editor, { ...state, owner: key })
}

export interface ToolbarSlot {
  /** A `<DiagramToolbar>` is mounted for this editor: no canvas renders its row inline. */
  readonly detached: boolean
  /** The element this canvas renders its row into, while it owns the slot. */
  readonly host: HTMLElement | null
}

const INLINE: ToolbarSlot = { detached: false, host: null }
const WAITING: ToolbarSlot = { detached: true, host: null }

/**
 * Where a canvas renders its tool row: inline while no slot is mounted,
 * into the slot while it owns it, nowhere otherwise (its tools appear in
 * the slot once it has focus). `editable` is whether the canvas has a tool
 * row at all; `active` is whether it has focus, which takes the slot.
 */
export function useToolbarHost(editor: LexicalEditor, nodeKey: NodeKey, editable: boolean, active: boolean): ToolbarSlot {
  useEffect(() => {
    if (!editable) return
    return mountCanvas(editor, nodeKey)
  }, [editor, nodeKey, editable])

  useEffect(() => {
    if (editable && active) claimToolbar(editor, nodeKey)
  }, [editor, nodeKey, editable, active])

  const state = useSlotState(editor)
  if (state.host === null) return INLINE
  return state.owner === nodeKey ? { detached: true, host: state.host } : WAITING
}

export interface DiagramToolbarProps {
  /** The editor whose canvases render here. Taken from `<MarkdownEditorProvider>` when omitted. */
  readonly editor?: MarkdownEditorInstance | undefined
  readonly className?: string | undefined
  /** Shown while no canvas of the editor is on screen: the document has none, or every block is edited as text. */
  readonly placeholder?: ReactNode
}

/**
 * The slot the canvases' tool rows render into. Its root carries
 * `rmk-editor`, so the `--rmk-diagram-*` tokens a host maps on that class
 * reach the tools wherever the slot sits, and `rmk-diagram-toolbar-host`;
 * `data-rmk-diagram-toolbar` is `filled` while a canvas owns it and
 * `empty` otherwise.
 */
export function DiagramToolbar({ editor, className, placeholder }: DiagramToolbarProps): ReactElement {
  const context = useOptionalMarkdownEditorContext()
  const instance = editor ?? context
  if (instance === null) {
    throw new Error('<DiagramToolbar> needs an editor: render it inside <MarkdownEditorProvider>, or pass editor={useMarkdownEditor(...)}.')
  }
  // The plugin is the one package that touches Lexical, so the escape hatch is its door.
  const lexical = instance.getNativeEditor() as LexicalEditor
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (slot === null) return
    return setToolbarHost(lexical, slot)
  }, [lexical, slot])

  const { owner } = useSlotState(lexical)
  const filled = owner !== null
  const classes = ['rmk-editor', 'rmk-diagram-toolbar-host', className].filter((name) => name !== undefined && name !== '').join(' ')

  // The portal target is a child React never gives children of its own, so
  // the placeholder and the portalled row never contend for the same node.
  return (
    <div className={classes} data-rmk-diagram-toolbar={filled ? 'filled' : 'empty'}>
      {filled || placeholder === undefined ? null : <div className="rmk-diagram-toolbar-placeholder">{placeholder}</div>}
      <div ref={setSlot} className="rmk-diagram-toolbar-slot" />
    </div>
  )
}
