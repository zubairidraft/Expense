import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { AccountProvider } from './context/AccountContext'
import { CategoryProvider } from './context/CategoryContext'
import { TransactionProvider } from './context/TransactionContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <WorkspaceProvider>
        <AccountProvider>
          <CategoryProvider>
            <TransactionProvider>
              <App />
            </TransactionProvider>
          </CategoryProvider>
        </AccountProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </StrictMode>,
)

