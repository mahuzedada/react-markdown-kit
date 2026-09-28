/**
 * Decks split across files. `<!-- src: path -->` alone on a line, outside
 * a code fence, is replaced by the file `read` returns for that path, with
 * the included file's own front matter dropped (the including deck's wins).
 * Includes nest; a file that includes itself, directly or not, or nesting
 * deeper than `maxDepth`, keeps its comment, and so does a path `read`
 * does not know. The renderer then reports it as
 * `SLIDES_INCLUDE_UNRESOLVED`.
 *
 * It works on source text, before compiling, because the renderer never
 * reads files: `read` is the host's, synchronous, and may be a lookup in
 * an object of imported strings. When paths are relative, `read` returns
 * `{ id, source }` with the resolved id: nested includes are then asked
 * for relative to that id, and cycles are found by id, not by spelling.
 */
import { findFrontMatter } from './deck/front-matter.js'

/** A file read for an include: its text, or its text with the resolved id it is known by. */
export type DeckFile = string | { readonly id: string; readonly source: string }

/** The file at `path`, as seen from the file that includes it (`from`: that file's id, undefined for the root deck). */
export type ReadDeckFile = (path: string, from: string | undefined) => DeckFile | undefined

export interface IncludeDeckFilesOptions {
  /** Deepest nesting followed. Default 8. */
  readonly maxDepth?: number
}

const INCLUDE = /^ {0,3}<!--\s*src\s*:\s*(\S+)\s*-->\s*$/i
const FENCE = /^ {0,3}(`{3,}|~{3,})/
const CLOSING = /^ {0,3}(`{3,}|~{3,})\s*$/

export function includeDeckFiles(source: string, read: ReadDeckFile, options: IncludeDeckFilesOptions = {}): string {
  return expand(source, read, [], options.maxDepth ?? 8)
}

function expand(source: string, read: ReadDeckFile, stack: readonly string[], maxDepth: number): string {
  let fence: string | undefined
  return source
    .split('\n')
    .map((line) => {
      const opening = FENCE.exec(line)?.[1]
      if (fence !== undefined) {
        // A closing fence is the same character, at least as long, and nothing after it.
        if (opening !== undefined && opening[0] === fence[0] && opening.length >= fence.length && CLOSING.test(line)) fence = undefined
        return line
      }
      if (opening !== undefined) {
        fence = opening
        return line
      }
      const path = INCLUDE.exec(line)?.[1]
      if (path === undefined || stack.length >= maxDepth) return line
      const file = read(path, stack[stack.length - 1])
      if (file === undefined) return line
      const { id, source: included } = typeof file === 'string' ? { id: path, source: file } : file
      if (stack.includes(id)) return line
      // Blank lines around keep the included blocks from gluing to their neighbours.
      return `\n${expand(withoutFrontMatter(included), read, [...stack, id], maxDepth).trim()}\n`
    })
    .join('\n')
}

function withoutFrontMatter(source: string): string {
  const block = findFrontMatter(source)
  return block === undefined ? source : source.slice(block.end.offset)
}
