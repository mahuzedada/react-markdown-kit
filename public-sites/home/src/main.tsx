import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

import '@zuilib/tokens/tokens.css'
import '../../shared/foundry.css'
import '../../shared/demo.css'
import './home.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
