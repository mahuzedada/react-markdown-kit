/**
 * The `components.figure` the client entry registers (spec 6.1). The
 * renderer passes every <figure> in the output through it with its hast
 * `node` and its attributes as props. A figure the plugin rendered as static
 * SVG, or any figure that is not a diagram at all, renders as itself. A
 * diagram figure shown as source (`data-rmk-diagram-support="source"`, or a
 * parse error's `data-rmk-diagram-error`) is the host's chance: after mount
 * its fence body goes to the host's `render`, and the SVG that comes back
 * replaces the <pre>.
 *
 * The first client render is the static markup, attribute for attribute, so
 * server output and hydration agree. The replacement lives in an effect. The
 * host chose the renderer and owns its markup: it is inserted as given and
 * the kit's policy does not run on it. A rejected or empty result keeps the
 * source, so a failing host degrades to what the server sent. The body is
 * read from the hast node, not from the React children, so a host override
 * of <pre> or <code> cannot hide it.
 */
import { createElement, useEffect, useState, type ComponentType, type HTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { Element, ElementContent } from 'hast'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'

export interface DiagramFallbackOptions {
  /** SVG markup for a fence the plugin shows as source. The host decides how: Mermaid.js, Kroki, a server. */
  readonly render: (source: string, kind: string) => Promise<string>
}

export interface DiagramFigureProps {
  /** The hast node, passed by the renderer and not forwarded to the DOM */
  readonly node?: unknown
  readonly children?: ReactNode
  readonly [attribute: string]: unknown
}

/** The kind reported when the figure carries none, as a parse error on a legacy JSON fence does. */
const UNKNOWN_KIND = 'unknown'

function attributesOf(props: DiagramFigureProps): HTMLAttributes<HTMLElement> {
  const attributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) if (key !== 'node' && key !== 'children') attributes[key] = value
  return attributes as HTMLAttributes<HTMLElement>
}

function needsFallback(props: DiagramFigureProps): boolean {
  if (props['data-rmk-diagram'] === undefined) return false
  return props['data-rmk-diagram-support'] === 'source' || props['data-rmk-diagram-error'] !== undefined
}

function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'element'
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

/** The fence body: the text of the `code` element inside the figure's `pre`. */
function sourceOf(figure: Element | undefined): string | undefined {
  if (figure === undefined) return undefined
  for (const child of figure.children) {
    if (!isElement(child) || child.tagName !== 'pre') continue
    const code = child.children.find((inner): inner is Element => isElement(inner) && inner.tagName === 'code')
    return code === undefined ? textOf(child) : textOf(code)
  }
  return undefined
}

interface FallbackFigureProps {
  readonly attributes: HTMLAttributes<HTMLElement>
  readonly figure: Element | undefined
  readonly kind: string
  readonly render: DiagramFallbackOptions['render']
  readonly children?: ReactNode
}

function FallbackFigure({ attributes, figure, kind, render, children }: FallbackFigureProps): ReactElement {
  const [svg, setSvg] = useState<string | undefined>(undefined)
  const source = sourceOf(figure)

  // Mounted: ask the host once per source. A result that arrives after the
  // source changed, or after unmount, is dropped.
  useEffect(() => {
    if (source === undefined) return
    let current = true
    render(source, kind).then(
      (markup) => {
        if (current && typeof markup === 'string' && markup !== '') setSvg(markup)
      },
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [render, source, kind])

  if (svg === undefined || figure === undefined) return createElement('figure', attributes, children)
  return createElement('figure', attributes, ...replacePre(figure, svg))
}

/** The figure's children with the <pre> swapped for the host's SVG; the rest (a caption) renders from the hast as it was. */
function replacePre(figure: Element, svg: string): readonly ReactElement[] {
  return figure.children.map((child, index) =>
    isElement(child) && child.tagName === 'pre'
      ? createElement('div', { key: index, 'data-rmk-diagram-fallback': '', dangerouslySetInnerHTML: { __html: svg } })
      : createElement(Fragment, { key: index }, toJsxRuntime(child, { Fragment, jsx, jsxs, passKeys: true })),
  )
}

export function createDiagramFigure(options: DiagramFallbackOptions): ComponentType<DiagramFigureProps> {
  const { render } = options
  return function DiagramFigure(props: DiagramFigureProps): ReactElement {
    const attributes = attributesOf(props)
    if (!needsFallback(props)) return createElement('figure', attributes, props.children)
    const figure = isElement(props.node) ? props.node : undefined
    const kind = typeof props['data-rmk-diagram-kind'] === 'string' ? props['data-rmk-diagram-kind'] : UNKNOWN_KIND
    return createElement(FallbackFigure, { attributes, figure, kind, render }, props.children)
  }
}
