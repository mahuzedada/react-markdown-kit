/*
 * Colours for the deck source in the left pane. It reads a line at a time
 * and carries two bits of state down the file: whether it is inside the
 * front matter and whether it is inside a code fence. Slide breaks, the
 * three markers and `<!-- key: value -->` directives get their own colours,
 * since they're what the plugin reads; headings, list bullets, quotes and a
 * little inline Markdown get the rest. It never throws and never changes
 * the text, so the coloured layer lines up with the textarea over it.
 */
import type { CodeToken } from '../../components/CodePane'

export type DeckTokenKind = 'break' | 'marker' | 'directive' | 'value' | 'key' | 'heading' | 'fence' | 'code' | 'bullet' | 'quote' | 'inlineCode' | 'strong' | 'link'

export type DeckToken = CodeToken<DeckTokenKind>

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const BREAK = /^ {0,3}-{3,}\s*$/
const MARKER = /^(?:--|\?\?\?|::right::)\s*$/
const DIRECTIVE = /^(\s*<!--\s*[a-z][\w-]*\s*:)(.*?)(\s*-->\s*)$/i
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/
const LIST = /^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/
const QUOTE = /^(\s*>+\s?)(.*)$/
const KEY = /^(\s*[A-Za-z_][\w-]*\s*:)(.*)$/
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]*\]\([^)\n]*\))/g
const INLINE_KINDS: readonly DeckTokenKind[] = ['inlineCode', 'strong', 'link']

function whole(kind: DeckToken['kind'], text: string): DeckToken[] {
  return text === '' ? [] : [{ kind, text }]
}

function inline(text: string): DeckToken[] {
  const tokens: DeckToken[] = []
  let last = 0
  INLINE.lastIndex = 0
  for (let match = INLINE.exec(text); match !== null; match = INLINE.exec(text)) {
    if (match.index > last) tokens.push({ kind: 'plain', text: text.slice(last, match.index) })
    const group = match.findIndex((value, index) => index > 0 && value !== undefined)
    tokens.push({ kind: INLINE_KINDS[group - 1] ?? 'plain', text: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) tokens.push({ kind: 'plain', text: text.slice(last) })
  return tokens
}

function prose(line: string): DeckToken[] {
  if (BREAK.test(line)) return whole('break', line)
  if (MARKER.test(line)) return whole('marker', line)
  const directive = DIRECTIVE.exec(line)
  if (directive !== null) return [...whole('directive', directive[1]!), ...whole('value', directive[2]!), ...whole('directive', directive[3]!)]
  if (HEADING.test(line)) return whole('heading', line)
  const list = LIST.exec(line)
  if (list !== null) return [...whole('plain', list[1]!), { kind: 'bullet', text: list[2]! }, { kind: 'plain', text: list[3]! }, ...inline(list[4]!)]
  const quote = QUOTE.exec(line)
  if (quote !== null) return [{ kind: 'quote', text: quote[1]! }, ...inline(quote[2]!)]
  return inline(line)
}

function frontMatterLine(line: string): DeckToken[] {
  const key = KEY.exec(line)
  return key === null ? whole('value', line) : [{ kind: 'key', text: key[1]! }, ...whole('value', key[2]!)]
}

/** Every line of `source`, tokenized. A trailing newline yields a final empty line, as a textarea shows it. */
export function tokenizeDeck(source: string): DeckToken[][] {
  const lines = source.split('\n')
  let inFrontMatter = lines[0]?.trim() === '---' && KEY.test(lines[1] ?? '')
  let fence: string | undefined
  return lines.map((line, index) => {
    if (inFrontMatter) {
      if (index > 0 && line.trim() === '---') inFrontMatter = false
      return line.trim() === '---' ? whole('break', line) : frontMatterLine(line)
    }
    const opening = FENCE.exec(line)?.[1]
    if (fence !== undefined) {
      if (opening !== undefined && opening[0] === fence[0] && opening.length >= fence.length) {
        fence = undefined
        return whole('fence', line)
      }
      return whole('code', line)
    }
    if (opening !== undefined) {
      fence = opening
      return whole('fence', line)
    }
    return prose(line)
  })
}
