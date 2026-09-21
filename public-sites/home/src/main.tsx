import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SiteActivity } from '../../shared/Activity'

import '@zuilib/primitives/zui-no-preflight.css'
import '../../shared/foundry.css'
import '../../shared/demo.css'
import './home.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteActivity site="home" dev={import.meta.env.DEV}>
      <App />
    </SiteActivity>
  </StrictMode>,
)
