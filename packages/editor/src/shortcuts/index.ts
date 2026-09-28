/**
 * Markdown typing shortcuts on the rich surface: `- `, `1. `, `[ ] `, `# `,
 * `> `, ```` ``` ````, `---`, `| a | b |`, `**bold**`, `[text](url)` and the
 * rest. Each one is a single undo step, so Ctrl+Z gives back the typed text.
 * Enter and Backspace in a list or blockquote come with them, since a typed
 * list is only usable if Enter starts the next item and a quote if Enter
 * can leave it.
 *
 * Not `@lexical/markdown`: its shortcuts build `@lexical/rich-text` and
 * `@lexical/list` nodes this editor does not use, it pulls in Prism through
 * `@lexical/code`, and its import side is what docs/AUDIT.md traces the old
 * editor's data loss to.
 */
import { $getNodeByKey, $isRootOrShadowRoot, $isTextNode, type LexicalNode, type TextNode } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { $isCodeBlockNode } from '../nodes/blocks.js'
import { editorOf, type MarkdownBridge } from '../bridge/session.js'
import { BLOCK_SHORTCUTS } from './blocks.js'
import { registerEnterShortcuts } from './enter.js'
import { $inlineShortcut } from './inline.js'
import { registerBlockKeys } from './block-keys.js'
import { $taskItemShortcut } from './task-item.js'
import { typedCaret } from './typed.js'

/** Every shortcut completes on one of these; any other key skips the update. */
const TRIGGERS = new Set([' ', '*', '_', '`', '~', ')'])

export function registerShortcuts(bridge: MarkdownBridge): () => void {
  const editor = editorOf(bridge)
  const gfm = bridge.profile === 'gfm'
  return mergeRegister(
    editor.registerUpdateListener((payload) => {
      const caret = typedCaret(editor, payload)
      if (caret === null || !TRIGGERS.has(caret.character)) return
      editor.update(() => {
        const node = $getNodeByKey(caret.key)
        if (!$isTextNode(node) || node.hasFormat('code') || $inCodeBlock(node)) return
        if ($blockShortcut(node, caret.offset, gfm)) return
        if (gfm && $taskItemShortcut(node, caret.offset)) return
        $inlineShortcut(node, caret.offset, gfm)
      })
    }),
    registerEnterShortcuts(editor, bridge),
    registerBlockKeys(editor),
  )
}

function $blockShortcut(node: TextNode, offset: number, gfm: boolean): boolean {
  const block = node.getParent()
  if (block === null || !$isRootOrShadowRoot(block.getParent()) || !node.is(block.getFirstChild())) return false
  const line = node.getTextContent().slice(0, offset)
  if (!line.endsWith(' ')) return false
  for (const shortcut of BLOCK_SHORTCUTS) {
    if (shortcut.gfm === true && !gfm) continue
    const match = shortcut.pattern.exec(line)
    if (match === null) continue
    const [marker, rest] = node.splitText(offset)
    const children = rest === undefined ? (marker?.getNextSiblings() ?? []) : [rest, ...rest.getNextSiblings()]
    if (!shortcut.$apply(block, children, match)) return false
    marker?.remove()
    return true
  }
  return false
}

function $inCodeBlock(node: LexicalNode): boolean {
  for (let current: LexicalNode | null = node; current !== null; current = current.getParent()) {
    if ($isCodeBlockNode(current)) return true
  }
  return false
}
