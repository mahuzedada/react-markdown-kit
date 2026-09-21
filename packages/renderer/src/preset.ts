/**
 * `defineMarkdownPreset` — one answer to "what does Markdown mean in this
 * application?", reused by the renderer, the editor and the template engine.
 *
 * The implementation lives in the shared internal contract so the template
 * package can emit the identical function without depending on this package
 * (spec 5.2). Presets built by either are structurally interchangeable.
 */
import {
  definePreset,
  isMarkdownPreset,
  mergeExtensions,
  EXTENSION_CONTRACT_VERSION,
  type DefineMarkdownPresetOptions,
  type EditorAdapter,
  type MarkdownExtension,
  type MarkdownPolicy,
  type MarkdownPreset,
  type RendererAdapter,
  type SyntaxAdapter,
  type SyntaxTransformContext,
  type TemplateAdapter,
} from '@internal/extension-contracts/index.js'
import type { ComponentType, JSX } from 'react'

/**
 * React component overrides, keyed by HTML element name or custom node type.
 * `JSX` is imported from React rather than assumed global, because React 19
 * removed the global namespace.
 */
export type MarkdownComponents = Readonly<
  Record<string, ComponentType<never> | keyof JSX.IntrinsicElements>
>

export function defineMarkdownPreset(options: DefineMarkdownPresetOptions = {}): MarkdownPreset {
  return definePreset(options)
}

export {
  isMarkdownPreset,
  mergeExtensions,
  EXTENSION_CONTRACT_VERSION,
  type DefineMarkdownPresetOptions,
  type EditorAdapter,
  type MarkdownExtension,
  type MarkdownPolicy,
  type MarkdownPreset,
  type RendererAdapter,
  type SyntaxAdapter,
  type SyntaxTransformContext,
  type TemplateAdapter,
}
