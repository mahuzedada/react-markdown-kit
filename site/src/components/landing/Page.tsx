import type { ReactNode } from 'react'
import { cn } from '@zuilib/primitives/lib/cn'
import Prose from '../Prose'

/*
 * The copy under each demo and on the home page. `Page` is the reading
 * column and the prose, so every element in it reads like the docs; the
 * rest are the few blocks prose has no element for.
 */

/** The reading column, as prose. */
export function Page({
  children,
  id,
  className,
  as: Tag = 'article',
}: {
  readonly children: ReactNode
  readonly id?: string
  readonly className?: string
  readonly as?: 'article' | 'main'
}): ReactNode {
  return (
    <Tag id={id} className={cn('px-4 py-12', className)}>
      <Prose className="mx-auto max-w-(--width-reading)">{children}</Prose>
    </Tag>
  )
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
    <>
      {kicker ? <p className="text-sm font-medium text-primary-text">{kicker}</p> : null}
      <h1 className={cn(kicker && 'mt-1')}>{title}</h1>
      {lede ? <p className="text-lg">{lede}</p> : null}
      {children}
    </>
  )
}

/** A row of plain links under the hero. */
export function LinkRow({ children }: { readonly children: ReactNode }): ReactNode {
  return <p className="flex flex-wrap gap-x-4 gap-y-1">{children}</p>
}

/** Items in a grid, each under a hairline: the demos' features and the home page's links. */
export function Features({ children }: { readonly children: ReactNode }): ReactNode {
  return <ul className="mt-8 grid list-none grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-x-6 gap-y-4 p-0">{children}</ul>
}

export function Feature({ title, children }: { readonly title: ReactNode; readonly children: ReactNode }): ReactNode {
  return (
    <li className="m-0 border-t border-border pt-3">
      <strong className="mb-1 block font-semibold">{title}</strong>
      {children}
    </li>
  )
}

/** Numbered how-to steps; each step can hold a CodeBlock. */
export function Steps({ children }: { readonly children: ReactNode }): ReactNode {
  return <ol className="[&>li]:mb-5 [&_[data-copy-code]]:mt-2">{children}</ol>
}

/** A panel that points at further reading. */
export function Callout({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="my-8 rounded-(--radius) border-s-4 border-primary bg-muted px-5 py-4 [&_p]:m-0">{children}</div>
}
