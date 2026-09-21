/**
 * `useMarkdownEditor` (spec 7.5, 7.6) — the headless half of the package.
 *
 * Owns controlled/uncontrolled value, controlled/uncontrolled mode, document
 * identity and the bridge. Renders nothing. `<MarkdownEditor>` is a thin
 * component over this hook, so the default chrome has no private powers.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { registerRichText } from '@lexical/rich-text'
import { createEmptyHistoryState, registerHistory } from '@lexical/history'
import { mergeRegister } from '@lexical/utils'
import type { MarkdownDiagnostic } from '@internal/diagnostics/index.js'
import { createMarkdownBridge, editorOf, type MarkdownBridge } from '../bridge/session.js'
import { createCommands, redo, undo } from '../commands.js'
import type {
  MarkdownEditorCommands,
  MarkdownEditorInstance,
  MarkdownEditorLabels,
  MarkdownEditorMode,
  UseMarkdownEditorOptions,
} from '../types.js'
import { attachInternals } from './internals.js'
import type { EditorClassNames } from '../class-names.js'

/** Fields `<MarkdownEditor>` forwards that the headless hook also accepts. */
interface ChromeOptions {
  readonly classNames?: EditorClassNames
  readonly placeholder?: ReactNode
  readonly labels?: MarkdownEditorLabels
  readonly components?: Readonly<Record<string, unknown>>
}

export function useMarkdownEditor(options: UseMarkdownEditorOptions = {}): MarkdownEditorInstance {
  const chrome = options as ChromeOptions
  const controlled = options.value !== undefined
  const modeControlled = options.mode !== undefined

  useControlledWarning(controlled, 'value', 'defaultValue')
  useControlledWarning(modeControlled, 'mode', 'defaultMode')

  const [, rerender] = useReducer((count: number) => count + 1, 0)

  const ownValue = useRef(options.value ?? options.defaultValue ?? '')
  const value = controlled ? (options.value as string) : ownValue.current
  const valueRef = useRef(value)
  valueRef.current = value

  const ownMode = useRef<MarkdownEditorMode>(options.mode ?? options.defaultMode ?? 'rich')
  const mode = modeControlled ? (options.mode as MarkdownEditorMode) : ownMode.current

  const handlers = useRef(options)
  handlers.current = options

  /**
   * The bridge is rebuilt when the dialect changes — extensions resolve per
   * render rather than at mount, which is audit G9 — or when `documentKey`
   * changes. A new bridge is a new Lexical editor, and that is precisely what
   * "deliberate document replacement" means: fresh undo history, no carried
   * over selection (spec 7.10).
   */
  const dialect = useMemo(
    () =>
      [
        options.preset?.profile ?? 'commonmark',
        ...(options.preset?.extensions ?? []).map((one) => `${one.name}@${one.version ?? ''}`),
        ...(options.extensions ?? []).map((one) => `${one.name}@${one.version ?? ''}`),
      ].join('|'),
    [options.preset, options.extensions],
  )
  const identity = `${dialect}::${options.documentKey ?? ''}`

  const lastEmitted = useRef('')
  const diagnostics = useRef<readonly MarkdownDiagnostic[]>([])
  const sourceDirty = useRef(false)
  const loading = useRef(false)
  const cache = useRef<{ identity: string; bridge: MarkdownBridge; revision: number } | null>(null)

  if (cache.current === null || cache.current.identity !== identity) {
    const bridge = createMarkdownBridge({
      preset: options.preset,
      extensions: options.extensions,
      classNames: chrome.classNames,
    })
    diagnostics.current = bridge.load(valueRef.current)
    lastEmitted.current = bridge.getMarkdown()
    sourceDirty.current = false
    cache.current = { identity, bridge, revision: (cache.current?.revision ?? 0) + 1 }
  }
  const { bridge, revision } = cache.current

  /** Replaces the content without reporting it back as a user edit. */
  const loadQuietly = useCallback(
    (source: string) => {
      loading.current = true
      try {
        diagnostics.current = bridge.load(source)
      } finally {
        loading.current = false
      }
      lastEmitted.current = bridge.getMarkdown()
      sourceDirty.current = false
    },
    [bridge],
  )

  const uploads = useRef<AbortController | null>(null)
  if (uploads.current === null) uploads.current = new AbortController()

  const commands: MarkdownEditorCommands = useMemo(
    () =>
      createCommands({
        bridge,
        getUploadImage: () => handlers.current.onUploadImage,
        getDocumentKey: () => handlers.current.documentKey,
        getUploadSignal: () => (uploads.current as AbortController).signal,
      }),
    [bridge],
  )

  const emit = useCallback(
    (next: string) => {
      lastEmitted.current = next
      valueRef.current = next
      if (handlers.current.value === undefined) ownValue.current = next
      handlers.current.onChange?.(next)
      rerender()
    },
    [],
  )

  const setSource = useCallback(
    (next: string) => {
      sourceDirty.current = true
      emit(next)
    },
    [emit],
  )

  const setMode = useCallback((next: MarkdownEditorMode) => {
    if (handlers.current.mode === undefined) ownMode.current = next
    handlers.current.onModeChange?.(next)
    rerender()
  }, [])

  const live = useRef({ mode, commands, readOnly: options.readOnly === true, setMode })
  live.current = { mode, commands, readOnly: options.readOnly === true, setMode }

  // Rich-text behaviour and undo history, registered once per editor.
  useEffect(() => {
    // History captures the state *before* a change, and it has no "before" for
    // the very first one unless it is told where the document started. Without
    // this seed the opening edit of a session is silently not undoable.
    const historyState = createEmptyHistoryState()
    historyState.current = { editor: editorOf(bridge), editorState: editorOf(bridge).getEditorState() }
    return mergeRegister(
      registerRichText(editorOf(bridge)),
      registerHistory(editorOf(bridge), historyState, 300),
    )
  }, [bridge])

  // Extension plugins. A new `extensions` array with the same dialect (say,
  // `templateVariables()` handed fresh preview data) re-registers the plugins
  // in place; only a changed dialect rebuilds the editor.
  useEffect(() => {
    bridge.refreshExtensions({ preset: options.preset, extensions: options.extensions })
    return bridge.registerPlugins()
  }, [bridge, options.preset, options.extensions])

  useEffect(() => {
    editorOf(bridge).setEditable(options.readOnly !== true)
  }, [bridge, options.readOnly])

  // Markdown out. A selection-only update is not a change.
  useEffect(
    () =>
      editorOf(bridge).registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        if (loading.current) return
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
        const next = bridge.getMarkdown()
        if (next === lastEmitted.current) return
        emit(next)
      }),
    [bridge, emit],
  )

  /**
   * Markdown in. An echoed value is the string this editor just emitted, so it
   * is ignored and neither selection nor undo history is disturbed (spec 7.10).
   * Anything else is a genuine external change and replaces the content.
   */
  useEffect(() => {
    if (!controlled) return
    const next = options.value as string
    if (next === lastEmitted.current) return
    loadQuietly(next)
    rerender()
  }, [controlled, loadQuietly, options.value])

  // Text typed in source mode reaches the rich surface when the user returns.
  useEffect(() => {
    if (mode !== 'rich' || !sourceDirty.current) return
    loadQuietly(valueRef.current)
  }, [loadQuietly, mode])

  useEffect(() => {
    handlers.current.onDiagnostics?.(diagnostics.current)
  }, [revision, value])

  useEffect(() => {
    const controller = uploads.current
    return () => {
      controller?.abort()
    }
  }, [])

  const instance = useMemo<MarkdownEditorInstance>(
    () => ({
      getMarkdown: () => (sourceDirty.current ? valueRef.current : bridge.getMarkdown()),
      getDocument: () => bridge.getDocument(),
      focus: () => {
        editorOf(bridge).focus()
      },
      blur: () => {
        editorOf(bridge).blur()
      },
      undo: () => {
        undo(editorOf(bridge))
      },
      redo: () => {
        redo(editorOf(bridge))
      },
      setMode: (next: MarkdownEditorMode) => {
        live.current.setMode(next)
      },
      get mode() {
        return live.current.mode
      },
      get commands() {
        return live.current.commands
      },
      get diagnostics() {
        return diagnostics.current
      },
      get readOnly() {
        return live.current.readOnly
      },
      getNativeEditor: () => editorOf(bridge),
    }),
    [bridge],
  )

  attachInternals(instance, {
    bridge,
    mode,
    setMode,
    value,
    setSource,
    preset: options.preset,
    extensions: options.extensions,
    components: chrome.components,
    classNames: chrome.classNames,
    readOnly: options.readOnly === true,
    placeholder: chrome.placeholder,
    labels: chrome.labels,
    documentKey: options.documentKey,
    revision,
  })

  return instance
}

function useControlledWarning(controlled: boolean, prop: string, fallback: string): void {
  const first = useRef(controlled)
  useEffect(() => {
    if (first.current === controlled) return
    first.current = controlled
    if (process.env['NODE_ENV'] === 'production') return
    // eslint-disable-next-line no-console
    console.error(
      '[@react-markdown-kit/editor] A component changed between controlled and uncontrolled. ' +
        `Decide on either \`${prop}\` or \`${fallback}\` for the lifetime of the component.`,
    )
  }, [controlled, prop, fallback])
}
