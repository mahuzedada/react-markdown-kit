/**
 * The playground's Showcase mode: a component for every element the renderer
 * emits, so the output looks like an application's document rather than a
 * browser's defaults. Each component reads the hast `node` the renderer
 * hands it, which is what lets a blockquote become a callout, a fenced block
 * a titled window with a gutter, and a task list a progress bar.
 *
 * The Code tab shows `SHOWCASE_SOURCE`, a compact copy of the same code.
 */
import { Children, cloneElement, isValidElement, useState, type ComponentProps, type ReactNode } from 'react'

/** The parts of a hast node the showcase reads. Avoids a type dependency on hast. */
interface HastNode {
  readonly type?: string
  readonly tagName?: string
  readonly properties?: Readonly<Record<string, unknown>>
  readonly children?: readonly HastNode[]
  readonly data?: { readonly meta?: string }
  readonly value?: string
}

type WithNode<T> = T & { readonly node?: HastNode }

const CALLOUTS: Readonly<Record<string, { readonly label: string; readonly glyph: string }>> = {
  note: { label: 'Note', glyph: 'i' },
  tip: { label: 'Tip', glyph: '✦' },
  important: { label: 'Important', glyph: '!' },
  warning: { label: 'Warning', glyph: '▲' },
  caution: { label: 'Caution', glyph: '✕' },
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
}

function heading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const
  return function Heading({ node: _node, children, className, ...props }: WithNode<ComponentProps<typeof Tag>>): ReactNode {
    const id = slugify(textOf(children))
    return (
      <Tag id={id} {...props} className={className === undefined ? 'sc-heading' : `sc-heading ${className}`}>
        <span className="sc-heading-text">{children}</span>
        <a href={`#${id}`} className="sc-anchor" aria-label="Link to this heading">#</a>
      </Tag>
    )
  }
}

function SmartLink({ node: _node, href, children, ...props }: WithNode<ComponentProps<'a'>>): ReactNode {
  const external = /^https?:\/\//.test(href ?? '')
  if (!external) return <a href={href} {...props} className="sc-link">{children}</a>
  const host = new URL(href!).hostname.replace(/^www\./, '')
  return (
    <a href={href} target="_blank" rel="noreferrer" {...props} className="sc-link sc-link-external">
      {children}
      <span className="sc-host" aria-hidden="true">{host} ↗</span>
    </a>
  )
}

/** `> [!TIP]` on the first line turns a blockquote into a callout; anything else is a pull quote. */
function Callout({ node: _node, children, ...props }: WithNode<ComponentProps<'blockquote'>>): ReactNode {
  const items = Children.toArray(children)
  const index = items.findIndex((item) => isValidElement(item))
  const first = items[index]
  if (isValidElement<{ children?: ReactNode }>(first)) {
    const inner = Children.toArray(first.props.children)
    const lead = inner[0]
    const match = typeof lead === 'string' ? /^\[!(\w+)\]\s*/.exec(lead) : null
    const kind = match?.[1]?.toLowerCase()
    if (match !== null && match !== undefined && kind !== undefined && kind in CALLOUTS) {
      const rest = lead!.toString().slice(match[0].length)
      const stripped = cloneElement(first, {}, ...(rest === '' ? inner.slice(1) : [rest, ...inner.slice(1)]))
      const { label, glyph } = CALLOUTS[kind]!
      return (
        <aside {...props} className={`sc-callout sc-callout-${kind}`} role="note">
          <span className="sc-callout-glyph" aria-hidden="true">{glyph}</span>
          <div className="sc-callout-body">
            <strong className="sc-callout-label">{label}</strong>
            {[...items.slice(0, index), stripped, ...items.slice(index + 1)]}
          </div>
        </aside>
      )
    }
  }
  return (
    <blockquote {...props} className="sc-quote">
      <span className="sc-quote-mark" aria-hidden="true">“</span>
      {children}
    </blockquote>
  )
}

/** A titled window with a line gutter, from the fence's info string and its text. */
function CodeWindow({ node, children, ...props }: WithNode<ComponentProps<'pre'>>): ReactNode {
  const [copied, setCopied] = useState(false)
  const code = node?.children?.find((child) => child.tagName === 'code')
  const classes = code?.properties?.className
  const language = (Array.isArray(classes) ? classes : [])
    .map(String)
    .find((token) => token.startsWith('language-'))
    ?.slice('language-'.length)
  const title = /title="([^"]*)"/.exec(code?.data?.meta ?? '')?.[1]
  const text = textOf(children).replace(/\n$/, '')
  const lines = text.split('\n')
  const copy = (): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <figure className="sc-code" data-language={language}>
      <figcaption className="sc-code-head">
        <span className="sc-code-title">{title ?? language ?? 'text'}</span>
        <span className="sc-code-meta">
          {title !== undefined && language !== undefined ? `${language} · ` : ''}
          {lines.length} {lines.length === 1 ? 'line' : 'lines'}
        </span>
        <button type="button" className="sc-code-copy" data-zui-tag="sample-code-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </figcaption>
      <pre {...props} className="sc-code-body">
        <code className={language === undefined ? undefined : `language-${language}`}>
          {lines.map((line, index) => (
            <span key={index} className="sc-line">
              <span className="sc-line-number" aria-hidden="true">{index + 1}</span>
              <span className="sc-line-text">{line === '' ? ' ' : line}</span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  )
}

function TaskList({ node, className, children, ...props }: WithNode<ComponentProps<'ul'>>): ReactNode {
  if (!className?.includes('contains-task-list')) return <ul className={`sc-list ${className ?? ''}`} {...props}>{children}</ul>
  const items = (node?.children ?? []).filter((child) => child.tagName === 'li')
  const done = items.filter((item) => item.children?.some((child) => child.tagName === 'input' && Boolean(child.properties?.checked))).length
  return (
    <div className="sc-tasks">
      <div className="sc-tasks-head">
        <span>{done} of {items.length} done</span>
        <span className="sc-tasks-bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length}>
          <span style={{ width: `${items.length === 0 ? 0 : (done / items.length) * 100}%` }} />
        </span>
      </div>
      <ul className={`sc-list ${className}`} {...props}>{children}</ul>
    </div>
  )
}

function Checkbox({ node: _node, checked, ...props }: WithNode<ComponentProps<'input'>>): ReactNode {
  if (props.type !== 'checkbox') return <input checked={checked} {...props} />
  return (
    <span className={checked ? 'sc-check sc-check-on' : 'sc-check'} role="checkbox" aria-checked={Boolean(checked)} aria-disabled="true">
      {checked ? '✓' : ''}
    </span>
  )
}

function DataTable({ node, children, ...props }: WithNode<ComponentProps<'table'>>): ReactNode {
  const body = node?.children?.find((child) => child.tagName === 'tbody')
  const head = node?.children?.find((child) => child.tagName === 'thead')?.children?.find((child) => child.tagName === 'tr')
  const rows = body?.children?.filter((child) => child.tagName === 'tr').length ?? 0
  const columns = head?.children?.filter((child) => child.tagName === 'th').length ?? 0
  return (
    <figure className="sc-table">
      <div className="sc-table-scroll">
        <table {...props}>{children}</table>
      </div>
      <figcaption className="sc-table-foot">{rows} {rows === 1 ? 'row' : 'rows'} · {columns} columns</figcaption>
    </figure>
  )
}

function Figure({ node: _node, src, alt, title }: WithNode<ComponentProps<'img'>>): ReactNode {
  return (
    <span className="sc-figure">
      <img src={src} alt={alt} loading="lazy" />
      {(title ?? alt) ? <span className="sc-figure-caption">{title ?? alt}</span> : null}
    </span>
  )
}

function Rule({ node: _node, ...props }: WithNode<ComponentProps<'hr'>>): ReactNode {
  return (
    <div {...props} role="separator" className="sc-rule">
      <span aria-hidden="true">◆</span>
    </div>
  )
}

function Notes({ node: _node, children, ...props }: WithNode<ComponentProps<'section'>>): ReactNode {
  const isFootnotes = 'data-footnotes' in props
  return (
    <section {...props} className={isFootnotes ? 'sc-notes' : undefined}>
      {isFootnotes ? <span className="sc-notes-label" aria-hidden="true">Notes</span> : null}
      {children}
    </section>
  )
}

export const SHOWCASE_CLASS_NAME = 'pg-showcase'

export const showcase = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  h5: heading(5),
  h6: heading(6),
  a: SmartLink,
  blockquote: Callout,
  pre: CodeWindow,
  ul: TaskList,
  input: Checkbox,
  table: DataTable,
  img: Figure,
  hr: Rule,
  section: Notes,
}

/** What the Code tab shows for Showcase mode: the same components, compacted. */
export const SHOWCASE_SOURCE = `// showcase.tsx — one component per element, each reading the hast \`node\`
function Heading({ node, children, ...props }) {
  const Tag = node.tagName
  const id = slugify(textOf(children))
  return <Tag id={id} {...props}>{children} <a href={\`#\${id}\`}>#</a></Tag>
}

function SmartLink({ href, children, ...props }) {
  if (!/^https?:/.test(href)) return <a href={href} {...props}>{children}</a>
  const host = new URL(href).hostname.replace(/^www\\./, '')
  return <a href={href} target="_blank" rel="noreferrer" {...props}>{children} <small>{host} ↗</small></a>
}

function Callout({ children, ...props }) {
  // "> [!TIP]" on the first line becomes a callout; anything else is a pull quote
  const [first, ...rest] = Children.toArray(children).filter(isValidElement)
  const lead = Children.toArray(first.props.children)[0]
  const match = typeof lead === 'string' ? /^\\[!(\\w+)\\]\\s*/.exec(lead) : null
  if (!match) return <blockquote {...props}>{children}</blockquote>
  const kind = match[1].toLowerCase()
  const body = cloneElement(first, {}, lead.slice(match[0].length), ...Children.toArray(first.props.children).slice(1))
  return <aside role="note" className={\`callout callout-\${kind}\`}><strong>{kind}</strong>{body}{rest}</aside>
}

function CodeWindow({ node, children }) {
  const code = node.children.find((c) => c.tagName === 'code')
  const language = code?.properties.className?.find((c) => c.startsWith('language-'))?.slice(9)
  const title = /title="([^"]*)"/.exec(code?.data?.meta ?? '')?.[1]   // the fence's info string
  const lines = textOf(children).replace(/\\n$/, '').split('\\n')
  return (
    <figure className="code">
      <figcaption>{title ?? language} · {lines.length} lines <CopyButton text={lines.join('\\n')} /></figcaption>
      <pre><code>{lines.map((line, i) => <span key={i} data-line={i + 1}>{line}</span>)}</code></pre>
    </figure>
  )
}

function TaskList({ node, className, children }) {
  if (!className?.includes('contains-task-list')) return <ul className={className}>{children}</ul>
  const items = node.children.filter((c) => c.tagName === 'li')
  const done = items.filter((li) => li.children.some((c) => c.tagName === 'input' && c.properties.checked)).length
  return (
    <div className="tasks">
      <progress value={done} max={items.length} /> {done} of {items.length} done
      <ul className={className}>{children}</ul>
    </div>
  )
}

function Checkbox({ checked, ...props }) {
  if (props.type !== 'checkbox') return <input checked={checked} {...props} />
  return <span role="checkbox" aria-checked={!!checked} className="check">{checked ? '✓' : ''}</span>
}

function DataTable({ node, children }) {
  const rows = node.children.find((c) => c.tagName === 'tbody')?.children.filter((c) => c.tagName === 'tr').length ?? 0
  return <figure className="table"><table>{children}</table><figcaption>{rows} rows</figcaption></figure>
}

function Figure({ src, alt, title }) {
  return <span className="figure"><img src={src} alt={alt} loading="lazy" />{title ?? alt}</span>
}

function Rule() {
  return <div role="separator" className="rule">◆</div>
}

function Notes({ children, ...props }) {
  const footnotes = 'data-footnotes' in props   // GFM marks its footnote section
  return <section {...props} className={footnotes ? 'notes' : undefined}>{children}</section>
}

const showcase = {
  h1: Heading, h2: Heading, h3: Heading, h4: Heading, h5: Heading, h6: Heading,
  a: SmartLink, blockquote: Callout, pre: CodeWindow, ul: TaskList, input: Checkbox,
  table: DataTable, img: Figure, hr: Rule, section: Notes,
}`
