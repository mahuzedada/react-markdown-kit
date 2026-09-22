/**
 * Mermaid text entities, decoded once for every kind.
 *
 * Mermaid escapes a character inside a label as `#NN;` (its code point),
 * with `#quot;`, `#lt;` and `#gt;` as named forms, and `<br/>` as a line
 * break. HTML entities are accepted too because authors paste them. The
 * flowchart and sequence parsers both run label text through this, so a
 * label means the same thing in every kind.
 *
 * The numeric form is decoded last so an escaped `#` (`#35;quot;`) yields
 * the literal text `#quot;` rather than a quote: that is what keeps the
 * flowchart writer's `escapeText` and this decoder symmetric. A code point
 * that is not an XML character (control characters, surrogates, U+FFFE,
 * U+FFFF, anything past U+10FFFF) becomes U+FFFD instead of a character
 * the SVG could not carry, and never a thrown RangeError: `parse` must not
 * throw and Mermaid.js accepts these entities.
 */
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
