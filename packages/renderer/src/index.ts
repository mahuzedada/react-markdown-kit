/**
 * @react-markdown-kit/renderer
 *
 * Render Markdown as React. No provider, no stylesheet, no design system and
 * no account required. This entry carries no "use client" directive so it
 * stays usable from server components and static server rendering.
 */
export { Markdown, default } from './markdown.js'
export type { MarkdownProps, MarkdownBaseProps } from './markdown.js'

export { compileMarkdown, documentToMarkdown } from './compile.js'
export type { MarkdownCompileOptions } from './compile.js'

export { defineMarkdownPreset, isMarkdownPreset, mergeExtensions } from './preset.js'
export type {
  DefineMarkdownPresetOptions,
  MarkdownComponents,
  MarkdownExtension,
  MarkdownPolicy,
  MarkdownPreset,
  RendererAdapter,
  SyntaxAdapter,
  SyntaxTransformContext,
  TemplateAdapter,
  EditorAdapter,
} from './preset.js'

export { gfm } from './extensions/gfm.js'
export type { GfmOptions } from './extensions/gfm.js'

export { defaultUrlTransform } from './policy.js'
export type { RendererClassNames, RendererPart } from './class-names.js'

export {
  isMarkdownDocument,
  createMarkdownDocument,
  DOCUMENT_CONTRACT_VERSION,
} from '@internal/document-contracts/index.js'
export type {
  MarkdownDocument,
  MarkdownNode,
  MarkdownRoot,
  MarkdownInput,
} from '@internal/document-contracts/index.js'

export { MarkdownConfigurationError } from '@internal/diagnostics/index.js'
export type {
  MarkdownDiagnostic,
  DiagnosticSeverity,
  SourcePoint,
  SourceRange,
} from '@internal/diagnostics/index.js'
