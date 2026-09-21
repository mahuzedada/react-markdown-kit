/**
 * API type tests (spec 12.5).
 *
 * These assert compile-time contracts. They are checked by `pnpm typecheck`;
 * @ts-expect-error lines FAIL the build if the error stops happening, which is
 * what makes them real assertions rather than comments.
 */
import Markdown, { compileMarkdown, defineMarkdownPreset, gfm } from '@react-markdown-kit/renderer'
import type { MarkdownDocument, MarkdownPreset } from '@react-markdown-kit/renderer'

const doc: MarkdownDocument = compileMarkdown('# hi')

// --- children and document are mutually exclusive (spec 4.3) ---

export const stringInput = <Markdown>{'# hi'}</Markdown>
export const documentInput = <Markdown document={doc} />

// @ts-expect-error passing both is ambiguous and must not type-check
export const bothInputs = <Markdown document={doc}>{'# hi'}</Markdown>

// @ts-expect-error neither input is not a valid call
export const neitherInput = <Markdown />

// @ts-expect-error children must be a string, not arbitrary React children
export const elementChildren = <Markdown><span>no</span></Markdown>

// --- the renderer accepts no template props (spec 17.1) ---

// @ts-expect-error rendering and data resolution stay separate concerns
export const noTemplateProp = <Markdown template={doc}>{'x'}</Markdown>

// @ts-expect-error className is not a renderer prop; wrap it instead
export const noClassName = <Markdown className="prose">{'x'}</Markdown>

// --- styling props are typed (docs/STYLING.md) ---

export const withClassNames = (
  <Markdown classNames={{ heading: 'text-xl', code: 'font-mono' }}>{'# x'}</Markdown>
)

// @ts-expect-error an unknown part is a typo, not an extension point
export const badPart = <Markdown classNames={{ notAPart: 'x' }}>{'# x'}</Markdown>

// --- presets are structural and cross package boundaries (spec 5.2) ---

const preset: MarkdownPreset = defineMarkdownPreset({ extensions: [gfm()] })
export const withPreset = <Markdown preset={preset}>{'x'}</Markdown>

/**
 * The template package emits its own `defineMarkdownPreset` from the same
 * internal contract. A preset from either must satisfy the other's type
 * without either package importing the other. This function stands in for the
 * template package's parameter type.
 */
function acceptsAnyPreset(value: MarkdownPreset): string {
  return value.profile
}
export const crossPackage = acceptsAnyPreset(preset)

// @ts-expect-error a hand-rolled object is not a preset; use defineMarkdownPreset
export const fakePreset = acceptsAnyPreset({ profile: 'gfm', extensions: [] })

// --- compiled documents ---

export const compiled: MarkdownDocument = compileMarkdown('# x', { preset })

// @ts-expect-error the document contract version is fixed, not caller-supplied
export const forgedDocument: MarkdownDocument = { ...doc, contractVersion: 2 }

// @ts-expect-error compileMarkdown takes a string
export const compileNonString = compileMarkdown(42)
