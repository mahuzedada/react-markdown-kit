/*
 * Runs `@zuilib/tokens/contrast`, the tokens package's own WCAG pair checks,
 * against ../shared/foundry.css in both modes. Text pairs must reach 4.5:1 and
 * ui pairs 3:1. The three hairline borders (`--border`, `--input`,
 * `--sidebar-border`) are decorative and expected to fail, exactly as the
 * tokens package lists them in its own contrast-exceptions.json.
 *
 *   node scripts/check-theme-contrast.mjs [-v]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { allPairs, pairRatio, parseColor } from '@zuilib/tokens/contrast'
import contract from '@zuilib/tokens/tokens.json' with { type: 'json' }

const DECORATIVE = new Set(['--border', '--input', '--sidebar-border'])

const css = readFileSync(fileURLToPath(new URL('../../shared/foundry.css', import.meta.url)), 'utf8')
const blocks = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => [m[1].trim(), m[2]])
const read = sel =>
  Object.fromEntries(
    [...blocks.find(b => b[0].startsWith(sel))[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]),
  )
const light = read(':root')
const dark = read("[data-theme='dark']")

const resolve = (map, name, mode) => {
  let v = map[name] ?? (mode === 'dark' ? light[name] : undefined) ?? contract[name]?.[mode]
  while (v && /^var\(/.test(v)) v = resolve(map, v.slice(4, -1).trim(), mode)
  return v
}

const verbose = process.argv.includes('-v')
let failures = 0
for (const mode of ['light', 'dark']) {
  const map = mode === 'light' ? light : dark
  const val = n => parseColor(resolve(map, n, mode), mode)
  const page = val('--background')
  for (const pair of allPairs(contract)) {
    const fg = val(pair.fg)
    const bg = val(pair.bg)
    if (!fg || !bg) {
      failures++
      console.log(`FAIL ${mode} unparsable colour in ${pair.fg} on ${pair.bg}`)
      continue
    }
    const { ratio } = pairRatio(pair, { page, bg, fg })
    const passes = ratio >= pair.threshold
    const expected = !passes && pair.kind === 'ui' && DECORATIVE.has(pair.fg)
    if (!passes && !expected) failures++
    if (verbose || (!passes && !expected)) {
      const tag = passes ? 'ok  ' : expected ? 'warn' : 'FAIL'
      console.log(`${tag} ${mode.padEnd(5)} ${pair.kind.padEnd(7)} ${pair.fg} on ${pair.bg}: ${ratio.toFixed(2)} (needs ${pair.threshold})`)
    }
  }
}
console.log(failures ? `${failures} pair(s) below threshold` : 'every text pair passes; hairline borders are decorative')
process.exit(failures ? 1 : 0)
