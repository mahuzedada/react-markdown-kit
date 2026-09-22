/**
 * `SequenceModel` in, Mermaid `sequenceDiagram` out (docs/MERMAID_PLATFORM.md
 * section 4.3).
 *
 * Canonical source for a model, so the canvas can edit the model and commit
 * text: the same model always writes the same text, `parse` reads the text
 * back to an equal model, and Mermaid.js accepts it. The order is fixed:
 * front matter (the JSON-quoted title and the retained front-matter lines),
 * the header, `autonumber`, the participants in declaration order with
 * each box opened where its first participant sits (so the column order
 * the canvas edits survives), the retained body lines, then the items depth
 * first, four spaces per nesting level.
 *
 * Retained lines are re-emitted verbatim, each once, after the participants:
 * they are `link`, `links`, `properties`, `details`, `accTitle`, `accDescr`,
 * directives and comments, which attach to a participant or to the diagram
 * and do not depend on their position. `create` and `destroy` do depend on
 * it and cannot be kept in place, so they are dropped; the parser names
 * `create-destroy` in `lossy` and the canvas lock shows the notice first.
 *
 * Activations are written from `activations`, the source of truth for the
 * bars. A span whose start message carries `+` (towards the participant)
 * and whose end message carries `-` (from it) is spelled by those suffixes;
 * a span the suffixes do not spell gets `activate` after the item where it
 * starts and `deactivate` after the item where it ends. A `-` that closes
 * nothing is dropped, because Mermaid.js rejects it; a `+` is always kept.
 * At one item the statements go in the order Mermaid's stack needs: closes
 * of earlier spans, then opens (longest first), then closes of spans that
 * start and end on that item.
 *
 * Text is unquoted in this dialect, so it goes through the shared
 * `escapeStatementText`: `;` becomes `#59;`, `#` becomes `#35;`, line
 * breaks become `<br/>`. Whitespace at either end of a text, which the
 * parser would trim, is written as `#NN;` entities, and a text starting
 * with `wrap:` or `nowrap:`, which Mermaid reads as a directive, has its
 * first character written as an entity. Ids are written as they are.
 */
import { writeFrontMatterTitle } from '../front-matter.js'
import type { RetainedLine } from '../kind.js'
import { escapeStatementText } from '../text.js'
import type { Activation, Box, Frame, Message, Note, Participant, SequenceItem, SequenceModel } from './model.js'
import { flattenItems } from './model.js'

export interface SequenceWriteOptions {
  /** Lines the parser read through, re-emitted verbatim in their places. Default none. */
  readonly retained?: readonly RetainedLine[]
}

const INDENT = '    '
/** Mermaid's `NUM` token for `autonumber`: an integer or up to two decimals. */
const NUMBER = /^\d+(?:\.\d{1,2})?$/
/** A retained line holding a `create` or `destroy` statement; comment lines never match. */
const CREATE_DESTROY = /^(?!\s*%%)(?:[^;]*;)*\s*(?:create|destroy)\s/i
/** The divider keyword of a frame kind with several sections; the other kinds have one section. */
const SECTION_KEYWORD: Readonly<Partial<Record<Frame['kind'], string>>> = { alt: 'else', par: 'and', critical: 'option' }
const ARROW: Readonly<Record<`${Message['line']}|${Message['head']}`, string>> = {
  'solid|none': '->',
  'dotted|none': '-->',
  'solid|arrow': '->>',
  'dotted|arrow': '-->>',
  'solid|cross': '-x',
  'dotted|cross': '--x',
  'solid|open': '-)',
  'dotted|open': '--)',
}

/** Write a sequence model as Mermaid source, without a trailing newline. */
export function writeSequenceDiagram(model: SequenceModel, options: SequenceWriteOptions = {}): string {
  const retained = options.retained ?? []
  const frontMatter = retained.filter((line) => line.place === 'frontMatter').map((line) => line.text)
  const body = retained.filter((line) => line.place === 'body' && !CREATE_DESTROY.test(line.text)).map((line) => line.text)
  const lines = [
    ...(model.title === undefined && frontMatter.length === 0
      ? []
      : ['---', ...(model.title === undefined ? [] : [writeFrontMatterTitle(model.title)]), ...frontMatter, '---']),
    'sequenceDiagram',
    ...numberingLines(model.numbering),
    ...participantLines(model.participants, model.boxes),
    ...body,
    ...itemLines(model.items, model.activations),
  ]
  return lines.join('\n')
}

function numberingLines(numbering: SequenceModel['numbering']): string[] {
  if (numbering === undefined) return []
  const start = String(numbering.start)
  const step = String(numbering.step)
  if (!NUMBER.test(start)) return [`${INDENT}autonumber`]
  if (!NUMBER.test(step) || step === '1') return [start === '1' ? `${INDENT}autonumber` : `${INDENT}autonumber ${start}`]
  return [`${INDENT}autonumber ${start} ${step}`]
}

/**
 * Participants in declaration order. A box is written where its first
 * participant sits, holding every participant it names in the box's order,
 * so a model the parser produced keeps its column order. A participant
 * appears once, in the first box that names it; a box naming nobody known
 * is not written.
 */
function participantLines(participants: readonly Participant[], boxes: readonly Box[]): string[] {
  const byId = new Map(participants.map((participant) => [participant.id, participant]))
  const written = new Set<string>()
  const writtenBoxes = new Set<Box>()
  const out: string[] = []
  for (const participant of participants) {
    if (written.has(participant.id)) continue
    const box = boxes.find((candidate) => !writtenBoxes.has(candidate) && candidate.participantIds.includes(participant.id))
    if (box === undefined) {
      out.push(INDENT + participantLine(participant))
      written.add(participant.id)
      continue
    }
    writtenBoxes.add(box)
    out.push(`${INDENT}box${labelSuffix(box.label ?? '')}`)
    for (const id of box.participantIds) {
      const member = byId.get(id)
      if (member === undefined || written.has(id)) continue
      out.push(INDENT + INDENT + participantLine(member))
      written.add(id)
    }
    out.push(`${INDENT}end`)
  }
  return out
}

function participantLine(participant: Participant): string {
  const alias = participant.label === '' || participant.label === participant.id ? '' : ` as ${labelText(participant.label)}`
  return `${participant.kind} ${participant.id}${alias}`
}

function itemLines(items: readonly SequenceItem[], activations: readonly Activation[]): string[] {
  const flat = flattenItems(items)
  if (flat.length === 0) {
    // Nothing to attach a span to: the parser reads both statements at index 0.
    return activations.flatMap((span) => [`${INDENT}activate ${span.participantId}`, `${INDENT}deactivate ${span.participantId}`])
  }
  const plan = planActivations(flat, activations)
  const out: string[] = []
  let index = 0
  const walk = (list: readonly SequenceItem[], depth: number): void => {
    const indent = INDENT.repeat(depth + 1)
    for (const item of list) {
      const i = index
      index += 1
      if (item.type === 'frame') {
        const sections = frameSections(item)
        out.push(`${indent}${item.kind}${labelSuffix(sections[0]?.label ?? '')}`)
        out.push(...(plan.statements[i] ?? []).map((statement) => INDENT + indent + statement))
        sections.forEach((section, n) => {
          if (n > 0) out.push(`${indent}${SECTION_KEYWORD[item.kind] ?? ''}${labelSuffix(section.label)}`)
          walk(section.items, depth + 1)
        })
        out.push(`${indent}end`)
        continue
      }
      const line = item.type === 'message' ? messageLine(item, plan.suffixes[i]) : noteLine(item)
      if (line !== undefined) out.push(indent + line)
      out.push(...(plan.statements[i] ?? []).map((statement) => indent + statement))
    }
  }
  walk(items, 0)
  return out
}

/** The sections to write: as they are for `alt`, `par` and `critical`; merged into one for the kinds Mermaid gives one section. */
function frameSections(frame: Frame): Frame['sections'] {
  const first = frame.sections[0]
  if (first === undefined) return [{ label: '', items: [] }]
  if (SECTION_KEYWORD[frame.kind] !== undefined || frame.sections.length === 1) return frame.sections
  return [{ label: first.label, items: frame.sections.flatMap((section) => section.items) }]
}

function messageLine(message: Message, suffix: Message['activate'] | undefined): string {
  return `${message.from}${arrow(message)}${suffix ?? ''}${message.to}:${textSuffix(message.text)}`
}

function arrow(message: Message): string {
  if (message.bidirectional && message.head === 'arrow') return message.line === 'solid' ? '<<->>' : '<<-->>'
  return ARROW[`${message.line}|${message.head}`]
}

/** A note names one participant, or two for `over`; a note naming nobody has no Mermaid spelling and is left out. */
function noteLine(note: Note): string | undefined {
  const ids = note.participantIds.filter((id) => id !== '')
  if (ids.length === 0) return undefined
  const target = note.placement === 'over' ? `over ${ids.slice(0, 2).join(',')}` : `${note.placement} of ${ids[0] ?? ''}`
  return `Note ${target}:${textSuffix(note.text)}`
}

interface ActivationPlan {
  /** The suffix to write on the message at each flat index, once a `-` that closes nothing is dropped. */
  readonly suffixes: readonly (Message['activate'] | undefined)[]
  /** The `activate`/`deactivate` statements to write after the item at each flat index. */
  readonly statements: readonly (readonly string[])[]
}

/**
 * Replays Mermaid's activation stack over the flat items, taking each span
 * from `activations` as the target: a `+` on the message where a span
 * starts, towards its participant, spells the open; a `-` on the message
 * where it ends, from its participant, spells the close; every open and
 * close the suffixes do not spell becomes a statement after that item.
 */
function planActivations(flat: readonly SequenceItem[], activations: readonly Activation[]): ActivationPlan {
  const last = flat.length - 1
  const startsAt = new Map<number, Activation[]>()
  const endsAt = new Map<number, Activation[]>()
  for (const raw of activations) {
    if (!Number.isFinite(raw.start) || !Number.isFinite(raw.end)) continue
    const start = Math.min(Math.max(0, Math.trunc(raw.start)), last)
    const end = Math.min(Math.max(start, Math.trunc(raw.end)), last)
    const span: Activation = { participantId: raw.participantId, start, end }
    push(startsAt, start, span)
    if (end > start) push(endsAt, end, span)
  }
  for (const spans of startsAt.values()) spans.sort((a, b) => b.end - a.end)

  const depth = new Map<string, number>()
  const open = (id: string): void => {
    depth.set(id, (depth.get(id) ?? 0) + 1)
  }
  const close = (id: string): boolean => {
    const current = depth.get(id) ?? 0
    if (current === 0) return false
    depth.set(id, current - 1)
    return true
  }
  const suffixes: (Message['activate'] | undefined)[] = []
  const statements: string[][] = []
  flat.forEach((item, i) => {
    const opens = [...(startsAt.get(i) ?? [])]
    const closes = [...(endsAt.get(i) ?? [])]
    const selfCloses = opens.filter((span) => span.end === i)
    let suffix = item.type === 'message' ? item.activate : undefined
    if (item.type === 'message' && suffix === '+') {
      open(item.to)
      take(opens, item.to)
    } else if (item.type === 'message' && suffix === '-') {
      if (close(item.from)) take(closes, item.from)
      else suffix = undefined
    }
    suffixes.push(suffix)
    const after: string[] = []
    for (const span of closes) if (close(span.participantId)) after.push(`deactivate ${span.participantId}`)
    for (const span of opens) {
      open(span.participantId)
      after.push(`activate ${span.participantId}`)
    }
    for (const span of selfCloses) if (close(span.participantId)) after.push(`deactivate ${span.participantId}`)
    statements.push(after)
  })
  return { suffixes, statements }
}

function push(map: Map<number, Activation[]>, key: number, span: Activation): void {
  const list = map.get(key)
  if (list === undefined) map.set(key, [span])
  else list.push(span)
}

/** Remove the first span of `id` from `spans`, when there is one. */
function take(spans: Activation[], id: string): void {
  const at = spans.findIndex((span) => span.participantId === id)
  if (at >= 0) spans.splice(at, 1)
}

/** `: text`, or a bare `:` for empty text, which Mermaid and the parser both accept. */
function textSuffix(text: string): string {
  const written = bodyText(text)
  return written === '' ? '' : ` ${written}`
}

/** ` label`, or nothing for an empty label: `loop`, `else` and `box` stand alone. */
function labelSuffix(label: string): string {
  const written = labelText(label)
  return written === '' ? '' : ` ${written}`
}

/** Escaped label text whose leading and trailing whitespace, which the parser trims, is written as entities. */
function labelText(text: string): string {
  return escapeStatementText(text).replace(/^\s+|\s+$/g, (whitespace) => [...whitespace].map(entity).join(''))
}

/** `labelText`, and a leading `wrap:`/`nowrap:`, which Mermaid reads as a directive, has its first character written as an entity. */
function bodyText(text: string): string {
  const written = labelText(text)
  return /^(?:no)?wrap:/i.test(written) ? entity(written.charAt(0)) + written.slice(1) : written
}

function entity(char: string): string {
  return `#${char.codePointAt(0) ?? 0xfffd};`
}
