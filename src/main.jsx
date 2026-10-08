import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { AccountProvider } from './context/AccountContext'
import { CategoryProvider } from './context/CategoryContext'
import { TransactionProvider } from './context/TransactionContext'
import { RuleProvider } from './context/RuleContext'
import { AttachmentProvider } from './context/AttachmentContext'
import { RecurringProvider } from './context/RecurringContext'
import { BudgetProvider } from './context/BudgetContext'
import { GoalProvider } from './context/GoalContext'
import { SharedDebtsProvider } from './context/SharedDebtsContext'
import { BusinessProvider } from './context/BusinessContext'
import { CurrencyProvider } from './context/CurrencyContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <WorkspaceProvider>
        <AccountProvider>
          <CategoryProvider>
            <TransactionProvider>
              <RuleProvider>
                <AttachmentProvider>
                  <RecurringProvider>
                    <BudgetProvider>
                      <GoalProvider>
                        <SharedDebtsProvider>
                          <BusinessProvider>
                            <CurrencyProvider>
                              <App />
                            </CurrencyProvider>
                          </BusinessProvider>
                        </SharedDebtsProvider>
                      </GoalProvider>
                    </BudgetProvider>
                  </RecurringProvider>
                </AttachmentProvider>
              </RuleProvider>
            </TransactionProvider>
          </CategoryProvider>
        </AccountProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </StrictMode>,
)


