/**
 * Marks what a slide shows at a given reveal step, by walking its element
 * tree: every `data-rmk-fragment` (a `--` group or an incremental list
 * item, at any depth) gets `data-rmk-fragment-state`, and the lines of
 * every stepped code block get the highlight of the step that is active.
 * Elements are cloned, never replaced, so keys and DOM nodes survive.
 */
import { cloneElement, isValidElement, type ReactNode } from 'react'
import { childList, type SectionElement } from './sections.js'

type Props = Record<string, unknown>

export function revealTree(node: ReactNode, shown: number): ReactNode {
  if (!isValidElement(node)) return node
  const props = node.props as Props
  const extra: Props = {}
  const fragment = props['data-rmk-fragment']
  if (fragment !== undefined) extra['data-rmk-fragment-state'] = Number(fragment) <= shown ? 'shown' : 'hidden'
  if (typeof props['data-rmk-code-steps'] === 'string') {
    return cloneElement(node as SectionElement, extra, highlightLines(props.children as ReactNode, activeStep(props['data-rmk-code-steps'], shown)))
  }
  if (props.children === undefined) return Object.keys(extra).length === 0 ? node : cloneElement(node as SectionElement, extra)
  return cloneElement(node as SectionElement, extra, ...childList(props.children).map((child) => revealTree(child, shown)))
}

/** The last highlight step whose reveal step has been reached; the first one before that. */
export function activeStep(steps: string, shown: number): number {
  const starts = steps.split(' ').map(Number)
  let active = 0
  starts.forEach((start, index) => {
    if (start <= shown) active = index
  })
  return active
}

function highlightLines(node: ReactNode, step: number): ReactNode {
  if (Array.isArray(node)) return node.map((child: ReactNode) => highlightLines(child, step))
  if (!isValidElement(node)) return node
  const props = node.props as Props
  if (typeof props['data-rmk-code-focus'] === 'string') {
    const focused = props['data-rmk-code-focus'].split(' ').includes(String(step))
    return cloneElement(node as SectionElement, { 'data-rmk-code-line-state': focused ? 'focus' : 'dim' })
  }
  if (props.children === undefined) return node
  return cloneElement(node as SectionElement, {}, ...childList(props.children).map((child) => highlightLines(child, step)))
}
