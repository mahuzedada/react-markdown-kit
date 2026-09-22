/**
 * The source editor of a diagram block (docs/MERMAID_PLATFORM.md section
 * 9.2): the kind's static output as a live preview, a monospace textarea
 * under it, and the problems the parser reported under that, invalid ones
 * first because Mermaid.js itself would reject them.
 *
 * The textarea is a plain text field inside a Lexical decorator, so every
 * key and clipboard event stops at it (native listeners, following the
 * canvas's text overlay): Lexical never sees a keystroke meant for the
 * source and never rewrites it. The draft is local; each change commits
 * the node's source at once, merged into the previous history entry when
 * the previous commit was under 300 ms ago, so typing undoes in bursts
 * rather than one character at a time. Undo and redo keys inside the field
 * are Lexical's, dispatched as its commands. Source mode signals problems,
 * it never blocks a keystroke.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { $addUpdateTag, $getNodeByKey, REDO_COMMAND, UNDO_COMMAND, type NodeKey } from 'lexical'
import { useLexicalEditor } from '@react-markdown-kit/editor/lexical'
import { detectDiagramKind } from '../core/detect.js'
import type { DiagramKind, DiagramProblem } from '../core/kind.js'
import type { DiagramSourceParse } from '../extension.js'
import { useDiagramLabels } from '../canvas/labels.js'
import { useDiagramOptions } from '../canvas/options.js'
import { DIAGRAM_FOCUS_COMMAND } from './commands.js'
import { $isDiagramNode } from './diagram-node.js'

/** Commits closer together than this merge into one history entry. */
const HISTORY_MERGE_WINDOW = 300
const INDENT = '  '
/** Events that must never reach Lexical's root listeners. */
const STOPPED_EVENTS = [
  'keyup',
  'keypress',
  'beforeinput',
  'paste',
  'cut',
  'copy',
  'drop',
  'compositionstart',
  'compositionupdate',
  'compositionend',
] as const

export interface DiagramSourceEditorProps {
  readonly nodeKey: NodeKey
  readonly source: string
  readonly kind: string
  readonly registered: DiagramKind | undefined
  readonly parsed: DiagramSourceParse | undefined
  /** False hides the textarea: preview and problems only. */
  readonly showTextarea: boolean
  readonly onFocusChange: (focused: boolean) => void
  /** Escape in the textarea. */
  readonly onEscape: () => void
}

export function DiagramSourceEditor({
  nodeKey,
  source,
  kind,
  registered,
  parsed,
  showTextarea,
  onFocusChange,
  onEscape,
}: DiagramSourceEditorProps): ReactElement {
  const { editor } = useLexicalEditor()
  const { kinds, fallbackTitle } = useDiagramOptions(editor)
  const labels = useDiagramLabels()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(source)
  const lastCommittedRef = useRef(source)
  const lastCommitAtRef = useRef(0)
  /** Caret to place after the next render, when the draft was replaced from outside. */
  const caretRef = useRef<number | null>(null)
  const kindsRef = useRef(kinds)
  kindsRef.current = kinds
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  // An undo, a canvas edit or a collaborator changed the node: adopt it. A
  // change equal to what this field last committed is its own echo.
  useEffect(() => {
    if (source === lastCommittedRef.current) return
    lastCommittedRef.current = source
    caretRef.current = source.length
    setDraft(source)
  }, [source])

  useLayoutEffect(() => {
    const element = ref.current
    const caret = caretRef.current
    if (element === null || caret === null) return
    caretRef.current = null
    element.setSelectionRange(caret, caret)
  }, [draft])

  useEffect(() => {
    const element = ref.current
    if (element === null) return

    const commit = (next: string): void => {
      const now = Date.now()
      const merge = now - lastCommitAtRef.current < HISTORY_MERGE_WINDOW
      lastCommitAtRef.current = now
      lastCommittedRef.current = next
      editor.update(
        () => {
          const node = $getNodeByKey(nodeKey)
          if (!$isDiagramNode(node) || node.getSource() === next) return
          if (merge) $addUpdateTag('history-merge')
          node.setSource(next, kindsRef.current)
        },
        { discrete: true },
      )
    }
    const apply = (next: string, selectionStart: number, selectionEnd: number): void => {
      element.value = next
      element.setSelectionRange(selectionStart, selectionEnd)
      setDraft(next)
      commit(next)
    }

    const onInput = (event: Event): void => {
      event.stopPropagation()
      setDraft(element.value)
      commit(element.value)
    }
    // Lexical's own history, committed discretely like the editor's
    // commands, so the step has landed when the key handler returns.
    const history = (command: typeof UNDO_COMMAND): void => {
      editor.update(
        () => {
          editor.dispatchCommand(command, undefined)
        },
        { discrete: true },
      )
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation()
      const key = event.key
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && !event.altKey && key.toLowerCase() === 'z') {
        event.preventDefault()
        history(event.shiftKey ? REDO_COMMAND : UNDO_COMMAND)
        return
      }
      if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && key.toLowerCase() === 'y') {
        event.preventDefault()
        history(REDO_COMMAND)
        return
      }
      if (key === 'Escape') {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (key === 'Tab' && !modifier && !event.altKey) {
        event.preventDefault()
        const { value, selectionStart, selectionEnd } = element
        if (event.shiftKey) {
          const edit = outdent(value, selectionStart, selectionEnd)
          if (edit !== null) apply(edit.value, edit.selectionStart, edit.selectionEnd)
        } else {
          const next = value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd)
          apply(next, selectionStart + INDENT.length, selectionStart + INDENT.length)
        }
      }
    }
    const stop = (event: Event): void => {
      event.stopPropagation()
    }
    element.addEventListener('keydown', onKeyDown)
    element.addEventListener('input', onInput)
    for (const type of STOPPED_EVENTS) element.addEventListener(type, stop)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('input', onInput)
      for (const type of STOPPED_EVENTS) element.removeEventListener(type, stop)
    }
  }, [editor, nodeKey, showTextarea])

  const model = parsed !== undefined && !('error' in parsed) ? parsed.model : undefined
  const problems = parsed !== undefined && !('error' in parsed) ? parsed.problems : undefined

  return (
    <div className="rmk-diagram-source">
      {registered?.render !== undefined && model !== undefined ? (
        <DiagramPreview kind={registered} model={model} fallbackTitle={fallbackTitle} />
      ) : (
        <Notice kind={kind} registered={registered} source={source} kinds={kinds} />
      )}
      {showTextarea && (
        <textarea
          ref={ref}
          className="rmk-diagram-source-input"
          aria-label={labels.source}
          value={draft}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={Math.max(3, draft.split('\n').length + 1)}
          onChange={noop}
          onFocus={() => {
            onFocusChange(true)
            editor.dispatchCommand(DIAGRAM_FOCUS_COMMAND, nodeKey)
          }}
          onBlur={() => {
            onFocusChange(false)
            editor.dispatchCommand(DIAGRAM_FOCUS_COMMAND, null)
          }}
        />
      )}
      <ProblemList error={parsed !== undefined && 'error' in parsed ? parsed.error : undefined} problems={problems ?? []} />
    </div>
  )
}

function noop(): void {}

/** Shift+Tab: every line the selection touches loses up to two leading spaces. Null when nothing changes. */
function outdent(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; selectionStart: number; selectionEnd: number } | null {
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const blockEnd = value.indexOf('\n', selectionEnd)
  const end = blockEnd === -1 ? value.length : blockEnd
  const lines = value.slice(lineStart, end).split('\n')
  let removedFirst = 0
  let removedTotal = 0
  const next = lines.map((line, index) => {
    const removed = Math.min(INDENT.length, line.length - line.trimStart().length)
    if (index === 0) removedFirst = removed
    removedTotal += removed
    return line.slice(removed)
  })
  if (removedTotal === 0) return null
  return {
    value: value.slice(0, lineStart) + next.join('\n') + value.slice(end),
    selectionStart: Math.max(lineStart, selectionStart - removedFirst),
    selectionEnd: Math.max(lineStart, selectionEnd - removedTotal),
  }
}

/** The kind's static SVG, as React. */
export function DiagramPreview({ kind, model, fallbackTitle }: { kind: DiagramKind; model: unknown; fallbackTitle: string }): ReactElement {
  const labels = useDiagramLabels()
  const rendered = useMemo<ReactNode>(() => {
    const render = kind.render
    if (render === undefined) return null
    return toJsxRuntime(render(model, { fallbackTitle }), { Fragment, jsx, jsxs, passKeys: true })
  }, [kind, model, fallbackTitle])
  return (
    <div className="rmk-diagram-preview" aria-label={labels.preview}>
      {rendered}
    </div>
  )
}

/** Why there is no preview: the kind is shown as source, or the source names no kind. */
function Notice({
  kind,
  registered,
  source,
  kinds,
}: {
  kind: string
  registered: DiagramKind | undefined
  source: string
  kinds: readonly DiagramKind[]
}): ReactElement {
  const labels = useDiagramLabels()
  if (kind === 'unknown') {
    const { hint } = detectDiagramKind(source, kinds)
    return (
      <p className="rmk-diagram-notice" role="status">
        {labels.notMermaid}
        {hint === undefined ? null : ` ${labels.keywordHint(hint)}`}
      </p>
    )
  }
  return (
    <p className="rmk-diagram-notice" role="status">
      {labels.unsupported(registered?.label ?? kind)}
    </p>
  )
}

/** Problems with their line numbers, `invalid` first, prefixed as Mermaid's own rejection. */
function ProblemList({ error, problems }: { error: string | undefined; problems: readonly DiagramProblem[] }): ReactElement | null {
  const labels = useDiagramLabels()
  const ordered = useMemo(() => {
    const rank = (problem: DiagramProblem): number => (problem.severity === 'invalid' ? 0 : 1)
    return [...problems].sort((a, b) => rank(a) - rank(b))
  }, [problems])
  if (error === undefined && ordered.length === 0) return null
  return (
    <ul className="rmk-diagram-problems" aria-label={labels.problems}>
      {error !== undefined && (
        <li data-rmk-diagram-severity="invalid">
          {labels.rejects} {error}
        </li>
      )}
      {ordered.map((problem, index) => (
        <li key={`${problem.code}:${problem.line ?? ''}:${index}`} data-rmk-diagram-severity={problem.severity}>
          {problem.line === undefined ? '' : `${labels.problemLine(problem.line)}: `}
          {problem.severity === 'invalid' ? `${labels.rejects} ` : ''}
          {problem.message}
        </li>
      ))}
    </ul>
  )
}
