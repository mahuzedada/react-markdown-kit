/**
 * Styling contract (docs/STYLING.md).
 *
 * The kit ships no styling dependency. These helpers give every rendered part
 * a stable class hook that a consumer can target with plain CSS, replace with
 * their own utility classes, or ignore entirely.
 */

export const CLASS_PREFIX = 'rmk' as const

/** Parts of rendered Markdown a consumer may want to name. */
export type RendererPart =
  | 'root'
  | 'paragraph'
  | 'heading'
  | 'link'
  | 'image'
  | 'list'
  | 'listItem'
  | 'taskListItem'
  | 'blockquote'
  | 'code'
  | 'codeBlock'
  | 'pre'
  | 'table'
  | 'thead'
  | 'tbody'
  | 'tr'
  | 'th'
  | 'td'
  | 'hr'
  | 'footnotes'
  | 'footnoteRef'
  | 'variable'
  | 'diagram'
  | 'deck'
  | 'slide'
  | 'slideNotes'

/** Parts of the editor chrome a consumer may want to name. */
export type EditorPart =
  | 'root'
  | 'toolbar'
  | 'toolbarGroup'
  | 'toolbarButton'
  | 'toolbarButtonActive'
  | 'toolbarDivider'
  | 'content'
  | 'placeholder'
  | 'sourceTextarea'
  | 'preview'
  | 'statusBar'
  | 'variableChip'

export type ClassNameMap<TPart extends string> = Partial<Record<TPart, string>>

/**
 * Resolves the class for one part.
 *
 * A consumer-supplied class **replaces** the default rather than merging with
 * it, so utility-class users never fight the shipped CSS and never need
 * `!important`. Passing an empty string removes the class entirely.
 */
export function partClass<TPart extends string>(
  part: TPart,
  overrides: ClassNameMap<TPart> | undefined,
  extra?: string | undefined,
): string | undefined {
  const override = overrides?.[part]
  const base = override === undefined ? `${CLASS_PREFIX}-${kebab(part)}` : override
  const merged = [base, extra].filter((value) => value !== undefined && value !== '').join(' ')
  return merged === '' ? undefined : merged
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
}

/** Joins defined class names. Exported so packages need no `clsx` dependency. */
export function cx(...values: readonly (string | false | null | undefined)[]): string | undefined {
  const joined = values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ')
  return joined === '' ? undefined : joined
}
