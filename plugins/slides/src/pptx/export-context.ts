/**
 * What every part of the export reads: the theme, the URL policy, and the
 * pictures that were fetched (`pictures.ts`), by URL.
 */
import type { PptxTheme } from './theme.js'

/** A URL from the deck, allowed as is, rewritten, or refused (undefined). */
export type ResolvePptxUrl = (url: string, kind: 'image' | 'link') => string | undefined

export interface ExportContext {
  readonly theme: PptxTheme
  readonly resolveUrl: ResolvePptxUrl
  /** Allowed URL to its data URL; a picture missing here is left out. */
  readonly pictures: ReadonlyMap<string, string>
}

/** The data URL to place for a picture in the deck, or undefined when it is refused or didn't load. */
export function pictureOf(context: ExportContext, url: string | undefined): string | undefined {
  const allowed = url === undefined ? undefined : context.resolveUrl(url, 'image')
  return allowed === undefined ? undefined : context.pictures.get(allowed)
}

const WEB = /^https?:\/\//i
const IMAGE_DATA = /^data:image\//i
const LINK = /^(?:https?:|mailto:)/i

/**
 * The default policy. pptxgenjs reads a `path` from the file system on a
 * server, so only web and `data:image` pictures are fetched, and only web
 * and mail links are written. In a browser a relative URL is resolved
 * against the page first.
 */
export const defaultResolveUrl: ResolvePptxUrl = (url, kind) => {
  const absolute = typeof location === 'undefined' || WEB.test(url) || /^[a-z]+:/i.test(url) ? url : new URL(url, location.href).href
  if (kind === 'image') return WEB.test(absolute) || IMAGE_DATA.test(absolute) ? absolute : undefined
  return LINK.test(absolute) ? absolute : undefined
}
