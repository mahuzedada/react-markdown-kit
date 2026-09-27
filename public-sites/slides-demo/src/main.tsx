import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SiteActivity } from '../../shared/Activity'

import '../../shared/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteActivity site="slides" dev={import.meta.env.DEV}>
      <App />
    </SiteActivity>
  </StrictMode>,
)
