import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Auto-update PWA: detecta nuevo deploy y recarga silenciosamente
let _deployVersion = null
async function checkVersion() {
  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const r = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const { v } = await r.json()
    if (_deployVersion === null) { _deployVersion = v; return }
    if (v !== _deployVersion) window.location.reload()
  } catch {}
}
checkVersion()
setInterval(checkVersion, 5 * 60 * 1000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
