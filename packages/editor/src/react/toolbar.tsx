/**
 * The default toolbar (docs/STYLING.md, "Editor chrome").
 *
 * Semantic `<button type="button">` with an accessible name, inline SVG icons,
 * `rmk-` classes that `classNames` replaces outright, and `aria-pressed` for
 * state. Remove it with `toolbar={false}`, replace it with a render prop, or
 * ignore it entirely and build your own on `useMarkdownEditor`.
 */
import { useEffect, useState, type ReactElement } from 'react'
import {
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  type LexicalNode,
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { cx, editorClass } from '../class-names.js'
import { editorOf } from '../bridge/session.js'
import { adapterOf } from '../bridge/adapters.js'
import { $isBlockquoteNode, $isCodeBlockNode, $isHeadingNode, $isListItemNode, $isListNode } from '../nodes/blocks.js'
import { formatOf } from '../commands.js'
import type { EditorInternals } from './internals.js'
import type {
  MarkdownEditorInstance,
  MarkdownEditorLabels,
  MarkdownEditorMode,
  MarkdownToolbarItem,
  MarkdownToolbarRenderer,
} from '../types.js'
import { icons } from './icons.js'

const DEFAULT_LABELS: Readonly<Record<string, string>> = {
  bold: 'Bold',
  italic: 'Italic',
  strikethrough: 'Strikethrough',
  code: 'Inline code',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  paragraph: 'Paragraph',
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  taskList: 'Task list',
  blockquote: 'Block quote',
  codeBlock: 'Code block',
  link: 'Link',
  image: 'Image',
  thematicBreak: 'Horizontal rule',
  undo: 'Undo',
  redo: 'Redo',
  rich: 'Rich text',
  source: 'Markdown source',
  preview: 'Preview',
  toolbar: 'Formatting',
  modes: 'Editing mode',
  linkPrompt: 'Link URL',
  imagePrompt: 'Image URL',
}

interface SurfaceState {
  readonly marks: readonly string[]
  readonly block: string
  readonly list: 'bullet' | 'ordered' | 'task' | null
  readonly canUndo: boolean
  readonly canRedo: boolean
}

const EMPTY_STATE: SurfaceState = { marks: [], block: 'paragraph', list: null, canUndo: false, canRedo: false }

function useSurfaceState(internals: EditorInternals): SurfaceState {
  const editor = editorOf(internals.bridge)
  const [state, setState] = useState<SurfaceState>(EMPTY_STATE)

  useEffect(() => {
    const read = (): void => {
      editor.getEditorState().read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return
        const marks: string[] = []
        for (const mark of ['strong', 'emphasis', 'delete', 'code'] as const) {
          if (selection.hasFormat(formatOf(mark))) marks.push(mark)
        }
        const { block, list } = describeBlock(selection.anchor.getNode())
        setState((previous) => ({ ...previous, marks, block, list }))
      })
    }
    read()
    return mergeRegister(
      editor.registerUpdateListener(read),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (canUndo: boolean) => {
          setState((previous) => ({ ...previous, canUndo }))
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (canRedo: boolean) => {
          setState((previous) => ({ ...previous, canRedo }))
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor])

  return state
}

function describeBlock(node: LexicalNode): { block: string; list: SurfaceState['list'] } {
  let current: LexicalNode | null = node
  let list: SurfaceState['list'] = null
  let block = 'paragraph'
  while (current !== null) {
    if ($isHeadingNode(current)) block = `heading${current.getDepth()}`
    else if ($isBlockquoteNode(current)) block = 'blockquote'
    else if ($isCodeBlockNode(current)) block = 'codeBlock'
    else if ($isListItemNode(current) && current.getChecked() !== null) list = 'task'
    else if ($isListNode(current) && list === null) list = current.isOrdered() ? 'ordered' : 'bullet'
    current = current.getParent()
  }
  return { block, list }
}

export function buildToolbarItems(
  editor: MarkdownEditorInstance,
  internals: EditorInternals,
  state: SurfaceState,
  labels: MarkdownEditorLabels | undefined,
): MarkdownToolbarItem[] {
  const label = (key: string): string => labels?.[key] ?? DEFAULT_LABELS[key] ?? key
  const commands = editor.commands
  const disabled = internals.readOnly || internals.mode !== 'rich'

  const item = (
    id: string,
    group: string,
    active: boolean,
    run: () => void,
    overrides?: { disabled?: boolean },
  ): MarkdownToolbarItem => ({
    id,
    group,
    label: label(id),
    icon: icons[id] ?? null,
    active,
    disabled: overrides?.disabled ?? disabled,
    run,
  })

  const mode = (target: MarkdownEditorMode): MarkdownToolbarItem =>
    item(
      target,
      'mode',
      internals.mode === target,
      () => {
        internals.setMode(target)
      },
      { disabled: false },
    )

  return [
    item('bold', 'mark', state.marks.includes('strong'), () => {
      commands.toggleMark('strong')
    }),
    item('italic', 'mark', state.marks.includes('emphasis'), () => {
      commands.toggleMark('emphasis')
    }),
    item('strikethrough', 'mark', state.marks.includes('delete'), () => {
      commands.toggleMark('delete')
    }),
    item('code', 'mark', state.marks.includes('code'), () => {
      commands.toggleMark('code')
    }),
    item('heading1', 'block', state.block === 'heading1', () => {
      commands.setBlockType(state.block === 'heading1' ? 'paragraph' : 'heading1')
    }),
    item('heading2', 'block', state.block === 'heading2', () => {
      commands.setBlockType(state.block === 'heading2' ? 'paragraph' : 'heading2')
    }),
    item('heading3', 'block', state.block === 'heading3', () => {
      commands.setBlockType(state.block === 'heading3' ? 'paragraph' : 'heading3')
    }),
    item('blockquote', 'block', state.block === 'blockquote', () => {
      commands.setBlockType(state.block === 'blockquote' ? 'paragraph' : 'blockquote')
    }),
    item('codeBlock', 'block', state.block === 'codeBlock', () => {
      commands.setBlockType(state.block === 'codeBlock' ? 'paragraph' : 'codeBlock')
    }),
    item('bulletList', 'list', state.list === 'bullet', () => {
      commands.toggleBulletList()
    }),
    item('orderedList', 'list', state.list === 'ordered', () => {
      commands.toggleOrderedList()
    }),
    item('taskList', 'list', state.list === 'task', () => {
      commands.toggleTaskList()
    }),
    item('link', 'insert', false, () => {
      const url = promptFor(label('linkPrompt'))
      if (url !== null) commands.insertLink(url)
    }),
    item('image', 'insert', false, () => {
      const url = promptFor(label('imagePrompt'))
      if (url !== null) commands.insertImage({ src: url })
    }),
    item('thematicBreak', 'insert', false, () => {
      commands.insertThematicBreak()
    }),
    // Extension buttons sit with the insert group unless they name another.
    ...adapterOf(internals.bridge).commands.map(
      (contribution): MarkdownToolbarItem => ({
        id: contribution.id,
        group: contribution.group ?? 'insert',
        label: labels?.[contribution.id] ?? contribution.label ?? contribution.id,
        icon: contribution.icon ?? icons[contribution.id] ?? null,
        active: false,
        disabled,
        run: () => {
          contribution.run(editorOf(internals.bridge))
        },
      }),
    ),
    item(
      'undo',
      'history',
      false,
      () => {
        editor.undo()
      },
      { disabled: disabled || !state.canUndo },
    ),
    item(
      'redo',
      'history',
      false,
      () => {
        editor.redo()
      },
      { disabled: disabled || !state.canRedo },
    ),
    mode('rich'),
    mode('source'),
    mode('preview'),
  ]
}

/** The only browser dialog in the package, and only in the default toolbar. */
function promptFor(message: string): string | null {
  if (typeof globalThis.prompt !== 'function') return null
  const answer = globalThis.prompt(message)
  return answer === null || answer.trim() === '' ? null : answer.trim()
}

export interface MarkdownToolbarProps {
  readonly editor: MarkdownEditorInstance
  readonly internals: EditorInternals
  readonly render?: MarkdownToolbarRenderer | undefined
}

export function MarkdownToolbar({ editor, internals, render }: MarkdownToolbarProps): ReactElement {
  const state = useSurfaceState(internals)
  const items = buildToolbarItems(editor, internals, state, internals.labels)
  if (render !== undefined) return <>{render(items, editor)}</>

  const groups: MarkdownToolbarItem[][] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last !== undefined && last[0]?.group === item.group) last.push(item)
    else groups.push([item])
  }
  const labels = internals.labels
  const label = (key: string): string => labels?.[key] ?? DEFAULT_LABELS[key] ?? key

  return (
    <div
      className={editorClass('toolbar', internals.classNames)}
      role="toolbar"
      aria-label={label('toolbar')}
    >
      {groups.map((group) => (
        <div
          key={group[0]?.group}
          className={editorClass('toolbarGroup', internals.classNames)}
          role="group"
          aria-label={group[0]?.group === 'mode' ? label('modes') : undefined}
        >
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(
                editorClass('toolbarButton', internals.classNames),
                item.active ? editorClass('toolbarButtonActive', internals.classNames) : undefined,
              )}
              aria-label={item.label}
              aria-pressed={item.active}
              disabled={item.disabled}
              data-rmk-toolbar-item={item.id}
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={item.run}
            >
              {item.icon}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

