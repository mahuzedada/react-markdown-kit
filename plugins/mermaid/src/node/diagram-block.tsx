/**
 * The block a `DiagramNode` decorates (docs/MERMAID_PLATFORM.md section
 * 9.2): a header row naming the kind and its support level, and one editing
 * component under it, the kind's canvas or the source editor.
 *
 * The block owns the mode. Canvas mode needs a kind that writes and has a
 * canvas component in the editor's `editors` map (or a legacy fence, which
 * is a flowchart by construction), with the text toggle off; every other
 * block is edited as text. Both are read at render time, so a kind that
 * gains `write` or a component from configuration is on the canvas at the
 * next render. The kind is re-detected on every edit and the header follows
 * at once, but the editing component is held while the block's textarea
 * has focus: a mode change implied by a new kind takes effect on blur or on
 * the toggle, so typing a header never pulls the textarea out from under
 * the caret. In a read-only editor the header shows label and badge only,
 * and the block renders the kind's static output or the source.
 *
 * The block also owns what every canvas kind shares: the lossy lock (a
 * source whose features a canvas edit cannot keep is shown, not edited,
 * until the author accepts the loss or switches to text) and the commit. A
 * canvas hands back source; the block writes it to the node in a discrete
 * update, merging into its own previous commit when asked to and that
 * commit is under 300 ms old and still what the node holds. Any change of
 * the node from outside the block ends the burst, so a keystroke never
 * folds into the entry an undo restored.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { $addUpdateTag, $getNodeByKey, UNDO_COMMAND, type NodeKey } from 'lexical'
import { useLexicalEditor } from '@react-markdown-kit/editor/lexical'
import type { DiagramKind } from '../core/kind.js'
import { parseDiagramSource, type DiagramFormat, type DiagramSourceParse, type DiagramSupport } from '../extension.js'
import { Icon, UI_ICONS } from '../canvas/icons.js'
import { DiagramCanvasHostProvider, useDiagramLabels, type DiagramCanvasHost } from '../canvas/host.js'
import { resolveDiagramLabels } from '../canvas/labels.js'
import { DIAGRAM_FOCUS_COMMAND } from './commands.js'
import type { DiagramKindEditor } from '../canvas/options.js'
import { takeDiagramFocus, useDiagramOptions } from './options-store.js'
import { $isDiagramNode } from './diagram-node.js'
import { DiagramPreview, DiagramSourceEditor, DiagramSourcePre } from './source-editor.js'

type Mode = 'canvas' | 'source'

export interface DiagramBlockProps {
  readonly nodeKey: NodeKey
  readonly source: string
  readonly kind: string
  readonly format: DiagramFormat
}

/** Commits closer together than this merge into one history entry when the canvas asks. */
const HISTORY_MERGE_WINDOW = 300

/** The selector of whatever takes focus after an insert: the canvas root or the textarea. */
const FOCUS_TARGET = '.rmk-diagram-canvas, .rmk-diagram-source-input, [data-rmk-diagram-focus]'

/**
 * The canvas host of a document (host.tsx): the editor's options and
 * labels, the tool row slot keyed on the `LexicalEditor`, focus reported
 * through `DIAGRAM_FOCUS_COMMAND` and undo through the editor's history.
 */
function EditorCanvasHost({ children }: { children: ReactNode }): ReactElement {
  const { editor, labels } = useLexicalEditor()
  const options = useDiagramOptions(editor)
  const host = useMemo(
    (): DiagramCanvasHost => ({
      scope: editor,
      options,
      labels: resolveDiagramLabels(labels),
      chrome: 'block',
      toolbarOrientation: 'horizontal',
      onFocusChange: (id) => editor.dispatchCommand(DIAGRAM_FOCUS_COMMAND, id),
      undo: () =>
        editor.update(
          () => {
            editor.dispatchCommand(UNDO_COMMAND, undefined)
          },
          { discrete: true },
        ),
    }),
    [editor, options, labels],
  )
  return <DiagramCanvasHostProvider host={host}>{children}</DiagramCanvasHostProvider>
}

export function DiagramBlock(props: DiagramBlockProps): ReactElement {
  return (
    <EditorCanvasHost>
      <DiagramBlockBody {...props} />
    </EditorCanvasHost>
  )
}

function DiagramBlockBody({ nodeKey, source, kind, format }: DiagramBlockProps): ReactElement {
  const { editor, readOnly } = useLexicalEditor()
  const options = useDiagramOptions(editor)
  const { kinds } = options
  const labels = useDiagramLabels()
  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const registered: DiagramKind | undefined = kinds.find((candidate) => candidate.name === kind)
  const parsed: DiagramSourceParse | undefined = registered === undefined ? undefined : parseDiagramSource(kinds, kind, source)
  const parseError = parsed !== undefined && 'error' in parsed ? parsed.error : undefined
  const support: DiagramSupport = registered?.render === undefined ? 'source' : 'static'

  // The canvas component of this kind, when the kind can write what the
  // canvas edits: a legacy fence is a flowchart by construction, a
  // ```mermaid fence needs the kind's `write`. Read here, at render time.
  const canvasEditor: DiagramKindEditor | undefined =
    registered !== undefined && (format !== 'mermaid' || registered.write !== undefined) ? options.editors[registered.name] : undefined
  const [sourceMode, setSourceMode] = useState(false)
  const wanted: Mode = canvasEditor !== undefined && !sourceMode && parsed !== undefined && parseError === undefined ? 'canvas' : 'source'
  // The mode held while the textarea has focus; null once it blurs.
  const [held, setHeld] = useState<Mode | null>(null)
  const mode: Mode = readOnly ? 'source' : (held ?? wanted)

  // The lossy features the author accepted, as the parser names them. A
  // different set (the text was edited meanwhile) locks the canvas again.
  const [acknowledged, setAcknowledged] = useState<string | null>(null)
  const lossy = parsed !== undefined && !('error' in parsed) ? parsed.lossy : []
  const lossyKey = lossy.join(', ')
  const locked = lossy.length > 0 && acknowledged !== lossyKey

  const commit = useBlockCommit(nodeKey, source)

  // An insert asks the block it created to take focus once it mounts.
  useEffect(() => {
    if (!takeDiagramFocus(editor, nodeKey)) return
    const target = rootRef.current?.querySelector<HTMLElement>(FOCUS_TARGET)
    if (!target) return
    target.focus()
    if (target instanceof HTMLTextAreaElement) target.setSelectionRange(target.value.length, target.value.length)
  }, [editor, nodeKey])

  const kindLabel = registered?.label ?? (kind === 'unknown' ? labels.unknownKind : kind)
  const CanvasEditor = canvasEditor

  return (
    <div
      ref={rootRef}
      className="rmk-diagram-block"
      data-rmk-diagram-kind={kind}
      data-rmk-diagram-support={support}
      data-rmk-diagram-mode={mode}
    >
      <div ref={headerRef} className="rmk-diagram-header" tabIndex={-1} aria-label={labels.header}>
        <span className="rmk-diagram-kind">{kindLabel}</span>
        <span className="rmk-diagram-badge" data-rmk-diagram-support={support}>
          {support === 'static' ? labels.staticBadge : labels.sourceBadge}
        </span>
        {!readOnly && canvasEditor !== undefined && (
          <div className="rmk-diagram-mode" role="group">
            <ModeButton
              label={labels.canvasMode}
              active={mode === 'canvas'}
              disabled={parseError !== undefined}
              title={parseError}
              onClick={() => {
                setSourceMode(false)
                setHeld(null)
              }}
            >
              {UI_ICONS.canvas}
            </ModeButton>
            <ModeButton
              label={labels.textMode}
              active={mode === 'source'}
              disabled={parseError !== undefined}
              title={parseError}
              onClick={() => {
                setSourceMode(true)
                setHeld(null)
              }}
            >
              {UI_ICONS.code}
            </ModeButton>
          </div>
        )}
      </div>

      {readOnly ? (
        <ReadOnlyBody source={source} registered={registered} parsed={parsed} fallbackTitle={options.fallbackTitle} />
      ) : mode === 'canvas' && CanvasEditor !== undefined && registered !== undefined && parsed !== undefined && !('error' in parsed) ? (
        <>
          {locked && (
            <LossyNotice
              lossy={lossy}
              onEditOnCanvas={() => setAcknowledged(lossyKey)}
              onEditAsText={() => {
                setSourceMode(true)
                setHeld(null)
              }}
            />
          )}
          <CanvasEditor nodeKey={nodeKey} kind={registered} source={source} parse={parsed} readOnly={locked} commit={commit} />
        </>
      ) : (
        <DiagramSourceEditor
          nodeKey={nodeKey}
          source={source}
          kind={kind}
          registered={registered}
          parsed={parsed}
          showTextarea={options.sourceEditor}
          onFocusChange={(focused) => setHeld(focused ? wanted : null)}
          onEscape={() => headerRef.current?.focus()}
        />
      )}
    </div>
  )
}

/**
 * The block's commit for its canvas: writes source to the node discretely,
 * so the document holds the gesture when the handler returns, and merges
 * into this block's own previous commit under the 300 ms rule when the
 * canvas asks. A node that holds anything else changed from outside since,
 * and the burst is over.
 */
function useBlockCommit(nodeKey: NodeKey, source: string): (next: string, options?: { readonly merge?: boolean }) => void {
  const { editor } = useLexicalEditor()
  const { kinds } = useDiagramOptions(editor)
  const kindsRef = useRef(kinds)
  kindsRef.current = kinds
  const lastCommittedRef = useRef(source)
  const lastCommitAtRef = useRef(0)

  // An undo, a text edit or a collaborator changed the node: adopt it and
  // end the burst. A change equal to the last commit is the block's echo.
  useEffect(() => {
    if (source === lastCommittedRef.current) return
    lastCommittedRef.current = source
    lastCommitAtRef.current = 0
  }, [source])

  return useCallback(
    (next, options) => {
      const now = Date.now()
      const previous = lastCommittedRef.current
      const withinBurst = options?.merge === true && now - lastCommitAtRef.current < HISTORY_MERGE_WINDOW
      lastCommitAtRef.current = now
      lastCommittedRef.current = next
      editor.update(
        () => {
          const node = $getNodeByKey(nodeKey)
          if (!$isDiagramNode(node) || node.getSource() === next) return
          if (withinBurst && node.getSource() === previous) $addUpdateTag('history-merge')
          node.setSource(next, kindsRef.current)
        },
        { discrete: true },
      )
    },
    [editor, nodeKey],
  )
}

/** A lossy source: what a canvas edit would flatten, and the two ways on. */
function LossyNotice({
  lossy,
  onEditOnCanvas,
  onEditAsText,
}: {
  lossy: readonly string[]
  onEditOnCanvas: () => void
  onEditAsText: () => void
}): ReactElement {
  const labels = useDiagramLabels()
  return (
    <div className="rmk-diagram-lossy" role="status">
      <Icon>{UI_ICONS.warning}</Icon>
      <span className="rmk-diagram-lossy-text">
        {labels.lossyNotice} {lossy.join(', ')}
      </span>
      <button type="button" className="rmk-diagram-lossy-action" onClick={onEditOnCanvas}>
        {labels.editOnCanvas}
      </button>
      <button type="button" className="rmk-diagram-lossy-action" onClick={onEditAsText}>
        {labels.editAsText}
      </button>
    </div>
  )
}

function ModeButton({
  label,
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  label: string
  active: boolean
  disabled: boolean
  title: string | undefined
  onClick: () => void
  children: ReactElement
}): ReactElement {
  return (
    <button
      type="button"
      className={active ? 'rmk-diagram-mode-button is-active' : 'rmk-diagram-mode-button'}
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      title={title ?? label}
      onClick={onClick}
    >
      <Icon>{children}</Icon>
      <span>{label}</span>
    </button>
  )
}

/** Read-only: what the document renders, or the source when nothing renders it. */
function ReadOnlyBody({
  source,
  registered,
  parsed,
  fallbackTitle,
}: {
  source: string
  registered: DiagramKind | undefined
  parsed: DiagramSourceParse | undefined
  fallbackTitle: string
}): ReactElement {
  if (registered?.render !== undefined && parsed !== undefined && !('error' in parsed)) {
    return <DiagramPreview kind={registered} model={parsed.model} fallbackTitle={fallbackTitle} />
  }
  return <DiagramSourcePre source={source} />
}

