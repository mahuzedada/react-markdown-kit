import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, compileMarkdown, type MarkdownPreset } from '@react-markdown-kit/renderer'

/*
 * The diagram as a file: the same static SVG the renderer draws for the
 * fence, as text, as a PNG, or on the clipboard. Everything runs in the
 * browser; nothing is uploaded.
 */

const SVG = /<svg[\s\S]*?<\/svg>/

/** The static SVG the renderer draws for `markdown`, or nothing when no kind renders the fence (shown as source, or a parse error). */
export function diagramSvg(markdown: string, preset: MarkdownPreset): string | undefined {
  const html = renderToStaticMarkup(createElement(Markdown, { preset, document: compileMarkdown(markdown, { preset }) }))
  const svg = SVG.exec(html)?.[0]
  if (svg === undefined) return undefined
  // Label plates and the sequence diagram's colours read a theme property
  // with a Mermaid fallback; a file has no theme, so the fallback is written in.
  const plain = svg.replace(/var\(--[\w-]+,\s*([^)]+)\)/g, '$1')
  return plain.includes('xmlns=') ? plain : plain.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
}

/** The intrinsic size of an SVG string, from its width/height or its viewBox. */
function svgSize(svg: string): { width: number; height: number } {
  const open = /<svg[^>]*>/.exec(svg)?.[0] ?? ''
  const attribute = (name: string): number | undefined => {
    const value = new RegExp(`\\s${name}="([\\d.]+)`).exec(open)?.[1]
    return value === undefined ? undefined : Number(value)
  }
  const viewBox = /viewBox="([^"]*)"/.exec(open)?.[1]?.split(/[\s,]+/).map(Number)
  const width = attribute('width') ?? viewBox?.[2] ?? 800
  const height = attribute('height') ?? viewBox?.[3] ?? 400
  return { width, height }
}

/** `svg` rasterized at `scale` device pixels per unit, on `background`. */
export function svgToPng(svg: string, scale = 2, background = '#ffffff'): Promise<Blob> {
  const { width, height } = svgSize(svg)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const context = canvas.getContext('2d')
      if (context === null) {
        reject(new Error('Canvas 2D is unavailable'))
        return
      }
      context.fillStyle = background
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => (blob === null ? reject(new Error('PNG encoding failed')) : resolve(blob)), 'image/png')
    }
    image.onerror = () => reject(new Error('The SVG could not be drawn'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/** Saves `blob` as `name` through a temporary link. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Puts a PNG on the clipboard. Rejects where the browser has no image clipboard. */
export async function copyImage(png: Blob): Promise<void> {
  if (typeof ClipboardItem !== 'function' || typeof navigator.clipboard?.write !== 'function') {
    throw new Error('This browser cannot copy images')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

/** The file name a diagram downloads as, from its title line when it has one. */
export function diagramFileName(code: string, extension: 'svg' | 'png'): string {
  const title = /^---\s*\n[\s\S]*?title:\s*(.+?)\s*\n[\s\S]*?---/.exec(code)?.[1]
  const base = (title ?? 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram'
  return `${base}.${extension}`
}
