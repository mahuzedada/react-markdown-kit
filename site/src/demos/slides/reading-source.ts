/**
 * The deck as a plain document. The reading view renders with GFM alone,
 * which would print the slide-only syntax as text: front matter as a rule
 * and a heading, `<!-- key: value -->` directives as escaped comments, and
 * the `--`, `::right::` and `???` markers as paragraphs. This drops them,
 * and the speaker notes after a `???`, leaving fences untouched.
 */
const FRONT_MATTER = /^---[ \t]*\n(?:[ \t]*\n|[A-Za-z][\w-]*[ \t]*:.*\n)*---[ \t]*(?:\n|$)/
const DIRECTIVE = /^ {0,3}<!--\s*[A-Za-z][\w-]*\s*:[^\n]*?-->\s*$/
const MARKERS = new Set(['--', '::right::'])
const FENCE = /^ {0,3}(`{3,}|~{3,})/

export function readingSource(deck: string): string {
  const kept: string[] = []
  let fence: string | undefined
  let inNotes = false
  for (const line of deck.replace(FRONT_MATTER, '').split('\n')) {
    const opener = FENCE.exec(line)?.[1]
    if (fence !== undefined) {
      if (opener !== undefined && opener[0] === fence[0] && opener.length >= fence.length) fence = undefined
    } else if (opener !== undefined) {
      fence = opener
    } else if (line.trim() === '---') {
      inNotes = false
    } else if (line.trim() === '???') {
      inNotes = true
      continue
    } else if (inNotes || DIRECTIVE.test(line) || MARKERS.has(line.trim())) {
      continue
    }
    if (!inNotes) kept.push(line)
  }
  return kept.join('\n')
}
