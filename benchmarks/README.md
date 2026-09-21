# Benchmarks

Engineering gates, not marketing claims (spec 12.4, 14.3). Nothing here is
published as a comparison without the methodology note the runner prints.

```bash
node benchmarks/run.mjs          # human readable
node benchmarks/run.mjs --json   # machine readable
```

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

2.8x faster to re-render, because parsing is roughly 80% of the work and
`compileMarkdown` does it once. This is the architectural payoff of the shared
document contract, and it is the path the template engine already uses.

## Adversarial inputs

These exist to prove termination, not speed: deeply nested blockquotes, long
emphasis runs, unclosed emphasis, a 400-column table row, thousands of links,
and a 10,000-character backslash run. All complete in roughly 100 ms or less.
No input in the corpus causes quadratic behaviour.

## What is not measured yet

- Bundle size against the baseline. The renderer's built JS is about 24 kB
  unminified across three chunks; a like-for-like compressed comparison needs a
  real bundler run and is not done.
- Editor input-to-paint latency (spec 12.4 sets a 50 ms p95 target on a 10,000
  character document). Needs the editor package to land.
- Browser rendering, as opposed to server rendering.
