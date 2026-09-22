/**
 * Mermaid front matter, split the way Mermaid splits it.
 *
 * Mermaid reads a YAML block between two `---` lines at the very top of a
 * fence, with the closing line at the same indent as the opening one and
 * followed by at least one newline. The regex below is Mermaid's own, so a
 * block Mermaid treats as front matter is front matter here and a block it
 * treats as content (an unclosed or indented `---`) stays content. Only
 * `title` is read; every other key is a retained line for the kind's writer.
 *
 * A quoted title is unescaped the way YAML reads it: a double-quoted value
 * through JSON string syntax (which YAML's double-quoted scalars accept
 * verbatim, and which the flowchart writer emits), a single-quoted value
 * with `''` standing for one quote. That keeps `write` then `parse` exact
 * for titles YAML could not take as plain scalars (`a: b`, `[draft]`).
 */

/** Mermaid's `frontMatterRegex`: same indent on both fences, a newline after the closing one. */
const FRONT_MATTER = /^([^\S\n\r]*)-{3}\s*[\n\r](.*?)[\n\r]\1-{3}\s*[\n\r]+/s

export interface FrontMatterSplit {
  /** The lines between the fences, without them. Absent when the source has no front matter. */
  readonly frontMatter?: string
  /** Everything after the front matter, or the whole source. */
  readonly body: string
  /** Character index in `source` where `body` starts; 0 without front matter. */
  readonly bodyOffset: number
}

export function splitFrontMatter(source: string): FrontMatterSplit {
  const match = FRONT_MATTER.exec(source)
  if (match === null) return { body: source, bodyOffset: 0 }
  return { frontMatter: match[2] ?? '', body: source.slice(match[0].length), bodyOffset: match[0].length }
}

/** The `title:` value of a front-matter block, unquoted and unescaped. */
export function readFrontMatterTitle(frontMatter: string | undefined): string | undefined {
  if (frontMatter === undefined) return undefined
  const title = /^\s*title:\s*(.+?)\s*$/m.exec(frontMatter)?.[1]
  return title === undefined ? undefined : unquote(title)
}

/** A YAML scalar for `title`: JSON string syntax is a valid double-quoted YAML scalar for any text. */
export function writeFrontMatterTitle(title: string): string {
  return `title: ${JSON.stringify(title)}`
}

function unquote(value: string): string {
  if (/^".*"$/.test(value)) return unescapeDoubleQuoted(value)
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'")
  return value
}

/** JSON covers YAML's common escapes (`\"`, `\\`, `\n`, `\uXXXX`); anything else keeps the raw text between the quotes. */
function unescapeDoubleQuoted(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed === 'string') return parsed
  } catch {
    // Not JSON: a YAML-only escape such as `\ ` or a stray backslash.
  }
  return value.slice(1, -1)
}
