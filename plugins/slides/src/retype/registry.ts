/** The retyper for each root node type. A node type without one is left alone. */
import { retypeCode } from './code.js'
import { retypeContainer } from './container.js'
import { retypeHeading } from './heading.js'
import { retypeHtml } from './html.js'
import { retypeParagraph } from './paragraph.js'
import type { Retyper } from './retyper.js'
import { retypeThematicBreak } from './thematic-break.js'

export const RETYPERS: ReadonlyMap<string, Retyper> = new Map(Object.entries({
  thematicBreak: retypeThematicBreak,
  heading: retypeHeading,
  html: retypeHtml,
  paragraph: retypeParagraph,
  list: retypeContainer,
  blockquote: retypeContainer,
  code: retypeCode,
}))
