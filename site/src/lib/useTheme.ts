import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function readTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable; the attribute alone is enough for this visit.
  }
}

export interface ThemeState {
  readonly theme: Theme
  readonly toggle: () => void
}

/**
 * The colour mode, read from `<html data-theme>` after mount (the head
 * script in src/app/theme-script.ts sets it before paint) and written back
 * with the choice remembered. Any control on a page can toggle it, such as a
 * demo's own header; the navbar toggle writes the same attribute and key.
 */
export function useTheme(): ThemeState {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(readTheme())
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const toggle = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return { theme, toggle }
}
