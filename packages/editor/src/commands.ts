/**
 * Editing verbs (spec 7.7).
 *
 * Every default toolbar button routes through here, so a custom toolbar built
 * on `useMarkdownEditor` has exactly the same power as the shipped one and the
 * default chrome is never privileged.
 */
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  REDO_COMMAND,
  UNDO_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $findMatchingParent } from '@lexical/utils'
import { rawResolverFor } from './mdast/atoms.js'
import { blocksToLexical } from './bridge/import.js'
import {
  $createBlockquoteNode,
  $createCodeBlockNode,
  $createHeadingNode,
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  ListNode,
} from './nodes/blocks.js'
import { $createImageNode, $createLinkNode, $createThematicBreakNode, $isLinkNode } from './nodes/inline.js'
import { editorOf, type MarkdownBridge } from './bridge/session.js'
import { adapterOf } from './bridge/adapters.js'
import type {
  MarkdownBlockType,
  MarkdownEditorCommands,
  MarkdownImageValue,
  MarkdownInlineMark,
  MarkdownUploadImage,
} from './types.js'

const MARK_TO_FORMAT: Readonly<Record<MarkdownInlineMark, TextFormatType>> = {
  strong: 'bold',
  emphasis: 'italic',
  delete: 'strikethrough',
  code: 'code',
}

export function formatOf(mark: MarkdownInlineMark): TextFormatType {
  return MARK_TO_FORMAT[mark]
}

/**
 * A toolbar click should work whether or not the surface happens to be focused,
 * so a command with nothing selected acts on the end of the document rather
 * than silently doing nothing.
 */
function $selectionOrEnd(): RangeSelection {
  const selection = $getSelection()
  return $isRangeSelection(selection) ? selection : $getRoot().selectEnd()
}

export interface CommandContext {
  readonly bridge: MarkdownBridge
  readonly getUploadImage: () => MarkdownUploadImage | undefined
  readonly getDocumentKey: () => string | undefined
  readonly getUploadSignal: () => AbortSignal
}

export function createCommands(context: CommandContext): MarkdownEditorCommands {
  const editor = (): LexicalEditor => editorOf(context.bridge)

  /**
   * Commands commit discretely. A queued Lexical update lands on a microtask,
   * which would make `editor.getMarkdown()` stale for anyone who calls it right
   * after running a command. One user action, one committed state.
   */
  const write = (mutate: () => void): void => {
    editor().update(mutate, { discrete: true })
  }

  const blockCreator = (type: MarkdownBlockType): (() => ElementNode) => {
    if (type === 'blockquote') return $createBlockquoteNode
    if (type === 'codeBlock') return () => $createCodeBlockNode(null, null)
    const heading = /^heading([1-6])$/.exec(type)
    if (heading !== null) return () => $createHeadingNode(Number(heading[1]))
    return $createParagraphNode
  }

  return {
    toggleMark(mark) {
      write(() => {
        $selectionOrEnd().formatText(formatOf(mark))
      })
    },

    setBlockType(type) {
      write(() => {
        $setBlocksType($selectionOrEnd(), blockCreator(type))
      })
    },

    toggleBulletList() {
      toggleList(editor(), false)
    },

    toggleOrderedList() {
      toggleList(editor(), true)
    },

    toggleTaskList() {
      toggleList(editor(), false, true)
    },

    insertLink(url, options) {
      write(() => {
        const selection = $selectionOrEnd()
        const existing = $findMatchingParent(selection.anchor.getNode(), $isLinkNode)
        if (existing !== null) {
          existing.setURL(url)
          return
        }
        const link = $createLinkNode(url, options?.title ?? null)
        const text = selection.getTextContent()
        const label = options?.text ?? (text === '' ? url : text)
        link.append($createTextNode(label))
        if (text === '') $insertNodes([link])
        else selection.insertNodes([link])
      })
    },

    removeLink() {
      write(() => {
        const selection = $selectionOrEnd()
        const link = $findMatchingParent(selection.anchor.getNode(), $isLinkNode)
        if (link === null) return
        for (const child of link.getChildren()) link.insertBefore(child)
        link.remove()
      })
    },

    insertImage(image) {
      write(() => {
        $selectionOrEnd()
        $insertNodes([$createImageNode(image.src, image.alt ?? null, image.title ?? null)])
      })
    },

    insertThematicBreak() {
      write(() => {
        $selectionOrEnd()
        $insertNodes([$createThematicBreakNode(), $createParagraphNode()])
      })
    },

    insertMarkdown(source) {
      const document = context.bridge.compile(source)
      const raw = rawResolverFor(document.source)
      write(() => {
        $selectionOrEnd()
        const nodes = blocksToLexical(document.tree.children ?? [], raw, adapterOf(context.bridge))
        if (nodes.length > 0) $insertNodes(nodes)
      })
    },

    setMarkdown(source) {
      context.bridge.load(source)
    },

    async uploadImage(file) {
      const upload = context.getUploadImage()
      if (upload === undefined) {
        throw new Error(
          'onUploadImage is not configured. Pass it to <MarkdownEditor> to accept image uploads.',
        )
      }
      // A blob: URL is never written into the document (spec 7.8); the
      // application's returned URL is the only thing that reaches Markdown.
      const result: MarkdownImageValue = await upload(file, {
        signal: context.getUploadSignal(),
        documentKey: context.getDocumentKey(),
      })
      write(() => {
        $selectionOrEnd()
        $insertNodes([$createImageNode(result.src, result.alt ?? null, result.title ?? null)])
      })
    },
  }
}

function toggleList(editor: LexicalEditor, ordered: boolean, task = false): void {
  editor.update(() => {
    const blocks = selectedTopLevelBlocks($selectionOrEnd().getNodes())
    if (blocks.length === 0) return

    const alreadyMatching = blocks.every((block) => {
      const list = block instanceof ListNode ? block : null
      return list !== null && list.isOrdered() === ordered
    })
    if (alreadyMatching) {
      for (const block of blocks) unwrapList(block as ListNode)
      return
    }

    const list = $createListNode(ordered, 1, false)
    const first = blocks[0]
    if (first === undefined) return
    first.insertBefore(list)
    for (const block of blocks) {
      if ($isListNode(block)) {
        for (const item of block.getChildren()) list.append(item)
        block.remove()
        continue
      }
      const item = $createListItemNode(task ? false : null, false)
      item.append(block)
      list.append(item)
    }
  }, { discrete: true })
}

function selectedTopLevelBlocks(nodes: readonly LexicalNode[]): ElementNode[] {
  const root = $getRoot()
  const out: ElementNode[] = []
  for (const node of nodes) {
    let current: LexicalNode | null = node
    while (current !== null && current.getParent() !== root) current = current.getParent()
    if (current !== null && !out.includes(current as ElementNode)) out.push(current as ElementNode)
  }
  return out
}

function unwrapList(list: ListNode): void {
  for (const item of list.getChildren()) {
    if (!$isListItemNode(item)) {
      list.insertBefore(item)
      continue
    }
    for (const child of item.getChildren()) list.insertBefore(child)
  }
  list.remove()
}

export function undo(editor: LexicalEditor): void {
  editor.dispatchCommand(UNDO_COMMAND, undefined)
  $flush(editor)
}

export function redo(editor: LexicalEditor): void {
  editor.dispatchCommand(REDO_COMMAND, undefined)
  $flush(editor)
}

/**
 * History runs through `setEditorState`, which cannot be made discrete from the
 * call site. An empty discrete update commits whatever it queued, so
 * `getMarkdown()` is never one microtask behind the user.
 */
function $flush(editor: LexicalEditor): void {
  editor.update(() => undefined, { discrete: true })
}
