/**
 * Pure operations on a `SequenceModel`, one per gesture of the sequence
 * canvas (docs/MERMAID_PLATFORM.md section 9.5). Each takes a model and
 * returns a new one; nothing is mutated, and an operation that changes
 * nothing returns the model it was given so the canvas can skip the commit.
 *
 * Items are addressed by their flat index, the position in the depth-first
 * flattening the layout and the activations use, because that is the row
 * the pointer is on. A flat index is located in the item tree, the list
 * that holds it is rebuilt along the trail of frames and sections down to
 * it, and every untouched item keeps its identity; a frame rebuilt on the
 * way records what replaced it. Activations are then carried across by
 * identity: a span remembers the items it starts and ends on, not their
 * numbers, so an insertion or a reorder above it never moves the bar. A
 * span whose start item is gone goes with it; one whose end item is gone
 * runs to the last row, as it does when its `-` is cleared. Finally the
 * `+` and `-` suffixes are made to spell the spans again: a `+` stays only
 * where a span of the receiver starts, a `-` only where a span of the
 * sender ends, since that is what the parser reads them as. The result is
 * sorted the way the parser sorts, so `parse(write(m))` deep-equals `m`.
 *
 * An operation Mermaid.js would reject is not performed: a message that
 * would deactivate nothing keeps its spelling, a section is only added to a
 * kind that has dividers, and a frame wraps siblings only.
 */
import type { Activation, Frame, Message, Note, Participant, SequenceItem, SequenceModel } from './model.js'
import { flattenItems } from './model.js'

/** One step down the item tree: the frame at `item` in the current list, then its section. */
interface Step {
  readonly item: number
  readonly section: number
}

interface Located {
  readonly trail: readonly Step[]
  readonly index: number
}

/** The items an operation rebuilt, old to new, so a span anchored on one follows it. */
type Replaced = Map<SequenceItem, SequenceItem>

export type FrameKind = Frame['kind']
export type NotePlacement = Note['placement']

/** One frame on the way down to a section: the frame's flat index and the section number in it. */
export interface SectionStep {
  readonly index: number
  readonly section: number
}

/**
 * A place among the direct items of a frame section: the sections down to
 * it, outermost first (the layout's `sectionAt` gives it), and the
 * position in the innermost section's item list, clamped to its length.
 * Only the innermost step is looked up.
 */
export interface SectionInsertion {
  readonly trail: readonly SectionStep[]
  readonly position: number
}

/**
 * Where a new item goes: before the item at a flat index, after every item
 * when the index is past the end, or at a position inside a section, which
 * is how an empty section or the end of a middle section is reached.
 */
export type Insertion = number | SectionInsertion

/** The frame kinds whose sections a divider keyword separates. */
export const SECTIONED_FRAME_KINDS: readonly FrameKind[] = ['alt', 'par', 'critical']

/**
 * An id Mermaid's lexer reads as a keyword when it stands alone as an actor,
 * so the canvas never makes one (see the parser's `RESERVED_ID`).
 */
const RESERVED_ID =
  /^(?:box|participant|actor|create|destroy|loop|rect|opt|alt|else|par_over|par|and|critical|option|break|end|links|link|properties|details|over|note|activate|deactivate|sequenceDiagram|autonumber|off|title|accTitle|accDescr)$/i

/* ------------------------------------------------------------ participants */

/**
 * Appends a participant with a fresh id that is also its label: the first
 * free of `Participant1`, `Participant2`, … or `Actor1`, `Actor2`, …. The
 * bare words are Mermaid keywords, which a message or note cannot name.
 */
export function addParticipant(model: SequenceModel, kind: Participant['kind']): { readonly model: SequenceModel; readonly id: string } {
  const id = freeId(model, kind === 'actor' ? 'Actor' : 'Participant')
  return { model: { ...model, participants: [...model.participants, { id, label: id, kind }] }, id }
}

export interface RenameParticipantOptions {
  /**
   * Whether the id follows the label. Absent, it follows when the label is
   * the id, which is right for one rename. An inline edit commits every
   * change, so the canvas decides once at edit start and passes the same
   * answer with every change, with `originalId` the id at edit start: the
   * id is then recomputed from the whole label each time and falls back to
   * the original id, never to an intermediate one, when the sanitised label
   * is empty, taken or a keyword.
   */
  readonly follow?: boolean
  /** The id at edit start, the fallback when following; `id` when absent. */
  readonly originalId?: string
}

/**
 * Sets a participant's label. The id is kept unless the label was the id,
 * in which case the id follows a sanitised form of the new label (letters,
 * digits and `_`) when that is free and not a keyword, so a hand-written
 * diagram keeps its ids and a canvas-made one reads well as text. An
 * empty label falls back to the id.
 */
export function renameParticipant(model: SequenceModel, id: string, label: string, options: RenameParticipantOptions = {}): SequenceModel {
  const participant = model.participants.find((p) => p.id === id)
  if (participant === undefined) return model
  const free = (candidate: string): boolean => !model.participants.some((p) => p.id === candidate && p.id !== id)
  const follow = options.follow ?? participant.label === participant.id
  const original = options.originalId !== undefined && free(options.originalId) ? options.originalId : id
  const sanitised = follow ? sanitiseId(label) : ''
  const nextId = sanitised !== '' && !RESERVED_ID.test(sanitised) && free(sanitised) ? sanitised : follow ? original : id
  const nextLabel = label.trim() === '' ? nextId : label
  if (nextLabel === participant.label && nextId === id) return model
  const renamed = model.participants.map((p) => (p.id === id ? { ...p, id: nextId, label: nextLabel } : p))
  if (nextId === id) return { ...model, participants: renamed }
  const swap = (value: string): string => (value === id ? nextId : value)
  return {
    ...model,
    participants: renamed,
    boxes: model.boxes.map((box) => ({ ...box, participantIds: box.participantIds.map(swap) })),
    items: mapItems(model.items, (item) => {
      if (item.type === 'message') return { ...item, from: swap(item.from), to: swap(item.to) }
      if (item.type === 'note') return { ...item, participantIds: item.participantIds.map(swap) }
      return item
    }),
    activations: sortActivations(model.activations.map((a) => ({ ...a, participantId: swap(a.participantId) }))),
  }
}

/**
 * Moves a participant to column `index`. A box travels as a unit: its
 * members stay contiguous in the box's order, and a participant dropped
 * between two members lands beside the box, since the writer opens a box
 * where its first member sits. The boxes follow their first members, the
 * order the parser reads them back in.
 */
export function reorderParticipant(model: SequenceModel, id: string, index: number): SequenceModel {
  const moving = model.participants.find((p) => p.id === id)
  if (moving === undefined) return model
  const rest = model.participants.filter((p) => p.id !== id)
  const at = Math.max(0, Math.min(rest.length, Math.trunc(index)))
  const order = [...rest.slice(0, at), moving, ...rest.slice(at)]
  const boxOf = (participantId: string): SequenceModel['boxes'][number] | undefined => model.boxes.find((box) => box.participantIds.includes(participantId))
  const placed = new Set<string>()
  const participants: Participant[] = []
  for (const participant of order) {
    if (placed.has(participant.id)) continue
    const box = boxOf(participant.id)
    const group = box === undefined ? [participant] : order.filter((p) => box.participantIds.includes(p.id))
    for (const member of group) {
      participants.push(member)
      placed.add(member.id)
    }
  }
  if (participants.every((p, i) => p === model.participants[i])) return model
  const rank = new Map(participants.map((p, i) => [p.id, i]))
  const rankOf = (participantId: string): number => rank.get(participantId) ?? Number.POSITIVE_INFINITY
  const boxes = model.boxes
    .map((box) => ({ ...box, participantIds: [...box.participantIds].sort((a, b) => rankOf(a) - rankOf(b)) }))
    .sort((a, b) => rankOf(a.participantIds[0] ?? '') - rankOf(b.participantIds[0] ?? ''))
  return { ...model, participants, boxes }
}

export function setParticipantKind(model: SequenceModel, id: string, kind: Participant['kind']): SequenceModel {
  const participant = model.participants.find((p) => p.id === id)
  if (participant === undefined || participant.kind === kind) return model
  return { ...model, participants: model.participants.map((p) => (p.id === id ? { ...p, kind } : p)) }
}

/** Removes a participant with every message and note that names it; a box left empty goes too. */
export function removeParticipant(model: SequenceModel, id: string): SequenceModel {
  if (!model.participants.some((p) => p.id === id)) return model
  const replaced: Replaced = new Map()
  const items = filterItems(
    model.items,
    (item) => {
      if (item.type === 'message') return item.from !== id && item.to !== id
      if (item.type === 'note') return !item.participantIds.includes(id)
      return true
    },
    replaced,
  )
  const boxes = model.boxes
    .map((box) => ({ ...box, participantIds: box.participantIds.filter((p) => p !== id) }))
    .filter((box) => box.participantIds.length > 0)
  const activations = remapActivations(model, items, replaced).filter((a) => a.participantId !== id)
  return {
    ...model,
    participants: model.participants.filter((p) => p.id !== id),
    boxes,
    items: spellSuffixes(items, activations),
    activations,
  }
}

/* ------------------------------------------------------------------ items */

/** Inserts a `->>` message with empty text at `at` (see `Insertion`) and reports its flat index. */
export function addMessage(model: SequenceModel, from: string, to: string, at: Insertion): { readonly model: SequenceModel; readonly index: number } {
  const message: Message = { type: 'message', from, to, line: 'solid', head: 'arrow', bidirectional: false, text: '' }
  return insertItem(model, message, at)
}

/** Inserts a note over `participantId` with empty text at `at` (see `Insertion`) and reports its flat index. */
export function addNote(model: SequenceModel, participantId: string, at: Insertion): { readonly model: SequenceModel; readonly index: number } {
  const note: Note = { type: 'note', placement: 'over', participantIds: [participantId], text: '' }
  return insertItem(model, note, at)
}

/**
 * Moves the item at `index` among its siblings so that it sits before the
 * first sibling whose row is at or under `row`, or last when none is. A
 * frame sibling counts by its first row, so an item never lands inside one.
 */
export function reorderItem(model: SequenceModel, index: number, row: number): SequenceModel {
  const located = locate(model.items, index)
  if (located === undefined) return model
  const flat = flattenItems(model.items)
  const list = listAt(model.items, located.trail)
  const item = list[located.index]
  if (item === undefined) return model
  const rest = list.filter((_, i) => i !== located.index)
  let at = rest.findIndex((sibling) => flat.indexOf(sibling) >= row)
  if (at < 0) at = rest.length
  const next = [...rest.slice(0, at), item, ...rest.slice(at)]
  if (next.every((entry, i) => entry === list[i])) return model
  const replaced: Replaced = new Map()
  const items = withList(model.items, located.trail, () => next, replaced)
  return { ...model, ...settle(model, items, replaced) }
}

/**
 * Removes a message or note; a frame is unwrapped instead, so nothing
 * inside it is lost. A bar that started on the item goes with it, and the
 * `-` that ended it is cleared; a bar that ended on the item runs to the
 * last row, as if its `-` had been cleared.
 */
export function removeItem(model: SequenceModel, index: number): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined) return model
  if (item.type === 'frame') return unwrapFrame(model, index)
  const replaced: Replaced = new Map()
  const items = filterItems(model.items, (candidate) => candidate !== item, replaced)
  return { ...model, ...settle(model, items, replaced) }
}

export interface MessageStyle {
  readonly line?: Message['line']
  readonly head?: Message['head']
  readonly bidirectional?: boolean
}

/** Sets a message's line, head or two-way flag. Two-way is only spelled with the `arrow` head, so the two are coupled. */
export function setMessageStyle(model: SequenceModel, index: number, style: MessageStyle): SequenceModel {
  return replaceMessage(model, index, (message) => {
    const head = style.head ?? message.head
    const bidirectional = style.head !== undefined && style.head !== 'arrow' ? false : (style.bidirectional ?? message.bidirectional)
    return { ...message, line: style.line ?? message.line, head: bidirectional ? 'arrow' : head, bidirectional }
  })
}

/**
 * Swaps a message's ends. The `+`/`-` suffix names the other end after the
 * swap, so it is dropped and the bars it spelled are written as
 * `activate`/`deactivate` statements instead; the bars themselves stay.
 */
export function swapEnds(model: SequenceModel, index: number): SequenceModel {
  return replaceMessage(model, index, (message) => {
    const { activate: _activate, ...rest } = message
    return { ...rest, from: message.to, to: message.from }
  })
}

/** Sets a message or note's text. */
export function setText(model: SequenceModel, index: number, text: string): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type === 'frame' || item.text === text) return model
  return replaceItem(model, item, { ...item, text })
}

/** Sets the label of a frame's section: the frame's own label for section 0, a divider's after. */
export function setSectionLabel(model: SequenceModel, index: number, section: number, label: string): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type !== 'frame') return model
  const current = item.sections[section]
  if (current === undefined || current.label === label) return model
  const sections = item.sections.map((entry, i) => (i === section ? { ...entry, label } : entry))
  return replaceItem(model, item, { ...item, sections })
}

/**
 * True when `-` can be set on the message: a bar of its sender covers the
 * row, or an earlier message to the sender could start one. Mermaid.js
 * rejects a deactivation of an inactive participant, so the property bar
 * does not offer it otherwise.
 */
export function canDeactivate(model: SequenceModel, index: number): boolean {
  const message = flattenItems(model.items)[index]
  if (message === undefined || message.type !== 'message') return false
  if (message.activate === '-') return true
  return coveringSpan(model.activations, message.from, index) !== undefined || previousMessageTo(model, message.from, index) !== undefined
}

/**
 * Sets a message's activation suffix and keeps `activations`, the source
 * of truth for the bars, in step with it, mirroring what the same edit in
 * text does: `+` starts a bar on the receiver that runs to its next reply
 * (or the last row), skipping a reply the bar could only cross, since
 * Mermaid's stack cannot spell two bars that cross; `-` ends the sender's
 * covering bar here, or starts one from the last message to the sender
 * when none covers the row; no suffix drops the bar a `+` started and lets
 * the bar a `-` ended run to the last row. The suffix on the other end of a
 * bar that went or moved is cleared with it.
 */
export function setActivation(model: SequenceModel, index: number, suffix: Message['activate'] | undefined): SequenceModel {
  const flat = flattenItems(model.items)
  const message = flat[index]
  if (message === undefined || message.type !== 'message' || message.activate === suffix) return model
  const last = Math.max(0, flat.length - 1)
  let activations = [...model.activations]
  if (message.activate === '+') {
    const started = activations.filter((a) => a.participantId === message.to && a.start === index).sort((a, b) => b.end - a.end)[0]
    if (started !== undefined) activations = activations.filter((a) => a !== started)
  } else if (message.activate === '-') {
    const ended = activations.filter((a) => a.participantId === message.from && a.end === index).sort((a, b) => b.start - a.start)[0]
    if (ended !== undefined) activations = activations.map((a) => (a === ended ? { ...a, end: last } : a))
  }
  if (suffix === '+') {
    if (!activations.some((a) => a.participantId === message.to && a.start === index)) {
      activations.push({ participantId: message.to, start: index, end: replyRow(flat, activations, message.to, index) })
    }
  } else if (suffix === '-') {
    const covering = coveringSpan(activations, message.from, index)
    if (covering !== undefined) {
      activations = activations.map((a) => (a === covering ? { ...a, end: index } : a))
    } else {
      const start = previousMessageTo(model, message.from, index)
      if (start === undefined) return model
      activations.push({ participantId: message.from, start, end: index })
    }
  }
  const { activate: _activate, ...rest } = message
  const next: Message = suffix === undefined ? rest : { ...rest, activate: suffix }
  const sorted = sortActivations(activations)
  const items = spellSuffixes(
    mapItems(model.items, (item) => (item === message ? next : item)),
    sorted,
  )
  return { ...model, items, activations: sorted }
}

/** Moves a note between `left of`, `right of` and `over`; `over` may name a second participant. */
export function setNotePlacement(model: SequenceModel, index: number, placement: NotePlacement, second?: string): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type !== 'note') return model
  const first = item.participantIds[0] ?? ''
  const participantIds = placement === 'over' && second !== undefined && second !== first ? [first, second] : [first]
  if (item.placement === placement && participantIds.join(',') === item.participantIds.join(',')) return model
  return replaceItem(model, item, { ...item, placement, participantIds })
}

/** True when the two items are siblings, so a frame can wrap the range between them. */
export function areSiblings(model: SequenceModel, a: number, b: number): boolean {
  const first = locate(model.items, a)
  const second = locate(model.items, b)
  return first !== undefined && second !== undefined && sameTrail(first.trail, second.trail)
}

/** Wraps the sibling range between two flat indices in a new frame with one empty-labelled section. */
export function wrapInFrame(
  model: SequenceModel,
  from: number,
  to: number,
  kind: FrameKind,
): { readonly model: SequenceModel; readonly index: number } | undefined {
  const first = locate(model.items, from)
  const second = locate(model.items, to)
  if (first === undefined || second === undefined || !sameTrail(first.trail, second.trail)) return undefined
  const lo = Math.min(first.index, second.index)
  const hi = Math.max(first.index, second.index)
  const list = listAt(model.items, first.trail)
  const frame: Frame = { type: 'frame', kind, sections: [{ label: '', items: list.slice(lo, hi + 1) }] }
  const replaced: Replaced = new Map()
  const items = withList(model.items, first.trail, (current) => [...current.slice(0, lo), frame, ...current.slice(hi + 1)], replaced)
  const index = flattenItems(items).indexOf(frame)
  return { model: { ...model, ...settle(model, items, replaced) }, index }
}

/** Adds an empty section after section `after` of an `alt`, `par` or `critical` frame. */
export function addSection(model: SequenceModel, index: number, after: number): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type !== 'frame' || !SECTIONED_FRAME_KINDS.includes(item.kind)) return model
  const at = Math.max(0, Math.min(item.sections.length - 1, after)) + 1
  const sections = [...item.sections.slice(0, at), { label: '', items: [] }, ...item.sections.slice(at)]
  return replaceItem(model, item, { ...item, sections })
}

/**
 * Replaces a frame with the items of its sections, in order. A bar
 * anchored on the frame's own row (an `activate` written right after the
 * opener) moves to the first unwrapped item; only an empty frame loses it.
 */
export function unwrapFrame(model: SequenceModel, index: number): SequenceModel {
  const located = locate(model.items, index)
  if (located === undefined) return model
  const list = listAt(model.items, located.trail)
  const frame = list[located.index]
  if (frame === undefined || frame.type !== 'frame') return model
  const inner = frame.sections.flatMap((section) => section.items)
  const replaced: Replaced = new Map()
  const items = withList(model.items, located.trail, (current) => [...current.slice(0, located.index), ...inner, ...current.slice(located.index + 1)], replaced)
  const first = inner[0]
  if (first !== undefined) replaced.set(frame, first)
  return { ...model, ...settle(model, items, replaced) }
}

/**
 * Extends a frame over the next `delta` siblings, into its last section,
 * or for a negative `delta` moves that many items from the end of its last
 * section out after it.
 */
export function extendFrame(model: SequenceModel, index: number, delta: number): SequenceModel {
  const located = locate(model.items, index)
  if (located === undefined || delta === 0) return model
  const list = listAt(model.items, located.trail)
  const frame = list[located.index]
  if (frame === undefined || frame.type !== 'frame') return model
  const lastSection = frame.sections[frame.sections.length - 1]
  if (lastSection === undefined) return model
  let next: SequenceItem[]
  let rebuilt: Frame
  if (delta > 0) {
    const taken = list.slice(located.index + 1, located.index + 1 + delta)
    if (taken.length === 0) return model
    const sections = frame.sections.map((section) => (section === lastSection ? { ...section, items: [...section.items, ...taken] } : section))
    rebuilt = { ...frame, sections }
    next = [...list.slice(0, located.index), rebuilt, ...list.slice(located.index + 1 + taken.length)]
  } else {
    const count = Math.min(lastSection.items.length, -delta)
    if (count === 0) return model
    const kept = lastSection.items.slice(0, lastSection.items.length - count)
    const moved = lastSection.items.slice(lastSection.items.length - count)
    const sections = frame.sections.map((section) => (section === lastSection ? { ...section, items: kept } : section))
    rebuilt = { ...frame, sections }
    next = [...list.slice(0, located.index), rebuilt, ...moved, ...list.slice(located.index + 1)]
  }
  const replaced: Replaced = new Map([[frame, rebuilt]])
  const items = withList(model.items, located.trail, () => next, replaced)
  return { ...model, ...settle(model, items, replaced) }
}

/**
 * What a frame's bottom edge can move over: the flat indices of the
 * siblings after it (each by its first row) and of the items in its last
 * section, so the canvas can turn a pointer row into an `extendFrame`
 * delta.
 */
export function frameNeighbours(model: SequenceModel, index: number): { readonly following: readonly number[]; readonly lastSection: readonly number[] } {
  const located = locate(model.items, index)
  const flat = flattenItems(model.items)
  if (located === undefined) return { following: [], lastSection: [] }
  const list = listAt(model.items, located.trail)
  const frame = list[located.index]
  if (frame === undefined || frame.type !== 'frame') return { following: [], lastSection: [] }
  const following = list.slice(located.index + 1).map((item) => flat.indexOf(item))
  const lastSection = (frame.sections[frame.sections.length - 1]?.items ?? []).map((item) => flat.indexOf(item))
  return { following, lastSection }
}

/** The flat indices of the siblings from `a` to `b` inclusive, or only `a` when the two are not siblings. */
export function siblingRange(model: SequenceModel, a: number, b: number): readonly number[] {
  const first = locate(model.items, a)
  const second = locate(model.items, b)
  if (first === undefined) return []
  if (second === undefined || !sameTrail(first.trail, second.trail)) return [a]
  const flat = flattenItems(model.items)
  const list = listAt(model.items, first.trail)
  const lo = Math.min(first.index, second.index)
  const hi = Math.max(first.index, second.index)
  return list.slice(lo, hi + 1).map((item) => flat.indexOf(item))
}

/** Turns autonumbering on at start 1, step 1, or off. */
export function setNumbering(model: SequenceModel, on: boolean): SequenceModel {
  if (on === (model.numbering !== undefined)) return model
  const { numbering: _numbering, ...rest } = model
  return on ? { ...rest, numbering: { start: 1, step: 1 } } : rest
}

/* ---------------------------------------------------------------- helpers */

/** `base` when it is free and not a keyword, else the first free of `base1`, `base2`, …; a keyword base is never used bare. */
function freeId(model: SequenceModel, base: string): string {
  const taken = new Set(model.participants.map((p) => p.id))
  const reserved = RESERVED_ID.test(base)
  if (!reserved && !taken.has(base)) return base
  for (let n = reserved ? 1 : 2; ; n += 1) {
    const candidate = `${base}${n}`
    if (!taken.has(candidate) && !RESERVED_ID.test(candidate)) return candidate
  }
}

/** Letters, digits and `_` of a label, which every Mermaid dialect takes as an actor id. */
function sanitiseId(label: string): string {
  return label.replace(/[^\p{L}\p{N}_]+/gu, '')
}

function locate(items: readonly SequenceItem[], index: number): Located | undefined {
  let flat = 0
  const walk = (list: readonly SequenceItem[], trail: readonly Step[]): Located | undefined => {
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i]
      if (item === undefined) continue
      if (flat === index) return { trail, index: i }
      flat += 1
      if (item.type !== 'frame') continue
      for (let s = 0; s < item.sections.length; s += 1) {
        const found = walk(item.sections[s]?.items ?? [], [...trail, { item: i, section: s }])
        if (found !== undefined) return found
      }
    }
    return undefined
  }
  return walk(items, [])
}

function listAt(items: readonly SequenceItem[], trail: readonly Step[]): readonly SequenceItem[] {
  let list = items
  for (const step of trail) {
    const frame = list[step.item]
    list = frame !== undefined && frame.type === 'frame' ? (frame.sections[step.section]?.items ?? []) : []
  }
  return list
}

/** The items with the list at the end of `trail` replaced by `fn` of it; every frame on the way is rebuilt and recorded, nothing else. */
function withList(
  items: readonly SequenceItem[],
  trail: readonly Step[],
  fn: (list: readonly SequenceItem[]) => readonly SequenceItem[],
  replaced?: Replaced,
): SequenceItem[] {
  const [step, ...rest] = trail
  if (step === undefined) return [...fn(items)]
  return items.map((item, i) => {
    if (i !== step.item || item.type !== 'frame') return item
    const sections = item.sections.map((section, s) => (s === step.section ? { ...section, items: withList(section.items, rest, fn, replaced) } : section))
    const rebuilt: Frame = { ...item, sections }
    replaced?.set(item, rebuilt)
    return rebuilt
  })
}

function sameTrail(a: readonly Step[], b: readonly Step[]): boolean {
  return a.length === b.length && a.every((step, i) => step.item === b[i]?.item && step.section === b[i]?.section)
}

/** The new item inserted at `at`, with the bars carried across, and its flat index. */
function insertItem(model: SequenceModel, item: SequenceItem, at: Insertion): { readonly model: SequenceModel; readonly index: number } {
  const replaced: Replaced = new Map()
  const items = typeof at === 'number' ? insertBefore(model.items, at, item, replaced) : insertInSection(model.items, at, item, replaced)
  const index = flattenItems(items).indexOf(item)
  return { model: { ...model, ...settle(model, items, replaced) }, index }
}

function insertBefore(items: readonly SequenceItem[], row: number, item: SequenceItem, replaced?: Replaced): SequenceItem[] {
  const located = locate(items, row)
  if (located === undefined) return [...items, item]
  return withList(items, located.trail, (list) => [...list.slice(0, located.index), item, ...list.slice(located.index)], replaced)
}

/** Inserts into the innermost section of the trail at its position; a trail that names no frame section appends after every item. */
function insertInSection(items: readonly SequenceItem[], at: SectionInsertion, item: SequenceItem, replaced?: Replaced): SequenceItem[] {
  const step = at.trail[at.trail.length - 1]
  const located = step === undefined ? undefined : locate(items, step.index)
  const frame = located === undefined ? undefined : listAt(items, located.trail)[located.index]
  if (step === undefined || located === undefined || frame === undefined || frame.type !== 'frame' || frame.sections[step.section] === undefined) {
    return [...items, item]
  }
  const trail = [...located.trail, { item: located.index, section: step.section }]
  return withList(
    items,
    trail,
    (list) => {
      const position = Math.max(0, Math.min(list.length, Math.trunc(at.position)))
      return [...list.slice(0, position), item, ...list.slice(position)]
    },
    replaced,
  )
}

/** Every item mapped through `fn`, frames included (their sections are mapped first); what changed is recorded. */
function mapItems(items: readonly SequenceItem[], fn: (item: SequenceItem) => SequenceItem, replaced?: Replaced): SequenceItem[] {
  return items.map((item) => {
    let current = item
    if (item.type === 'frame') {
      const sections = item.sections.map((section) => {
        const mapped = mapItems(section.items, fn, replaced)
        return mapped.every((entry, i) => entry === section.items[i]) ? section : { ...section, items: mapped }
      })
      if (!sections.every((section, i) => section === item.sections[i])) current = { ...item, sections }
    }
    const next = fn(current)
    if (next !== item) replaced?.set(item, next)
    return next
  })
}

function filterItems(items: readonly SequenceItem[], keep: (item: SequenceItem) => boolean, replaced?: Replaced): SequenceItem[] {
  const out: SequenceItem[] = []
  for (const item of items) {
    if (!keep(item)) continue
    if (item.type !== 'frame') {
      out.push(item)
      continue
    }
    const sections = item.sections.map((section) => {
      const kept = filterItems(section.items, keep, replaced)
      return kept.length === section.items.length && kept.every((entry, i) => entry === section.items[i]) ? section : { ...section, items: kept }
    })
    if (sections.every((section, i) => section === item.sections[i])) {
      out.push(item)
      continue
    }
    const rebuilt: Frame = { ...item, sections }
    replaced?.set(item, rebuilt)
    out.push(rebuilt)
  }
  return out
}

function replaceItem(model: SequenceModel, previous: SequenceItem, next: SequenceItem): SequenceModel {
  const replaced: Replaced = new Map()
  const items = mapItems(model.items, (item) => (item === previous ? next : item), replaced)
  return { ...model, ...settle(model, items, replaced) }
}

function replaceMessage(model: SequenceModel, index: number, fn: (message: Message) => Message): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type !== 'message') return model
  const next = fn(item)
  return replaceItem(model, item, next)
}

/** The innermost bar of `participantId` that starts above `index` and reaches it. */
function coveringSpan(activations: readonly Activation[], participantId: string, index: number): Activation | undefined {
  return activations.filter((a) => a.participantId === participantId && a.start < index && a.end >= index).sort((a, b) => b.start - a.start)[0]
}

/** The flat index of the last message to `participantId` before `index`. */
function previousMessageTo(model: SequenceModel, participantId: string, index: number): number | undefined {
  const flat = flattenItems(model.items)
  for (let i = index - 1; i >= 0; i -= 1) {
    const item = flat[i]
    if (item !== undefined && item.type === 'message' && item.to === participantId) return i
  }
  return undefined
}

/**
 * Where a bar of `participantId` started at `index` ends: at its next
 * reply, a message from the participant, or the last row. The bar may not
 * cross another bar of the participant, since Mermaid's stack cannot spell
 * that: it stays inside a bar that covers `index`, and it skips a reply
 * that sits inside a later bar without reaching that bar's end, so the
 * result either contains that bar or ends before it.
 */
function replyRow(flat: readonly SequenceItem[], activations: readonly Activation[], participantId: string, index: number): number {
  const own = activations.filter((a) => a.participantId === participantId)
  const cap = Math.min(flat.length - 1, ...own.filter((a) => a.start < index && a.end >= index).map((a) => a.end))
  const crosses = (end: number): boolean => own.some((a) => a.start > index && a.start <= end && a.end > end)
  for (let i = index + 1; i <= cap; i += 1) {
    const item = flat[i]
    if (item !== undefined && item.type === 'message' && item.from === participantId && !crosses(i)) return i
  }
  return Math.max(index, cap)
}

/** The items and activations of `model` carried over to the new items: the bars follow their items, and the suffixes spell the bars. */
function settle(model: SequenceModel, items: readonly SequenceItem[], replaced: Replaced): { readonly items: SequenceItem[]; readonly activations: Activation[] } {
  const activations = remapActivations(model, items, replaced)
  return { items: spellSuffixes(items, activations), activations }
}

/**
 * The activations of `model` on the new items: each span follows the items
 * it starts and ends on by identity (through `replaced` when one was
 * rebuilt). A span whose start item is gone is dropped; one whose end item
 * is gone runs to the last row; one whose items crossed keeps the range
 * between them.
 */
function remapActivations(model: SequenceModel, items: readonly SequenceItem[], replaced: Replaced): Activation[] {
  const before = flattenItems(model.items)
  const after = flattenItems(items)
  const position = new Map(after.map((item, i) => [item, i]))
  const find = (index: number): number | undefined => {
    const item = before[index]
    if (item === undefined) return undefined
    return position.get(replaced.get(item) ?? item)
  }
  const out: Activation[] = []
  for (const span of model.activations) {
    const start = find(span.start)
    if (start === undefined) continue
    const end = find(span.end) ?? after.length - 1
    out.push({ participantId: span.participantId, start: Math.min(start, end), end: Math.max(start, end) })
  }
  return sortActivations(out)
}

/**
 * The items with every `+` and `-` that spells no span cleared: the parser
 * reads a `+` as a span of the receiver starting at the message and a `-`
 * as a span of the sender ending there, so a suffix left over from a bar
 * that went or moved would come back as a bar the model does not hold.
 * Items keep their identity unless a suffix goes.
 */
function spellSuffixes(items: readonly SequenceItem[], activations: readonly Activation[]): SequenceItem[] {
  const stale = new Map<SequenceItem, Message>()
  flattenItems(items).forEach((item, i) => {
    if (item.type !== 'message' || item.activate === undefined) return
    const spelled =
      item.activate === '+'
        ? activations.some((a) => a.participantId === item.to && a.start === i)
        : activations.some((a) => a.participantId === item.from && a.start < i && a.end === i)
    if (spelled) return
    const { activate: _activate, ...rest } = item
    stale.set(item, rest)
  })
  if (stale.size === 0) return [...items]
  return mapItems(items, (item) => stale.get(item) ?? item)
}

/** The parser's order: start ascending, end descending, then participant id. */
function sortActivations(activations: readonly Activation[]): Activation[] {
  return [...activations].sort((a, b) => a.start - b.start || b.end - a.end || a.participantId.localeCompare(b.participantId))
}
