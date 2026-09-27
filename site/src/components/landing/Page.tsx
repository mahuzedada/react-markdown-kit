import type { ReactNode } from 'react'
import Heading from '@zuilib/primitives/heading'
import Text from '@zuilib/primitives/text'
import { cn } from '@zuilib/primitives/lib/cn'

/*
 * The landing copy every site shares: the page column, the hero, features,
 * prose, steps and a callout. Layout and type are zui primitives and
 * Tailwind token classes; theme.css is the only stylesheet. Body copy is
 * always full-size foreground text, and muted text is kept for metadata.
 */

interface ChildrenProps {
  readonly children: ReactNode
  readonly className?: string
}

/** The page column under a demo, or the whole page on the home site. */
export function Page({ children, className, id, as: Tag = 'article' }: ChildrenProps & { readonly id?: string; readonly as?: 'article' | 'main' }): ReactNode {
  return <Tag id={id} className={cn('mx-auto w-full max-w-(--container-width-md) px-4 pt-12 pb-16', className)}>{children}</Tag>
}

export interface HeroProps {
  readonly title: ReactNode
  /** A short line above the title. Keep it a readable sentence, not a tag. */
  readonly kicker?: ReactNode
  readonly lede?: ReactNode
  readonly children?: ReactNode
}

export function Hero({ title, kicker, lede, children }: HeroProps): ReactNode {
  return (
    <header className="mb-10">
      {kicker ? (
        <Text size="sm" weight="medium" className="m-0 mb-2 text-primary-text">
          {kicker}
        </Text>
      ) : null}
      <Heading as="h1" size="3xl" className="m-0 mb-3">
        {title}
      </Heading>
      {lede ? (
        <Text size="lg" className="m-0 mb-4 max-w-2xl">
          {lede}
        </Text>
      ) : null}
      {children}
    </header>
  )
}

/** A row of plain links under the hero. */
export function LinkRow({ children }: { readonly children: ReactNode }): ReactNode {
  return <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 [&_a]:text-primary-text">{children}</p>
}

export function Features({ children }: { readonly children: ReactNode }): ReactNode {
  return <ul className="m-0 mb-12 grid list-none grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4 p-0">{children}</ul>
}

export function Feature({ title, children }: { readonly title: ReactNode; readonly children: ReactNode }): ReactNode {
  return (
    <li className="m-0 rounded-md border border-border bg-card p-5 leading-relaxed">
      <strong className="mb-1 block font-semibold">{title}</strong>
      {children}
    </li>
  )
}

/**
 * Long-form copy. The children are plain elements (h2, p, ul, ol, code),
 * so their spacing and type are set here once.
 */
export function Prose({ children, className }: ChildrenProps): ReactNode {
  return (
    <div
      className={cn(
        'leading-relaxed',
        '[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h2:first-child]:mt-0',
        '[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold',
        '[&_p]:mt-0 [&_p]:mb-4 [&_li]:mb-2 [&_ul]:pl-5 [&_ol]:pl-5',
        '[&_a]:text-primary-text',
        '[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Numbered how-to steps; each step can hold a CodeBlock. */
export function Steps({ children }: { readonly children: ReactNode }): ReactNode {
  return <ol className="pl-5 [&>li]:mb-5 [&_[data-copy-code]]:mt-2 [&_[data-copy-code]]:mb-0">{children}</ol>
}

/** A panel that points at further reading. */
export function Callout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="my-8 rounded-md border border-l-4 border-border border-l-primary bg-muted px-5 py-4 [&_p:last-child]:mb-0">
      {children}
    </div>
  )
}
