import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { useAuth } from './context/AuthContext'
import { useAccounts } from './context/AccountContext'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'
import MobileNav from './components/layout/MobileNav'
import AuthModal from './components/auth/AuthModal'
import ProfileSettingsModal from './components/profile/ProfileSettingsModal'
import CreateWorkspaceModal from './components/workspace/CreateWorkspaceModal'
import WorkspaceMembersModal from './components/workspace/WorkspaceMembersModal'
import AccountsView from './components/accounts/AccountsView'
import CreateAccountModal from './components/accounts/CreateAccountModal'
import CategoriesView from './components/categories/CategoriesView'
import CreateCategoryModal from './components/categories/CreateCategoryModal'
import CreateMerchantModal from './components/categories/CreateMerchantModal'
import CreateTagModal from './components/categories/CreateTagModal'
import TransactionsView from './components/transactions/TransactionsView'
import CreateTransactionModal from './components/transactions/CreateTransactionModal'
import QuickAddModal from './components/transactions/QuickAddModal'
import TransferModal from './components/transactions/TransferModal'
import ReconciliationModal from './components/reconciliation/ReconciliationModal'
import RulesModal from './components/rules/RulesModal'
import ReceiptUploadModal from './components/receipts/ReceiptUploadModal'
import RecurringView from './components/recurring/RecurringView'
import CreateRecurringModal from './components/recurring/CreateRecurringModal'
import BudgetsView from './components/budgets/BudgetsView'
import CreateBudgetModal from './components/budgets/CreateBudgetModal'
import CreateGoalModal from './components/goals/CreateGoalModal'
import AllocateGoalModal from './components/goals/AllocateGoalModal'
import SharedDebtsView from './components/shared/SharedDebtsView'
import CreateSharedExpenseModal from './components/shared/CreateSharedExpenseModal'
import CreateDebtModal from './components/shared/CreateDebtModal'
import RecordDebtPaymentModal from './components/shared/RecordDebtPaymentModal'
import CreateInstallmentModal from './components/shared/CreateInstallmentModal'
import CreateContactModal from './components/shared/CreateContactModal'
import BusinessView from './components/business/BusinessView'
import CreateProjectModal from './components/business/CreateProjectModal'
import CreateCostCenterModal from './components/business/CreateCostCenterModal'
import CurrencyConverterModal from './components/currency/CurrencyConverterModal'
import ImportExportModal from './components/imports/ImportExportModal'
import AnalyticsView from './components/analytics/AnalyticsView'
import ReportsView from './components/reports/ReportsView'
import PreferencesView from './components/settings/PreferencesView'
import DashboardView from './components/dashboard/DashboardView'
import ZakatCalculatorModal from './components/regional/ZakatCalculatorModal'
import NotificationCenterModal from './components/notifications/NotificationCenterModal'
import OnboardingModal from './components/onboarding/OnboardingModal'
import AppearanceModal from './components/settings/AppearanceModal'
import './App.css'
import './styles/material.css'

// Dev-only visual annotation toolbar: never shipped to / executed in production builds
const Agentation = import.meta.env.DEV
  ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
  : null



export default function App() {
  const { user, profile } = useAuth()
  const { accounts } = useAccounts()

  // App Shell Navigation State
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'transactions' | 'accounts' | 'categories' | 'budgets' | 'analytics' | 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Modals State
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [createWsModalOpen, setCreateWsModalOpen] = useState(false)
  const [membersWsModalOpen, setMembersWsModalOpen] = useState(false)
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false)
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false)
  const [createMerchantModalOpen, setCreateMerchantModalOpen] = useState(false)
  const [createTagModalOpen, setCreateTagModalOpen] = useState(false)
  const [createTxModalOpen, setCreateTxModalOpen] = useState(false)
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false)
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false)
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [receiptDraftData, setReceiptDraftData] = useState(null)
  const [receiptTxTargetId, setReceiptTxTargetId] = useState(null)
  const [createRecurringModalOpen, setCreateRecurringModalOpen] = useState(false)
  const [createBudgetModalOpen, setCreateBudgetModalOpen] = useState(false)
  const [createGoalModalOpen, setCreateGoalModalOpen] = useState(false)
  const [allocateGoalModalOpen, setAllocateGoalModalOpen] = useState(false)
  const [selectedGoalForAlloc, setSelectedGoalForAlloc] = useState(null)
  const [createSharedExpenseModalOpen, setCreateSharedExpenseModalOpen] = useState(false)
  const [createDebtModalOpen, setCreateDebtModalOpen] = useState(false)
  const [recordDebtPaymentModalOpen, setRecordDebtPaymentModalOpen] = useState(false)
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState(null)
  const [createInstallmentModalOpen, setCreateInstallmentModalOpen] = useState(false)
  const [createContactModalOpen, setCreateContactModalOpen] = useState(false)
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false)
  const [createCostCenterModalOpen, setCreateCostCenterModalOpen] = useState(false)
  const [currencyConverterModalOpen, setCurrencyConverterModalOpen] = useState(false)
  const [importExportModalOpen, setImportExportModalOpen] = useState(false)
  const [zakatModalOpen, setZakatModalOpen] = useState(false)
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false)
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false)
  const [appearanceModalOpen, setAppearanceModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferInitialData, setTransferInitialData] = useState(null)

  const handleOpenTransfer = (opts = {}) => {
    setTransferInitialData({
      defaultFromAccountId: opts?.fromAccountId || opts?.defaultFromAccountId || '',
      defaultToAccountId: opts?.toAccountId || opts?.defaultToAccountId || '',
      editTransaction: opts?.editTransaction || null,
    })
    setTransferModalOpen(true)
  }

  const handleEditTransfer = (tx) => {
    setTransferInitialData({
      defaultFromAccountId: '',
      defaultToAccountId: '',
      editTransaction: tx,
    })
    setTransferModalOpen(true)
  }

  // Selected account for overview transaction card
  const [selectedAccountId, setSelectedAccountId] = useState('')

  // Onboarding: completion is stored on the profile (server). Skipping only hides it for this session.
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  // Mandatory onboarding for signed-in users whose profile is not yet set up
  const isMandatoryOnboarding = useMemo(() => {
    if (onboardingDismissed) return false
    if (!user) return false
    return profile.onboardingCompleted === false
  }, [user, profile.onboardingCompleted, onboardingDismissed])

  const handleCloseOnboarding = () => {
    setOnboardingDismissed(true)
    setOnboardingModalOpen(false)
  }

  useEffect(() => {
    if (isMandatoryOnboarding && !onboardingDismissed) {
      setOnboardingModalOpen(true)
    }
  }, [isMandatoryOnboarding, onboardingDismissed])

  // Synchronize default selected account
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id)
    }
  }, [accounts, selectedAccountId])

  // Global Keyboard Shortcuts (Only Ctrl+K or Cmd+K for Quick Add)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setQuickAddModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])



  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setMobileNavOpen(false)
  }

  return (
    <div className="app-shell">
      {/* Visual Annotation Toolbar for AI Agents (development only) */}
      {Agentation && (
        <Suspense fallback={null}>
          <Agentation
            endpoint={import.meta.env.VITE_AGENTATION_ENDPOINT || 'http://localhost:4747'}
            appName="Expense Tracking"
          />
        </Suspense>
      )}

      {/* Persistent Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onOpenSettings={() => setActiveTab('settings')}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onOpenCurrencyConverter={() => setCurrencyConverterModalOpen(true)}
        onOpenImportExport={() => setImportExportModalOpen(true)}
        onOpenAppearance={() => setAppearanceModalOpen(true)}
      />

      {/* Main App Container */}
      <div className="app-main-content">
        <div className="app-container">
          {/* Top Header & Workspace Switcher */}
          <Navbar
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenCreateWorkspace={() => setCreateWsModalOpen(true)}
            onOpenWorkspaceMembers={() => setActiveTab('settings')}
            onOpenQuickAdd={() => setQuickAddModalOpen(true)}
            onOpenTransfer={handleOpenTransfer}
            onOpenCurrencyConverter={() => setCurrencyConverterModalOpen(true)}
            onOpenImportExport={() => setImportExportModalOpen(true)}
            onOpenNotifications={() => setNotificationsModalOpen(true)}
            onOpenOnboarding={() => setOnboardingModalOpen(true)}
            onOpenAppearance={() => setAppearanceModalOpen(true)}
          />


          {/* View Routing Based on Active Tab */}
          {activeTab === 'overview' && (
            <DashboardView
              onNavigateTab={handleTabChange}
              onOpenOnboarding={() => setOnboardingModalOpen(true)}
              onOpenTransfer={handleOpenTransfer}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              onOpenCreateTransaction={() => {
                setReceiptDraftData(null);
                setCreateTxModalOpen(true);
              }}
              onOpenTransfer={handleOpenTransfer}
              onEditTransfer={handleEditTransfer}
              onOpenReconcile={() => setReconcileModalOpen(true)}
              onOpenRules={() => setRulesModalOpen(true)}
              onOpenReceiptScanner={(txId) => {
                setReceiptTxTargetId(txId);
                setReceiptModalOpen(true);
              }}
            />
          )}


          {activeTab === 'accounts' && (
            <AccountsView
              onOpenCreateAccount={() => setCreateAccountModalOpen(true)}
              onOpenTransfer={handleOpenTransfer}
              onEditTransfer={handleEditTransfer}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              onOpenCreateCategory={() => setCreateCategoryModalOpen(true)}
              onOpenCreateMerchant={() => setCreateMerchantModalOpen(true)}
              onOpenCreateTag={() => setCreateTagModalOpen(true)}
            />
          )}

          {activeTab === 'recurring' && (
            <RecurringView
              onOpenCreateRecurring={() => setCreateRecurringModalOpen(true)}
            />
          )}


          {activeTab === 'budgets' && (
            <BudgetsView
              onOpenCreateBudget={() => setCreateBudgetModalOpen(true)}
              onOpenCreateGoal={() => setCreateGoalModalOpen(true)}
              onOpenAllocateGoal={(goal) => {
                setSelectedGoalForAlloc(goal);
                setAllocateGoalModalOpen(true);
              }}
            />
          )}

          {activeTab === 'shared' && (
            <SharedDebtsView
              onOpenCreateSharedExpense={() => setCreateSharedExpenseModalOpen(true)}
              onOpenCreateDebt={() => setCreateDebtModalOpen(true)}
              onOpenCreateInstallment={() => setCreateInstallmentModalOpen(true)}
              onOpenCreateContact={() => setCreateContactModalOpen(true)}
              onOpenRecordPayment={(debt) => {
                setSelectedDebtForPayment(debt);
                setRecordDebtPaymentModalOpen(true);
              }}
            />
          )}

          {activeTab === 'business' && (
            <BusinessView
              onOpenCreateProject={() => setCreateProjectModalOpen(true)}
              onOpenCreateCostCenter={() => setCreateCostCenterModalOpen(true)}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              onOpenZakatModal={() => setZakatModalOpen(true)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView />
          )}

          {activeTab === 'settings' && (
            <PreferencesView />
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (<900px) */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onOpenQuickAdd={() => setQuickAddModalOpen(true)}
        onOpenMore={() => setMobileNavOpen(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Profile & Regional Settings Modal */}
      <ProfileSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onOpenOnboarding={() => setOnboardingModalOpen(true)}
      />

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={createWsModalOpen}
        onClose={() => setCreateWsModalOpen(false)}
      />

      {/* Workspace Members & Settings Modal */}
      <WorkspaceMembersModal
        isOpen={membersWsModalOpen}
        onClose={() => setMembersWsModalOpen(false)}
      />

      {/* Create Account Modal */}
      <CreateAccountModal
        isOpen={createAccountModalOpen}
        onClose={() => setCreateAccountModalOpen(false)}
      />

      {/* Create Category Modal */}
      <CreateCategoryModal
        isOpen={createCategoryModalOpen}
        onClose={() => setCreateCategoryModalOpen(false)}
      />

      {/* Create Merchant Modal */}
      <CreateMerchantModal
        isOpen={createMerchantModalOpen}
        onClose={() => setCreateMerchantModalOpen(false)}
      />

      {/* Create Tag Modal */}
      <CreateTagModal
        isOpen={createTagModalOpen}
        onClose={() => setCreateTagModalOpen(false)}
      />

      {/* Book Transaction Modal */}
      <CreateTransactionModal
        isOpen={createTxModalOpen}
        onClose={() => {
          setCreateTxModalOpen(false);
          setReceiptDraftData(null);
        }}
        initialDraft={receiptDraftData}
      />

      {/* Quick Add Speed Entry Modal */}
      <QuickAddModal
        isOpen={quickAddModalOpen}
        onClose={() => setQuickAddModalOpen(false)}
        onOpenTransfer={handleOpenTransfer}
      />

      {/* Dedicated Transfer Funds Modal */}
      <TransferModal
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false)
          setTransferInitialData(null)
        }}
        defaultFromAccountId={transferInitialData?.defaultFromAccountId}
        defaultToAccountId={transferInitialData?.defaultToAccountId}
        editTransaction={transferInitialData?.editTransaction}
      />

      {/* Statement Reconciliation Modal */}
      <ReconciliationModal
        isOpen={reconcileModalOpen}
        onClose={() => setReconcileModalOpen(false)}
      />

      {/* Auto-Categorization Rules Engine Modal */}
      <RulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />

      {/* Receipt OCR Scanner & Attachment Modal */}
      <ReceiptUploadModal
        isOpen={receiptModalOpen}
        transactionId={receiptTxTargetId}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptTxTargetId(null);
        }}
        onConfirmDraft={(draft) => {
          setReceiptDraftData(draft);
          setCreateTxModalOpen(true);
        }}
      />

      {/* Create Recurring Profile Modal */}
      <CreateRecurringModal
        isOpen={createRecurringModalOpen}
        onClose={() => setCreateRecurringModalOpen(false)}
      />

      {/* Set Category Budget Envelope Modal */}
      <CreateBudgetModal
        isOpen={createBudgetModalOpen}
        onClose={() => setCreateBudgetModalOpen(false)}
      />

      {/* Create Financial Goal Modal */}
      <CreateGoalModal
        isOpen={createGoalModalOpen}
        onClose={() => setCreateGoalModalOpen(false)}
      />

      {/* Allocate Funds to Goal Modal */}
      <AllocateGoalModal
        isOpen={allocateGoalModalOpen}
        goal={selectedGoalForAlloc}
        onClose={() => {
          setAllocateGoalModalOpen(false);
          setSelectedGoalForAlloc(null);
        }}
      />

      {/* Stage D Modals */}
      <CreateSharedExpenseModal
        isOpen={createSharedExpenseModalOpen}
        onClose={() => setCreateSharedExpenseModalOpen(false)}
        onOpenAddContact={() => setCreateContactModalOpen(true)}
      />

      <CreateDebtModal
        isOpen={createDebtModalOpen}
        onClose={() => setCreateDebtModalOpen(false)}
        onOpenAddContact={() => setCreateContactModalOpen(true)}
      />

      <RecordDebtPaymentModal
        isOpen={recordDebtPaymentModalOpen}
        debt={selectedDebtForPayment}
        onClose={() => {
          setRecordDebtPaymentModalOpen(false);
          setSelectedDebtForPayment(null);
        }}
      />

      <CreateInstallmentModal
        isOpen={createInstallmentModalOpen}
        onClose={() => setCreateInstallmentModalOpen(false)}
      />

      <CreateContactModal
        isOpen={createContactModalOpen}
        onClose={() => setCreateContactModalOpen(false)}
      />

      <CreateProjectModal
        isOpen={createProjectModalOpen}
        onClose={() => setCreateProjectModalOpen(false)}
      />

      <CreateCostCenterModal
        isOpen={createCostCenterModalOpen}
        onClose={() => setCreateCostCenterModalOpen(false)}
      />

      {/* Stage E Modals */}
      <CurrencyConverterModal
        isOpen={currencyConverterModalOpen}
        onClose={() => setCurrencyConverterModalOpen(false)}
      />

      <ImportExportModal
        isOpen={importExportModalOpen}
        onClose={() => setImportExportModalOpen(false)}
        onApplySmsDraft={(draft) => {
          setReceiptDraftData(draft);
          setCreateTxModalOpen(true);
        }}
      />

      {/* Stage F Modals */}
      <ZakatCalculatorModal
        isOpen={zakatModalOpen}
        onClose={() => setZakatModalOpen(false)}
      />

      <NotificationCenterModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
      />

      <AppearanceModal isOpen={appearanceModalOpen} onClose={() => setAppearanceModalOpen(false)} />

      {/* Mandatory Onboarding & Account Balances Setup Wizard */}
      <OnboardingModal
        isOpen={onboardingModalOpen}
        isMandatory={isMandatoryOnboarding}
        onClose={handleCloseOnboarding}
      />
    </div>
  )
}



