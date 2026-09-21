/**
 * Opt-in class hooks for editor chrome (docs/STYLING.md rules 3 and 7).
 *
 * Unlike the renderer, the editor *does* emit `rmk-` defaults: the toolbar, the
 * content box and the opaque-node block have no semantic element of their own
 * to hang a selector on. Every one of them is replaceable through `classNames`,
 * and a consumer class replaces the default rather than merging with it.
 */
import { partClass, cx, type EditorPart } from '@internal/styling/index.js'

/** Editor parts on top of the shared contract's list. */
export type EditorClassNamePart =
  | EditorPart
  | 'modeGroup'
  | 'opaque'
  | 'opaqueSource'
  | 'image'
  | 'inlineOpaque'
  | 'codeBlock'
  | 'table'
  | 'strong'
  | 'emphasis'
  | 'strikethrough'

export type EditorClassNames = Partial<Record<EditorClassNamePart, string>>

/**
 * The editor's scope class is `rmk-editor`, not `rmk-root`: docs/STYLING.md
 * names `.rmk-editor` as the one selector the optional stylesheet hangs off,
 * and `scripts/check-css-scope.mjs` enforces it.
 */
const ROOT_CLASS = 'rmk-editor'

export function editorClass(
  part: EditorClassNamePart,
  classNames: EditorClassNames | undefined,
  extra?: string,
): string | undefined {
  if (part === 'root' && classNames?.root === undefined) {
    return extra === undefined || extra === '' ? ROOT_CLASS : `${ROOT_CLASS} ${extra}`
  }
  return partClass<EditorClassNamePart>(part, classNames, extra)
}

export { cx }
