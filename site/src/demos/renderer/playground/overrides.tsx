/**
 * The component overrides the playground can switch on. Each is the kind of
 * thing a real application writes on day one, and the Code tab shows the
 * same source so it can be copied as-is.
 */
import type { ComponentProps, ReactNode } from 'react'
/** The bit of the hast node an override reads. Avoids a type dependency on hast. */
interface Element { readonly tagName?: string; readonly data?: { readonly meta?: string } }

type WithNode<T> = T & { readonly node?: Element }

export function AppLink({ node: _node, ...props }: WithNode<ComponentProps<'a'>>): ReactNode {
  const external = props.href?.startsWith('http') ?? false
  return (
    <a {...props} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      {props.children}
      {external ? <span aria-hidden="true"> ↗</span> : null}
    </a>
  )
}

export function CaptionedImage({ node: _node, src, alt, title }: WithNode<ComponentProps<'img'>>): ReactNode {
  return (
    <span style={{ display: 'block' }}>
      <img src={src} alt={alt} loading="lazy" style={{ maxWidth: 240, borderRadius: 6 }} />
      {title ? <span style={{ display: 'block', fontSize: '0.8em', opacity: 0.7 }}>{title}</span> : null}
    </span>
  )
}

export function LabelledCode({ node, className, children, ...props }: WithNode<ComponentProps<'code'>>): ReactNode {
  const language = languageOf(className)
  const meta = node?.data?.meta
  return (
    <>
      {language ? (
        <span style={{ display: 'block', fontSize: '0.72em', letterSpacing: '0.06em', opacity: 0.6, marginBottom: '0.4em' }}>
          {language}
          {meta ? ` · ${meta}` : ''}
        </span>
      ) : null}
      <code className={className} {...props}>{children}</code>
    </>
  )
}

/** The `language-*` token, wherever it sits among other classes. */
function languageOf(className: string | undefined): string | undefined {
  return className?.split(/\s+/).find((token) => token.startsWith('language-'))?.slice('language-'.length)
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node !== null && typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

export function anchorHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const
  return function AnchorHeading({ node: _node, children, ...props }: WithNode<ComponentProps<typeof Tag>>): ReactNode {
    const id = slugify(textOf(children))
    return (
      <Tag id={id} {...props}>
        {children}{' '}
        <a href={`#${id}`} aria-label="Link to this heading" style={{ opacity: 0.35, textDecoration: 'none' }}>
          #
        </a>
      </Tag>
    )
  }
}

/** Source shown in the Code tab, one entry per override. */
export const OVERRIDE_SOURCE = {
  links: `function AppLink(props) {
  const external = props.href?.startsWith('http')
  return (
    <a {...props} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      {props.children}{external ? ' ↗' : null}
    </a>
  )
}`,
  images: `function CaptionedImage({ src, alt, title }) {
  return (
    <span className="figure">
      <img src={src} alt={alt} loading="lazy" />
      {title ? <span className="caption">{title}</span> : null}
    </span>
  )
}`,
  code: `function LabelledCode({ node, className, children }) {
  const language = className?.split(' ').find((c) => c.startsWith('language-'))?.slice(9)
  const meta = node?.data?.meta   // the rest of the info string
  return (
    <>
      {language ? <span className="lang">{language}{meta ? \` · \${meta}\` : ''}</span> : null}
      <code className={className}>{children}</code>
    </>
  )
}`,
  headings: `function AnchorHeading({ node, children, ...props }) {
  const Tag = node.tagName
  const id = slugify(textOf(children))
  return <Tag id={id} {...props}>{children} <a href={\`#\${id}\`}>#</a></Tag>
}`,
} as const
