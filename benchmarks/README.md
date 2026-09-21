# Benchmarks

Engineering gates, not marketing claims (spec 12.4, 14.3). Nothing here is
published as a comparison without the methodology note the runner prints.

```bash
node benchmarks/run.mjs          # human readable
node benchmarks/run.mjs --json   # machine readable
node benchmarks/run.mjs --write  # also record the medians in docs/data/benchmarks.json
```

Every ratio, median and byte count quoted on a public page is checked against
`docs/data/benchmarks.json`, `docs/data/bundle-sizes.json` and
`docs/data/mermaid-size.json` by `tests/published-figures.test.ts`. After a
`--write` run the test lists every sentence still quoting the old numbers.

Benchmarks run against the **built** package in `packages/renderer/dist`, the
same artifact a consumer installs, not against source.

## Methodology

- Same process, five warm-up calls before timing, median of the iteration count
  printed per row.
- `renderToStaticMarkup` on the server, so the numbers measure the library
  rather than a DOM.
- **Both sides parse the same dialect.** The kit gets `gfm()` and the baseline
  gets `remark-gfm`. This matters more than anything else on the list: an
  earlier revision of this harness gave the kit GFM and the baseline plain
  CommonMark, which made the kit look 2.2x slower purely because it was doing
  strictly more parsing work. Any comparison that does not state the dialect on
  both sides should be distrusted.
- Baseline is `react-markdown@10.1.0`, pinned in the root `devDependencies`.

## Results on the reference machine

Apple M4 Max, 14 cores, Node 24.17. Ratios are kit ÷ baseline, so below 1.00 is
faster.

| Document | Kit median | Baseline median | Ratio |
| --- | ---: | ---: | ---: |
| 1 KB | 2.69 ms | 2.23 ms | 1.21x |
| 10 KB | 16.22 ms | 16.25 ms | 1.00x |
| 100 KB | 206.96 ms | 233.36 ms | 0.89x |

Parity at 10 KB and faster at 100 KB. **The 1 KB case misses the within-10%
target and is a known open item**: it is fixed per-render cost, not a scaling
problem, and it is dominated by constructing the unified processor and the
policy walk on every render. The fix is to cache the processor per resolved
configuration. Tracked, not yet done.

## Precompiled documents

| Path | 10 KB median |
| --- | ---: |
| From a source string | 16.80 ms |
| From a precompiled `MarkdownDocument` | 5.99 ms |

2.8x faster to re-render, because parsing is about two thirds of the work and
`compileMarkdown` does it once. This is the architectural payoff of the shared
document contract, and it is the path the template engine already uses.

## Adversarial inputs

These exist to prove termination, not speed: deeply nested blockquotes, long
emphasis runs, unclosed emphasis, a 400-column table row, thousands of links,
and a 10,000-character backslash run. All complete in roughly 100 ms or less.
No input in the corpus causes quadratic behaviour.

## Bundle sizes

`scripts/compare-bundles.mjs` measures what a browser downloads for one import
of the kit and of each competitor. It is a separate harness from `run.mjs`
because it needs the network: every package, including the kit's own, is
installed from a tarball into a temporary directory, then bundled by the
esbuild that ships under Vite.

```bash
pnpm size:bundles                                  # refresh docs/data/bundle-sizes.json
node scripts/compare-bundles.mjs --only=kit-renderer,react-markdown
node scripts/compare-bundles.mjs --date=2026-09-20 # otherwise HEAD's commit date
```

The output is `docs/data/bundle-sizes.json`, committed so docs pages can read
it. Every row carries the version measured, the entry expression bundled, the
minified and gzipped bytes, the license, the peer `react` range and whether the
package ships types. A package that fails to install or bundle gets an `error`
string instead of a number.

Method, which any published table has to state alongside the numbers:

- esbuild, ESM, `platform: browser`, `target: es2020`, minified, tree shaken.
- `react` and `react-dom` are external. An app pays for them once whichever
  library it picks.
- `process.env.NODE_ENV` is defined as `production`, so development-only
  warnings are dropped, as in a real app build.
- Gzip is `node:zlib` at level 9. CSS is counted separately and is not added
  into the JS number.
- The kit is measured twice, with and without the GFM preset, because GFM sits
  behind the `@react-markdown-kit/renderer/gfm` export.

Results from the committed run of 2026-09-20, gzipped:

| Import | Version | Gzip |
| --- | --- | ---: |
| `markdown-to-jsx` | 9.10.3 | 27.8 kB |
| `react-markdown` | 10.1.0 | 35.5 kB |
| `@react-markdown-kit/renderer` | 0.1.0 | 36.8 kB |
| `react-markdown` + `remark-gfm` | 10.1.0 | 46.4 kB |
| `@react-markdown-kit/renderer` + GFM | 0.1.0 | 48.5 kB |
| `@milkdown/react` + preset-commonmark | 7.22.1 | 104.9 kB |
| `@react-markdown-kit/editor` | 0.1.0 | 110.3 kB |
| `streamdown` | 2.6.0 | 152.2 kB |
| `@mdxeditor/editor` | 4.2.5 | 163.1 kB |

**The renderer is larger than react-markdown, not smaller**: 1.3 kB gzip more
on CommonMark and 2.1 kB more with GFM. Both parse with micromark, so the
difference is the kit's document contract and policy layer, not the parser.
Size is not a reason to switch renderers today, and no page should claim it is.
The editor comparison is the other way round: 110.3 kB against 163.1 kB for
`@mdxeditor/editor`, with `@milkdown/react` 5.4 kB below the kit.

## What is not measured yet

- Editor input-to-paint latency (spec 12.4 sets a 50 ms p95 target on a 10,000
  character document). Needs the editor package to land.
- Browser rendering, as opposed to server rendering.
