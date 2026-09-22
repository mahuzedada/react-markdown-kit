#!/usr/bin/env node
/**
 * Renders the 1200x630 PNG social card of each public site. Social crawlers
 * do not render SVG, so the PNGs are committed and referenced as `og:image`.
 * Run again after changing a title here: `node scripts/social-cards.mjs`.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const CARDS = [
  {
    out: 'public-sites/home/public/social-card.png',
    title: 'React Markdown Kit',
    lines: ['Render Markdown. Add editing.', 'Mermaid diagrams and slides, in React.'],
    host: 'reactmarkdownkit.com',
  },
  {
    out: 'public-sites/docs/static/img/social-card.png',
    title: 'React Markdown Kit docs',
    lines: ['Renderer, editor, templates,', 'Mermaid and slides for React.'],
    host: 'docs.reactmarkdownkit.com',
  },
  {
    out: 'public-sites/renderer-demo/public/social-card.png',
    title: 'React Markdown Renderer',
    lines: ['Paste Markdown, switch every option,', 'copy the code that made the output.'],
    host: 'renderer.reactmarkdownkit.com',
  },
  {
    out: 'public-sites/editor-demo/public/social-card.png',
    title: 'Free Online Markdown Editor',
    lines: ['Rich, source and preview modes.', 'Plain Markdown in, plain Markdown out.'],
    host: 'editor.reactmarkdownkit.com',
  },
  {
    out: 'public-sites/mermaid-demo/public/social-card.png',
    title: 'Free Mermaid Visual Editor',
    lines: ['Flowcharts on a canvas, sequence diagrams as SVG.', 'Get plain Mermaid syntax back.'],
    host: 'mermaid.reactmarkdownkit.com',
  },
  {
    out: 'public-sites/slides-demo/public/social-card.png',
    title: 'Markdown Slides Editor',
    lines: ['Write the deck as Markdown.', 'Present it from the browser.'],
    host: 'slides.reactmarkdownkit.com',
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
  <rect x="64" y="64" width="72" height="72" rx="16" fill="#2d72d2"/>
  <path d="M78 118V82h9l9.6 13.2L106.2 82h9v36h-9V96.4l-6.6 9h-2.7l-6.6-9V118z" fill="#fff"/>
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
