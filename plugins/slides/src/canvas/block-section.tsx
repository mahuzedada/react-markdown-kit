import { cloneElement, isValidElement, useState, type ReactNode, type ReactElement } from 'react'
import type { SectionElement } from '../present/sections.js'
import { BlockEditor } from './block-editor.js'

function replace(node: ReactNode, start: number, editor: ReactElement): ReactNode {
  if (Array.isArray(node)) return node.map((child) => replace(child, start, editor))
  if (!isValidElement<Record<string, unknown>>(node)) return node
  if (Number(node.props['data-rmk-canvas-block']) === start) return cloneElement(editor, { key: node.key })
  if (node.props.children === undefined) return node
  return cloneElement(node, {}, replace(node.props.children as ReactNode, start, editor))
}

/** Freeze the surrounding rendering for this edit session: Enter may split one
 * block into several nodes, but the session still owns that one source range. */
export function BlockSection({ section, block, start }: { readonly section: SectionElement; readonly block: number; readonly start: number }): ReactElement {
  const [original] = useState(() => ({ section, start }))
  return replace(original.section, original.start, <BlockEditor block={block} />) as ReactElement
}
