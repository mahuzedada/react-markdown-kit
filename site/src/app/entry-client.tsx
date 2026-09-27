import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import { documentTitle, pageMeta } from './head'
import { findPage, loadPage } from './routes'
import NotFound from './NotFound'
import '../css/theme.css'

/*
 * The built pages are static HTML, so every link is a full page load: the
 * browser loads this entry, it imports the one page module, and React
 * hydrates what the server rendered. In development the root is empty and
 * the page renders here.
 */

const root = document.getElementById('root') as HTMLElement
const page = findPage(location.pathname)

if (page === undefined) {
  if (root.hasChildNodes()) hydrateRoot(root, <NotFound />)
  else createRoot(root).render(<NotFound />)
} else {
  void loadPage(page).then((module) => {
    const app = <App page={page} module={module} />
    if (root.hasChildNodes()) {
      hydrateRoot(root, app)
    } else {
      document.title = documentTitle(pageMeta(page, module))
      createRoot(root).render(app)
    }
  })
}
