/**
 * Tolerant HTML comparison for conformance tests.
 *
 * Two HTML strings are "equivalent" when they describe the same element tree
 * with the same text, ignoring differences that no browser can observe:
 *
 *   - attribute order (`<a href b>` vs `<a b href>`)
 *   - self-closing spelling (`<br />` vs `<br>`)
 *   - valueless attributes (`<input checked>` vs `<input checked="">`)
 *   - entity spelling in text and attribute values (`&quot;` vs `&#34;` vs `"`)
 *   - whitespace that sits only between block-level tags
 *
 * Everything else is a real difference. This normalizer deliberately does NOT
 * collapse whitespace inside inline content, does not touch anything inside
 * `<pre>`, and does not drop elements or attributes. Weakening it to make a
 * suite go green would defeat the point of the suite.
 */

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/**
 * Elements between which pure-whitespace text is not observable. Kept
 * deliberately narrow: inline elements are absent, so whitespace around
 * `<em>`/`<a>`/`<code>` is still compared exactly.
 */
const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'caption', 'colgroup',
  'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hgroup', 'hr', 'html', 'legend', 'li', 'main', 'menu', 'nav', 'ol', 'p',
  'pre', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'tr', 'ul',
])

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', hellip: '…', mdash: '—',
  ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“',
  rdquo: '”', auml: 'ä', ouml: 'ö', uuml: 'ü',
  szlig: 'ß', eacute: 'é', Aacute: 'Á', frac34: '¾',
  DiacriticalTilde: '˜', ClockwiseContourIntegral: '∲',
  ngE: '≧̸',
}

/**
 * Decodes character references in one pass, so `&amp;lt;` decodes to the
 * literal text `&lt;` and not to `<`.
 */
export function decodeEntities(value: string): string {
  return value.replace(/&(#[Xx][0-9A-Fa-f]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      if (!Number.isFinite(code) || code === 0 || code > 0x10ffff) return '�'
      try {
        return String.fromCodePoint(code)
      } catch {
        return '�'
      }
    }
    const named = NAMED_ENTITIES[body]
    return named ?? match
  })
}

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'open'; name: string; attributes: ReadonlyArray<readonly [string, string]> }
  | { kind: 'close'; name: string }
  | { kind: 'comment'; value: string }
  | { kind: 'other'; value: string }

const TAG = /<(!--[\s\S]*?--|!\[CDATA\[[\s\S]*?\]\]|[!?][^>]*|\/?[A-Za-z][^\s/>]*(?:"[^"]*"|'[^']*'|[^>"'])*)>/g
const ATTRIBUTE = /([^\s/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  let cursor = 0
  TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG.exec(html)) !== null) {
    if (match.index > cursor) tokens.push({ kind: 'text', value: html.slice(cursor, match.index) })
    cursor = match.index + match[0].length
    const body = match[1]
    if (body.startsWith('!--')) {
      tokens.push({ kind: 'comment', value: body.slice(3, -2) })
    } else if (body.startsWith('!') || body.startsWith('?')) {
      tokens.push({ kind: 'other', value: body })
    } else if (body.startsWith('/')) {
      tokens.push({ kind: 'close', name: body.slice(1).trim().toLowerCase() })
    } else {
      const nameEnd = body.search(/[\s/]/)
      const name = (nameEnd === -1 ? body : body.slice(0, nameEnd)).toLowerCase()
      const rest = nameEnd === -1 ? '' : body.slice(nameEnd).replace(/\/\s*$/, '')
      tokens.push({ kind: 'open', name, attributes: parseAttributes(rest) })
    }
  }
  if (cursor < html.length) tokens.push({ kind: 'text', value: html.slice(cursor) })
  return tokens
}

function parseAttributes(rest: string): ReadonlyArray<readonly [string, string]> {
  const attributes: Array<readonly [string, string]> = []
  ATTRIBUTE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE.exec(rest)) !== null) {
    const raw = match[2] ?? match[3] ?? match[4] ?? ''
    attributes.push([match[1].toLowerCase(), decodeEntities(raw)])
  }
  // Sorted by name, then value, so attribute order never decides a comparison.
  return attributes.sort((a, b) => (a[0] === b[0] ? compare(a[1], b[1]) : compare(a[0], b[0])))
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** True when whitespace immediately next to this token is not observable. */
function isBlockBoundary(token: Token | undefined): boolean {
  if (token === undefined) return true
  if (token.kind === 'open' || token.kind === 'close') return BLOCK_ELEMENTS.has(token.name)
  return false
}

export function normalizeHtml(html: string): string {
  const tokens = tokenize(html)

  // Merge adjacent text and decode entities. Track `<pre>` so its whitespace
  // is never treated as layout noise.
  const merged: Token[] = []
  const insidePre: boolean[] = []
  let preDepth = 0
  for (const token of tokens) {
    if (token.kind === 'open' && token.name === 'pre') preDepth += 1
    const previous = merged[merged.length - 1]
    if (token.kind === 'text' && previous?.kind === 'text') {
      merged[merged.length - 1] = { kind: 'text', value: previous.value + token.value }
    } else {
      merged.push(token.kind === 'text' ? { kind: 'text', value: decodeEntities(token.value) } : token)
      insidePre.push(preDepth > 0)
    }
    if (token.kind === 'close' && token.name === 'pre') preDepth = Math.max(0, preDepth - 1)
  }

  const parts: string[] = []
  for (let index = 0; index < merged.length; index += 1) {
    const token = merged[index]
    if (token.kind === 'text') {
      if (
        !insidePre[index] &&
        token.value.trim() === '' &&
        isBlockBoundary(merged[index - 1]) &&
        isBlockBoundary(merged[index + 1])
      ) {
        continue
      }
      parts.push(JSON.stringify(token.value))
      continue
    }
    if (token.kind === 'comment') {
      parts.push(`<!--${token.value}-->`)
      continue
    }
    if (token.kind === 'other') {
      parts.push(`<${token.value}>`)
      continue
    }
    if (token.kind === 'close') {
      // A void element's end tag is never observable.
      if (!VOID_ELEMENTS.has(token.name)) parts.push(`</${token.name}>`)
      continue
    }
    const attributes = token.attributes.map(([name, value]) => ` ${name}="${value}"`).join('')
    parts.push(`<${token.name}${attributes}>`)
  }
  return parts.join('')
}

export function htmlEquivalent(actual: string, expected: string): boolean {
  return normalizeHtml(actual) === normalizeHtml(expected)
}

/** A compact, readable rendering of a mismatch for failure reports. */
export function describeDifference(actual: string, expected: string): string {
  const a = normalizeHtml(actual)
  const b = normalizeHtml(expected)
  let index = 0
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1
  const window = 60
  const from = Math.max(0, index - 20)
  return [
    `  expected: …${b.slice(from, from + window)}…`,
    `  actual:   …${a.slice(from, from + window)}…`,
  ].join('\n')
}
