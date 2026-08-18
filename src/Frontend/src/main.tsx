import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { SemesterProvider } from './context/SemesterContext.tsx'
import { AppToaster } from './components/AppToaster.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SemesterProvider>
        <App />
        <AppToaster />
      </SemesterProvider>
    </AuthProvider>
  </StrictMode>,
)
