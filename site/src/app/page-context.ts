import { createContext, useContext } from 'react'
import type { PageEntry } from './routes'

export const PageContext = createContext<PageEntry | undefined>(undefined)

/** The page being rendered: its route, kind and front matter. The 404 page has none. */
export function usePage(): PageEntry | undefined {
  return useContext(PageContext)
}
