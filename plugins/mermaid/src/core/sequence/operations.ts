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
 * it, and every untouched item keeps its identity. Activations are then
 * carried across by identity: a span remembers the items it starts and
 * ends on, not their numbers, so an insertion or a reorder above it never
 * moves the bar, and a span whose start or end item is gone goes with it.
 * The result is sorted the way the parser sorts, so `parse(write(m))`
 * deep-equals `m`.
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

export type FrameKind = Frame['kind']
export type NotePlacement = Note['placement']

/** The frame kinds whose sections a divider keyword separates. */
export const SECTIONED_FRAME_KINDS: readonly FrameKind[] = ['alt', 'par', 'critical']

/**
 * An id Mermaid's lexer reads as a keyword when it stands alone as an actor,
 * so the canvas never makes one (see the parser's `RESERVED_ID`).
 */
const RESERVED_ID =
  /^(?:box|participant|actor|create|destroy|loop|rect|opt|alt|else|par_over|par|and|critical|option|break|end|links|link|properties|details|over|note|activate|deactivate|sequenceDiagram|autonumber|off|title|accTitle|accDescr)$/i

/* ------------------------------------------------------------ participants */

/** Appends a participant with a fresh id that is also its label. */
export function addParticipant(model: SequenceModel, kind: Participant['kind']): { readonly model: SequenceModel; readonly id: string } {
  const id = freeId(model, kind === 'actor' ? 'Actor' : 'Participant')
  return { model: { ...model, participants: [...model.participants, { id, label: id, kind }] }, id }
}

/**
 * Sets a participant's label. The id is kept unless the label was the id,
 * in which case the id follows a sanitised form of the new label (letters,
 * digits and `_`) when that is free and not a keyword, so a hand-written
 * diagram keeps its ids and a canvas-made one reads well as text.
 */
export function renameParticipant(model: SequenceModel, id: string, label: string): SequenceModel {
  const participant = model.participants.find((p) => p.id === id)
  if (participant === undefined) return model
  const nextLabel = label.trim() === '' ? id : label
  const follow = participant.label === participant.id ? sanitiseId(nextLabel) : ''
  const nextId = follow !== '' && !RESERVED_ID.test(follow) && !model.participants.some((p) => p.id === follow && p.id !== id) ? follow : id
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
 * where its first member sits.
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
  const boxes = model.boxes.map((box) => ({
    ...box,
    participantIds: [...box.participantIds].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)),
  }))
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
  const items = filterItems(model.items, (item) => {
    if (item.type === 'message') return item.from !== id && item.to !== id
    if (item.type === 'note') return !item.participantIds.includes(id)
    return true
  })
  const boxes = model.boxes
    .map((box) => ({ ...box, participantIds: box.participantIds.filter((p) => p !== id) }))
    .filter((box) => box.participantIds.length > 0)
  return {
    ...model,
    participants: model.participants.filter((p) => p.id !== id),
    boxes,
    items,
    activations: remapActivations(model, items).filter((a) => a.participantId !== id),
  }
}

/* ------------------------------------------------------------------ items */

/** Inserts a `->>` message with empty text before flat index `row` (after every item when `row` is past the end). */
export function addMessage(model: SequenceModel, from: string, to: string, row: number): { readonly model: SequenceModel; readonly index: number } {
  const message: Message = { type: 'message', from, to, line: 'solid', head: 'arrow', bidirectional: false, text: '' }
  const items = insertBefore(model.items, row, message)
  return { model: { ...model, items, activations: remapActivations(model, items) }, index: flattenItems(items).indexOf(message) }
}

/** Inserts a note over `participantId` with empty text before flat index `row`. */
export function addNote(model: SequenceModel, participantId: string, row: number): { readonly model: SequenceModel; readonly index: number } {
  const note: Note = { type: 'note', placement: 'over', participantIds: [participantId], text: '' }
  const items = insertBefore(model.items, row, note)
  return { model: { ...model, items, activations: remapActivations(model, items) }, index: flattenItems(items).indexOf(note) }
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
  const items = withList(model.items, located.trail, () => next)
  return { ...model, items, activations: remapActivations(model, items) }
}

/** Removes a message or note; a frame is unwrapped instead, so nothing inside it is lost. */
export function removeItem(model: SequenceModel, index: number): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined) return model
  if (item.type === 'frame') return unwrapFrame(model, index)
  const items = filterItems(model.items, (candidate) => candidate !== item)
  return { ...model, items, activations: remapActivations(model, items) }
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
 * (or the last row); `-` ends the sender's covering bar here, or starts
 * one from the last message to the sender when none covers the row; no
 * suffix drops the bar a `+` started and lets the bar a `-` ended run to
 * the last row.
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
      const reply = flat.findIndex((item, i) => i > index && item.type === 'message' && item.from === message.to)
      activations.push({ participantId: message.to, start: index, end: reply < 0 ? last : reply })
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
  const items = mapItems(model.items, (item) => (item === message ? next : item))
  return { ...model, items, activations: sortActivations(activations) }
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
  const items = withList(model.items, first.trail, (current) => [...current.slice(0, lo), frame, ...current.slice(hi + 1)])
  return { model: { ...model, items, activations: remapActivations(model, items) }, index: flattenItems(items).indexOf(frame) }
}

/** Adds an empty section after section `after` of an `alt`, `par` or `critical` frame. */
export function addSection(model: SequenceModel, index: number, after: number): SequenceModel {
  const item = flattenItems(model.items)[index]
  if (item === undefined || item.type !== 'frame' || !SECTIONED_FRAME_KINDS.includes(item.kind)) return model
  const at = Math.max(0, Math.min(item.sections.length - 1, after)) + 1
  const sections = [...item.sections.slice(0, at), { label: '', items: [] }, ...item.sections.slice(at)]
  return replaceItem(model, item, { ...item, sections })
}

/** Replaces a frame with the items of its sections, in order. */
export function unwrapFrame(model: SequenceModel, index: number): SequenceModel {
  const located = locate(model.items, index)
  if (located === undefined) return model
  const list = listAt(model.items, located.trail)
  const frame = list[located.index]
  if (frame === undefined || frame.type !== 'frame') return model
  const inner = frame.sections.flatMap((section) => section.items)
  const items = withList(model.items, located.trail, (current) => [...current.slice(0, located.index), ...inner, ...current.slice(located.index + 1)])
  return { ...model, items, activations: remapActivations(model, items) }
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
  if (delta > 0) {
    const taken = list.slice(located.index + 1, located.index + 1 + delta)
    if (taken.length === 0) return model
    const sections = frame.sections.map((section) => (section === lastSection ? { ...section, items: [...section.items, ...taken] } : section))
    next = [...list.slice(0, located.index), { ...frame, sections }, ...list.slice(located.index + 1 + taken.length)]
  } else {
    const count = Math.min(lastSection.items.length, -delta)
    if (count === 0) return model
    const kept = lastSection.items.slice(0, lastSection.items.length - count)
    const moved = lastSection.items.slice(lastSection.items.length - count)
    const sections = frame.sections.map((section) => (section === lastSection ? { ...section, items: kept } : section))
    next = [...list.slice(0, located.index), { ...frame, sections }, ...moved, ...list.slice(located.index + 1)]
  }
  const items = withList(model.items, located.trail, () => next)
  return { ...model, items, activations: remapActivations(model, items) }
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

function freeId(model: SequenceModel, base: string): string {
  const taken = new Set(model.participants.map((p) => p.id))
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    const candidate = `${base}${n}`
    if (!taken.has(candidate)) return candidate
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

/** The items with the list at the end of `trail` replaced by `fn` of it; every frame on the way is rebuilt, nothing else. */
function withList(
  items: readonly SequenceItem[],
  trail: readonly Step[],
  fn: (list: readonly SequenceItem[]) => readonly SequenceItem[],
): SequenceItem[] {
  const [step, ...rest] = trail
  if (step === undefined) return [...fn(items)]
  return items.map((item, i) => {
    if (i !== step.item || item.type !== 'frame') return item
    const sections = item.sections.map((section, s) => (s === step.section ? { ...section, items: withList(section.items, rest, fn) } : section))
    return { ...item, sections }
  })
}

function sameTrail(a: readonly Step[], b: readonly Step[]): boolean {
  return a.length === b.length && a.every((step, i) => step.item === b[i]?.item && step.section === b[i]?.section)
}

function insertBefore(items: readonly SequenceItem[], row: number, item: SequenceItem): SequenceItem[] {
  const located = locate(items, row)
  if (located === undefined) return [...items, item]
  return withList(items, located.trail, (list) => [...list.slice(0, located.index), item, ...list.slice(located.index)])
}

/** Every item mapped through `fn`, frames included (their sections are mapped first). */
function mapItems(items: readonly SequenceItem[], fn: (item: SequenceItem) => SequenceItem): SequenceItem[] {
  return items.map((item) => {
    if (item.type !== 'frame') return fn(item)
    const sections = item.sections.map((section) => {
      const mapped = mapItems(section.items, fn)
      return mapped.every((entry, i) => entry === section.items[i]) ? section : { ...section, items: mapped }
    })
    return fn(sections.every((section, i) => section === item.sections[i]) ? item : { ...item, sections })
  })
}

function filterItems(items: readonly SequenceItem[], keep: (item: SequenceItem) => boolean): SequenceItem[] {
  const out: SequenceItem[] = []
  for (const item of items) {
    if (!keep(item)) continue
    if (item.type !== 'frame') {
      out.push(item)
      continue
    }
    const sections = item.sections.map((section) => {
      const kept = filterItems(section.items, keep)
      return kept.length === section.items.length && kept.every((entry, i) => entry === section.items[i]) ? section : { ...section, items: kept }
    })
    out.push(sections.every((section, i) => section === item.sections[i]) ? item : { ...item, sections })
  }
  return out
}

function replaceItem(model: SequenceModel, previous: SequenceItem, next: SequenceItem): SequenceModel {
  const items = mapItems(model.items, (item) => (item === previous ? next : item))
  return { ...model, items, activations: remapActivations(model, items, new Map([[previous, next]])) }
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
 * The activations of `model` on the new items: each span follows the items
 * it starts and ends on by identity (through `replaced` when one was
 * rebuilt); a span that lost either is dropped, and one whose items
 * crossed keeps the range between them.
 */
function remapActivations(
  model: SequenceModel,
  items: readonly SequenceItem[],
  replaced: ReadonlyMap<SequenceItem, SequenceItem> = new Map(),
): Activation[] {
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
    const end = find(span.end)
    if (start === undefined || end === undefined) continue
    out.push({ participantId: span.participantId, start: Math.min(start, end), end: Math.max(start, end) })
  }
  return sortActivations(out)
}

/** The parser's order: start ascending, end descending, then participant id. */
function sortActivations(activations: readonly Activation[]): Activation[] {
  return [...activations].sort((a, b) => a.start - b.start || b.end - a.end || a.participantId.localeCompare(b.participantId))
}
