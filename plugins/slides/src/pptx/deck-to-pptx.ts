/**
 * `deckToPptx`: a compiled deck as a PowerPoint file. It takes what
 * `compileMarkdown(source, { preset })` returns with `slides()` in the
 * preset, reads the deck from the tree the same way the renderer does, and
 * writes one PowerPoint slide per deck slide with pptxgenjs, which is
 * imported on the first call so the package works without it until then.
 * Pictures are fetched first (`pictures.ts`), so a dead image link leaves
 * one picture out rather than losing the file.
 */
import type PptxGenJS from 'pptxgenjs'
import type { MarkdownRoot } from '@internal/document-contracts/index.js'
import type { DeckModel, SlideAspect } from '../deck/model.js'
import { readDeck } from '../deck/read-deck.js'
import { defaultResolveUrl, type ExportContext, type ResolvePptxUrl } from './export-context.js'
import { loadPictures, pictureUrls } from './pictures.js'
import { PPTX_LAYOUTS } from './geometry.js'
import { DEFAULT_PPTX_THEME, type PptxTheme } from './theme.js'
import { writeSlide } from './write-slide.js'

/** The part of a compiled document the export reads. */
export interface CompiledDeck {
  readonly tree: MarkdownRoot
}

export interface PptxOutputs {
  readonly blob: Blob
  readonly arraybuffer: ArrayBuffer
  readonly uint8array: Uint8Array
  readonly nodebuffer: Uint8Array
}

export type PptxOutput = keyof PptxOutputs

export interface DeckToPptxOptions<Output extends PptxOutput = 'blob'> {
  /** Used when the front matter sets none. Default `16:9`. */
  readonly aspect?: SlideAspect
  readonly theme?: Partial<PptxTheme>
  /** What the promise resolves to. Default `blob`; use `nodebuffer` or `uint8array` outside a browser. */
  readonly output?: Output
  /**
   * Which picture and link URLs reach the file. The default allows web and
   * `data:image` pictures and web and mail links, and refuses the rest
   * (pptxgenjs would read any other path from the file system).
   */
  readonly resolveUrl?: ResolvePptxUrl
  /** How long each picture may take to download before it is left out. Default 10 000 ms. */
  readonly pictureTimeoutMs?: number
}

export async function deckToPptx<Output extends PptxOutput = 'blob'>(
  document: CompiledDeck,
  options: DeckToPptxOptions<Output> = {},
): Promise<PptxOutputs[Output]> {
  const { default: Presentation } = (await import('pptxgenjs')) as { default: typeof PptxGenJS }
  const deck = readDeck(document.tree)
  const resolveUrl = options.resolveUrl ?? defaultResolveUrl
  const pictures = await loadPictures(pictureUrls(deck, resolveUrl), options.pictureTimeoutMs ?? 10_000)
  const context: ExportContext = { theme: { ...DEFAULT_PPTX_THEME, ...options.theme }, resolveUrl, pictures }
  const presentation = build(Presentation, deck, deck.aspect ?? options.aspect ?? '16:9', context)
  return (await presentation.write({ outputType: options.output ?? 'blob' })) as PptxOutputs[Output]
}

function build(Presentation: typeof PptxGenJS, deck: DeckModel, aspect: SlideAspect, context: ExportContext): PptxGenJS {
  const presentation = new Presentation()
  presentation.layout = PPTX_LAYOUTS[aspect].name
  if (deck.title !== undefined) presentation.title = deck.title
  for (const slide of deck.slides) writeSlide(presentation, slide, aspect, context)
  return presentation
}
