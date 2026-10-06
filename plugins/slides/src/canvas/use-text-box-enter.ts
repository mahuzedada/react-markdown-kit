import { useEffect } from 'react'
import { $getSelection, $isParagraphNode, $isRangeSelection, COMMAND_PRIORITY_HIGH, INSERT_PARAGRAPH_COMMAND, type LexicalEditor } from 'lexical'
import type { MarkdownEditorInstance } from '@react-markdown-kit/editor'

/** A slide text box is one Markdown paragraph, with hard breaks for new lines.
 * Register at the command layer so keyboard and beforeinput Enter agree.
 * Lists, tables, code and headings keep their structural editing commands.
 */
export function useTextBoxEnter(editor: MarkdownEditorInstance): void {
  useEffect(() => {
    const native = editor.getNativeEditor() as LexicalEditor
    return native.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
      if (native.isComposing()) return false
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return false
      const paragraph = selection.anchor.getNode().getTopLevelElement()
      if (!$isParagraphNode(paragraph) || !selection.focus.getNode().getTopLevelElement()?.is(paragraph)) return false
      selection.insertLineBreak()
      return true
    }, COMMAND_PRIORITY_HIGH)
  }, [editor])
}
