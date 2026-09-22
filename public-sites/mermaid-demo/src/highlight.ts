/*
 * A small tokenizer for Mermaid syntax, enough to colour the code pane. The
 * keyword set follows the diagram kind the plugin detected: flowchart lines
 * have comments, quoted text, edge labels, edge operators, colours, keywords,
 * directions and shape brackets; sequence diagram lines have comments,
 * arrows, statement keywords and the message or note text after the colon.
 * Anything else is plain text. It never throws and never changes the text,
 * so the highlighted layer always lines up with the textarea over it.
 */

export type TokenKind = 'comment' | 'string' | 'label' | 'edge' | 'color' | 'keyword' | 'direction' | 'bracket' | 'plain'

export interface Token {
  readonly kind: TokenKind
  readonly text: string
}

const FLOWCHART =
  /(%%.*)|("(?:[^"\\]|\\.)*")|(\|[^|\n]*\|)|(<-->|-{2,}[>ox]|-\.+->|-\.+-|={2,}>|={2,}|-{2,}|\.->|\.-)|(#[0-9a-fA-F]{3,8}\b)|(\b(?:flowchart|graph|subgraph|end|style|direction|classDef|class|linkStyle|click)\b)|(\b(?:LR|RL|TD|TB|BT)\b)|([[\]{}()/\\>]+)/g

const FLOWCHART_KINDS: readonly TokenKind[] = ['comment', 'string', 'label', 'edge', 'color', 'keyword', 'direction', 'bracket']

/*
 * The part of a sequence line before the colon: arrows (with the `+`/`-`
 * activation mark Mermaid allows after them), then the statement keywords,
 * case-insensitive as Mermaid reads them.
 */
const SEQUENCE_HEAD =
  /(%%.*)|((?:<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))[+-]?)|(\b(?:sequenceDiagram|participant|actor|as|Note|over|left|right|of|loop|alt|else|opt|par|and|critical|option|break|rect|end|autonumber|activate|deactivate|box|title)\b)/gi

const SEQUENCE_KINDS: readonly TokenKind[] = ['comment', 'edge', 'keyword']

/** `text` scanned with `pattern`, whose groups map to `kinds` in order; every character lands in a token. */
function scan(text: string, pattern: RegExp, kinds: readonly TokenKind[]): Token[] {
  const tokens: Token[] = []
  let last = 0
  pattern.lastIndex = 0
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > last) tokens.push({ kind: 'plain', text: text.slice(last, match.index) })
    const group = match.findIndex((value, index) => index > 0 && value !== undefined)
    tokens.push({ kind: kinds[group - 1] ?? 'plain', text: match[0] })
    last = match.index + match[0].length
    if (match[0].length === 0) pattern.lastIndex += 1
  }
  if (last < text.length) tokens.push({ kind: 'plain', text: text.slice(last) })
  return tokens
}

/** A sequence line: a whole-line comment, or a head of keywords and arrows and the text after the first colon. */
function tokenizeSequenceLine(line: string): Token[] {
  if (/^\s*%%/.test(line)) return [{ kind: 'comment', text: line }]
  const colon = line.indexOf(':')
  if (colon === -1) return scan(line, SEQUENCE_HEAD, SEQUENCE_KINDS)
  return [...scan(line.slice(0, colon), SEQUENCE_HEAD, SEQUENCE_KINDS), { kind: 'string', text: line.slice(colon) }]
}

/** The tokens of one line, in order, covering every character. `kind` is the detected diagram kind; anything but a sequence diagram reads as a flowchart. */
export function tokenizeLine(line: string, kind = 'flowchart'): Token[] {
  return kind === 'sequenceDiagram' ? tokenizeSequenceLine(line) : scan(line, FLOWCHART, FLOWCHART_KINDS)
}

/** Every line of `source`, tokenized. A trailing newline yields a final empty line, as a textarea shows it. */
export function tokenize(source: string, kind = 'flowchart'): Token[][] {
  return source.split('\n').map((line) => tokenizeLine(line, kind))
}
