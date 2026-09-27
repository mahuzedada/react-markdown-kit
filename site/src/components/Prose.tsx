import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'
import CodeBlock from './CodeBlock'

/**
 * Long-form copy on every page: docs, articles and the copy under each demo.
 * The type is the renderer's own `.rmk-document` stylesheet with its
 * variables set to the site's tokens (`[data-prose]` in theme.css), so the
 * site reads the way the kit renders.
 */
export default function Prose({ children, className }: { readonly children: ReactNode; readonly className?: string }): ReactNode {
  return (
    <div className={cn('rmk-document', className)} data-prose="">
      {children}
    </div>
  )
}

/** A heading with the link to itself that shows on hover. */
function anchored(Tag: 'h2' | 'h3') {
  return function Heading({ id, children, ...props }: ComponentPropsWithoutRef<'h2'>): ReactNode {
    return (
      <Tag id={id} className="group scroll-mt-(--navbar-height)" {...props}>
        {children}
        {id ? (
          <a
            href={`#${id}`}
            className="ms-2 text-muted-foreground no-underline opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Link to this section"
          >
            #
          </a>
        ) : null}
      </Tag>
    )
  }
}

/** A fenced block: MDX gives `<pre><code className="language-x">`. */
function Pre({ children }: { readonly children?: ReactNode }): ReactNode {
  const code = (children as ReactElement<{ className?: string; children?: string }>).props
  const language = /language-(\S+)/.exec(code.className ?? '')?.[1]
  return <CodeBlock language={language}>{String(code.children ?? '')}</CodeBlock>
}

/** What MDX renders each Markdown element as. */
export const MDX_COMPONENTS = { h2: anchored('h2'), h3: anchored('h3'), pre: Pre }
