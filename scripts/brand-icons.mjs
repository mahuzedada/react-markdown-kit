#!/usr/bin/env node
/**
 * Writes every logo and favicon file of the six public sites from the one
 * master drawing, `public-sites/shared/brand/logo.svg`. Run again after
 * changing that file: `node scripts/brand-icons.mjs`, then
 * `node scripts/social-cards.mjs`, whose cards draw the same logo.
 *
 * Per site: logo.svg and favicon.svg (the master), favicon.ico (16, 32, 48),
 * apple-touch-icon.png (180, on white, because iOS fills transparency with
 * black), icon-192.png and icon-512.png, and site.webmanifest naming them.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logo = readFileSync(join(root, 'public-sites/shared/brand/logo.svg'), 'utf8')

// `dir` is the site's static root; `svgDir` is where logo.svg and favicon.svg
// live (the docs site keeps them under img/ for Docusaurus).
const SITES = [
  { dir: 'public-sites/home/public', name: 'React Markdown Kit' },
  { dir: 'public-sites/docs/static', svgDir: 'img', name: 'React Markdown Kit docs', shortName: 'RMK docs' },
  { dir: 'public-sites/renderer-demo/public', name: 'React Markdown Renderer', shortName: 'Renderer' },
  { dir: 'public-sites/editor-demo/public', name: 'Markdown Editor', shortName: 'Editor' },
  { dir: 'public-sites/mermaid-demo/public', name: 'Mermaid Visual Editor', shortName: 'Mermaid' },
  { dir: 'public-sites/slides-demo/public', name: 'Markdown Slides', shortName: 'Slides' },
]

function png(size, { background, padding = 0 } = {}) {
  const inner = size - padding * 2
  const body = logo.slice(logo.indexOf('>') + 1, logo.lastIndexOf('</svg>'))
  const viewBox = /viewBox="([^"]+)"/.exec(logo)[1]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + (background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '')
    + `<svg x="${padding}" y="${padding}" width="${inner}" height="${inner}" viewBox="${viewBox}">${body}</svg></svg>`
  return new Resvg(svg).render().asPng()
}

// An ICO holding PNG images, which every current browser reads.
function ico(sizes) {
  const images = sizes.map((size) => png(size))
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach((image, i) => {
    const entry = 6 + 16 * i
    header.writeUInt8(sizes[i] % 256, entry)
    header.writeUInt8(sizes[i] % 256, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(image.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })
  return Buffer.concat([header, ...images])
}

function manifest({ name, shortName = name }) {
  return JSON.stringify({
    name,
    short_name: shortName,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#2d72d2',
    background_color: '#ffffff',
    display: 'browser',
  }, null, 2) + '\n'
}

const files = {
  'favicon.ico': ico([16, 32, 48]),
  'apple-touch-icon.png': png(180, { background: '#ffffff', padding: 18 }),
  'icon-192.png': png(192),
  'icon-512.png': png(512),
}

for (const site of SITES) {
  const write = (path, data) => {
    writeFileSync(join(root, site.dir, path), data)
    console.log(`${site.dir}/${path}: ${data.length} bytes`)
  }
  const svgDir = site.svgDir ? `${site.svgDir}/` : ''
  write(`${svgDir}logo.svg`, logo)
  write(`${svgDir}favicon.svg`, logo)
  for (const [path, data] of Object.entries(files)) write(path, data)
  write('site.webmanifest', manifest(site))
}
