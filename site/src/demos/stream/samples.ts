/**
 * The document the demo streams: the constructs that break in a naive
 * streaming renderer (an open fence, half-written emphasis, a table stopped
 * mid row, a link with no closing bracket), in the order a chat reply would
 * write them.
 */
export const SAMPLE = `# Deploy checklist

Here's what I'd check before the **Friday release**. Most of it is quick, but
the migration step takes a while, so *start that one first*.

## Steps

1. Run the migration on staging
2. Compare row counts against production
   - \`orders\` should match exactly
   - \`events\` can lag by a few minutes
3. Flip the feature flag

- [x] Changelog written
- [ ] Rollback plan reviewed

## Migration

\`\`\`sql
ALTER TABLE orders
  ADD COLUMN region text NOT NULL DEFAULT 'us-east';

CREATE INDEX CONCURRENTLY orders_region_idx ON orders (region);
\`\`\`

> \`CREATE INDEX CONCURRENTLY\` can't run inside a transaction, so run it by hand.

## Timing

| Step | Staging | Production |
| --- | ---: | ---: |
| Migration | 4 min | ~25 min |
| Index build | 1 min | ~8 min |
| Flag flip | instant | instant |

## Flow

\`\`\`mermaid
flowchart LR
  A[Migrate] --> B{Counts match?}
  B -->|yes| C[Flip flag]
  B -->|no| D[Roll back]
\`\`\`

The full runbook is in [the ops wiki](https://example.com/runbooks/deploy) if
anything above ~~looks off~~ doesn't match what you see.
`
