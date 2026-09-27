/// <reference types="vite/client" />

declare module 'virtual:pages' {
  const pages: readonly import('../../vite/pages').PageEntry[]
  export default pages
}

declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const Content: ComponentType<{ components?: object }>
  export default Content
}
