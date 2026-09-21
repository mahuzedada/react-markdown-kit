/**
 * Turns playground state into two things that must never disagree: the props
 * handed to the live `<Markdown>`, and the code shown in the Code tab. One
 * function produces both, so what the reader copies is what they saw.
 */
import type { ComponentType } from 'react'
import {
  defaultUrlTransform,
  defineMarkdownPreset,
  gfm,
  type MarkdownBaseProps,
  type MarkdownExtension,
  type MarkdownPreset,
  type RendererClassNames,
} from '@react-markdown-kit/renderer'
import { mermaid } from '@react-markdown-kit/mermaid'
import { AppLink, CaptionedImage, LabelledCode, OVERRIDE_SOURCE, anchorHeading } from './overrides'
import { SHOWCASE_SOURCE, showcase } from './showcase'
import { DEFAULT_THEME, type PlaygroundState, type Theme } from './state'

const TEXT_ONLY = ['p', 'strong', 'em', 'a', 'code', 'br'] as const

/** Tailwind-flavoured names. The playground defines these few itself. */
export const UTILITY_CLASS_NAMES: RendererClassNames = {
  heading: 'font-bold tracking-tight mt-8 mb-3',
  paragraph: 'leading-7 mb-4',
  link: 'underline decoration-2 underline-offset-4',
  code: 'rounded bg-stone-100 px-1 font-mono text-sm',
  pre: 'rounded-lg bg-stone-900 text-stone-100 p-4 overflow-x-auto',
  blockquote: 'border-l-4 pl-4 italic',
  list: 'pl-6 mb-4',
  table: 'w-full border-collapse text-sm',
  th: 'border-b-2 px-2 py-1 text-left',
  td: 'border-b px-2 py-1',
  image: 'rounded shadow',
  hr: 'my-8',
}

const FONT_STACKS: Record<Theme['font'], string> = {
  sans: '',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}

const presets = new Map<string, MarkdownPreset>()

function presetFor(state: PlaygroundState): MarkdownPreset | undefined {
  if (!state.gfm && !state.diagrams) return undefined
  const key = `gfm:${state.gfm ? state.singleTilde : 'off'}|diagrams:${state.diagrams}`
  let preset = presets.get(key)
  if (preset === undefined) {
    const extensions: MarkdownExtension[] = []
    if (state.gfm) extensions.push(gfm({ singleTilde: state.singleTilde }))
    if (state.diagrams) extensions.push(mermaid())
    preset = defineMarkdownPreset({ extensions })
    presets.set(key, preset)
  }
  return preset
}

function allowExtraSchemes(url: string): string {
  return /^(tel|sms):/i.test(url) ? url : defaultUrlTransform(url)
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const
const headingComponents = Object.fromEntries(
  HEADING_LEVELS.map((level) => [`h${level}`, anchorHeading(level)]),
) as Record<string, ComponentType<never>>

export interface Built {
  readonly props: MarkdownBaseProps
  /** Inline custom properties for the wrapper, in kit and showcase modes. */
  readonly wrapperStyle: Record<string, string>
  readonly code: string
}

export function buildProps(state: PlaygroundState): Built {
  const preset = presetFor(state)
  // Showcase brings a component for every element, so the single overrides step aside.
  const components: Record<string, ComponentType<never>> =
    state.styling === 'showcase'
      ? (showcase as unknown as Record<string, ComponentType<never>>)
      : {
          ...(state.overrides.links ? { a: AppLink as ComponentType<never> } : {}),
          ...(state.overrides.images ? { img: CaptionedImage as ComponentType<never> } : {}),
          ...(state.overrides.code ? { code: LabelledCode as ComponentType<never> } : {}),
          ...(state.overrides.headings ? headingComponents : {}),
        }

  const props: MarkdownBaseProps = {
    ...(preset === undefined ? {} : { preset }),
    ...(Object.keys(components).length === 0 ? {} : { components: components as NonNullable<MarkdownBaseProps['components']> }),
    ...(state.skipHtml ? { skipHtml: true } : {}),
    ...(state.policy === 'textOnly' ? { allowedElements: TEXT_ONLY } : {}),
    ...(state.policy === 'noImages' ? { disallowedElements: ['img'] } : {}),
    ...(state.policy !== 'default' && state.unwrapDisallowed ? { unwrapDisallowed: true } : {}),
    ...(state.extraSchemes ? { urlTransform: allowExtraSchemes } : {}),
    ...(state.styling === 'utility' ? { classNames: UTILITY_CLASS_NAMES } : {}),
  }

  return { props, wrapperStyle: themeStyle(state.theme), code: generateCode(state, components) }
}

function themeStyle(theme: Theme): Record<string, string> {
  const style: Record<string, string> = {}
  if (theme.link !== DEFAULT_THEME.link) style['--rmk-link'] = theme.link
  if (theme.measure !== DEFAULT_THEME.measure) style['--rmk-measure'] = `${theme.measure}ch`
  if (theme.radius !== DEFAULT_THEME.radius) style['--rmk-radius'] = `${theme.radius}px`
  if (theme.font !== 'sans') style['--rmk-font-body'] = FONT_STACKS[theme.font]
  return style
}

function generateCode(state: PlaygroundState, components: Record<string, unknown>): string {
  const usesPreset = state.gfm || state.diagrams
  const named: string[] = []
  if (usesPreset) named.push('defineMarkdownPreset')
  if (state.gfm) named.push('gfm')
  if (state.extraSchemes) named.push('defaultUrlTransform')
  const importLine =
    named.length === 0
      ? `import Markdown from '@react-markdown-kit/renderer'`
      : `import Markdown, { ${named.join(', ')} } from '@react-markdown-kit/renderer'`

  const head: string[] = [importLine]
  if (state.diagrams) head.push(`import { mermaid } from '@react-markdown-kit/mermaid'`)
  if (state.styling === 'kit') head.push(`import '@react-markdown-kit/renderer/styles.css'`)
  if (state.styling === 'showcase') head.push(`import { showcase } from './showcase'   // shown below`, `import './showcase.css'`)
  if (usesPreset) {
    const extensions: string[] = []
    if (state.gfm) extensions.push(`gfm(${state.singleTilde ? '' : '{ singleTilde: false }'})`)
    if (state.diagrams) extensions.push('mermaid()')
    head.push('', `const preset = defineMarkdownPreset({ extensions: [${extensions.join(', ')}] })`)
  }

  const attrs: string[] = []
  if (usesPreset) attrs.push('preset={preset}')
  const names = Object.keys(components)
  if (state.styling === 'showcase') {
    attrs.push('components={showcase}')
  } else if (names.length > 0) {
    const entries = names.map((name) => `${name}: ${componentName(name)}`)
    attrs.push(`components={{ ${entries.join(', ')} }}`)
  }
  if (state.skipHtml) attrs.push('skipHtml')
  if (state.policy === 'textOnly') attrs.push(`allowedElements={[${TEXT_ONLY.map((tag) => `'${tag}'`).join(', ')}]}`)
  if (state.policy === 'noImages') attrs.push(`disallowedElements={['img']}`)
  if (state.policy !== 'default' && state.unwrapDisallowed) attrs.push('unwrapDisallowed')
  if (state.extraSchemes) {
    attrs.push(`urlTransform={(url) => /^(tel|sms):/i.test(url) ? url : defaultUrlTransform(url)}`)
  }
  if (state.styling === 'utility') {
    const entries = Object.entries(UTILITY_CLASS_NAMES).map(([part, value]) => `    ${part}: '${value}',`)
    attrs.push(`classNames={{\n${entries.join('\n')}\n  }}`)
  }

  const element =
    attrs.length === 0
      ? `<Markdown>{content}</Markdown>`
      : `<Markdown\n  ${attrs.join('\n  ')}\n>\n  {content}\n</Markdown>`

  const style = themeStyle(state.theme)
  const styleAttr =
    Object.keys(style).length === 0
      ? ''
      : ` style={{ ${Object.entries(style).map(([key, value]) => `'${key}': '${value}'`).join(', ')} }}`
  const body =
    state.styling === 'kit'
      ? `<div className="rmk-document"${styleAttr}>\n${indent(element)}\n</div>`
      : state.styling === 'showcase'
        ? `<div className="showcase"${styleAttr}>\n${indent(element)}\n</div>`
        : element

  const overrideBlocks =
    state.styling === 'showcase'
      ? [SHOWCASE_SOURCE]
      : (Object.keys(OVERRIDE_SOURCE) as (keyof typeof OVERRIDE_SOURCE)[])
          .filter((key) => state.overrides[key])
          .map((key) => OVERRIDE_SOURCE[key])

  return [head.join('\n'), '', body, ...(overrideBlocks.length === 0 ? [] : ['', ...overrideBlocks.join('\n\n').split('\n')])].join('\n')
}

function componentName(tag: string): string {
  if (tag === 'a') return 'AppLink'
  if (tag === 'img') return 'CaptionedImage'
  if (tag === 'code') return 'LabelledCode'
  return 'AnchorHeading'
}

function indent(text: string): string {
  return text.split('\n').map((line) => `  ${line}`).join('\n')
}
