/**
 * Speaker notes as PowerPoint's plain text: paragraphs apart by a blank
 * line, list items one per line with a dash, hard breaks kept.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'

function inlineText(nodes: readonly MarkdownNode[] | undefined): string {
  return (nodes ?? []).map((node) => (node.type === 'break' ? '\n' : typeof node.value === 'string' ? node.value : inlineText(node.children))).join('')
}

function blockText(node: MarkdownNode, depth: number): string {
  if (node.type === 'list') {
    return (node.children ?? []).map((item) => `${'  '.repeat(depth)}- ${(item.children ?? []).map((child) => blockText(child, depth + 1).trim()).join('\n')}`).join('\n')
  }
  if (node.type === 'code') return String(node.value ?? '')
  if (node.type === 'blockquote') return (node.children ?? []).map((child) => blockText(child, depth)).join('\n\n')
  return inlineText(node.children ?? (typeof node.value === 'string' ? [node] : []))
}

export function notesText(notes: readonly MarkdownNode[]): string {
  return notes.map((node) => blockText(node, 0)).join('\n\n')
}
