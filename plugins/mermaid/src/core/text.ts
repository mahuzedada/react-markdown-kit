/**
 * Mermaid text entities, decoded once for every kind.
 *
 * Mermaid escapes a character inside a label as `#NN;` (its code point),
 * with `#quot;`, `#lt;` and `#gt;` as named forms, and `<br/>` as a line
 * break. HTML entities are accepted too because authors paste them. The
 * flowchart and sequence parsers both run label text through this, so a
 * label means the same thing in every kind.
 */
export function decodeText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/#quot;|&quot;/g, '"')
    .replace(/#lt;|&lt;/g, '<')
    .replace(/#gt;|&gt;/g, '>')
    .replace(/#124;/g, '|')
    .replace(/#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}
