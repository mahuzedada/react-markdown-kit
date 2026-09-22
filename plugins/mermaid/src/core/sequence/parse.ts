/**
 * Mermaid `sequenceDiagram` in, `SequenceModel` out (docs/MERMAID_PLATFORM.md
 * section 8.2).
 *
 * A line scanner in the style of `mermaid-parse.ts`, tolerant by contract:
 * the only error is a fence whose first statement is not `sequenceDiagram`.
 * Every other statement is either modelled, or reported as a problem and
 * kept as a retained line so nothing an author wrote is lost. Problems are
 * `invalid` when Mermaid.js itself would reject the fence (checked against
 * Mermaid 11) and `ignored` when Mermaid accepts a statement this kind does
 * not draw. One problem per code and line: a line that fails in several
 * places is reported once.
 *
 * Lexing follows Mermaid's: keywords are case-insensitive and win over
 * message actors, `;` ends a statement, a bare `#` starts a comment while
 * `#NN;` and `#name;` are entities, `%%` starts a comment only where a
 * statement starts or after the header, `end` or `autonumber` (inside
 * message text or an id it is text), a `%%{ … }%%`
 * directive may span lines and runs to `}%%` or the end of the body, the
 * header is the leading `sequenceDiagram` token and the rest of its line is
 * the first statement, and actor names in messages may hold spaces, hyphens
 * and parentheses but never `+ < > : , ;`. A message end or note target
 * that starts with a keyword is lexed as that keyword by Mermaid, so it is
 * an invalid reserved id here; declarations (`participant`, `activate`,
 * `box`) take any id, as Mermaid's lexer does in its id state. A line with
 * several statements is retained once when any of them is.
 *
 * `create` and `destroy` are read for the participant they declare and
 * retained, but their position among the messages is not modelled, so the
 * writer drops them and the parse names `create-destroy` in `lossy`: the
 * canvas then locks until the author accepts that an edit flattens them.
 */
import { readFrontMatterTitle, splitFrontMatter } from '../front-matter.js'
import type { DiagramParse, DiagramParseError, DiagramProblem, RetainedLine } from '../kind.js'
import { decodeText } from '../text.js'
import type { Activation, Box, Frame, Message, Participant, SequenceItem, SequenceModel } from './model.js'

export const SEQUENCE_PROBLEM_CODES = {
  unknownStatement: 'SEQUENCE_DIAGRAM_UNKNOWN_STATEMENT',
  reservedId: 'SEQUENCE_DIAGRAM_RESERVED_ID',
  deactivateInactive: 'SEQUENCE_DIAGRAM_DEACTIVATE_INACTIVE',
  endWithoutOpener: 'SEQUENCE_DIAGRAM_END_WITHOUT_OPENER',
  sectionOutsideFrame: 'SEQUENCE_DIAGRAM_SECTION_OUTSIDE_FRAME',
  frameUnclosed: 'SEQUENCE_DIAGRAM_FRAME_UNCLOSED',
  activationUnclosed: 'SEQUENCE_DIAGRAM_ACTIVATION_UNCLOSED',
  statementIgnored: 'SEQUENCE_DIAGRAM_STATEMENT_IGNORED',
} as const

/** The `lossy` name for `create` and `destroy` statements, which the writer cannot keep in place. */
export const LOSSY_CREATE_DESTROY = 'create-destroy'

const HEADER = 'sequenceDiagram'
/** The header token, case-sensitive like detection; what follows on the line is the first statement. */
const HEADER_TOKEN = /^sequenceDiagram\b\s*/

/** Arrow spellings, longest first so `-->>` wins over `->` and `-->`. */
const ARROWS: readonly [token: string, line: Message['line'], head: Message['head'], bidirectional: boolean][] = [
  ['<<-->>', 'dotted', 'arrow', true],
  ['<<->>', 'solid', 'arrow', true],
  ['-->>', 'dotted', 'arrow', false],
  ['->>', 'solid', 'arrow', false],
  ['-->', 'dotted', 'none', false],
  ['->', 'solid', 'none', false],
  ['--x', 'dotted', 'cross', false],
  ['-x', 'solid', 'cross', false],
  ['--)', 'dotted', 'open', false],
  ['-)', 'solid', 'open', false],
]
const ARROW_PATTERN = ARROWS.map(([token]) => token.replace(/[()]/g, '\\$&')).join('|')
/**
 * `from ARROW [+|-] to : text`, actors as Mermaid's lexer bounds them: `(`
 * and `)` are actor characters, but `to` cannot start with `(` (Mermaid
 * rejects `A->>(B): x`). The last group keeps `to`'s tail (`: text`) so the
 * reserved-keyword check sees what Mermaid's lexer would see after the id.
 */
const MESSAGE = new RegExp(`^([^+<>:,;]+?)\\s*(${ARROW_PATTERN})\\s*([+-])?\\s*((?!\\()[^+<>:,;]+?)(\\s*:.*)$`)
/** Half arrows (`-|\\`, `//-`, dotted forms): accepted by Mermaid 11, not drawn here. */
const HALF_ARROW = /-{1,2}(\|\\|\|\/|\\\\|\/\/)|(\/\||\\\||\/\/|\\\\)-{1,2}/
/** `note PLACEMENT ids : text`; the last group keeps the ids' tail for the reserved-keyword check. */
const NOTE = /^note\s+(left of|right of|over)\s+([^:]+?)(\s*:.*)$/i
const PARTICIPANT = /^(participant|actor)\s+(.+)$/i
const ALIAS = /^(.+?)\s+as\s+(.+)$/i
const FRAME_OPENER = /^(loop|opt|alt|par_over|par|critical|break|rect)\b\s*(.*)$/i
const SECTION = /^(else|and|option)\b\s*(.*)$/i
const END = /^end\b(.*)$/i
const TITLE = /^title(?::\s|\s)\s*(.+)$/i
const ACC = /^acc(Title|Descr)\s*(:|\{)/i
const IGNORED_KEYWORD = /^(link|links|properties|details|destroy)\s/i
const NUMBER = /^\d+(?:\.\d{1,2})?$|^\.\d{1,2}$/
/**
 * What may precede a `%%` comment on a statement: nothing, or a token after
 * which Mermaid's lexer is back in its initial state (the header, `end`,
 * `autonumber` and its arguments). After anything else (`deactivate A`, a
 * frame label, message text) `%%` is part of the token.
 */
const BEFORE_COMMENT = /^(?:sequenceDiagram|end|autonumber\b.*)?$/i
/**
 * What Mermaid's lexer reads as a keyword at the start of an actor id in a
 * message or note, given the id and the text after it. Word keywords need a
 * word boundary (`end point` is `end`, `endpoint` is an actor); `title` is
 * a keyword only before whitespace or `: `; `accTitle`/`accDescr` only
 * before their `:` or `{`.
 */
const RESERVED_ID =
  /^(?:(box|participant|actor|create|destroy|loop|rect|opt|alt|else|par_over|par|and|critical|option|break|end|left of|right of|links|link|properties|details|over|note|activate|deactivate|sequenceDiagram|autonumber|off)\b|(title)(?=\s|:\s)|(accTitle)(?=\s*:)|(accDescr)(?=\s*[:{]))/i

const SECTION_FRAME: Readonly<Record<string, Frame['kind']>> = { else: 'alt', and: 'par', option: 'critical' }

const UNKNOWN_MESSAGE = 'This statement is not sequence diagram syntax.'
const UNKNOWN_AFTER_SEMICOLON_MESSAGE =
  'This statement is not sequence diagram syntax; ";" ends a statement, so write #59; for a semicolon in text and #38;, #lt;, #gt; instead of &amp;, &lt;, &gt;.'

interface OpenFrame {
  readonly frame: Frame
  readonly line: number
}

interface OpenActivation {
  readonly start: number
  readonly line: number
}

interface Statement {
  readonly text: string
  /** The statement came after a `;` on its line. */
  readonly afterSemicolon: boolean
}

interface SplitLine {
  readonly statements: readonly Statement[]
  /** A `%%` comment that started where a statement would, to the end of the line. */
  readonly comment?: string
}

export function parseSequenceDiagram(source: string): DiagramParse<SequenceModel> | DiagramParseError {
  const { frontMatter, body, bodyOffset } = splitFrontMatter(source)
  const problems: DiagramProblem[] = []
  const retainedByLine = new Map<number, RetainedLine>()
  const retain = (line: number, text: string, place: RetainedLine['place'] = 'body'): void => {
    if (!retainedByLine.has(line)) retainedByLine.set(line, { line, text, place })
  }

  let title = readFrontMatterTitle(frontMatter)
  if (frontMatter !== undefined) {
    frontMatter.split(/\r?\n/).forEach((text, i) => {
      if (!/^\s*title:/.test(text)) retain(2 + i, text, 'frontMatter')
    })
  }

  const participants: Participant[] = []
  const boxes: Box[] = []
  const items: SequenceItem[] = []
  const activations: Activation[] = []
  const openActivations = new Map<string, OpenActivation[]>()
  const frames: OpenFrame[] = []
  let openBox: { readonly box: Box; readonly line: number } | undefined
  let numbering: SequenceModel['numbering']
  let messageSeen = false
  let headerSeen = false
  let flat = 0
  let accDescrOpen = false
  let createDestroySeen = false

  const problem = (code: string, severity: DiagramProblem['severity'], message: string, line: number): void => {
    if (problems.some((p) => p.code === code && p.line === line)) return
    problems.push({ code, severity, message, line })
  }
  const ignore = (line: number, text: string, message: string): void => {
    problem(SEQUENCE_PROBLEM_CODES.statementIgnored, 'ignored', message, line)
    retain(line, text)
  }
  const unknown = (line: number, text: string, afterSemicolon: boolean): void => {
    problem(SEQUENCE_PROBLEM_CODES.unknownStatement, 'invalid', afterSemicolon ? UNKNOWN_AFTER_SEMICOLON_MESSAGE : UNKNOWN_MESSAGE, line)
    retain(line, text)
  }
  /** Report an actor id Mermaid would lex as a keyword; `context` is the id and what follows it. */
  const checkReservedId = (context: string, line: number): void => {
    const keyword = reservedKeyword(context)
    if (keyword !== undefined) {
      problem(SEQUENCE_PROBLEM_CODES.reservedId, 'invalid', `"${keyword}" is a Mermaid keyword and cannot be a participant id.`, line)
    }
  }
  const currentItems = (): SequenceItem[] => {
    const top = frames[frames.length - 1]
    if (top === undefined) return items
    const section = top.frame.sections[top.frame.sections.length - 1]
    return section === undefined ? items : section.items
  }
  const push = (item: SequenceItem): number => {
    currentItems().push(item)
    return flat++
  }
  const ensureParticipant = (id: string, kind?: Participant['kind'], label?: string): void => {
    const existing = participants.find((p) => p.id === id)
    if (existing === undefined) {
      participants.push({ id, label: label ?? id, kind: kind ?? 'participant' })
      return
    }
    if (kind !== undefined) existing.kind = kind
    if (label !== undefined) existing.label = label
  }
  const declareParticipant = (rest: string, kind: Participant['kind'], line: number, text: string): boolean => {
    let declaration = rest.trim()
    const config = declaration.indexOf('@{')
    if (config >= 0) {
      declaration = declaration.slice(0, config).trim()
      ignore(line, text, 'The "@{ }" participant config is not drawn.')
    }
    const alias = ALIAS.exec(declaration)
    const id = (alias?.[1] ?? declaration).trim()
    if (id === '' || /[<>:,;]/.test(id)) return false
    const label = alias === null ? undefined : decodeText(alias[2]?.trim() ?? id)
    ensureParticipant(id, kind, label)
    if (openBox !== undefined && !openBox.box.participantIds.includes(id)) openBox.box.participantIds.push(id)
    return true
  }
  const endActivation = (id: string, end: number): boolean => {
    const open = openActivations.get(id)
    const last = open?.pop()
    if (last === undefined) return false
    activations.push({ participantId: id, start: last.start, end })
    return true
  }

  const bodyLineStart = 1 + (source.slice(0, bodyOffset).match(/\r\n|\r|\n/g)?.length ?? 0)
  const bodyLines = body.split(/\r?\n/)

  for (let i = 0; i < bodyLines.length; i += 1) {
    const text = bodyLines[i] ?? ''
    const line = bodyLineStart + i
    if (accDescrOpen) {
      retain(line, text)
      if (text.includes('}')) accDescrOpen = false
      continue
    }
    const trimmed = text.trim()
    if (trimmed === '') continue
    if (trimmed.startsWith('%%{') && !trimmed.includes('}%%')) {
      const last = directiveEnd(bodyLines, i)
      for (let j = i; j <= last; j += 1) retain(bodyLineStart + j, bodyLines[j] ?? '')
      i = last
      continue
    }
    if (trimmed.startsWith('%%')) {
      retain(line, text)
      continue
    }

    const { statements, comment } = splitStatements(text)
    for (const statement of statements) {
      let s = statement.text
      if (!headerSeen) {
        const header = HEADER_TOKEN.exec(s)
        if (header === null) return { error: `Not a sequence diagram: expected "${HEADER}", got "${s.slice(0, 40)}".`, line }
        headerSeen = true
        s = s.slice(header[0].length)
        if (s === '') continue
      }

      if (openBox !== undefined) {
        const declaration = PARTICIPANT.exec(s)
        if (declaration !== null) {
          if (!declareParticipant(declaration[2] ?? '', declaration[1]?.toLowerCase() as Participant['kind'], line, text)) {
            unknown(line, text, statement.afterSemicolon)
          }
          continue
        }
        const end = END.exec(s)
        if (end !== null) {
          boxes.push(openBox.box)
          openBox = undefined
          if ((end[1] ?? '').trim() !== '') unknown(line, text, statement.afterSemicolon)
          continue
        }
        unknown(line, text, statement.afterSemicolon)
        continue
      }

      const declaration = PARTICIPANT.exec(s)
      if (declaration !== null) {
        if (!declareParticipant(declaration[2] ?? '', declaration[1]?.toLowerCase() as Participant['kind'], line, text)) {
          unknown(line, text, statement.afterSemicolon)
        }
        continue
      }
      const create = /^create\s+(.*)$/i.exec(s)
      if (create !== null) {
        const created = PARTICIPANT.exec(create[1] ?? '')
        if (created === null || !declareParticipant(created[2] ?? '', created[1]?.toLowerCase() as Participant['kind'], line, text)) {
          unknown(line, text, statement.afterSemicolon)
          continue
        }
        ignore(line, text, '"create" is not drawn; the participant is shown from the start.')
        createDestroySeen = true
        continue
      }
      if (IGNORED_KEYWORD.test(s)) {
        const keyword = (/^[a-z]+/i.exec(s)?.[0] ?? '').toLowerCase()
        ignore(line, text, keyword === 'destroy' ? '"destroy" is not drawn; the participant is shown to the end.' : `"${keyword}" statements are not drawn.`)
        if (keyword === 'destroy') createDestroySeen = true
        continue
      }
      const acc = ACC.exec(s)
      if (acc !== null) {
        ignore(line, text, `"acc${acc[1] ?? ''}" is not drawn.`)
        if (acc[2] === '{' && !s.includes('}')) accDescrOpen = true
        continue
      }
      const box = /^box\b\s*(.*)$/i.exec(s)
      if (box !== null) {
        const label = box[1]?.trim() ?? ''
        openBox = { box: label === '' ? { participantIds: [] } : { label: decodeText(label), participantIds: [] }, line }
        continue
      }
      // `end` closes a frame; `end` used as a message actor (`end->>B: x`) is a message with a reserved id.
      const end = END.exec(s)
      if (end !== null && !MESSAGE.test(s)) {
        if (frames.pop() === undefined) {
          problem(SEQUENCE_PROBLEM_CODES.endWithoutOpener, 'invalid', '"end" closes nothing.', line)
          retain(line, text)
        }
        if ((end[1] ?? '').trim() !== '') unknown(line, text, statement.afterSemicolon)
        continue
      }
      const opener = FRAME_OPENER.exec(s)
      if (opener !== null) {
        const keyword = (opener[1] ?? '').toLowerCase()
        const kind = (keyword === 'par_over' ? 'par' : keyword) as Frame['kind']
        const frame: Frame = { type: 'frame', kind, sections: [{ label: decodeText(opener[2]?.trim() ?? ''), items: [] }] }
        push(frame)
        frames.push({ frame, line })
        continue
      }
      const section = SECTION.exec(s)
      if (section !== null) {
        const keyword = (section[1] ?? '').toLowerCase()
        const top = frames[frames.length - 1]
        const expected = SECTION_FRAME[keyword] ?? 'alt'
        if (top === undefined || top.frame.kind !== expected) {
          problem(SEQUENCE_PROBLEM_CODES.sectionOutsideFrame, 'invalid', `"${keyword}" needs an open "${expected}".`, line)
          retain(line, text)
          continue
        }
        top.frame.sections.push({ label: decodeText(section[2]?.trim() ?? ''), items: [] })
        continue
      }
      const autonumber = /^autonumber\b\s*(.*)$/i.exec(s)
      if (autonumber !== null) {
        const args = (autonumber[1] ?? '').trim()
        if (/^off$/i.test(args)) {
          ignore(line, text, '"autonumber off" is not applied.')
          continue
        }
        const parts = args === '' ? [] : args.split(/\s+/)
        if (parts.length > 2 || !parts.every((part) => NUMBER.test(part))) {
          unknown(line, text, statement.afterSemicolon)
          continue
        }
        if (messageSeen || numbering !== undefined) {
          ignore(line, text, 'A later "autonumber" is not applied.')
          continue
        }
        numbering = { start: parts[0] === undefined ? 1 : Number(parts[0]), step: parts[1] === undefined ? 1 : Number(parts[1]) }
        continue
      }
      const activate = /^(activate|deactivate)\s+(.+)$/i.exec(s)
      if (activate !== null) {
        const id = (activate[2] ?? '').trim()
        ensureParticipant(id)
        if ((activate[1] ?? '').toLowerCase() === 'activate') {
          const open = openActivations.get(id) ?? []
          open.push({ start: Math.max(0, flat - 1), line })
          openActivations.set(id, open)
        } else if (!endActivation(id, Math.max(0, flat - 1))) {
          problem(SEQUENCE_PROBLEM_CODES.deactivateInactive, 'invalid', `"${id}" is not active.`, line)
          retain(line, text)
        }
        continue
      }
      const note = NOTE.exec(s)
      if (note !== null) {
        const placement = (note[1] ?? '').toLowerCase().replace(' of', '') as 'left' | 'right' | 'over'
        const rawIds = note[2] ?? ''
        const ids = rawIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id !== '')
        if (ids.length === 0 || ids.length > (placement === 'over' ? 2 : 1)) {
          unknown(line, text, statement.afterSemicolon)
          continue
        }
        for (const context of idContexts(rawIds + (note[3] ?? ''))) checkReservedId(context, line)
        for (const id of ids) ensureParticipant(id)
        push({ type: 'note', placement, participantIds: ids, text: messageText(stripColon(note[3] ?? '')) })
        continue
      }
      const titled = TITLE.exec(s)
      if (titled !== null) {
        title = decodeText((titled[1] ?? '').trim())
        continue
      }
      const colon = s.indexOf(':')
      const head = colon < 0 ? '' : s.slice(0, colon)
      if (HALF_ARROW.test(head) || head.includes('()')) {
        ignore(line, text, HALF_ARROW.test(head) ? 'Half-arrow messages are not drawn.' : '"()" connections are not drawn.')
        continue
      }
      const message = MESSAGE.exec(s)
      if (message !== null) {
        const from = (message[1] ?? '').trim()
        const to = (message[4] ?? '').trim()
        const arrow = ARROWS.find(([token]) => token === message[2])
        if (arrow === undefined) {
          unknown(line, text, statement.afterSemicolon)
          continue
        }
        checkReservedId(s, line)
        checkReservedId(`${message[4] ?? ''}${message[5] ?? ''}`, line)
        ensureParticipant(from)
        ensureParticipant(to)
        const item: Message = {
          type: 'message',
          from,
          to,
          line: arrow[1],
          head: arrow[2],
          bidirectional: arrow[3],
          text: messageText(stripColon(message[5] ?? '')),
          ...(message[3] === undefined ? {} : { activate: message[3] as '+' | '-' }),
        }
        const index = push(item)
        messageSeen = true
        if (item.activate === '+') {
          const open = openActivations.get(to) ?? []
          open.push({ start: index, line })
          openActivations.set(to, open)
        } else if (item.activate === '-' && !endActivation(from, index)) {
          problem(SEQUENCE_PROBLEM_CODES.deactivateInactive, 'invalid', `"${from}" is not active.`, line)
        }
        continue
      }
      unknown(line, text, statement.afterSemicolon)
    }
    if (comment !== undefined) retain(line, comment)
  }

  if (!headerSeen) return { error: 'Not a sequence diagram: the block is empty.' }

  if (openBox !== undefined) {
    problem(SEQUENCE_PROBLEM_CODES.frameUnclosed, 'invalid', `"box" on line ${openBox.line} is not closed.`, openBox.line)
  }
  for (const open of frames) {
    problem(SEQUENCE_PROBLEM_CODES.frameUnclosed, 'invalid', `"${open.frame.kind}" on line ${open.line} is not closed.`, open.line)
  }
  const lastIndex = Math.max(0, flat - 1)
  for (const [id, open] of openActivations) {
    for (const activation of open) {
      problem(SEQUENCE_PROBLEM_CODES.activationUnclosed, 'ignored', `"${id}" is still active at the end.`, activation.line)
      activations.push({ participantId: id, start: activation.start, end: lastIndex })
    }
  }
  activations.sort((a, b) => a.start - b.start || b.end - a.end || a.participantId.localeCompare(b.participantId))

  const model: SequenceModel = {
    ...(title === undefined ? {} : { title }),
    participants,
    boxes,
    items,
    activations,
    ...(numbering === undefined ? {} : { numbering }),
  }
  const retained = [...retainedByLine.values()].sort((a, b) => a.line - b.line)
  return { model, problems, retained, lossy: createDestroySeen ? [LOSSY_CREATE_DESTROY] : [] }
}

/** Mermaid's text token: an optional `wrap:`/`nowrap:` prefix, then the text, entities decoded. */
function messageText(raw: string): string {
  return decodeText(raw.replace(/^\s*(?:no)?wrap:/i, '').trim())
}

/** The text after the `:` that ends an actor or note tail. */
function stripColon(tail: string): string {
  return tail.replace(/^\s*:/, '')
}

/** The keyword Mermaid's lexer reads at the start of an actor id, given the id and what follows it, or undefined. */
function reservedKeyword(context: string): string | undefined {
  const match = RESERVED_ID.exec(context)
  return match === null ? undefined : (match[1] ?? match[2] ?? match[3] ?? match[4])
}

/**
 * Each comma-separated id of a note with everything after it, as Mermaid's
 * lexer sees it: `A, end: x` gives `A, end: x` and `end: x`.
 */
function idContexts(idsAndTail: string): string[] {
  const out: string[] = []
  let offset = 0
  for (const segment of idsAndTail.split(',')) {
    out.push(idsAndTail.slice(offset + (segment.length - segment.trimStart().length)))
    offset += segment.length + 1
  }
  return out
}

/**
 * The index of the line that closes a `%%{` directive opened at `start`,
 * or the last line when it never closes, as Mermaid's directive regex takes
 * an unclosed directive to the end of the text.
 */
function directiveEnd(lines: readonly string[], start: number): number {
  for (let i = start; i < lines.length; i += 1) {
    if ((lines[i] ?? '').includes('}%%')) return i
  }
  return lines.length - 1
}

/**
 * Split a line into statements the way Mermaid's lexer does: a bare `#`
 * starts a comment for the rest of the line and `;` ends a statement, while
 * `#NN;` and `#name;` entities are text and never split. A `%%` where a
 * statement starts, or after a token that leaves the lexer in its initial
 * state (`BEFORE_COMMENT`), is a comment to the end of the line, returned
 * separately so it can be retained; the statements after it are gone, as
 * in Mermaid.
 */
function splitStatements(line: string): SplitLine {
  const out: Statement[] = []
  let current = ''
  let afterSemicolon = false
  let comment: string | undefined
  const flush = (): void => {
    const text = current.trim()
    if (text !== '') out.push({ text, afterSemicolon })
    current = ''
  }
  const entity = /^#\w+;/
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? ''
    if (char === '#') {
      const match = entity.exec(line.slice(i))
      if (match === null) break
      current += match[0]
      i += match[0].length - 1
      continue
    }
    if (char === '%' && line[i + 1] === '%' && BEFORE_COMMENT.test(current.trim())) {
      comment = line.slice(i)
      break
    }
    if (char === ';') {
      flush()
      afterSemicolon = true
      continue
    }
    current += char
  }
  flush()
  return comment === undefined ? { statements: out } : { statements: out, comment }
}
