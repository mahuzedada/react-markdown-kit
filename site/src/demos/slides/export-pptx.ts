/**
 * Export: the deck on screen as a .pptx download. The PowerPoint writer is
 * its own chunk, loaded on the first click.
 */
import { compileMarkdown, type MarkdownPreset } from '@react-markdown-kit/renderer'

function fileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug === '' ? 'deck' : slug}.pptx`
}

export async function downloadPptx(source: string, preset: MarkdownPreset, title: string): Promise<void> {
  const { deckToPptx } = await import('@react-markdown-kit/slides/pptx')
  const file = await deckToPptx(compileMarkdown(source, { preset }), { output: 'blob' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(title)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
