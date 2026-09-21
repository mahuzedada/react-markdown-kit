/**
 * `MarkdownEditorContent` (spec 7.3, 7.4) — the surface for the active mode.
 *
 * All three modes project the same document (the fix for audit G8: the prior
 * editor unmounted the document to show raw source, so anything it could not
 * represent died on the way back). Preview delegates to
 * `@react-markdown-kit/renderer`; there is no second renderer in this package.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Markdown } from '@react-markdown-kit/renderer'
import { editorClass } from '../class-names.js'
import { editorOf } from '../bridge/session.js'
import { useOptionalMarkdownEditorContext } from './context.js'
import { internalsOf, type EditorInternals } from './internals.js'
import { LexicalEditorContext, type LexicalEditorContextValue } from './native-context.js'
import type { MarkdownEditorInstance } from '../types.js'

/** The subset of ARIA a caller can put on the editing surface itself. */
export interface EditorAriaProps {
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
  readonly 'aria-describedby'?: string
}

export interface MarkdownEditorContentProps extends EditorAriaProps {
  readonly editor?: MarkdownEditorInstance
}

interface SurfaceProps extends EditorAriaProps {
  readonly internals: EditorInternals
}

export function MarkdownEditorContent(props: MarkdownEditorContentProps): ReactElement {
  // `editor` wins when given, so the surface can be rendered outside a
  // provider; otherwise the provider supplies it.
  const contextEditor = useOptionalMarkdownEditorContext()
  const editor = props.editor ?? contextEditor
  if (editor === null) {
    throw new Error(
      '<MarkdownEditorContent> needs an editor: render it inside <MarkdownEditorProvider>, or pass editor={useMarkdownEditor(...)}.',
    )
  }
  const internals = internalsOf(editor)
  const aria = {
    ...(props['aria-label'] === undefined ? {} : { 'aria-label': props['aria-label'] }),
    ...(props['aria-labelledby'] === undefined ? {} : { 'aria-labelledby': props['aria-labelledby'] }),
    ...(props['aria-describedby'] === undefined
      ? {}
      : { 'aria-describedby': props['aria-describedby'] }),
  }

  if (internals.mode === 'preview') return <PreviewSurface internals={internals} {...aria} />
  if (internals.mode === 'source') return <SourceSurface internals={internals} {...aria} />
  return <RichSurface internals={internals} {...aria} />
}

/* ---------------------------------------------------------------- rich mode */

/**
 * The only inline style in the package. `white-space: pre-wrap` is required for
 * the caret to sit in trailing spaces and for a soft line ending to render as
 * one; it is function, never appearance, so the styling contract allows it
 * (docs/STYLING.md rule 2).
 */
const FUNCTIONAL_STYLE: CSSProperties = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }

function RichSurface({ internals, ...aria }: SurfaceProps): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null)
  const { bridge, readOnly, classNames } = internals

  useLayoutEffect(() => {
    const element = ref.current
    editorOf(bridge).setRootElement(element ?? null)
    return () => {
      editorOf(bridge).setRootElement(null)
    }
  }, [bridge, internals.mode])

  const empty = internals.value.trim() === ''

  return (
    <div className={editorClass('content', classNames)} data-rmk-surface="rich">
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-readonly={readOnly ? 'true' : undefined}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        spellCheck
        style={FUNCTIONAL_STYLE}
        {...aria}
      />
      {empty && internals.placeholder !== undefined ? (
        <Placeholder internals={internals}>{internals.placeholder}</Placeholder>
      ) : null}
      <Decorators internals={internals} />
    </div>
  )
}

function Placeholder({
  internals,
  children,
}: {
  internals: EditorInternals
  children: ReactNode
}): ReactElement {
  return (
    <div className={editorClass('placeholder', internals.classNames)} aria-hidden="true">
      {children}
    </div>
  )
}

/**
 * Renders decorator nodes (images, thematic rules, opaque blocks) into the DOM
 * Lexical created for them. `@lexical/react` does the same thing; doing it here
 * keeps `@lexical/react` out of the dependency list.
 */
function Decorators({ internals }: { internals: EditorInternals }): ReactElement {
  const editor = editorOf(internals.bridge)
  const [decorators, setDecorators] = useState<Record<string, ReactNode>>(() =>
    editor.getDecorators<ReactNode>(),
  )

  useEffect(() => editor.registerDecoratorListener<ReactNode>(setDecorators), [editor])

  // Decorators are created when the root element is attached, which is a
  // layout effect on the parent and therefore already done by the time this
  // passive effect runs. Reading once here catches the initial document.
  useEffect(() => {
    setDecorators(editor.getDecorators<ReactNode>())
  }, [editor])

  // Portals keep React context, so this is how an extension's node UI reaches
  // the engine that owns it (`useLexicalEditor` on the `/lexical` entry).
  const context = useMemo<LexicalEditorContextValue>(
    () => ({ editor, readOnly: internals.readOnly, labels: internals.labels }),
    [editor, internals.readOnly, internals.labels],
  )

  return (
    <LexicalEditorContext.Provider value={context}>
      {Object.entries(decorators).map(([key, decorator]) => {
        const element = editor.getElementByKey(key)
        return element === null ? null : createPortal(decorator, element, key)
      })}
    </LexicalEditorContext.Provider>
  )
}

/* -------------------------------------------------------------- source mode */

function SourceSurface({ internals, ...aria }: SurfaceProps): ReactElement {
  return (
    <div className={editorClass('content', internals.classNames)} data-rmk-surface="source">
      <textarea
        className={editorClass('sourceTextarea', internals.classNames)}
        value={internals.value}
        readOnly={internals.readOnly}
        spellCheck={false}
        onChange={(event) => {
          internals.setSource(event.target.value)
        }}
        {...aria}
      />
    </div>
  )
}

/* ------------------------------------------------------------- preview mode */

function PreviewSurface({ internals, ...aria }: SurfaceProps): ReactElement {
  return (
    <div
      className={editorClass('preview', internals.classNames)}
      data-rmk-surface="preview"
      {...aria}
    >
      <Markdown
        {...(internals.preset === undefined ? {} : { preset: internals.preset })}
        {...(internals.extensions === undefined ? {} : { extensions: internals.extensions })}
        {...(internals.components === undefined
          ? {}
          : { components: internals.components as never })}
      >
        {internals.value}
      </Markdown>
    </div>
  )
}
