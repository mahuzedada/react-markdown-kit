#!/usr/bin/env node
/**
 * Tells the IndexNow search engines (Bing, Yandex, Seznam, Naver, Yep) which
 * pages of reactmarkdownkit.com are new or changed. Run after a deploy;
 * `make deploy` does. Google does not read IndexNow; it reads the sitemap.
 *
 * It reads the live sitemap, so it only ever submits what is deployed, and
 * compares each URL's lastmod with the last run, kept in `.indexnow.json`
 * (gitignored). A URL is submitted when it is new or its lastmod moved, or
 * when it left the sitemap, so the engines recrawl it and find its 301 or
 * 404. A first run, or a machine without the file, submits the whole sitemap
 * once.
 *
 *   node scripts/indexnow.mjs            submit new and changed URLs
 *   node scripts/indexnow.mjs --dry-run  list them, submit nothing
 *   node scripts/indexnow.mjs --all      submit every URL in the sitemap
 *
 * The key is the name and content of site/static/<key>.txt, served at the
 * site root, which is how the engines check the submitter owns the host.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOST = 'reactmarkdownkit.com'
const SITEMAP = `https://${HOST}/sitemap.xml`
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const STATE = join(root, '.indexnow.json')

const dryRun = process.argv.includes('--dry-run')
const all = process.argv.includes('--all')

function readKey() {
  const dir = join(root, 'site/static')
  const files = readdirSync(dir).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name))
  if (files.length !== 1) throw new Error(`expected one IndexNow key file in site/static, found ${files.length}`)
  const key = files[0].slice(0, -'.txt'.length)
  if (readFileSync(join(dir, files[0]), 'utf8').trim() !== key) throw new Error(`${files[0]} must contain its own name`)
  return key
}

/** `{ url: lastmod }` for every `<url>` in the sitemap; lastmod is '' when absent. */
function parseSitemap(xml) {
  const entries = {}
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1]
    if (loc) entries[loc] = /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1] ?? ''
  }
  return entries
}

const key = readKey()
const keyLocation = `https://${HOST}/${key}.txt`

const liveKey = await fetch(keyLocation).then((response) => (response.ok ? response.text() : ''))
if (liveKey.trim() !== key) {
  console.error(`indexnow: ${keyLocation} does not serve the key yet; deploy first`)
  process.exit(1)
}

const response = await fetch(SITEMAP)
if (!response.ok) {
  console.error(`indexnow: ${SITEMAP} answered ${response.status}`)
  process.exit(1)
}
const current = parseSitemap(await response.text())
const previous = !all && existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {}
const changed = Object.keys(current).filter((url) => previous[url] !== current[url])
const removed = Object.keys(previous).filter((url) => !(url in current))

if (changed.length === 0 && removed.length === 0) {
  console.log('indexnow: nothing new, changed or removed')
  process.exit(0)
}
console.log(`indexnow: ${changed.length} of ${Object.keys(current).length} URLs new or changed, ${removed.length} removed`)
for (const url of changed) console.log(`  ${url}`)
for (const url of removed) console.log(`  ${url} (removed)`)
if (dryRun) process.exit(0)

const submit = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation, urlList: [...changed, ...removed] }),
})
// 200 and 202 both mean accepted; 202 while the engine still checks the key.
if (submit.status !== 200 && submit.status !== 202) {
  console.error(`indexnow: submission answered ${submit.status} ${await submit.text()}`)
  process.exit(1)
}
writeFileSync(STATE, `${JSON.stringify(current, null, 2)}\n`)
console.log(`indexnow: submitted (HTTP ${submit.status})`)
