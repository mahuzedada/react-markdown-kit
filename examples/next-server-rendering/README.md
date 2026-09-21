# Next.js server rendering

Two things this example exists to prove:

**The renderer is a server component.** `app/page.tsx` reads a file with
`node:fs` and renders Markdown, with no `"use client"` anywhere. The renderer
entry carries no client directive, so React never pulls it across the
server/client boundary. The Markdown rendering ships zero JavaScript to the
browser.

**Precompiling pays.** `app/precompiled.tsx` compiles at module scope and
renders from the document per request. Parsing is about two thirds of the work, so
this is about 2.8x faster to re-render. The document is plain JSON, so it can
also come from a build step or a cache.

The editor is the opposite case: it is interactive, so it is a client
component. That is why it lives in a different package. Installing the renderer
never drags editor code into a server bundle, and `tests/packaging.test.ts`
asserts it.
