import sites from '../../shared/sites.json'
import { shareUrl as linkTo } from '../../shared/share'

/*
 * The Mermaid demo's share surface (docs/SEO_WORKPLAN.md, milestone D items 2
 * and 3). The hash format and its codec are shared by every demo and live in
 * `public-sites/shared/share.ts`; what a Mermaid link is used for, the badge
 * and the embed, lives here.
 */

export {
  COMPRESSED_PREFIX,
  PLAIN_PREFIX,
  decodeShareHash,
  encodeShareHash,
  isShareHash,
} from '../../shared/share'
import { encodeShareHash } from '../../shared/share'

/** The badge a README links to this editor with, served from public/. */
export const BADGE_URL = `${sites.mermaidDemo}/badge.svg`

/** The link to open `hash` in the editor at `base` (an origin plus path, no query). */
export function shareUrl(hash: string, base: string = `${sites.mermaidDemo}/`): string {
  return linkTo(hash, base)
}

/** The Markdown a README pastes: the badge, linking to the editor with the diagram in the hash. */
export function badgeMarkdown(link: string): string {
  return `[![Open in visual editor](${BADGE_URL})](${link})`
}

/** The iframe a blog post or docs page pastes: the editor without the site chrome. */
export function embedHtml(link: string, width = '100%', height = '520'): string {
  const url = new URL(link)
  url.searchParams.set('embed', '1')
  return `<iframe src="${url.href}" width="${width}" height="${height}" style="border:0" title="Mermaid visual editor" loading="lazy"></iframe>`
}

/**
 * mermaid.live's hash carries a JSON editor state (`{"code": …, "mermaid":
 * …}`) rather than bare source, so a link copied from there and pointed at
 * this host still opens: the code is lifted out of the state. Bare source
 * passes through untouched.
 */
export function sourceFromShared(payload: string): string {
  const trimmed = payload.trimStart()
  if (!trimmed.startsWith('{')) return payload
  try {
    const state: unknown = JSON.parse(trimmed)
    if (typeof state === 'object' && state !== null && typeof (state as { code?: unknown }).code === 'string') {
      return (state as { code: string }).code
    }
  } catch {
    // Not JSON after all: it is source that happens to start with a brace.
  }
  return payload
}

/** The same diagram opened on mermaid.live, in the state form its editor reads. */
export async function mermaidLiveUrl(code: string): Promise<string> {
  const state = JSON.stringify({ code, mermaid: '{\n  "theme": "default"\n}', autoSync: true, updateDiagram: true })
  return `https://mermaid.live/edit#${await encodeShareHash(state)}`
}

/**
 * The three-node flowchart the landing page's badge example links to, with
 * its layout annotation. `EXAMPLE_HASH` is `encodeShareHash(EXAMPLE_SOURCE)`
 * as Node's zlib produced it; tests/mermaid-share.test.ts decodes it back.
 */
export const EXAMPLE_SOURCE = `flowchart LR
    web[Web App] -->|REST| api[API]
    api --> db[(Postgres)]
    style web fill:#a5d8ff,stroke:#1971c2
    %% rmk-layout v1 {"canvasHeight":220,"nodes":{"web":{"x":40,"y":60,"width":160,"height":90},"api":{"x":280,"y":60,"width":160,"height":90},"db":{"x":520,"y":60,"width":160,"height":90}}}`

export const EXAMPLE_HASH = 'pako:eJyNzMFrwjAUBvD7_orHK4KDFNqgm-Yw6EFw4EF0sEPpIWlSG5qZ0GTWov3fpc6dt9N78P2-rzK2K2veBtjsngAAOiXyTyUgc66AOH677lb7jytwp_Ns-17cDXd6jECKfLq1Phxa5Z9_Ih96o8YRqLQxLOJzuagq4kNrG8WidPmalvQuJxNov5rY8N5-BzilcMGSH0_cr5U-1AEZpQnBo5XKI7tgp8R4zshmCcEe2UtCsNMy1MjS8a8ftWUyEOROPzRd_IPL3-05_VMPww18tFoi'
