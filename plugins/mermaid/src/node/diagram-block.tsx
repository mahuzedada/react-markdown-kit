/**
 * The block a `DiagramNode` decorates (docs/MERMAID_PLATFORM.md section
 * 9.2): a header row naming the kind and its support level, and one editing
 * component under it, the canvas for a flowchart or the source editor for
 * everything else.
 *
 * The block owns the mode. Canvas mode needs a legacy fence or the built-in
 * `flowchart` kind with the text toggle off; every other block is edited as
 * text. The kind is re-detected on every edit and the header follows at
 * once, but the editing component is held while the block's textarea has
 * focus: a mode change implied by a new kind takes effect on blur or on the
 * toggle, so typing a header never pulls the textarea out from under the
 * caret. In a read-only editor the header shows label and badge only, and
 * the block renders the kind's static output or the source.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { NodeKey } from 'lexical'
import { useLexicalEditor } from '@react-markdown-kit/editor/lexical'
import type { DrawingData } from '../core/drawing-data.js'
import type { DiagramKind } from '../core/kind.js'
import { parseDiagramSource, type DiagramFormat, type DiagramSourceParse, type DiagramSupport } from '../extension.js'
import { DiagramCanvas } from '../canvas/drawing-canvas.js'
import { Icon, UI_ICONS } from '../canvas/icons.js'
import { useDiagramLabels } from '../canvas/labels.js'
import { canvasKindOf, takeDiagramFocus, useDiagramOptions } from '../canvas/options.js'
import { DiagramPreview, DiagramSourceEditor, DiagramSourcePre } from './source-editor.js'

type Mode = 'canvas' | 'source'

export interface DiagramBlockProps {
  readonly nodeKey: NodeKey
  readonly source: string
  readonly kind: string
  readonly format: DiagramFormat
}

/** The selector of whatever takes focus after an insert: the canvas root or the textarea. */
const FOCUS_TARGET = '.rmk-diagram-canvas, .rmk-diagram-source-input'

export function DiagramBlock({ nodeKey, source, kind, format }: DiagramBlockProps): ReactElement {
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

  // The canvas draws the built-in flowchart only: a legacy fence is one by
  // construction, a ```mermaid fence when detection named it so.
  const canvasKind = canvasKindOf(kinds)
  const canvasEligible = canvasKind !== undefined && (format !== 'mermaid' || kind === canvasKind.name)
  const [sourceMode, setSourceMode] = useState(false)
  const wanted: Mode = canvasEligible && !sourceMode && parsed !== undefined && parseError === undefined ? 'canvas' : 'source'
  // The mode held while the textarea has focus; null once it blurs.
  const [held, setHeld] = useState<Mode | null>(null)
  const mode: Mode = readOnly ? 'source' : (held ?? wanted)

  // An insert asks the block it created to take focus once it mounts.
  useEffect(() => {
    if (!takeDiagramFocus(editor, nodeKey)) return
    const target = rootRef.current?.querySelector<HTMLElement>(FOCUS_TARGET)
    if (!target) return
    target.focus()
    if (target instanceof HTMLTextAreaElement) target.setSelectionRange(target.value.length, target.value.length)
  }, [editor, nodeKey])

  const kindLabel = registered?.label ?? (kind === 'unknown' ? labels.unknownKind : kind)

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
        {!readOnly && canvasEligible && (
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
      ) : mode === 'canvas' && parsed !== undefined && !('error' in parsed) ? (
        <DiagramCanvas
          nodeKey={nodeKey}
          data={parsed.model as DrawingData}
          retained={parsed.retained}
          lossy={parsed.lossy}
          onEditAsText={() => setSourceMode(true)}
        />
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
