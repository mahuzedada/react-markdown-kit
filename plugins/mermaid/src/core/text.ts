/**
 * Mermaid text entities, encoded and decoded once for every kind.
 *
 * Mermaid escapes a character inside a label as `#NN;` (its code point),
 * with `#quot;`, `#lt;` and `#gt;` as named forms, and `<br/>` as a line
 * break. HTML entities are accepted too because authors paste them. The
 * flowchart and sequence parsers both run label text through `decodeText`,
 * and both writers escape through `escapeText`, so a label means the same
 * thing in every kind and a round trip is exact.
 *
 * `escapeText` is one pass over the characters, so `#` in the author's
 * text becomes `#35;` while the `#` and `;` an entity introduces are never
 * escaped again, and text that already looks like an entity survives.
 * `&` and `%` become `#38;` and `#37;` so `&quot;` stays text and `%%{`
 * can never open a directive inside a label. `escapeStatementText` adds
 * `;`, for the sequence dialect where text is unquoted and a `;` would end
 * the statement; flowchart text is quoted, so it keeps its `;`.
 *
 * The numeric form is decoded last so an escaped `#` (`#35;quot;`) yields
 * the literal text `#quot;` rather than a quote: that is what keeps
 * `escapeText` and `decodeText` symmetric. A code point that is not an XML
 * character (control characters, surrogates, U+FFFE, U+FFFF, anything past
 * U+10FFFF) becomes U+FFFD instead of a character the SVG could not carry,
 * and never a thrown RangeError: `parse` must not throw and Mermaid.js
 * accepts these entities.
 */

const ENTITIES: Readonly<Record<string, string>> = {
  '#': '#35;',
  '&': '#38;',
  '%': '#37;',
  '"': '#quot;',
  '<': '#lt;',
  '>': '#gt;',
}
const SEMICOLON = '#59;'

/** Escape user text for a Mermaid label: `#`, `&`, `%`, quotes and angle brackets as entities, line breaks as `<br/>`. */
export function escapeText(text: string): string {
  return text.replace(/[#&%"<>]/g, (char) => ENTITIES[char] ?? char).replace(/\r?\n/g, '<br/>')
}

/** `escapeText` for unquoted statement text, where a `;` would end the statement: it becomes `#59;` too. */
export function escapeStatementText(text: string): string {
  return text.replace(/[#&%"<>;]/g, (char) => (char === ';' ? SEMICOLON : (ENTITIES[char] ?? char))).replace(/\r?\n/g, '<br/>')
}

export function decodeText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/#quot;|&quot;/g, '"')
    .replace(/#lt;|&lt;/g, '<')
    .replace(/#gt;|&gt;/g, '>')
    .replace(/#124;/g, '|')
    .replace(/#(\d+);/g, (_, code: string) => codePointText(Number(code)))
}

const REPLACEMENT = '�'

/** The character for a code point, or U+FFFD when XML 1.0 has no such character. */
function codePointText(codePoint: number): string {
  return isXmlChar(codePoint) ? String.fromCodePoint(codePoint) : REPLACEMENT
}

/** XML 1.0 `Char`: tab, newline, carriage return, and everything from U+0020 up except surrogates and U+FFFE/U+FFFF. */
function isXmlChar(codePoint: number): boolean {
  if (!Number.isInteger(codePoint)) return false
  if (codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd) return true
  if (codePoint >= 0x20 && codePoint <= 0xd7ff) return true
  if (codePoint >= 0xe000 && codePoint <= 0xfffd) return true
  return codePoint >= 0x10000 && codePoint <= 0x10ffff
}
