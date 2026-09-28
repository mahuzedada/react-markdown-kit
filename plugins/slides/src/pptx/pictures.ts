/**
 * Pictures are fetched here, before pptxgenjs sees the deck, and handed to
 * it as data URLs. pptxgenjs would fetch them itself, but one that fails
 * rejects the whole file in a browser and can hang forever on a server.
 * Here each fetch has a time limit, and a picture that doesn't arrive is
 * left out of the file.
 */
import type { MarkdownNode } from '@internal/document-contracts/index.js'
import type { DeckModel } from '../deck/model.js'
import type { ResolvePptxUrl } from './export-context.js'

function imageUrls(node: MarkdownNode): string[] {
  const own = node.type === 'image' && typeof node['url'] === 'string' ? [node['url']] : []
  return [...own, ...(node.children ?? []).flatMap(imageUrls)]
}

/** Every picture URL the deck uses (backgrounds, layout images, images in the body), after the URL policy. */
export function pictureUrls(deck: DeckModel, resolveUrl: ResolvePptxUrl): string[] {
  const raw = deck.slides.flatMap((slide) => [
    ...(slide.background === undefined ? [] : [slide.background]),
    ...(slide.image === undefined ? [] : [slide.image]),
    ...slide.blocks.flatMap((block) => imageUrls(block.node)),
  ])
  const allowed = raw.map((url) => resolveUrl(url, 'image')).filter((url): url is string => url !== undefined)
  return [...new Set(allowed)]
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

async function fetchAsDataUrl(url: string, timeoutMs: number): Promise<string | undefined> {
  if (url.startsWith('data:')) return url
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return undefined
    const type = response.headers.get('content-type')?.split(';')[0] ?? 'image/png'
    if (!type.startsWith('image/')) return undefined
    return `data:${type};base64,${base64(new Uint8Array(await response.arrayBuffer()))}`
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/** URL to data URL for every picture that arrived in time. */
export async function loadPictures(urls: readonly string[], timeoutMs: number): Promise<ReadonlyMap<string, string>> {
  const loaded = await Promise.all(urls.map(async (url) => [url, await fetchAsDataUrl(url, timeoutMs)] as const))
  return new Map(loaded.filter((entry): entry is readonly [string, string] => entry[1] !== undefined))
}
