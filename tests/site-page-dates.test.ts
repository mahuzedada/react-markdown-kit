import { describe, expect, it } from 'vitest'
import { pageLastUpdated } from '../site/vite/pages'

describe('Markdown document modification dates', () => {
  const fallback = '2026-09-29'

  it('includes a content-only edit in the page date used by the sitemap', () => {
    const dates = new Map([
      ['src/pages/markdown-editor.tsx', '2026-09-20'],
      ['src/content/editor.md', '2026-09-25'],
      ['src/content/slides.md', '2026-09-28'],
    ])
    expect(pageLastUpdated('src/pages/markdown-editor.tsx', dates, fallback)).toBe('2026-09-25')
  })

  it('keeps a newer page date and does not refresh dates on every build', () => {
    const dates = new Map([
      ['src/pages/index.tsx', '2026-09-27'],
      ['src/content/home.md', '2026-09-25'],
      ['docs/getting-started.mdx', '2026-09-20'],
    ])
    expect(pageLastUpdated('src/pages/index.tsx', dates, fallback)).toBe('2026-09-27')
    expect(pageLastUpdated('docs/getting-started.mdx', dates, fallback)).toBe('2026-09-20')
    expect(pageLastUpdated('src/pages/index.tsx', new Map(), fallback)).toBe(fallback)
  })
})
