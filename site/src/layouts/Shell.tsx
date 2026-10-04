import type { ReactNode } from 'react'
import { usePage } from '../app/page-context'
import { NAVBAR } from '../app/navigation'
import { MoonIcon, SunIcon } from '../components/icons'
import { useTheme } from '../lib/useTheme'
import '../css/documents.css'

export interface ShellProps {
  readonly children: ReactNode
  readonly className?: string
  readonly menu?: ReactNode
}

/** One quiet frame for documents, examples, and the diagram canvas. */
export default function Shell({ children, className, menu }: ShellProps): ReactNode {
  const route = usePage()?.route
  const { toggle } = useTheme()
  return <div className="document-site">
    <a className="document-skip" href="#page-content">Skip to content</a>
    <header className="site-header">
      <div className="site-navigation">
        <a className="site-wordmark" href="/" aria-label="React Markdown Kit home"><img className="site-logo-light" src="/img/logo.svg" alt="" width="28" height="28" /><img className="site-logo-dark" src="/img/logo-dark.svg" alt="" width="28" height="28" /> Markdown Kit</a>
        <nav aria-label="Main navigation">
          {NAVBAR.map(link => <a key={link.href} href={link.href} aria-current={route === link.href || (link.label === 'Docs' && route?.startsWith('/docs/')) ? 'page' : undefined}>{link.label}</a>)}
        </nav>
        <button className="site-theme" onClick={toggle} aria-label="Switch between dark and light mode" title="Switch theme">
          <SunIcon className="hidden size-4 [html[data-theme=light]_&]:inline" />
          <MoonIcon className="hidden size-4 [html[data-theme=dark]_&]:inline" />
        </button>
      </div>
    </header>
    {menu ? (
      <div className="document-frame">
        <aside className="document-directory">{menu}</aside>
        <div id="page-content" className={className} tabIndex={-1}>{children}</div>
      </div>
    ) : (
      <div id="page-content" className={className} tabIndex={-1}>{children}</div>
    )}
    <footer className="site-footer">
      <span>React Markdown Kit · MIT</span>
      <nav aria-label="Resources">
        <a href="/docs/getting-started">Docs</a>
        <a href="/compare">Comparisons</a>
        <a href="/migrate-from-react-markdown">Migration</a>
        <a href="https://github.com/mahuzedada/react-markdown-kit">GitHub ↗</a>
      </nav>
    </footer>
  </div>
}
