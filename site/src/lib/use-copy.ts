import { useCallback, useEffect, useRef, useState } from 'react'

export const COPIED_MS = 1500

export interface Copier {
  readonly copied: string | undefined
  readonly blocked: string | undefined
  readonly copy: (key: string, text: string) => Promise<boolean>
  readonly done: (key: string) => void
}

export function useCopy(): Copier {
  const [copied, setCopied] = useState<string | undefined>(undefined)
  const [blocked, setBlocked] = useState<string | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const done = useCallback((key: string): void => {
    setBlocked(undefined)
    setCopied(key)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(undefined), COPIED_MS)
  }, [])

  const copy = useCallback(
    async (key: string, text: string): Promise<boolean> => {
      try {
        if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('No clipboard')
        await navigator.clipboard.writeText(text)
        done(key)
        return true
      } catch {
        setCopied(undefined)
        setBlocked(key)
        return false
      }
    },
    [done],
  )

  return { copied, blocked, copy, done }
}
