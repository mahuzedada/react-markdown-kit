/*
 * A small tokenizer for Mermaid flowchart syntax, enough to colour the code
 * pane: comments, quoted text, edge labels, edge operators, colours, the
 * keywords, directions and shape brackets. Anything else is plain text.
 * It never throws and never changes the text, so the highlighted layer
 * always lines up with the textarea over it.
 */

export type TokenKind = 'comment' | 'string' | 'label' | 'edge' | 'color' | 'keyword' | 'direction' | 'bracket' | 'plain'

export interface Token {
  readonly kind: TokenKind
  readonly text: string
}

const TOKEN =
  /(%%.*)|("(?:[^"\\]|\\.)*")|(\|[^|\n]*\|)|(<-->|-{2,}[>ox]|-\.+->|-\.+-|={2,}>|={2,}|-{2,}|\.->|\.-)|(#[0-9a-fA-F]{3,8}\b)|(\b(?:flowchart|graph|subgraph|end|style|direction|classDef|class|linkStyle|click)\b)|(\b(?:LR|RL|TD|TB|BT)\b)|([[\]{}()/\\>]+)/g

const KINDS: readonly TokenKind[] = ['comment', 'string', 'label', 'edge', 'color', 'keyword', 'direction', 'bracket']

/** The tokens of one line, in order, covering every character. */
export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  TOKEN.lastIndex = 0
  for (let match = TOKEN.exec(line); match !== null; match = TOKEN.exec(line)) {
    if (match.index > last) tokens.push({ kind: 'plain', text: line.slice(last, match.index) })
    const group = match.findIndex((value, index) => index > 0 && value !== undefined)
    tokens.push({ kind: KINDS[group - 1] ?? 'plain', text: match[0] })
    last = match.index + match[0].length
    if (match[0].length === 0) TOKEN.lastIndex += 1
  }
  if (last < line.length) tokens.push({ kind: 'plain', text: line.slice(last) })
  return tokens
}

/** Every line of `source`, tokenized. A trailing newline yields a final empty line, as a textarea shows it. */
export function tokenize(source: string): Token[][] {
  return source.split('\n').map(tokenizeLine)
}
