/**
 * Content policy (RENDER-08).
 *
 * Default behaviour: raw HTML in the source is not executed, and URLs on
 * href/src-style attributes are restricted to safe protocols. Both are
 * deliberately the same algorithm `react-markdown` uses, because it is well
 * tested against protocol-obfuscation corpora and because migration
 * compatibility is a stated goal.
 */
import { urlAttributes } from 'html-url-attributes'
import type { Element, Nodes, Parents, Root } from 'hast'
import { visit } from 'unist-util-visit'
import type { MarkdownPolicy } from './preset.js'

const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i

/**
 * Blocks any URL whose scheme is not known-safe. A colon appearing after the
 * first `/`, `?` or `#` is part of a path or query, not a scheme, so those
 * stay relative URLs.
 */
export function defaultUrlTransform(value: string): string {
  const colon = value.indexOf(':')
  const questionMark = value.indexOf('?')
  const numberSign = value.indexOf('#')
  const slash = value.indexOf('/')

  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    safeProtocol.test(value.slice(0, colon))
  ) {
    return value
  }
  return ''
}

export interface ApplyPolicyOptions {
  readonly policy: MarkdownPolicy | undefined
}

/**
 * Walks the hast tree applying element filtering, raw-HTML removal and URL
 * sanitization. Runs after every user plugin, so a plugin cannot inject
 * markup that skips the policy.
 */
export function applyPolicy(tree: Root, { policy }: ApplyPolicyOptions): void {
  const allowed = policy?.allowedElements
  const disallowed = policy?.disallowedElements
  const allowElement = policy?.allowElement
  // Default `false`, matching react-markdown: raw HTML is rendered as visible
  // escaped text rather than removed. Removing it is silent content loss, and
  // both behaviours are equally safe because neither executes the HTML.
  // `skipHtml: true` opts into removal.
  const skipHtml = policy?.skipHtml ?? false
  const unwrapDisallowed = policy?.unwrapDisallowed ?? false
  const urlTransform = policy?.urlTransform ?? defaultUrlTransform

  if (allowed !== undefined && disallowed !== undefined) {
    throw new Error('Use either `allowedElements` or `disallowedElements`, not both.')
  }

  visit(tree, (node: Nodes, index: number | undefined, parent: Parents | undefined) => {
    if (node.type === 'raw' && parent !== undefined && index !== undefined) {
      if (skipHtml) {
        parent.children.splice(index, 1)
      } else {
        // Raw HTML becomes visible text, never markup. Executing it is the
        // application's job through an explicit rehype-raw + rehype-sanitize
        // recipe, documented in the security guide.
        parent.children[index] = { type: 'text', value: (node as { value: string }).value }
      }
      return index
    }

    if (node.type === 'element') {
      const element = node as Element
      for (const key of Object.keys(element.properties ?? {})) {
        const attributes = urlAttributes[key as keyof typeof urlAttributes]
        if (attributes === undefined) continue
        if (attributes !== null && !attributes.includes(element.tagName)) continue
        const value = element.properties[key]
        if (typeof value !== 'string') continue
        const next = urlTransform(value, key, element as never)
        element.properties[key] = next ?? ''
      }
    }

    if (node.type === 'element' && parent !== undefined && index !== undefined) {
      const element = node as Element
      let remove = false
      if (allowed !== undefined) remove = !allowed.includes(element.tagName)
      else if (disallowed !== undefined) remove = disallowed.includes(element.tagName)

      if (!remove && allowElement !== undefined) {
        remove = allowElement(element as never, index, parent as never) === false
      }

      if (remove) {
        if (unwrapDisallowed && element.children.length > 0) {
          parent.children.splice(index, 1, ...element.children)
        } else {
          parent.children.splice(index, 1)
        }
        return index
      }
    }
    return undefined
  })
}
