import type { ReactNode } from 'react'
import measured from '../../../../docs/data/bundle-sizes.json'

/*
 * The install-size table shared by every comparison page (docs/SEO_WORKPLAN.md
 * 3.1). Every number comes from `docs/data/bundle-sizes.json`, written by
 * `scripts/compare-bundles.mjs`, so no page types a byte count by hand and a
 * rerun of the script updates all four pages at once.
 */

export interface SizeRow {
  readonly id: string
  readonly label: string
  readonly package: string
  readonly version: string
  readonly minBytes: number | null
  readonly gzipBytes: number | null
  readonly license: string | null
  readonly peerReact: string | null
  readonly error: string | null
}

const ROWS = measured.results as readonly SizeRow[]

/** The date the committed run was measured, for the sentence next to the table. */
export const measuredOn: string = measured.measuredOn

/** The bundler the run used, for the sentence next to the table. */
export const bundler: string = measured.method.bundler

/** 1 KB is 1024 bytes. Every page that prints one of these says so. */
export const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`

/** One measured row, by id. Throws at build time rather than rendering a blank cell. */
export function sizeRow(id: string): SizeRow {
  const found = ROWS.find((row) => row.id === id)
  if (found === undefined) throw new Error(`No bundle-size row with id ${id}`)
  return found
}

/** Gzipped bytes of a row, or `null` if that row failed to build. */
const gzip = (id: string): number | null => sizeRow(id).gzipBytes

/**
 * The gzipped difference between two rows, as `1.3 KB`, with no sign and no
 * adjective. The page states which way round it goes.
 */
export function gzipDifference(a: string, b: string): string {
  const left = gzip(a)
  const right = gzip(b)
  if (left === null || right === null) throw new Error(`Cannot compare ${a} with ${b}`)
  return kb(Math.abs(left - right))
}

export interface CompareTableProps {
  /** Row ids from `docs/data/bundle-sizes.json`, in the order to print them. */
  readonly ids: readonly string[]
  /** Caption above the table. */
  readonly caption?: string
  /** Print the license and peer `react` range columns. */
  readonly licenses?: boolean
}

/**
 * Minified and gzipped bytes for one import of each named package.
 *
 * React and React DOM are external in every row, so no row includes them, and
 * CSS is measured separately and never added into the JavaScript number.
 */
export default function CompareTable({
  ids,
  caption,
  licenses = false,
}: CompareTableProps): ReactNode {
  const rows = ids.map(sizeRow)
  return (
    <figure>
      {caption !== undefined && <figcaption>{caption}</figcaption>}
      <table>
        <thead>
          <tr>
            <th>Import</th>
            <th>Version</th>
            <th>Minified</th>
            <th>Gzipped</th>
            {licenses && <th>License</th>}
            {licenses && <th>Peer react</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.label}</td>
              <td>{row.version}</td>
              <td>{row.minBytes === null ? row.error : kb(row.minBytes)}</td>
              <td>{row.gzipBytes === null ? row.error : kb(row.gzipBytes)}</td>
              {licenses && <td>{row.license ?? 'unstated'}</td>}
              {licenses && <td>{row.peerReact ?? 'unstated'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
