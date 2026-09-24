/**
 * The detached tool row (docs/MERMAID_PLATFORM.md section 9.6). A host that
 * builds its own chrome around the editor, the way the editor package's
 * composable route lets it build its own formatting toolbar, mounts
 * `<DiagramToolbar>` wherever the tools should sit; every canvas of that
 * editor then renders its tool row into it instead of along its own top
 * edge. Without a mounted `<DiagramToolbar>` nothing changes.
 *
 * One slot per scope (the `LexicalEditor` in a document, the standalone
 * component's own instance), so nothing here is module state. The slot
 * shows one canvas's tools at a time: the canvas that last had focus, or, before any has, the first one
 * that mounted; when the owner unmounts (the block was deleted, switched to
 * text or changed kind) the oldest remaining canvas takes over. The other
 * canvases show no row of their own while the slot is mounted: their tools
 * appear in it once they have focus. A canvas under the lossy lock renders
 * no tool row and never takes the slot.
 */
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'

/** What a slot is keyed on: the `LexicalEditor` in a document, the component instance standalone. */
type Scope = object
type NodeKey = string

interface SlotState {
  /** The element the owner portals its tool row into; null while no `<DiagramToolbar>` is mounted. */
  readonly host: HTMLElement | null
  /** Every canvas that would take the slot, in mount order. */
  readonly mounted: readonly NodeKey[]
  /** The canvas whose tool row the slot shows. */
  readonly owner: NodeKey | null
}

const EMPTY: SlotState = { host: null, mounted: [], owner: null }

const states = new WeakMap<Scope, SlotState>()
const listeners = new WeakMap<Scope, Set<() => void>>()

function stateOf(scope: Scope): SlotState {
  return states.get(scope) ?? EMPTY
}

function update(scope: Scope, next: SlotState): void {
  states.set(scope, next)
  for (const listener of listeners.get(scope) ?? []) listener()
}

function subscribe(scope: Scope, listener: () => void): () => void {
  let set = listeners.get(scope)
  if (set === undefined) {
    set = new Set()
    listeners.set(scope, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

function useSlotState(scope: Scope): SlotState {
  const subscribeTo = useCallback((listener: () => void) => subscribe(scope, listener), [scope])
  const read = useCallback(() => stateOf(scope), [scope])
  return useSyncExternalStore(subscribeTo, read, read)
}

/** Registers the element the owner's tool row renders into; returns the function that removes it. */
function setToolbarHost(scope: Scope, host: HTMLElement): () => void {
  update(scope, { ...stateOf(scope), host })
  return () => {
    const state = stateOf(scope)
    if (state.host === host) update(scope, { ...state, host: null })
  }
}

function mountCanvas(scope: Scope, key: NodeKey): () => void {
  const state = stateOf(scope)
  if (!state.mounted.includes(key)) {
    update(scope, { ...state, mounted: [...state.mounted, key], owner: state.owner ?? key })
  }
  return () => {
    const current = stateOf(scope)
    const mounted = current.mounted.filter((candidate) => candidate !== key)
    update(scope, { ...current, mounted, owner: current.owner === key ? (mounted[0] ?? null) : current.owner })
  }
}

function claimToolbar(scope: Scope, key: NodeKey): void {
  const state = stateOf(scope)
  if (state.owner !== key && state.mounted.includes(key)) update(scope, { ...state, owner: key })
}

export interface ToolbarSlot {
  /** A slot is mounted for this scope: no canvas renders its row inline. */
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
export function useToolbarHost(scope: Scope, nodeKey: NodeKey, editable: boolean, active: boolean): ToolbarSlot {
  useEffect(() => {
    if (!editable) return
    return mountCanvas(scope, nodeKey)
  }, [scope, nodeKey, editable])

  useEffect(() => {
    if (editable && active) claimToolbar(scope, nodeKey)
  }, [scope, nodeKey, editable, active])

  const state = useSlotState(scope)
  if (state.host === null) return INLINE
  return state.owner === nodeKey ? { detached: true, host: state.host } : WAITING
}

/**
 * The element a scope's tool rows render into. `<DiagramToolbar>` (the
 * editor's) and the standalone component's floating island both mount one.
 */
export function ToolbarSlotHost({
  scope,
  className,
  placeholder,
}: {
  readonly scope: object
  readonly className?: string | undefined
  readonly placeholder?: ReactNode
}): ReactElement {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (slot === null) return
    return setToolbarHost(scope, slot)
  }, [scope, slot])

  const { owner } = useSlotState(scope)
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
