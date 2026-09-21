/**
 * Front matter, found in the source rather than by the parser.
 *
 * The micromark front-matter construct is `concrete`: when `---` opens the
 * document and no closing fence follows, its failed attempt has already
 * skipped the container checks on every line it fed, so lists and block
 * quotes flatten into paragraphs. A deck that opens with a break is a
 * common shape, so the plugin does not use the construct. The tree is
 * plain CommonMark; the transform looks at byte 0 of the source for an
 * opening `---` line, only blank or `key: value` lines, and a closing `---`
 * line, and replaces the root nodes those bytes parsed as (a break and a
 * setext heading, usually) with one `yaml` node. Everything else is left
 * as CommonMark parsed it: a leading `---` is a break that opens no slide.
 *
 * Front matter itself is read as flat `key: value` lines. There is no YAML
 * parser: four scalar keys do not justify one.
 */
import type { MarkdownNode, MarkdownRoot } from '@internal/document-contracts/index.js'
import type { SlideAspect } from './model.js'

const KEY_LINE = /^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/
const KEY_HEAD = /^[A-Za-z_][\w-]*\s*:/
const OPENING_FENCE = /^---[ \t]*(?:\r?\n|$)/
const CLOSING_FENCE = /^---[ \t]*$/

export interface FrontMatter {
  readonly title?: string
  readonly aspect?: SlideAspect
  readonly class?: string
  readonly background?: string
  /** Known keys whose value was rejected. */
  readonly problems: readonly string[]
}

/** Empty, or opening with a `key:` line. */
export function isFrontMatter(value: string): boolean {
  const first = value.split('\n').find((line) => line.trim() !== '')
  return first === undefined || KEY_HEAD.test(first)
}

export function parseFrontMatter(value: string): FrontMatter {
  const entries = new Map<string, string>()
  for (const line of value.split('\n')) {
    const match = KEY_LINE.exec(line)
    if (match !== null) entries.set(match[1]!.toLowerCase(), unquote(match[2]!))
  }
  const problems: string[] = []
  const aspect = entries.get('aspect')
  if (aspect !== undefined && aspect !== '16:9' && aspect !== '4:3') problems.push('`aspect` must be `16:9` or `4:3`.')
  const background = entries.get('background')
  if (background !== undefined && !/^\S+$/.test(background)) problems.push('`background` must be one URL with no spaces.')
  const title = entries.get('title')
  const classes = entries.get('class')
  return {
    ...(title === undefined || title === '' ? {} : { title }),
    ...(aspect === '16:9' || aspect === '4:3' ? { aspect } : {}),
    ...(classes === undefined || classes === '' ? {} : { class: classes }),
    ...(background === undefined || !/^\S+$/.test(background) ? {} : { background }),
    problems,
  }
}

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value)
  return quoted === null ? value : quoted[2]!
}

/** Where a front matter block sits in the source. */
export interface FrontMatterBlock {
  /** The lines between the fences, joined with `\n`, as `yaml.value`. */
  readonly value: string
  /** Just past the closing fence, before its line ending: the `yaml` node's end. */
  readonly end: { readonly line: number; readonly column: number; readonly offset: number }
}

/**
 * The front matter block at byte 0, or undefined when the source does not
 * open with `---`, a line between the fences is neither blank nor
 * `key: value`, or no closing `---` line follows.
 */
export function findFrontMatter(source: string): FrontMatterBlock | undefined {
  const opening = OPENING_FENCE.exec(source)
  if (opening === null) return undefined
  const lines: string[] = []
  let offset = opening[0].length
  let line = 2
  while (offset < source.length) {
    const eol = source.indexOf('\n', offset)
    const lineEnd = eol === -1 ? source.length : eol
    const text = source.slice(offset, lineEnd).replace(/\r$/, '')
    if (CLOSING_FENCE.test(text)) return { value: lines.join('\n'), end: { line, column: text.length + 1, offset: offset + text.length } }
    if (text.trim() !== '' && !KEY_HEAD.test(text)) return undefined
    lines.push(text)
    if (eol === -1) return undefined
    offset = eol + 1
    line += 1
  }
  return undefined
}

/**
 * Opens like front matter (`---` then a `key: value` line right under it)
 * without being a block `findFrontMatter` accepts. The author most likely
 * forgot the closing fence, and the lines will render as content.
 */
export function opensLikeFrontMatter(source: string): boolean {
  const opening = OPENING_FENCE.exec(source)
  if (opening === null) return false
  const second = source.slice(opening[0].length).split(/\r?\n/, 1)[0] ?? ''
  return KEY_HEAD.test(second)
}

/**
 * Replaces the root nodes that lie inside the block's bytes with one `yaml`
 * node holding its value. Returns undefined when a node straddles the
 * block's end or has no offsets, so the tree is left as parsed.
 */
export function liftFrontMatter(tree: MarkdownRoot, block: FrontMatterBlock): MarkdownRoot | undefined {
  const rest: MarkdownNode[] = []
  for (const node of tree.children) {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return undefined
    if (end <= block.end.offset) continue
    if (start < block.end.offset) return undefined
    rest.push(node)
  }
  const yaml: MarkdownNode = {
    type: 'yaml',
    value: block.value,
    position: { start: { line: 1, column: 1, offset: 0 }, end: { ...block.end } },
  }
  return { ...tree, children: [yaml, ...rest] }
}
