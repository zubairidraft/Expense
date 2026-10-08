import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { AccountProvider } from './context/AccountContext'
import { CategoryProvider } from './context/CategoryContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <WorkspaceProvider>
        <AccountProvider>
          <CategoryProvider>
            <App />
          </CategoryProvider>
        </AccountProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </StrictMode>,
)
