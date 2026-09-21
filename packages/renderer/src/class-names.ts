/**
 * Opt-in class hooks (docs/STYLING.md rule 3).
 *
 * With no `classNames` prop the DOM stays clean semantic HTML. When a consumer
 * supplies classes they are applied per part, replacing rather than merging
 * with anything the kit would otherwise add, so utility-class users never have
 * to out-specify shipped CSS.
 */
import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'
import type { RendererPart } from '@internal/styling/index.js'

export type { RendererPart }
export type RendererClassNames = Partial<Record<RendererPart | 'root', string>>

const TAG_TO_PART: Readonly<Record<string, RendererPart>> = {
  p: 'paragraph',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  a: 'link',
  img: 'image',
  ul: 'list',
  ol: 'list',
  li: 'listItem',
  blockquote: 'blockquote',
  code: 'code',
  pre: 'pre',
  table: 'table',
  thead: 'thead',
  tbody: 'tbody',
  tr: 'tr',
  th: 'th',
  td: 'td',
  hr: 'hr',
}

/** Tag name decides the part, except for a diagram figure, a variable chip or a slide deck, which an extension marks. */
function partOf(node: Element): RendererPart | undefined {
  if (node.tagName === 'figure' && node.properties?.['dataRmkDiagram'] !== undefined) return 'diagram'
  if (node.tagName === 'span' && node.properties?.['dataRmkVariable'] !== undefined) return 'variable'
  if (node.tagName === 'article' && node.properties?.['dataRmkDeck'] !== undefined) return 'deck'
  if (node.tagName === 'section' && node.properties?.['dataRmkSlide'] !== undefined) return 'slide'
  if (node.tagName === 'aside' && node.properties?.['dataRmkSlideNotes'] !== undefined) return 'slideNotes'
  return TAG_TO_PART[node.tagName]
}

export function applyClassNames(tree: Root, classNames: RendererClassNames | undefined): void {
  if (classNames === undefined) return
  visit(tree, 'element', (node: Element) => {
    const part = partOf(node)
    if (part === undefined) return
    // A task-list item is a distinct part so it can be styled without :has().
    const isTaskItem =
      part === 'listItem' &&
      node.children.some(
        (child) => child.type === 'element' && child.tagName === 'input' && child.properties?.['type'] === 'checkbox',
      )
    const key: RendererPart = isTaskItem ? 'taskListItem' : part
    const extra = classNames[key]
    if (extra === undefined || extra === '') return
    node.properties = node.properties ?? {}
    const existing = node.properties['className']
    const existingList = Array.isArray(existing) ? existing : typeof existing === 'string' ? [existing] : []
    node.properties['className'] = [...existingList, extra]
  })
}
