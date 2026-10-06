/**
 * Puts the caret where the author clicked. The inline editor opens over the
 * rendered slide with the same type at the same size, so the point of the
 * click lands on the same character in the editor's text. The selection is
 * set through Lexical: a native one set on focus is replaced by the
 * editor's own.
 */
import { $createRangeSelection, $getNearestNodeFromDOMNode, $getRoot, $isElementNode, $isTextNode, $setSelection, type LexicalEditor } from 'lexical'

interface CaretPositionDocument {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

function pointAt(x: number, y: number): { readonly node: Node; readonly offset: number } | undefined {
  const finder = document as unknown as CaretPositionDocument
  const position = finder.caretPositionFromPoint?.(x, y)
  if (position != null) return { node: position.offsetNode, offset: position.offset }
  const range = finder.caretRangeFromPoint?.(x, y)
  return range == null ? undefined : { node: range.startContainer, offset: range.startOffset }
}

/** True when the caret was placed inside `editable`. */
export function placeCaretAt(editable: HTMLElement, native: unknown, x: number, y: number): boolean {
  const point = pointAt(x, y)
  if (point === undefined || !editable.contains(point.node)) return false
  editable.focus({ preventScroll: true })
  let placed = false
  ;(native as LexicalEditor).update(
    () => {
      const node = $getNearestNodeFromDOMNode(point.node)
      if ($isTextNode(node)) {
        const offset = Math.min(point.offset, node.getTextContentSize())
        const selection = $createRangeSelection()
        selection.anchor.set(node.getKey(), offset, 'text')
        selection.focus.set(node.getKey(), offset, 'text')
        $setSelection(selection)
        placed = true
      } else if ($isElementNode(node)) {
        node.selectEnd()
        placed = true
      }
    },
    { discrete: true },
  )
  return placed
}

/** The caret at the end of the slide's text, for a tool used before any click on the slide. */
export function placeCaretAtEnd(editable: HTMLElement, native: unknown): void {
  editable.focus({ preventScroll: true })
  ;(native as LexicalEditor).update(() => $getRoot().selectEnd(), { discrete: true })
}
