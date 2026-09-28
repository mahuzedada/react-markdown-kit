/**
 * Inline shortcuts that fire on the character closing them: `**bold**`,
 * `*em*`, `_em_`, `` `code` ``, `~~gone~~`, `[text](url)` and `![alt](src)`.
 *
 * Only the text node under the caret is searched, so a span that already
 * crosses a link or a differently formatted run is left as typed.
 */
import { $createTextNode, $isTextNode, type TextFormatType, type TextNode } from 'lexical'
import { $createImageNode, $createLinkNode } from '../nodes/inline.js'

interface FormatShortcut {
  readonly tag: string
  readonly formats: readonly TextFormatType[]
  /** `_` only counts at a word boundary: `snake_case_name` stays as typed. */
  readonly wordBoundary?: boolean
  readonly gfm?: boolean
}

/** Longest tags first, so `***` is not read as `*` around `*text*`. */
const FORMATS: readonly FormatShortcut[] = [
  { tag: '***', formats: ['bold', 'italic'] },
  { tag: '___', formats: ['bold', 'italic'], wordBoundary: true },
  { tag: '**', formats: ['bold'] },
  { tag: '__', formats: ['bold'], wordBoundary: true },
  { tag: '~~', formats: ['strikethrough'], gfm: true },
  { tag: '*', formats: ['italic'] },
  { tag: '_', formats: ['italic'], wordBoundary: true },
  { tag: '`', formats: ['code'] },
]

const LINK = /(!?)\[([^[\]]*)\]\(([^()\s]+)(?:\s"([^"]*)")?\)$/

export function $inlineShortcut(node: TextNode, offset: number, gfm: boolean): boolean {
  const before = node.getTextContent().slice(0, offset)
  if (before.endsWith(')') && $link(node, before)) return true
  for (const shortcut of FORMATS) {
    if (shortcut.gfm === true && !gfm) continue
    if ($format(node, before, shortcut)) return true
  }
  return false
}

function $format(node: TextNode, before: string, { tag, formats, wordBoundary }: FormatShortcut): boolean {
  const close = before.length - tag.length
  if (close <= 0 || !before.endsWith(tag) || before[close - 1] === tag[0]) return false
  const open = before.lastIndexOf(tag, close - tag.length - 1)
  if (open < 0) return false
  const content = before.slice(open + tag.length, close)
  if (content.trim() !== content || content === '') return false
  const preceding = before[open - 1]
  if (preceding === tag[0]) return false
  if (wordBoundary === true && preceding !== undefined && /[\p{L}\p{N}]/u.test(preceding)) return false

  const parts = node.splitText(open, open + tag.length, close, before.length)
  const [opening, text, closing] = open === 0 ? parts : parts.slice(1)
  if (!$isTextNode(text)) return false
  opening?.remove()
  closing?.remove()
  for (const format of formats) if (!text.hasFormat(format)) text.toggleFormat(format)
  // The caret sits after the new run without its formats, so typing on is plain.
  const selection = text.select(content.length, content.length)
  for (const format of formats) if (selection.hasFormat(format)) selection.toggleFormat(format)
  return true
}

function $link(node: TextNode, before: string): boolean {
  const match = LINK.exec(before)
  if (match === null) return false
  const [whole, bang, label = '', url = '', title] = match
  if (bang === '' && label === '') return false
  const parts = node.splitText(match.index, before.length)
  const source = match.index === 0 ? parts[0] : parts[1]
  if (source === undefined || source.getTextContent() !== whole) return false
  if (bang === '!') {
    const image = $createImageNode(url, label === '' ? null : label, title ?? null)
    source.replace(image)
    image.selectNext(0, 0)
    return true
  }
  const text = $createTextNode(label).setFormat(source.getFormat())
  const link = $createLinkNode(url, title ?? null).append(text)
  source.replace(link)
  link.selectNext(0, 0)
  return true
}
