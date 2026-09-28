/**
 * The Enter shortcut: a root-level paragraph that says exactly `---`, a
 * marker's spelling (`--`, `???`, `::right::`) or `***` / `___` (a rule)
 * becomes the matching node when the author presses Enter in it, with a
 * fresh paragraph after it for the caret.
 *
 * It is a command handler and not a node transform on purpose: a transform
 * would turn `--` into a pause marker while the author is still typing
 * `---`. Enter is the moment the line is finished. Registered above the
 * rich-text handler so the paragraph is replaced rather than split; a line
 * that is not a marker falls through untouched, and so does a modified
 * Enter (Shift+Enter is a soft break).
 */
import {
  $createParagraphNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical'
import type { BreakKind } from '../deck/breaks.js'
import { markerOfSpelling } from '../deck/marker-kinds/registry.js'
import { $createSlideBreakNode } from './slide-break-node.js'
import { $createSlideMarkerNode } from './slide-marker-node.js'

const BREAKS: Readonly<Record<string, BreakKind>> = { '---': 'slide', '***': 'rule', '___': 'rule' }

/** The node a finished line stands for, or undefined when it is prose. Markers come from the marker registry. */
export function $nodeForLine(text: string): LexicalNode | undefined {
  const breakKind = Object.hasOwn(BREAKS, text) ? BREAKS[text] : undefined
  if (breakKind !== undefined) return $createSlideBreakNode(breakKind)
  const marker = markerOfSpelling(text)
  return marker === undefined ? undefined : $createSlideMarkerNode(marker)
}

export function registerEnterShortcut(editor: LexicalEditor): () => void {
  return editor.registerCommand(
    KEY_ENTER_COMMAND,
    (event) => {
      if (event !== null && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)) return false
      const selection = $getSelection()
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
      const paragraph = selection.anchor.getNode().getTopLevelElement()
      if (!$isParagraphNode(paragraph) || !$isRootNode(paragraph.getParent())) return false
      const replacement = $nodeForLine(paragraph.getTextContent())
      if (replacement === undefined) return false
      event?.preventDefault()
      const next = $createParagraphNode()
      paragraph.replace(replacement)
      replacement.insertAfter(next)
      next.select()
      return true
    },
    COMMAND_PRIORITY_HIGH,
  )
}
