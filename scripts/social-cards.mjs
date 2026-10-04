#!/usr/bin/env node
/**
 * Renders the 1200x630 PNG social card of each public site. Social crawlers
 * do not render SVG, so the PNGs are committed and referenced as `og:image`.
 * Run again after changing a title here or the logo: `node scripts/social-cards.mjs`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// The master logo from scripts/brand-icons.mjs in its dark-mode ink (the
// cards are dark), nested at the card's top left.
const logo = readFileSync(join(root, 'site/brand/logo.svg'), 'utf8').replaceAll('#1c2127', '#f6f7f9')
const LOGO = logo
  .replace(/<svg [^>]*viewBox="([^"]+)"[^>]*>/, '<svg x="60" y="56" width="96" height="96" viewBox="$1">')
  .trim()

const CARDS = [
  {
    out: 'site/static/img/social-card.png',
    title: 'React Markdown Kit docs',
    lines: ['Renderer, editor, variables,', 'Mermaid and slides for React.'],
    host: 'reactmarkdownkit.com',
  },
  {
    out: 'site/static/img/social-card-renderer.png',
    title: 'React Markdown Renderer',
    lines: ['Paste Markdown, switch every option,', 'copy the code that made the output.'],
    host: 'reactmarkdownkit.com/markdown-renderer',
  },
  {
    out: 'site/static/img/social-card-stream.png',
    title: 'Streaming Markdown Playground',
    lines: ['Markdown replayed in chunks, like a chat reply.', 'Every prefix renders.'],
    host: 'reactmarkdownkit.com/markdown-streaming',
  },
  {
    out: 'site/static/img/social-card-editor.png',
    title: 'Free Online Markdown Editor',
    lines: ['Rich, source and preview modes.', 'Plain Markdown in, plain Markdown out.'],
    host: 'reactmarkdownkit.com/markdown-editor',
  },
  {
    out: 'site/static/img/social-card-variables.png',
    title: 'Markdown Variables Playground',
    lines: ['Typed placeholders, schemas and locales.', 'Data is placed as text, never as Markdown.'],
    host: 'reactmarkdownkit.com/markdown-variables',
  },
  {
    out: 'site/static/img/social-card-mermaid.png',
    title: 'Free Mermaid Visual Editor',
    lines: ['Flowcharts on a canvas, sequence diagrams as SVG.', 'Get plain Mermaid syntax back.'],
    host: 'reactmarkdownkit.com/mermaid-editor',
  },
  {
    out: 'site/static/img/social-card-slides.png',
    title: 'Markdown Slides Editor',
    lines: ['Write the deck as Markdown.', 'Present it from the browser.'],
    host: 'reactmarkdownkit.com/markdown-slides',
  },
]

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONO = "Menlo, 'SF Mono', Consolas, monospace"

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

function svg({ title, lines, host }) {
  const [first = '', second = ''] = lines
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#1c2127"/>
  ${LOGO}
  <text x="64" y="290" font-family="${SANS}" font-size="64" font-weight="700" fill="#ffffff">${escape(title)}</text>
  <text x="64" y="366" font-family="${SANS}" font-size="38" fill="#abb3bf">${escape(first)}</text>
  <text x="64" y="418" font-family="${SANS}" font-size="38" fill="#abb3bf">${escape(second)}</text>
  <text x="64" y="556" font-family="${MONO}" font-size="28" fill="#8abbff">${escape(host)}</text>
</svg>`
}

for (const card of CARDS) {
  const png = new Resvg(svg(card), {
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' },
  })
    .render()
    .asPng()
  writeFileSync(join(root, card.out), png)
  console.log(`${card.out}: ${png.length} bytes`)
}
