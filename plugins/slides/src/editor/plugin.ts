/**
 * The editor plugin: handles the three insert commands, publishes the
 * labels to the node UI, registers the Enter shortcut, and contributes the
 * four toolbar buttons.
 *
 * An insert lands at the selection, or at the end of the document when the
 * surface is not focused (a toolbar click should always do something), and
 * always leaves a paragraph after the new node for the caret. The toolbar
 * buttons dispatch inside a discrete update so the click has landed when
 * `getMarkdown()` is next called, matching the editor's own commands.
 *
 * One node transform: a slide break only splits slides at the root, so one
 * that opens or lands inside a quote or a list is re-typed as a rule, which
 * is what the deck reader and the renderer already make of it.
 */
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_EDITOR,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical'
import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils'
import type { EditorCommandContribution, EditorPlugin } from '@react-markdown-kit/editor/lexical'
import { INSERT_SLIDE_COMMAND, INSERT_SLIDE_DIRECTIVE_COMMAND, INSERT_SLIDE_MARKER_COMMAND } from './commands.js'
import { registerEnterShortcut } from './enter-shortcut.js'
import { SLIDES_ICONS } from './icons.js'
import { setSlidesEditorLabels, type SlidesEditorLabels } from './options.js'
import { $createImportedSlideBreakNode, $createSlideBreakNode, SlideBreakNode } from './slide-break-node.js'
import { $createSlideDirectiveNode } from './slide-directive-node.js'
import { $createSlideMarkerNode } from './slide-marker-node.js'

export interface SlidesPluginOptions {
  readonly labels: SlidesEditorLabels
}

/**
 * An element with nothing in it but other hollow elements: the clone a
 * split leaves behind. A list with one empty item or a quote holding an
 * empty paragraph is hollow; a paragraph holding only an image is not.
 */
function $isHollow(node: LexicalNode): boolean {
  return $isElementNode(node) && node.getChildren().every($isHollow)
}

/**
 * Removes the hollow clone a split left at one edge of `node`, at whatever
 * depth it sits: the empty item a list keeps after its last item was split,
 * or the empty sub-item under a nested one. Descends only through content,
 * so an authored empty element deeper in is left alone.
 */
function $dropHollowEdge(node: LexicalNode, edge: 'first' | 'last'): void {
  let parent = node
  while ($isElementNode(parent)) {
    const child = edge === 'first' ? parent.getFirstChild() : parent.getLastChild()
    if (child === null) return
    if ($isHollow(child)) {
      child.remove()
      return
    }
    parent = child
  }
}

/**
 * Inserts a block at the selection (or the end) and puts the caret in the
 * paragraph after it. `$insertNodeToNearestRoot` splits every ancestor of
 * the caret up to the root, and at a block's edge the split leaves a hollow
 * clone (an empty heading after a heading's end, a list with one empty item
 * after a list's end, an empty paragraph before a paragraph's start); a
 * hollow neighbour is removed, or turned into the paragraph the caret needs,
 * and a hollow edge inside a neighbour that kept content is trimmed.
 */
function $insertBlock(node: LexicalNode): void {
  if (!$isRangeSelection($getSelection())) $getRoot().selectEnd()
  const inserted = $insertNodeToNearestRoot(node)
  const previous = inserted.getPreviousSibling()
  if (previous !== null) {
    if ($isHollow(previous)) previous.remove()
    else $dropHollowEdge(previous, 'last')
  }
  let next = inserted.getNextSibling()
  if (next === null) {
    next = $createParagraphNode()
    inserted.insertAfter(next)
  } else if ($isHollow(next)) {
    if (!$isParagraphNode(next)) {
      const paragraph = $createParagraphNode()
      next.replace(paragraph)
      next = paragraph
    }
  } else {
    $dropHollowEdge(next, 'first')
  }
  if ($isElementNode(next)) next.selectStart()
}

/** The plugin for one `slides()` configuration. */
export function createSlidesPlugin(options: SlidesPluginOptions): EditorPlugin {
  return (editor) =>
    mergeRegister(
      setSlidesEditorLabels(editor, options.labels),
      editor.registerCommand(
        INSERT_SLIDE_COMMAND,
        () => {
          $insertBlock($createSlideBreakNode('slide'))
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        INSERT_SLIDE_MARKER_COMMAND,
        ({ kind }) => {
          $insertBlock($createSlideMarkerNode(kind))
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        INSERT_SLIDE_DIRECTIVE_COMMAND,
        ({ key, argument }) => {
          $insertBlock($createSlideDirectiveNode(key, argument))
          return true
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      registerEnterShortcut(editor),
      registerNestedBreakRule(editor),
    )
}

/**
 * Only a root-level `---` splits slides: a slide break nested in a quote or
 * a list (imported, pasted or dragged there) becomes a rule, keeping its
 * bytes so the writer still aligns it with its original. Registering marks
 * the breaks already open as dirty in a batched update; committing that at
 * once means the surface never shows a nested break numbered as a slide.
 */
function registerNestedBreakRule(editor: LexicalEditor): () => void {
  const off = editor.registerNodeTransform(SlideBreakNode, (node) => {
    if (node.getKind() !== 'slide' || $isRootNode(node.getParent())) return
    node.replace($createImportedSlideBreakNode('rule', node.getSource()))
  })
  editor.update(() => undefined, { discrete: true, tag: 'history-merge' })
  return off
}

function dispatch<T>(command: LexicalCommand<T>, payload: T): (editor: LexicalEditor) => void {
  return (editor) => {
    editor.update(
      () => {
        editor.dispatchCommand(command, payload)
      },
      { discrete: true },
    )
  }
}

/** The default toolbar's `slides` group: New slide, Speaker notes, Pause, Background. */
export const SLIDES_COMMANDS: readonly EditorCommandContribution[] = [
  { id: 'slide', group: 'slides', label: 'New slide', icon: SLIDES_ICONS.slide, run: dispatch(INSERT_SLIDE_COMMAND, undefined) },
  {
    id: 'slideNotes',
    group: 'slides',
    label: 'Speaker notes',
    icon: SLIDES_ICONS.notes,
    run: dispatch(INSERT_SLIDE_MARKER_COMMAND, { kind: 'notes' }),
  },
  {
    id: 'slidePause',
    group: 'slides',
    label: 'Pause',
    icon: SLIDES_ICONS.pause,
    run: dispatch(INSERT_SLIDE_MARKER_COMMAND, { kind: 'pause' }),
  },
  {
    id: 'slideBackground',
    group: 'slides',
    label: 'Background',
    icon: SLIDES_ICONS.background,
    run: dispatch(INSERT_SLIDE_DIRECTIVE_COMMAND, { key: 'background', argument: '' }),
  },
]
