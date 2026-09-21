/**
 * Diagnostic codes and their messages, in one place so the codes stay stable
 * and the wording stays consistent. Messages never contain author content:
 * a bad directive argument is described, not echoed.
 */
import { diagnostic, type MarkdownDiagnostic, type SourceRange, type DiagnosticSeverity } from '@internal/diagnostics/index.js'

export const SLIDES_DIAGNOSTIC_CODES = {
  /** A depth-2 setext heading: the dashes under a line of text made a heading, not a break. */
  setextHeading: 'SLIDES_SETEXT_HEADING',
  /** A slide with no content blocks. Kept and rendered. */
  slideEmpty: 'SLIDES_SLIDE_EMPTY',
  /** `---` and `key: value` lines at the top with no closing `---` line: read as content. */
  frontMatterInvalid: 'SLIDES_FRONT_MATTER_INVALID',
  /** A known directive key with an argument it does not accept. */
  directiveInvalid: 'SLIDES_DIRECTIVE_INVALID',
  /** A `<!-- key: value -->` comment whose key is not a directive. */
  directiveUnknown: 'SLIDES_DIRECTIVE_UNKNOWN',
  /** Two slides with the same `name`. */
  nameDuplicate: 'SLIDES_NAME_DUPLICATE',
  /** A second `???` in a slide, or a `--` after `???`. */
  markerMisplaced: 'SLIDES_MARKER_MISPLACED',
  /** A `--` or `???` glued to the paragraph above it. */
  markerAttached: 'SLIDES_MARKER_ATTACHED',
  /** A slide opening with bare `key: value` lines, remark style. */
  propertyBare: 'SLIDES_PROPERTY_BARE',
} as const

export type SlidesDiagnosticCode = (typeof SLIDES_DIAGNOSTIC_CODES)[keyof typeof SLIDES_DIAGNOSTIC_CODES]

const SEVERITY: Readonly<Record<SlidesDiagnosticCode, DiagnosticSeverity>> = {
  SLIDES_SETEXT_HEADING: 'info',
  SLIDES_SLIDE_EMPTY: 'info',
  SLIDES_FRONT_MATTER_INVALID: 'warning',
  SLIDES_DIRECTIVE_INVALID: 'warning',
  SLIDES_DIRECTIVE_UNKNOWN: 'warning',
  SLIDES_NAME_DUPLICATE: 'warning',
  SLIDES_MARKER_MISPLACED: 'warning',
  SLIDES_MARKER_ATTACHED: 'warning',
  SLIDES_PROPERTY_BARE: 'info',
}

const MESSAGE: Readonly<Record<SlidesDiagnosticCode, string>> = {
  SLIDES_SETEXT_HEADING:
    'A line of dashes directly under text makes a heading, not a slide break or a pause. Put a blank line before the dashes.',
  SLIDES_SLIDE_EMPTY: 'This slide has no content.',
  SLIDES_FRONT_MATTER_INVALID:
    'The deck opens like front matter but no --- line closes the `key: value` lines, so they are shown as content. Close the front matter with ---, or start the deck with content.',
  SLIDES_DIRECTIVE_INVALID: 'The directive argument is not accepted, so the comment is shown as text.',
  SLIDES_DIRECTIVE_UNKNOWN: 'The comment looks like a directive but its key is not one, so it is shown as text.',
  SLIDES_NAME_DUPLICATE: 'Another slide already has this name, so this one gets no id.',
  SLIDES_MARKER_MISPLACED: 'A second ??? in a slide, or a -- after ???, is ignored.',
  SLIDES_MARKER_ATTACHED: 'A -- or ??? on the line right after text is part of the paragraph. Put a blank line before it.',
  SLIDES_PROPERTY_BARE:
    'A slide opening with bare `key: value` lines is prose here. Write each as a `<!-- key: value -->` comment.',
}

export function slidesDiagnostic(
  code: SlidesDiagnosticCode,
  range: SourceRange | undefined,
  detail?: string,
): MarkdownDiagnostic {
  const message = detail === undefined ? MESSAGE[code] : `${MESSAGE[code]} ${detail}`
  return diagnostic(code, SEVERITY[code], message, range === undefined ? {} : { range })
}
