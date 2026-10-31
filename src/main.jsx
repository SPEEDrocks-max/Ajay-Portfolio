import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root'))
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const application = isAdminRoute ? import('./admin/AdminApp.jsx') : import('./App.jsx')

application.then(({ default: App }) => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}).catch((error) => {
  console.error('Application could not be loaded.', error)
  root.render(<main role="alert">This page could not be loaded. Please refresh and try again.</main>)
})
